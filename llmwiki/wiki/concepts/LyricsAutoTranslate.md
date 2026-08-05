---
title: Lyrics Auto-Translate Detection
date: 2026-08-05
type: concept
tags: [lyrics, translate, i18n, ux, fe]
---

# Lyrics Auto-Translate Detection

## Summary
Tự động bật dịch lời bài hát (nút 🌐 sẵn có) khi phát hiện title/artist/album không phải tiếng Việt, không cần bấm tay. Bật bằng toggle ⚡, mặc định **ON**. Dùng chính endpoint Google Translate đã gọi để dịch lyrics để detect ngôn ngữ — không thêm dependency.

## Backend (`backend/internal/api/lyrics.go`)
- `detectLanguage(text string)` gọi lại `translate_a/single` (cùng endpoint `translateLines()` dùng), đọc `raw[2]` (ngôn ngữ) + `raw[6]` (confidence, best-effort).
- `GET /api/lyrics/detect-language?text=...` — đăng ký TRƯỚC `GET /api/lyrics/{id}` trong `routes.go` (literal path thắng wildcard, Go 1.22+ ServeMux).
- `GET /api/lyrics/{id}/translate` chỉ đọc lyrics đã cache (sidecar/embedded/DB `lyrics_cache`) — **không tự fetch online nếu cache rỗng**. `GET /api/lyrics/{id}` mới là bước warm cache. Test/stress-test phải gọi đúng thứ tự này, nếu không 404 giả sẽ bị hiểu nhầm là data gap.

## Frontend flow
1. `PlayerBar.tsx`: state `autoTranslate`, persist `localStorage['lyrics-auto-translate']`, **mặc định ON** (`!== '0'`, không phải `=== '1'`).
2. `LyricsView.tsx` gọi `onReady(trackId)` đúng lúc lyrics cho track đó thực sự sẵn sàng (cache-hit đồng bộ hoặc fetch xong).
3. `handleLyricsReady()` trong `PlayerBar.tsx`: build `text = title + artist_name + album_title` (lấy trực tiếp từ `track` object, đồng bộ — không chờ `fetchArtistDetail` riêng), gọi `detectLyricsLanguage`, retry 1 lần sau 1s nếu fail, nếu `lang !== 'vi'` → `toggleTranslation()`.
4. Nút ⚡ đặt ở 2 nơi: `.npo-controls` (mobile, luôn hiện) và panel "⋮ Lyric settings" (`.lyrics-tools-panel`, desktop + mobile đều vào được).

## Race conditions đã gặp và fix
| Vấn đề | Nguyên nhân | Fix |
|---|---|---|
| Desktop không thấy nút ⚡ | `.npo-controls` là `display:none` ngoài `@media max-width:640px` — chỉ mobile thấy | Thêm nút ⚡ vào `.lyrics-tools-panel` (không bị gate theo viewport) |
| `onReady` bắn sớm khi đổi bài (cache-hit) | Gọi đồng bộ ngay trong effect `[trackId]`, trước khi `setShowTr(false)` kịp lan tới `trActive` ở parent | `setTimeout(() => onReadyRef.current?.(trackId), 0)` — đẩy sang tick sau |
| Next/track-switch không tự dịch dù bài trước đang dịch | `doFetch()`'s closure bắt `onReady` (=`handleLyricsReady`) tại thời điểm effect chạy — đóng băng `trActive` cũ, dù network trả về sau đó rất lâu | Route qua `onReadyRef.current` (ref pattern, giống `toggleFnRef` đã có sẵn trong file) thay vì gọi tham số `onReady` trực tiếp — luôn dùng bản mới nhất tại thời điểm gọi thật |
| `crypto.randomUUID()` throw ở HTTP thô (NodePort, non-secure context) | API này chỉ tồn tại trong secure context (HTTPS/localhost) | `safeUUID()` fallback trong `PlayerContext.tsx` |

## Verify
- Playwright headless (scratch dir, không thêm dependency vào repo): phát 1 bài tự dịch (32 dòng), bấm Next sang bài khác → 42/42 dòng lyrics có bản dịch tự động, lặp lại ổn định 2 lần.
- Stress test 91 track ngẫu nhiên (script Python, `/api/albums` → sample → `/api/tracks?album_id`): 0 lỗi detect-language, latency max ~1.9s; translate pipeline 33/41 dịch thành công, 8/41 404 xác nhận là thiếu lyrics thật (đã warm cache trước khi test, không phải race).

## Notes
- Liên quan: [[Lyrics]], [[LyricsUI]], [[LyricsReliability]]
- Bug CSS không liên quan phát hiện trong lúc test (đã fix riêng, xem commit `671bf2c`): `.smart-badge--active`/`.collection-badge` dùng `color:#fff` trên `background: var(--purple)` (theme monochrome, `--purple`=`#fff`) — chữ vô hình; `.lyrics-source-dropdown` luôn mở xuống dù panel cha neo sát đáy màn hình.

## Origin
- **Draft:** `wiki/sources/draft/040826-lyrics-auto-translate-fe.md`
- **Commit:** `e53a546` (bản đầu) + `0cf2350` (fix auto-translate không tự bật thực tế: default ON, desktop UI, artist+album detect, race onReady) + `671bf2c` (fix CSS liên quan phát hiện lúc test)
- **Date promoted:** 2026-08-05
