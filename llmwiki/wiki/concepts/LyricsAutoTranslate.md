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
- Playwright headless (scratch dir, không thêm dependency vào repo):
  - Next: phát "Do It All for You" (tự dịch, 32 dòng) → bấm Next sang "Faded" → 42/42 dòng có bản dịch tự động.
  - Prev (đổi bài thật, bấm trong 3s đầu — xem "Prev vs restart" bên dưới): phát "Faded (Interlude)" → bấm Previous → nhảy về "Faded" → 42/42 dòng có bản dịch tự động.
  - Cả 2 chiều lặp lại ổn định, không có lần nào bị chặn nhầm bởi race `trActive`.
- Stress test 91 track ngẫu nhiên (script Python, `/api/albums` → sample → `/api/tracks?album_id`): 0 lỗi detect-language, latency max ~1.9s; translate pipeline 33/41 dịch thành công, 8/41 404 xác nhận là thiếu lyrics thật (đã warm cache trước khi test, không phải race).

## Prev vs restart (không phải bug)
`prev()` trong `PlayerContext.tsx` có nhánh: nếu bài đang phát đã qua giây thứ 3, bấm Previous chỉ tua về đầu bài ĐANG phát (`active.currentTime = 0`), không đổi bài — giống mọi trình phát nhạc (Spotify...). `track.id` không đổi → không có gì để LyricsView re-detect → auto-translate không chạy lại, đúng như thiết kế. User từng báo "bấm backward không tự detect" — đây chính là nguyên nhân, xác nhận qua đọc code + test, không phải lỗi.

## `sessionStorage` cache dịch có thể bị kẹt state cũ
`handleToggleTranslation()` (`LyricsView.tsx`) cache kết quả dịch vào `sessionStorage['lyr-tr:{trackId}']`, không tự hết hạn (chỉ mất khi đóng tab). Trong lúc debug session này, nhiều báo cáo "bài X không tự dịch" (Heavy Is the Crown, The Last Goodbye, Gods...) hoá ra backend luôn đúng 100% khi test trực tiếp — nghi vấn cuối cùng và được user tự xác nhận: xoá `sessionStorage` (`Object.keys(sessionStorage).filter(k=>k.startsWith('lyr-tr:')).forEach(k=>sessionStorage.removeItem(k))`) thì dịch hiện lại ngay. Kết luận: các báo cáo đó là do state/cache kẹt lại từ những lần test TRƯỚC KHI các fix hôm nay được deploy, không phải bug còn tồn tại trong code hiện tại. Cách chẩn đoán nhanh lần sau: in + xoá `lyr-tr:*` trước khi kết luận là bug.

## Notes
- Liên quan: [[Lyrics]], [[LyricsUI]], [[LyricsReliability]]
- Bug CSS không liên quan phát hiện trong lúc test (đã fix riêng, xem commit `671bf2c`): `.smart-badge--active`/`.collection-badge` dùng `color:#fff` trên `background: var(--purple)` (theme monochrome, `--purple`=`#fff`) — chữ vô hình; `.lyrics-source-dropdown` luôn mở xuống dù panel cha neo sát đáy màn hình.
- Bug không liên quan tìm thấy nhưng CHƯA sửa (theo yêu cầu user, ngoài phạm vi): `lastfmNowPlaying()` (`PlayerContext.tsx`) gọi vô điều kiện mỗi lần đổi bài, không check `connected` trước — user chưa link Last.fm sẽ luôn thấy 401 mỗi lần đổi bài trong console.

## Origin
- **Draft:** `wiki/sources/draft/040826-lyrics-auto-translate-fe.md`
- **Commit:** `e53a546` (bản đầu) + `0cf2350` (fix auto-translate không tự bật thực tế: default ON, desktop UI, artist+album detect, race onReady) + `671bf2c` (fix CSS liên quan phát hiện lúc test)
- **Date promoted:** 2026-08-05
