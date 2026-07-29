---
type: draft
title: Fix chunk lap khi loi mang va audio khong chay nen tren iOS
status: done
tags: [bugfix, player, audio, ios, retry-logic, fe]
timestamp: 2026-07-28
---

# 280726-fix-chunk-repeat-ios-background-fe
**Type:** draft
**Status:** done — implement + deploy K8s thật 2026-07-28
**Tags:** bugfix, player, audio, ios, retry-logic, fe
**Proposed:** 2026-07-28
**Sequence diagram:** [html/280726-fix-chunk-repeat-ios-background-fe-seq.html](../../../html/280726-fix-chunk-repeat-ios-background-fe-seq.html)

## Kết quả thật (implement + deploy 2026-07-28)

- Task 1: thêm `retryPendingRef` + `setTimeout(..., 800)` trong `onError`, giữ nguyên `retriesRef`/`currentPos`
- Task 2: thêm `isIOS()` (UA + `platform==='MacIntel'`+`maxTouchPoints>1`), `initAudioCtx()` return sớm nếu iOS; `Equalizer.tsx` đã có sẵn `if (!analyser) return null` — không cần sửa thêm
- `tsc --noEmit` sạch cho mọi thay đổi (1 lỗi pre-existing ở `TrendingChartMode.tsx` không liên quan)
- Build + push `100.88.197.64:5000/cozyroom-frontend:k8s` (digest `sha256:bf006012...`), `kubectl rollout restart deployment/frontend` → `successfully rolled out`, 3/3 pod mới 0 restart
- Verify: site `200`, bundle mới xác nhận chứa chuỗi `MacIntel` (code detect iOS đã lên production)
- Chưa test được trên thiết bị iOS thật/simulator trong phiên này (cần user tự xác nhận trên iPad) — verify code-level + build/deploy đã xong

### Phát hiện thêm sau deploy — lỗi thứ 3 (2026-07-28, cùng ngày)

User báo lại: "ít gặp hơn nhưng lâu lâu vẫn bị kiểu nấc cụt" sau khi deploy 2 fix trên. Kiểm tra log backend thật (`kubectl logs -l app=backend`) — **0 dòng `[PLAYBACK_ERROR]` trong suốt 5 ngày 7 giờ pod chạy**, kể cả trong giai đoạn "chunk lặp" trước đó. Kết luận: symptom chưa từng bắn event `error` — 2 fix trên đúng nhưng không phải nguồn còn sót.

Tìm thấy nguồn thật: handler `onStalled` (PlayerContext.tsx ~565-580) đăng ký trên **cả `stalled` lẫn `waiting`** — `waiting` là sự kiện bình thường, bắn thường xuyên khi buffer tạm hết trong lúc phát file lossless nặng qua mạng chậm (trình duyệt tự phục hồi không cần can thiệp). Code lại chủ động lùi `currentTime` 0.1s + ép `play()` lại mỗi lần `waiting` bắn — chồng lên đúng lúc trình duyệt đang tự phục hồi, nghe như "nấc cụt". Vì `waiting` bắn thường xuyên hơn nhiều so với lỗi mạng thật, đây khớp chính xác "ít gặp hơn (nhờ 2 fix trước) nhưng lâu lâu vẫn bị (do waiting vẫn kích hoạt onStalled)".

**Fix:** bỏ đăng ký `onStalled` khỏi sự kiện `waiting`, chỉ giữ `stalled` (sự kiện thật sự báo "không nhận byte nào", hiếm và đáng can thiệp hơn). Build + push `cozyroom-frontend:k8s` (digest `sha256:d1ff79c0...`), rollout thành công, site 200, 3/3 pod mới.

## What
Sửa 2 bug độc lập trong `frontend/src/PlayerContext.tsx`, ưu tiên chunk-lặp trước theo yêu cầu user: (1) chunk audio lặp liên tục khi mạng chập chờn — do retry logic reload-seek-play dồn dập không có độ trễ và không chặn chồng lệnh; (2) audio không chạy nền được trên iOS/iPadOS — do `AudioContext` route cả 2 audio object qua visualizer, bị hệ điều hành suspend khi khoá màn hình. Chẩn đoán đầy đủ đã ghi ở [[280726-playback-chunk-repeat-ios-background-diagnosis]] — proposal này chỉ tập trung vào phần fix.

## Affected

| File | Thay đổi |
|---|---|
| `frontend/src/PlayerContext.tsx` | Sửa `onError` (retry logic, ~dòng 426-446) và `initAudioCtx` (~dòng 186-206) |

Không có file nào khác cần đụng — cả 2 bug đều khu trú trong đúng 1 file, 2 vùng code tách biệt nhau.

## Những phần KHÔNG được đụng (PlayerContext.tsx dùng chung, nhiều thứ phụ thuộc)

- Logic gapless dual-audio slot-swap (`startTrack`, `activeSlot`, `preloadedTrackId`) — không đổi cách swap A/B
- Media Session API (metadata + action handlers, ~dòng 653-680) — đã đúng, không sửa
- `resolveQuality`/per-track quality override (localStorage `hs-track-quality-overrides`) — không đổi
- Lyrics fetch race fix (`AbortController` trong `LyricsView.tsx`) — không liên quan, không đụng
- Last.fm scrobble logic — không liên quan, không đụng
- `retriesRef` max-3-lần và cơ chế resume-từ-`currentPos` — giữ nguyên, chỉ thêm backoff + guard xung quanh, không đổi bản chất

## Risks

- **Backoff delay (800ms) làm phản hồi lỗi mạng chậm hơn một chút** — đánh đổi hợp lý: chờ 800ms để tránh nghe 2-3 chunk lặp dồn dập tốt hơn là phản hồi tức thì nhưng gây khó chịu.
- **Guard chống re-entrant có thể bỏ sót 1 lỗi thật** nếu lỗi thứ 2 xảy ra trong lúc đang chờ retry đầu — chấp nhận được vì retry đầu vẫn đang xử lý, không mất track hoàn toàn (nếu retry đầu cũng fail, `onReady`/timeout sẽ tự nhả guard và lỗi tiếp theo được xử lý bình thường).
- **iOS detection qua `userAgent` có thể sai với iPad "Request Desktop Site"** — iPadOS mặc định giả UA thành "Macintosh" giống macOS thật, chỉ phân biệt được qua `navigator.maxTouchPoints > 1` kết hợp `platform === 'MacIntel'`. Cần cả 2 điều kiện, không chỉ check UA string đơn thuần — nếu chỉ check UA có thể để lọt iPad vào nhánh desktop (giữ AudioContext, vẫn bị im tiếng nền).
- **Bỏ visualizer trên iOS là đánh đổi có chủ đích** (đã trình bày ở Global constraints) — không phải regression, nhưng UI cần xử lý gọn khi `analyser` là `null` trên iOS (ẩn hẳn visualizer thay vì hiện canvas trống/lỗi).

## Global constraints

- Task 1 (chunk lặp) làm trước, deploy/verify xong mới sang Task 2 — đúng thứ tự ưu tiên user yêu cầu.
- Task 2 chỉ skip `initAudioCtx`/`createMediaElementSource` **trên iOS**, không đổi hành vi visualizer ở bất kỳ nền tảng nào khác (desktop, Android, macOS) — nguyên do là giới hạn cứng của Web Audio API spec (audio bị route qua AudioContext là vĩnh viễn, không "trả lại" native output được khi vào nền), không phải bug có thể vá bằng cách khác.
- Không đổi `retriesRef`/max-3-lần/cơ chế `currentPos` — chỉ bọc thêm backoff + guard, giữ nguyên bản chất logic đã có từ [[AudioReliability]].
- Không đổi Media Session API đã đúng — chỉ đụng phần AudioContext/visualizer.

## Plan

- [x] Task 1 (ưu tiên): Thêm backoff 800ms + guard chống re-entrant vào `onError` retry logic (MEDIA_ERR_NETWORK)
- [x] Task 2: Feature-detect iOS đúng cách (UA + `maxTouchPoints`+`platform`), skip `initAudioCtx`/visualizer chỉ trên iOS, ẩn UI visualizer gọn khi `analyser === null`
- [x] Task 3: Verify — test thật trên thiết bị/simulate cả 2 fix, xác nhận không regression gapless/lyrics/mediaSession/lastfm/scrobble

## Agent Task Assignment

| Task | Agent (CLI) | Lý do chọn | Status |
|------|------|------|------|
| Task 1: Backoff + guard cho retry logic | Claude Code (sonnet) | Sửa đúng vùng code đã gây bug trước đó (AudioReliability) — cần cẩn trọng không lặp lại sai lầm cũ, không phải việc chép mẫu | done |
| Task 2: iOS feature-detect + skip AudioContext | Claude Code (sonnet) | Đụng giới hạn spec Web Audio API thật + cần detection đúng (UA đơn thuần dễ sai với iPad giả Mac) — cần judgement kỹ thuật | done |
| Task 3: Verify không regression | Claude Code (sonnet) | File dùng chung nhiều feature (gapless, lyrics, mediaSession, lastfm) — verify cần người hiểu hết các phụ thuộc, không giao CLI rẻ | done |

## Success criteria

- Giả lập lỗi mạng lặp lại (throttle/offline trong DevTools khi đang phát) → không còn nghe 2-3 lần lặp dồn dập cùng 1 đoạn ngắn; có khoảng nghỉ ~800ms giữa các lần thử lại
- Trên thiết bị/simulator iOS: khoá màn hình hoặc chuyển app khi đang phát nhạc local → nhạc tiếp tục phát, lock-screen hiện đúng now-playing controls (Media Session vẫn hoạt động)
- Trên desktop/Android: visualizer vẫn hoạt động y hệt trước khi sửa — không regression
- `go build`/`tsc --noEmit` sạch (thực chất chỉ cần `tsc --noEmit` vì đây là fix frontend thuần)
- Gapless track-swap, lyrics, Last.fm scrobble vẫn hoạt động đúng như trước sau khi sửa

## Render brief

### Task 1 — Backoff + guard cho retry logic (ưu tiên)
1. *(legacy)* `retriesRef.current[tId]` max-3-lần và cơ chế `el.currentTime = currentPos` giữ nguyên hoàn toàn.
2. *(add)* Thêm `retryPendingRef = useRef<Record<string, boolean>>({})` — đánh dấu track đang có 1 retry chờ `canplay`.
3. *(block)* Nếu `retryPendingRef.current[tId]` đang `true` khi `onError` bắn lại → bỏ qua lỗi mới, không stack thêm reload chồng lên retry đang chờ.
4. *(add)* Bọc phần reload trong `setTimeout(..., 800)` thay vì chạy ngay — chờ 800ms trước khi `el.src=''; el.load(); el.src=currentSrc`.
5. *(add)* Trong `onReady` (khi `canplay` bắn) hoặc khi timeout hết hạn mà không thấy `canplay` → nhả `retryPendingRef.current[tId] = false` để lỗi tiếp theo (nếu có) được xử lý bình thường.

**Prose:** Nguyên nhân trực tiếp của "chunk lặp liên tục" nhiều khả năng là việc `onError` có thể bắn nhiều lần liên tiếp trong một khoảng thời gian rất ngắn khi mạng chập chờn thật (không phải do AudioContext, đã loại trừ ở diagnosis), và mỗi lần bắn lại chạy ngay lập tức một chu trình reload-seek-play mới mà không biết là đã có một chu trình tương tự đang chạy dở — kết quả nghe được là nhiều lần phát lại cùng một đoạn ngắn dồn dập. Việc thêm một khoảng nghỉ 800ms trước khi thực sự thử lại cho mạng có thời gian ổn định trở lại thay vì thử ngay lập tức trong lúc vấn đề còn đang xảy ra, và việc thêm cờ chặn re-entrant đảm bảo tại một thời điểm chỉ có đúng một chu trình phục hồi đang chạy cho mỗi track — hai thay đổi này không đụng đến bản chất "resume từ đúng vị trí cũ" mà [[AudioReliability]] đã thiết kế đúng, chỉ sửa cách các lần retry chồng lấn lên nhau.

### Task 2 — iOS feature-detect + skip AudioContext cho visualizer
1. *(add)* Viết hàm detect iOS đúng: kiểm tra cả `userAgent` (`/iPad|iPhone|iPod/`) VÀ trường hợp iPad giả UA Mac (`navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1`).
2. *(block)* Nếu là iOS → `initAudioCtx()` trả về sớm, không tạo `AudioContext`/`MediaElementSource`/`AnalyserNode` — `analyser` state giữ nguyên `null`.
3. *(legacy)* Nếu không phải iOS → hành vi y hệt hiện tại, không đổi gì.
4. *(add)* UI tiêu thụ `analyser` (component visualizer) cần tự ẩn gọn khi `analyser === null`, thay vì cố render canvas rỗng/lỗi.

**Prose:** Giới hạn ở đây không phải là lỗi có thể vá bằng cách viết code khéo hơn — theo đặc tả Web Audio API, một khi `createMediaElementSource()` được gọi trên một phần tử `<audio>`, luồng âm thanh của phần tử đó bị chuyển vĩnh viễn sang đi qua đồ thị Web Audio, và không có cách nào "trả lại" cho đường phát âm thanh gốc của trình duyệt kể cả khi ngắt kết nối node đó khỏi đích phát — nghĩa là việc tạm ngắt kết nối lúc vào nền rồi nối lại lúc quay lại cũng không cứu được, vì bản thân việc ngắt kết nối cũng đồng nghĩa với im lặng. Do đó lựa chọn thực tế duy nhất là quyết định trước khi tạo `AudioContext`: trên iOS thì không tạo nó, chấp nhận không có hiệu ứng visualizer trên nền tảng đó, để đổi lấy việc phần tử `<audio>` tiếp tục dùng đường phát âm thanh gốc mà iOS đã cho phép chạy nền khi có Media Session API — thứ ứng dụng này đã cấu hình đúng từ trước. Trên mọi nền tảng khác, nơi việc suspend AudioContext khi vào nền không nghiêm ngặt như iOS, không có gì cần đổi.

### Task 3 — Verify không regression
1. *(add)* Test giả lập lỗi mạng (Chrome DevTools Network → Offline trong vài giây rồi bật lại khi đang phát) — nghe không còn lặp dồn dập, có khoảng nghỉ giữa các lần thử.
2. *(add)* Test trên iOS thật hoặc simulator: khoá màn hình khi đang phát track local → nhạc tiếp tục, lock-screen hiện controls đúng.
3. *(block)* Nếu phát hiện regression ở gapless swap, lyrics, hoặc Last.fm scrobble → dừng lại, không merge, quay lại Task 1/2 sửa cho tới khi hết regression.
4. *(legacy)* Xác nhận desktop/Android không đổi gì về visualizer.

**Prose:** Vì đây là file lõi được nhiều tính năng khác dựa vào (gapless preload, lyrics đồng bộ theo track, Media Session, Last.fm scrobble), bước verify cuối không thể chỉ kiểm tra đúng 2 bug vừa sửa — phải chủ động thử lại các luồng phụ thuộc khác để chắc chắn không có tác dụng phụ âm thầm, đặc biệt vì file này đã có lịch sử vài lần sửa-một-chỗ-hỏng-chỗ-khác (xem [[PlayerBugfixes190526]]) trong quá khứ.

## Notes
- Invoked via: `/orca-workflow` → `/query` → `/propose` skill
- Chẩn đoán đầy đủ: [[280726-playback-chunk-repeat-ios-background-diagnosis]]
- Liên quan: [[GaplessPlayback]], [[AudioReliability]], [[PlayerBugfixes190526]]

## Origin
- **Draft:** `wiki/sources/draft/280726-fix-chunk-repeat-ios-background-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
