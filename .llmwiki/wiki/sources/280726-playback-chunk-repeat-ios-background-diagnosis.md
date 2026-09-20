---
type: source
title: Chan doan hop nhat chunk lap va khong chay nen iOS
status: diagnosed
tags: [player, audio, ios, background-playback, retry-logic, diagnosis]
timestamp: 2026-07-28
---

# 280726-playback-chunk-repeat-ios-background-diagnosis
**Type:** source
**Status:** diagnosed — chưa fix, chờ `/propose`
**Tags:** player, audio, ios, background-playback, retry-logic
**Date:** 2026-07-28

## Triệu chứng (user báo, 2 phiên liên tiếp)

1. Nghe nhạc trên iPad, app không được nhận diện là "web phát nhạc chạy nền" — im tiếng khi khoá màn hình/chuyển tab.
2. Chunk (đoạn ngắn) của bài hát bị lặp liên tục — **thường xuyên trên iPad, hiếm trên macOS nhưng vẫn có, không xảy ra với track YouTube (`audioYT`), chỉ xảy ra với track thư viện local (`audioA`/`audioB`)**.

## Chẩn đoán — 2 nguyên nhân độc lập, cùng khu trú ở nhánh audioA/audioB

### Nguyên nhân 1 — AudioContext route qua visualizer (chỉ giải thích #1)

`PlayerContext.tsx` dòng ~186-206 (`initAudioCtx`): cả `audioA` và `audioB` bị `createMediaElementSource()` route qua một `AnalyserNode` dùng chung rồi mới ra `ctx.destination`. Đây là **quyết định chủ đích** từ đề xuất gốc [[GaplessPlayback]] (2026-05-10, commit `9dc66bd`): "Update `initAudioCtx` to create `MediaElementSource` for *both* audio objects and route them to the same `AnalyserNode`, ensuring the visualizer works continuously across track swaps." — mục tiêu là giữ visualizer mượt qua lúc swap track trong hệ gapless dual-audio.

Tác dụng phụ không lường trước: một khi audio bị Web Audio API "sở hữu", iOS không còn áp dụng ngoại lệ chạy-nền dành cho `<audio>`/Media Session nữa — `AudioContext` bị hệ điều hành tự suspend khi khoá màn hình, dù Media Session API đã được cấu hình đúng (metadata + action handlers, xác nhận có trong code, dòng ~653-680).

`audioYT` (track YouTube) không đi qua AudioContext — phát trực tiếp — không gặp vấn đề này.

### Nguyên nhân 2 — Retry-từ-currentPos khi lỗi mạng (giải thích #2, độc lập với #1)

`PlayerContext.tsx` dòng ~426-446 (`onError`, `MEDIA_ERR_NETWORK` code 2): khi gặp lỗi mạng, code reload `src` rồi `el.currentTime = currentPos; el.play()`, lặp tối đa 3 lần. Logic này đến từ [[AudioReliability]] (2026-05-12, commit `25c1af5`) — vốn được thêm để **giải quyết một vấn đề khác** ("mất tiếng giữa chừng, im lặng hoàn toàn"), không phải để tối ưu trải nghiệm resume.

Bằng chứng đây là nguyên nhân #2 (không phải AudioContext): triệu chứng xảy ra **cả trên macOS** — nơi Safari/Chrome desktop không suspend AudioContext khi tab vẫn foreground đang phát nhạc, nên nguyên nhân 1 không áp dụng. Tần suất tỉ lệ thuận với độ chập chờn mạng: iPad (WiFi di động) chập chờn nhiều hơn Mac (thường ổn định hơn) → khớp chính xác "thường xuyên trên iPad, hiếm trên macOS nhưng vẫn có".

## Vì sao chỉ audioA/audioB dính, audioYT không dính

`startTrack()`: track YouTube phát qua `audioYT.current.play()` trực tiếp, không qua `initAudioCtx()`, không qua logic swap-slot gapless. Track local bắt buộc qua `audioA`/`audioB` — dính cả 2 lớp phức tạp (AudioContext + gapless slot-swap state) mà YouTube hoàn toàn tránh được.

## Kết luận

2 lỗi tách biệt, sửa độc lập được:
- Chạy nền iOS ↔ cách visualizer route audio qua AudioContext
- Chunk lặp ↔ retry logic khi lỗi mạng, không liên quan AudioContext

## Related
- [[GaplessPlayback]] — nguồn gốc quyết định route AudioContext qua cả 2 audio object
- [[AudioReliability]] — nguồn gốc retry logic MEDIA_ERR_NETWORK
- [[PlayerBugfixes190526]] — lịch sử các bug khác cùng hệ gapless dual-audio (duration 0:00, lyrics race)
- [[120726-mobile-stream-stutter-postmortem]] — bug stutter khác đã fix (transcode cache), không phải cùng nguyên nhân với 2 lỗi này

## Origin
- **Source:** Hội thoại user báo lỗi trực tiếp 2026-07-28, đối chiếu với 3 tài liệu wiki đã có ([[GaplessPlayback]], [[AudioReliability]], [[PlayerBugfixes190526]])
- **Commit:** _(không áp dụng — đây là chẩn đoán, chưa có code fix)_
