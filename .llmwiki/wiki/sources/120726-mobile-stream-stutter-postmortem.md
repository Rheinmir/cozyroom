---
type: source
title: "Postmortem: mobile playback stutter — live ffmpeg transcode chậm, không cache, không seek"
status: fixed
tags: [postmortem, streaming, transcode, mobile, performance, gapless]
timestamp: 2026-07-12
---

# 120726-mobile-stream-stutter-postmortem
**Type:** source
**Status:** fixed, verified trên production
**Tags:** postmortem, streaming, transcode, mobile, performance
**Date:** 2026-07-12

## Triệu chứng
User báo "cà giật cái chunk nhạc loop trên điện thoại", UI mobile performance tệ. Đính kèm feedback từ `/debug` (Request Log): `Max latency 10.51s`, câu hỏi "check duration sao mà mắc thế".

## Chẩn đoán

Lấy dữ liệu thật từ `/api/debug/requests` (ring buffer 500 request gần nhất):
```
13188ms  200  GET  /stream/{id}
12492ms  200  GET  /stream/{id}
11654ms  200  GET  /stream/{id}
10505ms  200  GET  /stream/{id}
 7388ms  200  GET  /stream/{id}
 6009ms  200  GET  /stream/{id}
 5905ms  200  GET  /stream/{id}   ← 11s trước, đúng lúc user chụp ảnh xác nhận đang giật
```
5+ lần chậm bất thường trong ~17 phút quan sát — không phải hiếm gặp, đang diễn ra liên tục.

**Chuỗi nguyên nhân:**
1. `/stream/{id}` có 3 nhánh (`handler.go`): passthrough file thô (`http.ServeFile`, có Range) hoặc transcode ffmpeg live theo `?q=320` (MP3) / `?q=lossless-clean` (FLAC re-mux, xử lý file gốc bị lỗi metadata/mixed mono-stereo — xem comment trong `transcode.go`).
2. Hai nhánh transcode dùng `cmd.Run()` — **chặn đồng bộ tới khi ffmpeg giải mã + mã hoá xong toàn bộ bài hát**, không hỗ trợ HTTP Range (không seek được).
3. `ToMP3_320` bọc thêm `bufio.Writer` 256KB (~6.4 giây âm thanh 320kbps) — dữ liệu không chảy ra client cho tới khi buffer đầy hoặc file xong, cộng thêm độ trễ bắt đầu phát.
4. Frontend không chủ động detect codec hỗ trợ — dựa vào cascade thử-sai phản ứng (`lossless` → lỗi → `lossless-clean` → lỗi → `320`). Khi cascade chạm `320`, code cũ gọi `setQuality('320')` **toàn cục** — một file lỗi làm mọi bài hát sau đó trong phiên đều bị hạ xuống transcode chậm, kể cả bài vốn phát tốt ở lossless.
5. Gapless preload (`PRELOAD_LOOK_AHEAD_S = 30`) dùng chung quality đang active — khi quality đã kẹt ở `320`, preload bài kế tiếp cũng phải chờ transcode chậm y hệt; nếu backend đang bận (cron enrich, HLS video transcode, YouTube download — cùng chia sẻ 1 pod `replicas:1`), transcode không kịp trong 30s → giật đúng lúc chuyển bài.

## Fix

**Backend** (`backend/internal/transcode/cache.go` mới, `handler.go`, `transcode.go`):
- Cache file transcode ra `/data/transcode-cache/{id}-{quality}.{ext}` — cache hit → `http.ServeFile` (nhanh, Range/seek thật). Cache miss → vừa stream tiến độ cho client vừa ghi file cache (`io.MultiWriter`), rename atomic khi xong.
- Giảm buffer `ToMP3_320` từ 256KB → 32KB (~0.8s thay vì ~6.4s trước khi byte đầu tiên tới client).
- Thêm `flushWriter` flush sau mỗi lần ghi — dữ liệu chảy tới client ngay khi ffmpeg sản xuất, không đợi buffer Go.
- Cron dọn cache mỗi giờ (`transcode.CleanupCache`), giới hạn `TRANSCODE_CACHE_MAX_MB` (mặc định 5000), xoá LRU theo mtime; luôn dọn file `.tmp` mồ côi từ encode bị kill giữa chừng.

**Frontend** (`frontend/src/PlayerContext.tsx`):
- Thêm bộ nhớ quality **theo từng track** (`localStorage hs-track-quality-overrides`, cap 300 entry) thay vì global — track nào từng cần fallback xuống `lossless-clean`/`320` thì nhớ riêng, không còn kéo tụt mọi bài khác trong phiên.
- Bỏ `setQuality('320')` toàn cục trong cascade lỗi.
- Mọi điểm gọi `streamUrl` (start track, preload gapless, restore session) đi qua `resolveQuality(trackId, fallback)` để ưu tiên override đã biết.

## Verify (production, sau deploy)

| | TTFB | Total | Header |
|---|---|---|---|
| Cache miss (track mới) | **0.67s** | 16.7s | `X-Cache: miss` |
| Cache hit (track vừa transcode) | **0.20s** | 11.3s | `X-Cache: hit`, `Accept-Ranges: bytes` |

Cache file xác nhận ghi đúng trên pod (`44b074cbb16b3880-320.mp3`, 7.9MB, không có `.tmp` sót lại). `go build`/`go vet`/`go test` và `tsc --noEmit` sạch trước khi deploy.

## Không làm trong lần này
- Chưa dùng `singleflight` dedupe 2 request đồng thời cùng track+quality chưa cache (race hiếm, chấp nhận double-transcode nếu xảy ra) — có thể thêm sau nếu số liệu cho thấy cần.
- Chưa xét kịch bản chuyển sang mobile app native — fix nằm ở tầng HTTP API, dùng chung cho mọi client tương lai.

## Related
- [[GaplessPlayback]] — kiến trúc dual-audio preloading gốc
- [[CozyArchitecture]] — `proxy_buffering off` ở nginx sidecar, tiền đề để flush hoạt động tới client
- Backend vẫn `replicas:1` (SPOF đã ghi trong [[100726-ha-decisions-proscons]]) — nguồn gốc contention CPU khiến transcode thỉnh thoảng rất chậm

## Origin
- **Source:** user báo lỗi trực tiếp 2026-07-12 kèm ảnh chụp Now Playing (320K, giật tại 3:14/4:42) + Design Feedback trên `/debug`
- **Commit:** _(sẽ điền khi commit)_
