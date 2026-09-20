---
type: draft
title: Fix phat chong 2 bai + MediaSession sai track tren iOS
status: proposed
tags: [bugfix, player, audio, ios, race-condition, mediasession, fe]
timestamp: 2026-09-02
---

# 020926-fix-playback-double-audio-mediasession-fe
**Type:** draft
**Status:** proposed
**Tags:** bugfix, player, audio, ios, race-condition, mediasession, fe
**Proposed:** 2026-09-02
**Sequence diagram:** [html/020926-fix-playback-double-audio-mediasession-fe-seq.html](../../../html/020926-fix-playback-double-audio-mediasession-fe-seq.html)

## What
Sửa race condition trong `startTrack()` (`frontend/src/PlayerContext.tsx`) gây 2 triệu chứng: (1) phát chồng 2 bài hát khi chuyển track nhanh, đặc biệt băng qua ranh giới local↔YouTube; (2) MediaSession trên iOS điều khiển sai track, đôi khi pause xong không start lại được. Kèm sửa 1 bug phụ khiến gapless seamless-swap không bao giờ chạy được với track online. Chẩn đoán đầy đủ đã ghi ở [[020926-playback-double-audio-mediasession-diagnosis]] — proposal này chỉ tập trung vào phần fix.

## Affected
| File / Symbol | Thay đổi |
|---|---|
| `frontend/src/PlayerContext.tsx` | Sửa callback `.then()` trong `startTrack` (~dòng 368-390), MediaSession `play` action handler (~dòng 783), thứ tự đọc/xoá `preloadedTrackId.current` |

Không có file nào khác cần đụng — cả 3 phần đều khu trú trong đúng 1 file.

## Những phần KHÔNG được đụng (PlayerContext.tsx dùng chung, nhiều thứ phụ thuộc)

- Cấu trúc dual-audio slot (`audioA`/`audioB`/`audioYT`), cách `getActive()`/`getStandby()` xác định phần tử — không đổi cách xác định, chỉ thêm điều kiện chặn ở đúng chỗ đang thiếu.
- Retry logic mạng trong `onError` (đã đúng từ trước, có sẵn guard) — không đụng, chỉ dùng làm mẫu để copy pattern sang chỗ đang thiếu.
- iOS AudioContext skip (`initAudioCtx`/`isIOS()`) — đã đúng từ lần fix tháng 7, không đụng.
- Lyrics fetch race fix, Last.fm scrobble logic — không liên quan, không đụng.
- Preload look-ahead effects (2 `useEffect` set `standby.src`) — không đổi cách preload được kích hoạt, chỉ đổi cách `preloadedTrackId` được ĐỌC đúng lúc trong `startTrack`.

## Risks

- **Thêm staleness guard có thể bỏ sót đúng lúc user CHỦ ĐỘNG muốn nghe lại track cũ ngay sau khi vừa chuyển đi** (ví dụ bấm prev ngay lập tức) — chấp nhận được vì lúc đó sẽ có một lệnh `startTrack` MỚI cho chính track đó, không phải callback mồ côi của lệnh cũ; guard chỉ chặn callback đã bị bỏ qua, không chặn ý định mới của user.
- **Capture `preloadedTrackId` trước khi gọi async có thể làm swap xảy ra dù ngay sau đó track bị đổi tiếp** (hiếm, do vẫn còn 1 khung thời gian giữa lúc capture và lúc callback chạy) — chấp nhận được vì bản thân staleness guard ở trên đã chặn callback mồ côi không được động vào audio nữa nếu track đã đổi, kể cả trong nhánh seamless-swap.
- **`.catch(console.error)` cho MediaSession play có thể không đủ** nếu nguyên nhân reject là do policy autoplay thật (hiếm, vì action này luôn đến từ gesture người dùng qua lock-screen) — chấp nhận log lỗi ra console thay vì im lặng, không cố tự động retry vì không phải là nguyên nhân chính đang sửa.

## Global constraints

- Không đổi bản chất cơ chế gapless dual-audio, không đổi Media Session metadata/action-handler khác (`pause`, `nexttrack`, `previoustrack`, `seekto`) — chỉ sửa đúng `play`.
- Không đụng backend, không đụng route/handler nào.
- Task 1 (staleness guard, nguyên nhân chính gây phát chồng) làm trước; Task 2 (MediaSession catch) và Task 3 (preloadedTrackId capture) làm sau, đúng thứ tự ưu tiên theo mức độ nghiêm trọng của triệu chứng.

## Plan
- [x] Task 1: Thêm staleness guard vào callback `getOfflineObjectURL().then()` trong `startTrack`
- [x] Task 2: Thêm `.catch()` + chain `setPlaying(true)` đúng lúc cho MediaSession `play` action handler
- [x] Task 3: Sửa thứ tự đọc `preloadedTrackId.current` — capture trước khi gọi async, không đọc lại ref đã bị xoá
- [x] Task 4: Verify — smoke test app load + no regression, xác nhận `tsc` sạch

## Agent Task Assignment
| Task | Agent (CLI) | Lý do chọn | Status |
|------|------|------|------|
| Task 1: Staleness guard trong `startTrack` | Claude Code (sonnet) | Nguyên nhân chính gây phát chồng — cần đúng điều kiện chặn, sai một chút có thể chặn nhầm cả lệnh chuyển bài hợp lệ | done |
| Task 2: `.catch()` cho MediaSession play | Claude Code (sonnet) | File lõi có lịch sử sửa-một-chỗ-hỏng-chỗ-khác — dù thay đổi nhỏ vẫn cần người hiểu hết ngữ cảnh MediaSession sửa | done |
| Task 3: Sửa thứ tự đọc `preloadedTrackId` | Claude Code (sonnet) | Đụng đúng logic gapless seamless-swap — cần hiểu đúng thứ tự microtask/đồng bộ để không lặp lại lỗi tương tự | done |
| Task 4: Verify không regression | Claude Code (sonnet) | File dùng chung nhiều tính năng (gapless, lyrics, MediaSession, Last.fm) — verify cần người hiểu hết phụ thuộc, không giao CLI rẻ | done |

## Verified — và giới hạn thật của lần verify này

- `tsc --noEmit` sạch (chỉ lỗi pre-existing `TrendingChartMode.tsx`, không liên quan).
- Smoke test Playwright: app load, sidebar + player bar render đúng, **0 lỗi JS uncaught** từ thay đổi trong `PlayerContext.tsx`.
- **KHÔNG verify được** (giống đúng giới hạn đã ghi nhận ở lần fix tháng 7 — [[280726-fix-chunk-repeat-ios-background-fe]]): tái hiện chính xác race condition (cửa sổ đua chỉ vài chục ms, cần backend thật đang chạy để stream audio thật + thao tác tay rất nhanh mới lộ ra) và test trên thiết bị iOS thật/simulator (lock-screen MediaSession). Cần user tự xác nhận trên thiết bị thật sau khi deploy: (1) chuyển bài rất nhanh nhiều lần, đặc biệt xen kẽ local↔YouTube, không còn nghe chồng tiếng; (2) trên iPhone/iPad, pause/play qua lock-screen nhiều lần liên tiếp không còn bị kẹt.

## Success criteria
- Chuyển bài rất nhanh nhiều lần liên tiếp (kể cả băng qua ranh giới local↔YouTube) → không còn nghe 2 bài chồng tiếng nhau
- Trên thiết bị/simulator iOS: phát 1 track, pause, play lại nhiều lần liên tiếp → luôn phát lại được, không bị kẹt ở trạng thái "tưởng đang phát nhưng im lặng"
- MediaSession lock-screen luôn hiện đúng track đang thực sự phát, điều khiển play/pause/next/prev đều tác động đúng lên track đó
- Gapless track-swap, lyrics, Last.fm scrobble vẫn hoạt động đúng như trước sau khi sửa
- `tsc --noEmit` sạch (trừ lỗi pre-existing đã biết ở `TrendingChartMode.tsx`)

## Render brief

### Task 1 — Staleness guard trong `startTrack`
1. *(legacy)* Cấu trúc `active`/`standby` xác định qua `activeSlot.current` giữ nguyên, không đổi cách chọn phần tử.
2. *(add)* Ngay đầu callback `.then(offlineUrl => {...})`, thêm kiểm tra: nếu `trackRef.current?.id !== t.id` → return ngay, không đụng gì vào `active`/`standby` (không set `src`, không gọi `.play()`, không đổi `activeSlot`).
3. *(block)* Áp dụng guard này cho CẢ 3 nhánh bên trong callback (offline, seamless-swap, normal-load) — không chỉ nhánh normal-load, vì cả 3 đều có thể là callback mồ côi.

**Prose:** Đây chính là fix cho nguyên nhân gốc của triệu chứng "phát chồng 2 bài". Nguyên tắc đơn giản: một khi track hiện tại (`trackRef.current.id`, luôn được cập nhật đồng bộ ngay khi `startTrack` mới nhất bắt đầu chạy) không còn khớp với track mà callback này đang phục vụ, callback đó đã lỗi thời và không còn quyền chạm vào bất kỳ audio element nào nữa — dù là để phát, để đổi nguồn, hay để đổi slot. Pattern này vốn đã tồn tại đúng trong `onError`'s retry logic; sửa lần này chỉ là mang đúng pattern đã được kiểm chứng đó sang chỗ đang thiếu, không phát minh cơ chế mới.

### Task 2 — `.catch()` cho MediaSession play handler
1. *(legacy)* Metadata, các action handler khác (`pause`, `nexttrack`, `previoustrack`, `seekto`) giữ nguyên không đổi.
2. *(add)* Đổi `() => { active.play(); setPlaying(true) }` thành `() => { active.play().then(() => setPlaying(true)).catch(console.error) }` — chỉ báo "đang phát" sau khi trình duyệt xác nhận `play()` thành công.

**Prose:** Đây là một dòng thay đổi nhỏ nhưng sửa đúng lỗ hổng khiến state UI và thực tế âm thanh lệch nhau — trước đây `setPlaying(true)` chạy vô điều kiện ngay sau khi gọi `play()`, bất kể promise đó có thành công hay không, nên khi `play()` reject (do phần tử bị hỏng bởi race ở Task 1, hoặc bất kỳ lý do nào khác trong tương lai), ứng dụng vẫn tin rằng nó đang phát nhạc. Chain `.then()` để chỉ cập nhật state khi trình duyệt thực sự xác nhận, và `.catch(console.error)` để lỗi không biến mất trong im lặng — khớp đúng pattern mọi lệnh `.play()` khác trong file đã dùng, riêng chỗ này trước đó là ngoại lệ duy nhất.

### Task 3 — Sửa thứ tự đọc `preloadedTrackId.current`
1. *(block)* Trước dòng `getOfflineObjectURL(t.id).then(...)`, thêm `const wasPreloaded = preloadedTrackId.current === t.id` — đọc giá trị NGAY LÚC ĐÓ, trước khi bất kỳ dòng nào khác có cơ hội xoá nó.
2. *(add)* Bên trong callback, thay điều kiện `if (preloadedTrackId.current === t.id)` bằng `if (wasPreloaded)` — dùng giá trị đã chụp thay vì đọc lại ref (lúc này đã luôn là `null` do dòng `preloadedTrackId.current = null` chạy đồng bộ ngay sau khi đăng ký `.then()`).
3. *(legacy)* Dòng `preloadedTrackId.current = null` (đồng bộ, ngay sau khối `if/else` xử lý track) giữ nguyên vị trí — nó vẫn cần chạy để dọn state cho lần preload tiếp theo, chỉ là không còn được ĐỌC LẠI bên trong callback nữa.

**Prose:** Lỗi này thuộc dạng kinh điển của lập trình bất đồng bộ trong JavaScript: một biến được đọc bên trong callback tưởng là "giá trị tại thời điểm gọi hàm", nhưng thực ra là "giá trị tại thời điểm callback thực sự chạy" — và giữa hai thời điểm đó, chính đoạn code đồng bộ ngay sau đã âm thầm đổi giá trị đó. Việc chụp giá trị vào một biến `const` cục bộ trước khi bất kỳ side-effect đồng bộ nào có cơ hội chạy là cách chuẩn để đóng băng đúng "ý định tại thời điểm gọi", tách nó ra khỏi bất kỳ thay đổi nào xảy ra sau đó — dù là do chính hàm này hay do một lệnh gọi khác chen vào.

### Task 4 — Verify không regression
1. *(add)* Test double-audio: chuyển bài liên tục thật nhanh (bấm next nhiều lần dồn dập), đặc biệt xen kẽ giữa track thư viện local và track YouTube — xác nhận không còn nghe chồng 2 nguồn âm thanh.
2. *(add)* Test trên iOS thật hoặc simulator: phát 1 track, khoá màn hình/dùng lock-screen controls để pause rồi play lại nhiều lần liên tiếp — xác nhận luôn phát lại được, lock-screen luôn hiện đúng track đang phát thật.
3. *(block)* Nếu phát hiện regression ở gapless swap, lyrics, hoặc Last.fm scrobble → dừng lại, không merge, quay lại Task 1-3 sửa cho tới khi hết regression.
4. *(legacy)* Xác nhận `onError` retry logic, iOS AudioContext skip không đổi hành vi.

**Prose:** Đúng như đã ghi nhận trong lịch sử fix tháng 7 của chính file này ([[PlayerBugfixes190526]], [[280726-fix-chunk-repeat-ios-background-fe]]) — `PlayerContext.tsx` là file lõi có nhiều tính năng phụ thuộc chồng chéo, và đã từng có tiền lệ "sửa một chỗ hỏng chỗ khác". Bước verify cuối không thể chỉ kiểm tra đúng 2 triệu chứng vừa sửa mà phải chủ động thử lại toàn bộ luồng phụ thuộc khác, đặc biệt vì Task 1 thêm một điều kiện chặn (`return` sớm) vào đúng đường dẫn mà mọi lần chuyển bài online đều đi qua — nếu điều kiện chặn sai một chút, hậu quả không phải là lỗi ồn ào dễ thấy mà là im lặng khó chịu (track không chịu phát), đúng dạng lỗi cần test tay thật kỹ chứ không thể chỉ tin vào type-check.

## Notes
- Yêu cầu gốc từ user: "tôi thấy client đôi khi phát 2 bài hát 1 lúc và thậm chí media controller trên apple không bắt điều khiển đúng track đang phát nên đôi khi pause xong là không start được nữa trên ios, deepcheck lỗi này"
- Chạy qua `/orca-workflow` → `/query` → deepcheck → `/propose`
- Chẩn đoán đầy đủ: [[020926-playback-double-audio-mediasession-diagnosis]]
- Liên quan: [[GaplessPlayback]], [[AudioReliability]], [[PlayerBugfixes190526]], [[280726-fix-chunk-repeat-ios-background-fe]]

## Origin
- **Draft:** `wiki/sources/draft/020926-fix-playback-double-audio-mediasession-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
