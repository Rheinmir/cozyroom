---
type: source
title: Toàn bộ request khi phát 1 bài nhạc — local library vs YouTube
tags: [playback, streaming, youtube, lastfm, lyrics, sequence-diagram]
timestamp: 2026-08-20
---

# Toàn bộ request khi phát 1 bài nhạc — local library vs YouTube

## What
Sequence diagram + mô tả chi tiết mọi HTTP request xảy ra khi user bấm play 1 bài nhạc, cho 2 luồng: track thư viện local và track YouTube. Đọc trực tiếp source code hiện tại (không suy đoán) — không phải proposal, không có code mới, chỉ là tài liệu hoá hành vi đang chạy thật.

**Diagram:** [html/200826-music-streaming-request-flow.html](../../html/200826-music-streaming-request-flow.html)

## Local track (A)
1. `startTrack()` → check IndexedDB offline trước (client-side) — có file offline thì dừng, không gọi `/stream` nào.
2. `GET /stream/{id}?q=...&client_id=...&attempt_id=...` — Range/transcode.
3. Song song ngay khi track đổi (không chờ bước 2): `POST /api/lastfm/now-playing` (luôn), preload `GET /stream/{nextId}` (trừ repeat=one/shuffle=shuffle), `GET /api/artists/{artist_id}` (nếu có), `GET /api/covers/{album_id}` (2 size), `GET /api/lyrics/{id}` (luôn mounted), `GET /api/smart-queue` (chỉ khi shuffleMode=smart).
4. Sau khi lyrics load: `GET /api/lyrics/detect-language` (nếu autoTranslate on) → chỉ khi lang≠'vi' mới `GET /api/lyrics/{id}/translate`.
5. Ở threshold nghe (duration≥30s AND progress≥min(duration×0.5,240) AND progress≥30): `POST /api/lastfm/scrobble` + `POST /api/tracks/{id}/play`.
6. Lỗi audio → `POST /api/playback/error` + fallback stream quality thấp hơn.

## YouTube track (B)
1. `audioYT.src = "/api/youtube/stream/{videoId}"` — tách biệt hoàn toàn 2 audio element A/B dùng cho local.
2. Backend: cache hit (TTL 4h) → proxy thẳng URL cũ; cache miss → subprocess `yt-dlp -g -f bestaudio` (không phải HTTP call ra ngoài) rồi cache + proxy; URL cache hết hạn giữa lúc proxy → xoá cache, gọi lại `yt-dlp -g` 1 lần.
3. Các effect song song giống local, trừ: `artist_id=''` → không gọi `/api/artists`; `/api/covers/yt:{id}` có nhánh riêng tải `i.ytimg.com`.

## 2 bug phát hiện khi đọc code (chưa fix, chỉ ghi lại để không quên)
- **Xác nhận:** `POST /api/tracks/yt:{id}/play` → 400 vì regex `hexID` (`^[0-9a-f]{16}$`) không khớp `"yt:..."` — lỗi bị `.catch()` nuốt im lặng, track YouTube không bao giờ được record play count, không thông báo.
- **Chưa xác nhận 100%:** `GET /api/smart-queue?track_id=yt:{id}` khả năng cũng 400 vì cùng regex `hexID` — Explore agent không tìm thấy nhánh xử lý riêng cho prefix `yt:` trong handler này, cần test runtime thật trước khi coi là bug chắc chắn.

## Notes
- Liên quan: [[GaplessPlayback]] (preload standby), [[LyricsAutoTranslate]] (detect-language/translate), [[YouTubeIntegration]] (search/stream/download).
- Nếu muốn fix 2 bug trên, cần `propose` riêng vì đụng logic validate ID chung (`hexID` regex dùng ở nhiều handler khác, không chỉ recordPlay/smartQueue).

## Origin
- Đọc trực tiếp: `frontend/src/PlayerContext.tsx`, `frontend/src/components/PlayerBar.tsx`, `frontend/src/components/LyricsView.tsx`, `backend/internal/api/handler.go`, `backend/internal/api/youtube.go`, `backend/internal/api/lastfm.go` (2026-08-20) — không có code mới, không có commit gắn với entry này.
