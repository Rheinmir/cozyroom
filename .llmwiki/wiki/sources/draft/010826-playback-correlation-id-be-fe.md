---
type: draft
title: Correlation ID client_id attempt_id cho luong phat nhac
status: done
tags: [observability, correlation-id, player, be-fe]
timestamp: 2026-08-01
---

# 010826-playback-correlation-id-be-fe
**Type:** draft
**Status:** done — implement + deploy K8s that 2026-08-01
**Tags:** observability, correlation-id, player, be-fe
**Proposed:** 2026-08-01
**Sequence diagram:** [html/010826-playback-correlation-id-be-fe-seq.html](../../../html/010826-playback-correlation-id-be-fe-seq.html)

## Ket qua that (implement + deploy 2026-08-01)

- Task 1: `getClientId()` (localStorage + crypto.randomUUID), `attemptIdRef` sinh moi trong `startTrack()`, `streamUrl()` them 2 tham so optional, cap nhat 4 call site (start, 3 fallback cascade) + POST body `/api/playback/error`
- Task 2: `handler.go` doc `client_id`/`attempt_id` tu query param, dua vao 2 dong log transcode hien co — khong dung lam Prometheus label
- Task 3: `playback.go` them 2 field vao struct nhan JSON + dong log `[PLAYBACK_ERROR]`
- Task 5: fix race preload — tach `preloadedTrackId` (chi set sau `canplay` that) khoi `preloadPendingId` (set dong bo luc bat dau load, dung de chan lap lai), ca 2 preload effect da sua
- `tsc --noEmit`/`go build`/`go vet` sach (1 loi pre-existing TrendingChartMode.tsx khong lien quan)
- Build + push `cozyroom-backend:k8s` (sha256:7a92293b...), `cozyroom-frontend:k8s` (sha256:bd09be31...), rollout thanh cong ca 2, khong pod nao restart ngoai y muon
- Verify that: POST `/api/playback/error` voi client_id=test-client-abc, attempt_id=test-attempt-xyz → log backend hien dung `Client: test-client-abc, Attempt: test-attempt-xyz` — xac nhan co che hoat dong dung tu dau den cuoi
- Task 2 (query-param tren `/stream`) xac nhan doc dung khong loi tren request that (200, cache miss, transcode thanh cong — khong co loi de sinh log so sanh nhung khong gay crash/regression)
- Task 5 verify bang code review + build sach — CHUA tu tay test rapid next/prev tren trinh duyet that, can user xac nhan

## What
Gắn `client_id` (ổn định theo thiết bị/trình duyệt) và `attempt_id` (ổn định theo 1 lần "cố phát 1 bài", giữ nguyên qua mọi lần retry mạng và cascade fallback quality) vào các request thuộc luồng phát nhạc (`/stream/{id}` và `/api/playback/error`), để log backend cho phép khoanh vùng chính xác: thiết bị nào, đang cố phát bài gì, đã thử mấy lần, lỗi ở đâu — dùng cho debug, không phải cơ chế chống trùng side-effect.

## Làm rõ thuật ngữ (quan trọng, tránh nhầm)

User ban đầu gọi đây là "idempotency key". Đã thống nhất lại: đây là **correlation ID / trace ID**, khác bản chất với **idempotency key** thật (thứ vừa dùng cho `EncodeAndCache`/`singleflight` — đảm bảo 1 thao tác ghi dữ liệu dù gọi lại N lần cũng chỉ có đúng 1 hiệu ứng). Ở đây mục đích là **nối các request retry lại với nhau để debug**, không phải chống ghi trùng — `/stream/{id}` vốn đã là GET không có side-effect cần chống trùng.

## Mở rộng phạm vi — race next/prev với preload (phát sinh giữa hội thoại)

User bổ sung: mỗi bài trong **queue** (kể cả bài đang preload ngầm, chưa phát) cũng cần mã riêng, để tránh trường hợp next/prev nhanh khiến dữ liệu bất đồng bộ trả về trễ bị gán nhầm cho bài khác — đúng loại race đã fix ở `LyricsView.tsx` (Bug A, `AbortController`).

**Đã trace code thật để xác nhận chính xác đang an toàn ở đâu, hở ở đâu:**
- `onError` và retry-mạng (đã fix) đã có sẵn guard `if (el !== getActive() || trackRef.current?.id !== tId) return` — next/prev giữa lúc retry đã được xử lý đúng, không cần sửa thêm.
- Dữ liệu audio thô không bị lẫn giữa 2 bài — chỉ có 1 `standby` element, đổi `.src` thì trình duyệt tự huỷ request cũ, không có cơ chế nào áp dụng byte của bài A cho bài B.
- **Lỗ hổng thật tìm thấy:** cả 2 nơi trigger preload (`PlayerContext.tsx` dòng ~593-604 và ~607-621) gán `preloadedTrackId.current = next.track.id` **ngay lập tức, đồng bộ**, không chờ sự kiện `canplay`/`loadedmetadata` xác nhận trình duyệt đã thật sự buffer xong. Hệ quả: `startTrack()`'s "seamless swap" (dòng 317, `if (preloadedTrackId.current === t.id)`) có thể tin standby đã sẵn sàng dù chưa buffer kịp, nếu user next/prev nhanh hơn preload hoàn tất — gây khựng đúng lúc chuyển bài. Đây không hẳn là "map nhầm dữ liệu bài khác", mà là "tin nhầm trạng thái sẵn sàng của đúng bài đó" — cùng họ race-condition, khác biểu hiện.

**Fix bổ sung:** thêm 1 task riêng — chỉ đánh dấu `preloadedTrackId.current` là sẵn sàng SAU khi `canplay` bắn thật trên `standby`, và tại thời điểm đó phải kiểm tra lại `standby.src` vẫn còn tương ứng đúng track đang mong đợi (phòng trường hợp preload đã bị ghi đè bởi 1 next.track.id mới hơn trong lúc chờ).

## Affected

| File | Thay đổi |
|---|---|
| `frontend/src/PlayerContext.tsx` | `getClientId()` helper, `attemptIdRef`, `streamUrl()` thêm 2 tham số optional, cập nhật 4 call site |
| `backend/internal/api/handler.go` | `stream()` đọc `client_id`/`attempt_id` từ query, đưa vào log hiện có |
| `backend/internal/api/playback.go` | `logPlaybackError()` thêm 2 field vào struct + log line |

## Risks

- **Cardinality nổ nếu dùng làm Prometheus label** — `client_id`/`attempt_id` gần như ngẫu nhiên (UUID), mỗi giá trị khác nhau tạo 1 time-series mới trong Prometheus, có thể làm phình bộ nhớ/storage không giới hạn. Bắt buộc: chỉ xuất hiện trong `log.Printf` (plain text log), **không bao giờ** dùng trong `metrics.XxxTotal.WithLabelValues(...)`.
- **`streamUrl()` thêm tham số** — hàm này được gọi ở nhiều nơi trong `PlayerContext.tsx` (preload, gapless swap, retry, fallback); phải làm tham số optional (không bắt buộc truyền) để các call site không cần đổi vẫn hoạt động y hệt cũ.
- **localStorage cho `client_id` có thể bị user xoá/browser riêng tư** — chấp nhận được, chỉ là mất khả năng nối log cũ với thiết bị đó, không ảnh hưởng chức năng phát nhạc.
- **Log tăng độ dài mỗi dòng** — chấp nhận được, đổi lấy khả năng debug tốt hơn nhiều so với hiện tại (0 thông tin thiết bị/lần-thử trong log).

## Global constraints

- Phạm vi CHỈ `/stream/{id}` + `/api/playback/error` — không mở rộng sang API khác trong lần này (Kanban Note, Playlists, v.v. không đụng).
- Tuyệt đối không dùng `client_id`/`attempt_id` làm Prometheus metric label — chỉ trong `log.Printf`.
- Không tạo bảng DB mới — chỉ log-based, không phải hệ thống lưu trữ có cấu trúc.
- Không đổi Media Session, Last.fm scrobble. Riêng logic gapless dual-audio (Task 5) CÓ đụng, nhưng chỉ đúng 1 điểm: thời điểm đánh dấu `preloadedTrackId.current` sẵn sàng — chuyển từ đồng bộ (ngay khi gán `.src`) sang chờ `canplay` thật + kiểm tra lại track mong đợi. Không đổi bất kỳ logic swap/slot nào khác.
- `streamUrl()` phải giữ backward-compatible (tham số mới optional) — call site không cần gắn ID (preload) không bắt buộc sửa.

## Plan

- [x] Task 1: `PlayerContext.tsx` — `getClientId()` (localStorage + `crypto.randomUUID()`), `attemptIdRef` sinh mới mỗi `startTrack()` thật, `streamUrl()` thêm tham số optional, cập nhật 4 call site (start, retry, 2 fallback cascade)
- [x] Task 2: `handler.go` — đọc `client_id`/`attempt_id` từ query param trong `stream()`, thêm vào log hiện có
- [x] Task 3: `playback.go` — thêm 2 field vào struct nhận JSON, thêm vào dòng `[PLAYBACK_ERROR]` log
- [x] Task 4: Verify — build sạch, deploy, giả lập lỗi mạng thật, xác nhận log backend thấy đúng 1 `attempt_id` xuyên suốt các lần retry của cùng 1 bài, không xuất hiện trong bất kỳ Prometheus metric nào
- [x] Task 5: Fix race preload/next-prev — chỉ đánh dấu `preloadedTrackId.current` sẵn sàng sau `canplay` thật trên `standby`, kiểm tra lại `src` vẫn đúng track mong đợi tại thời điểm đó (không đánh dấu sẵn sàng đồng bộ như hiện tại)

## Agent Task Assignment

| Task | Agent (CLI) | Lý do chọn | Status |
|------|------|------|------|
| Task 1: Frontend client_id/attempt_id + streamUrl | Claude Code (sonnet) | Đụng nhiều call site trong file lõi dùng chung, cần đảm bảo attempt_id đúng ngữ nghĩa (giữ nguyên qua retry, mới khi đổi bài thật) — cần judgement | done |
| Task 2: `handler.go` log query param | Claude Code (sonnet) | Cần đảm bảo tuyệt đối không lọt vào Prometheus label — rủi ro thật nếu code ẩu | done |
| Task 3: `playback.go` log field mới | Claude Code (sonnet) | Đụng struct nhận JSON dùng chung, nhỏ nhưng cần nhất quán với Task 1/2 | done |
| Task 4: Verify end-to-end | Claude Code (sonnet) | Cần verify thật bằng cách giả lập lỗi mạng và đọc log thật — không giao CLI rẻ | done |
| Task 5: Fix race preload/next-prev | Claude Code (sonnet) | Đụng đúng logic gapless dual-audio đã có lịch sử nhiều bug tinh vi (xem [[PlayerBugfixes190526]]) — cần judgement cẩn trọng, không phải việc chép mẫu | done |

## Success criteria

- Giả lập lỗi mạng khi đang phát (DevTools offline vài giây) → log backend cho thấy `attempt_id` **giống hệt nhau** across các lần retry/fallback của cùng 1 bài, `client_id` ổn định qua nhiều lần phát khác nhau trên cùng máy
- Đổi sang bài khác → `attempt_id` mới, khác hẳn bài trước
- `curl /metrics` không có bất kỳ label nào chứa giá trị giống UUID của client_id/attempt_id
- `tsc --noEmit`/`go build`/`go vet` sạch, không regression gapless/lyrics/mediaSession/scrobble
- Next/prev liên tục thật nhanh (spam trong vài giây) qua nhiều bài → không có lần chuyển bài nào bị khựng do standby chưa buffer xong đã bị coi là sẵn sàng; gapless swap vẫn mượt như trước ở tốc độ chuyển bài bình thường

## Render brief

### Task 1 — Frontend client_id/attempt_id + streamUrl
1. *(add)* `getClientId()`: đọc từ `localStorage['cozyroom_client_id']`, nếu chưa có thì sinh `crypto.randomUUID()` và lưu lại.
2. *(add)* `attemptIdRef = useRef<string>('')`, gán `crypto.randomUUID()` mới ở đầu `startTrack()` (chỉ khi phát bài thật, không phải preload).
3. *(add)* `streamUrl(trackId, quality, clientId?, attemptId?)` — append `&client_id=...&attempt_id=...` vào query string nếu 2 tham số được truyền.
4. *(add)* Cập nhật 4 call site: `active.src = streamUrl(...)` trong `startTrack`, retry-reload trong `onError` (network), 2 lần fallback (`lossless-clean`, `320`) trong `onError` — tất cả truyền `getClientId()` và `attemptIdRef.current`.
5. *(legacy)* Call site preload (`standby.src = streamUrl(...)`) không cần đổi — tham số optional, không truyền vẫn hoạt động y hệt cũ.

**Prose:** Điểm mấu chốt về mặt ngữ nghĩa là `attempt_id` phải được sinh đúng một lần khi `startTrack()` bắt đầu một bài THẬT SỰ (do user chọn hoặc do hàng đợi tự chuyển bài), rồi giữ nguyên xuyên suốt mọi nỗ lực khôi phục của chính bài đó — bao gồm retry mạng và toàn bộ chuỗi hạ chất lượng lossless→lossless-clean→320 — vì tất cả những nỗ lực đó, xét theo góc nhìn người dùng, đều là "cùng một lần cố phát bài này", chỉ khác nhau ở việc backend xử lý ra sao. Ngược lại, các request preload (chuẩn bị trước bài kế tiếp trong nền) cố tình KHÔNG mang `attempt_id` vì đó chưa phải là một nỗ lực phát nhạc thật của người dùng — nếu preload thất bại âm thầm, khi bài đó thực sự được phát (qua `startTrack`), nó sẽ có `attempt_id` mới của riêng nó, đúng bản chất một nỗ lực mới.

### Task 2 — Backend `handler.go` ghi log correlation
1. *(add)* Trong `stream()`, đọc `clientID := r.URL.Query().Get("client_id")` và `attemptID := r.URL.Query().Get("attempt_id")` — cả hai có thể rỗng nếu client cũ chưa gửi (backward-compatible).
2. *(add)* Đưa `clientID`/`attemptID` vào các dòng `log.Printf` hiện có khi transcode lỗi (`transcode %s: %v` → thêm context).
3. *(block)* **Không bao giờ** đưa 2 giá trị này vào bất kỳ lời gọi `metrics.XxxTotal.WithLabelValues(...)` nào — chỉ log text thuần.

**Prose:** Ranh giới quan trọng nhất trong toàn bộ proposal này nằm ở đây: log text thuần (`log.Printf`) chấp nhận được giá trị cardinality cao tuỳ ý vì nó chỉ là chuỗi ký tự lưu trên đĩa, nhưng Prometheus time-series thì hoàn toàn khác — mỗi tổ hợp giá trị label riêng biệt tạo ra một chuỗi thời gian riêng biệt tồn tại vĩnh viễn trong bộ nhớ cho tới khi hết hạn, và với UUID gần như luôn luôn khác nhau ở mỗi request, việc lỡ tay đưa `client_id`/`attempt_id` vào label sẽ khiến số time-series tăng không giới hạn theo thời gian, sớm hay muộn cũng làm sập hoặc làm chậm nghiêm trọng chính hệ thống Prometheus mà cả phiên trước đã dày công dựng lên.

### Task 3 — Backend `playback.go` log field mới
1. *(add)* Thêm `ClientID string` và `AttemptID string` vào struct `body` nhận JSON trong `logPlaybackError`.
2. *(add)* Đưa 2 field này vào dòng `log.Printf("[PLAYBACK_ERROR] ...")` hiện có.
3. *(legacy)* Không đổi response, không đổi endpoint khác.

**Prose:** Đây là điểm nối quan trọng thứ hai — khi frontend đã tự retry vài lần mà vẫn thất bại hoàn toàn (hết cascade fallback), nó vẫn gọi `/api/playback/error` như từ trước tới giờ; giờ đây dòng log đó sẽ mang theo đúng `attempt_id` đã xuất hiện trong các dòng log `transcode`/stream trước đó của cùng lần thử, cho phép ghép lại toàn bộ câu chuyện của một lần phát nhạc thất bại từ đầu tới cuối chỉ bằng cách lọc log theo một `attempt_id` duy nhất.

### Task 4 — Verify end-to-end
1. *(add)* Giả lập mất mạng vài giây khi đang phát (DevTools Offline), xem log backend.
2. *(block)* Nếu `attempt_id` khác nhau giữa các lần retry của CÙNG 1 bài → sai thiết kế, quay lại Task 1 sửa.
3. *(add)* Đổi bài → xác nhận `attempt_id` đổi, `client_id` giữ nguyên.
4. *(add)* `curl /metrics` — grep không thấy chuỗi giống UUID nào trong tên label.

**Prose:** Bước verify này là bằng chứng sống cho đúng mục đích ban đầu của tính năng — nếu không nhìn thấy cùng một `attempt_id` xuyên suốt nhiều dòng log của các lần retry khác nhau, toàn bộ giá trị debug mà tính năng này hứa hẹn sẽ không tồn tại, nên đây không phải bước kiểm tra hình thức mà là phép thử duy nhất chứng minh thiết kế đúng.

### Task 5 — Fix race preload/next-prev (canplay-gated readiness)
1. *(legacy)* `standby.src = streamUrl(...)` và `standby.load()` gán ngay như cũ — không đổi.
2. *(block)* KHÔNG còn gán `preloadedTrackId.current = next.track.id` ngay lập tức sau `.load()` như hiện tại.
3. *(add)* Đăng ký `standby.addEventListener('canplay', onReady, { once: true })` — trong `onReady`, kiểm tra lại `standby.src` vẫn khớp đúng track đang mong đợi (phòng trường hợp 1 lần preload mới hơn đã ghi đè `.src` trong lúc chờ) trước khi mới thực sự gán `preloadedTrackId.current = next.track.id`.
4. *(legacy)* Nhánh "seamless swap" trong `startTrack` (dòng 317, `if (preloadedTrackId.current === t.id)`) không đổi logic — chỉ là điều kiện đó giờ phản ánh đúng "đã thật sự buffer xong" thay vì "vừa mới bắt đầu tải".

**Prose:** Sự khác biệt cốt lõi ở đây là chuyển từ một niềm tin lạc quan ("vừa gán src xong thì coi như đã sẵn sàng") sang một xác nhận thật từ chính trình duyệt ("`canplay` đã bắn nghĩa là đủ dữ liệu để bắt đầu phát ngay"). Việc kiểm tra lại `standby.src` bên trong `onReady` là bước phòng thủ cần thiết cho đúng kịch bản next/prev nhanh mà user mô tả: nếu trong lúc chờ `canplay` của lần preload thứ nhất, người dùng đã next/prev khiến một lần preload thứ hai ghi đè `.src` của cùng phần tử `standby`, thì `onReady` của lần preload đầu tiên (nếu nó vẫn lỡ bắn ra) phải tự nhận ra `src` không còn khớp với track nó đang chờ nữa và bỏ qua, không đánh dấu sai `preloadedTrackId.current` cho một track không thật sự đã sẵn sàng.

## Notes
- Invoked via: `/orca-workflow` → `/propose` skill (tiếp nối làm rõ thuật ngữ "idempotency" → "correlation ID" trong hội thoại)
- Phạm vi hẹp có chủ đích theo lựa chọn của user — mở rộng sang API khác (playlists, notes...) sẽ là proposal riêng sau này nếu cần
- Liên quan: [[280726-fix-chunk-repeat-ios-background-fe]], [[280726-playback-chunk-repeat-ios-background-diagnosis]]

## Origin
- **Draft:** `wiki/sources/draft/010826-playback-correlation-id-be-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
