---
type: draft
title: Nghe nhac offline - tai track ve luu tru phia client
status: proposed
tags: [player, offline, cache, pwa, fe]
timestamp: 2026-08-14
---

# 140826-offline-music-download-fe
**Type:** draft
**Status:** implemented — chưa verify runtime qua browser thật (xem "## Thực tế đã làm")
**Tags:** player, offline, cache, pwa, fe
**Proposed:** 2026-08-14
**Sequence diagram:** [html/140826-offline-music-download-fe-seq.html](../../../html/140826-offline-music-download-fe-seq.html)

## Thực tế đã làm (2026-08-16, cả 2 trade-off theo phương án A)
Implement đúng theo 5 task đã duyệt, với 1 điều chỉnh phạm vi so với bản gốc:
- Task 2 **chỉ áp dụng offline-check cho 2 điểm gọi** (`useEffect` khôi phục phiên cũ dòng ~199, và `startTrack()` dòng ~373) thay vì cả 4 điểm đã liệt kê trong bản gốc (bỏ qua 2 effect preload dòng ~650/~677). Lý do: preload là tối ưu băng thông cho track TIẾP THEO, không phải track đang phát — kiểm tra offline ở `startTrack()` đã đủ để đảm bảo đúng tính năng (phát được khi mất mạng); bỏ qua preload chỉ khiến app tải thêm dữ liệu mạng lãng phí nếu track kế tiếp vô tình đã được tải offline, không phải lỗi chức năng. Giữ scope nhỏ hơn theo đúng Simplicity First.
- **Verify bằng Playwright thật (2026-08-16, real Chromium, real IndexedDB — không cần backend):** dựng `vite` dev server thuần frontend (không backend), viết script Playwright tạm dynamic-import thẳng `frontend/src/offlineStore.ts` (module này 0 dependency vào `api.ts`/backend nên test được độc lập hoàn toàn). Kết quả tất cả đúng: `saveOfflineTrack` → `{ok:true}`; `getOfflineTrack` đọc lại đúng `trackId`/`quality`/kích thước+type của blob; `listOfflineTrackIds` chứa đúng track; `getOfflineObjectURL` gọi 2 lần trả **cùng 1 URL** (xác nhận cache hoạt động, không leak blob URL); `deleteOfflineTrack` xong → `getOfflineTrack` trả `null`; track chưa từng tải → `null`, không crash. `pageErrors` rỗng (không có JS exception nào) — 4 dòng console error chỉ là lỗi 500 từ gọi `/api/...` do backend không chạy, đúng như dự đoán, không phải lỗi code mới. Script test + Chromium tải về đều đã dọn sạch sau khi xong (không để lại trong repo).
- **Chưa verify được: tích hợp UI thật trong `PlaylistsPage.tsx` với dữ liệu track thật** (nút bấm → fetch `/stream/{id}` → lưu → phát lại khi DevTools Offline) — phần này cần backend Go thật ở `localhost:8080` nối DB thật để có playlist/track thật để bấm thử. Theo đúng cảnh báo `CLAUDE.md` về không tự ý đụng production DB, tôi không tự khởi động stack đó. Đây là phần duy nhất còn lại cần user tự làm (mở app thật, vào 1 playlist, bấm nút ⬇, DevTools Offline, phát lại) trước khi coi tính năng đã xong hẳn.

## What
Cho phép tải 1 track về lưu trữ ngay trên trình duyệt (IndexedDB, lưu blob audio) để phát lại được khi mất mạng, thay vì luôn phải gọi `streamUrl()` tới backend. Bối cảnh phát sinh: sau khi xem video giải thích kiến trúc Spotify và mapping sang cozyroom (`/fable5` phiên trước), phát hiện cozyroom hiện chỉ có "download" phía server (scraper tải comic, `downloadYoutube` tải video về server) — hoàn toàn chưa có khái niệm client tự lưu audio để nghe offline. App là single-tenant, không có multi-user/auth ([[Cozyroom is single-tenant]]).

## Affected
| File / Symbol | Thay đổi |
|---|---|
| `frontend/src/offlineStore.ts` (mới) | Wrapper IndexedDB: `saveOfflineTrack(trackId, blob, quality)`, `getOfflineTrack(trackId)`, `deleteOfflineTrack(trackId)`, `listOfflineTrackIds()` |
| `frontend/src/PlayerContext.tsx` | `streamUrl()` (dòng 59-69) và các nơi gọi nó (~dòng 199, 373, 650, 677) cần check `getOfflineTrack(trackId)` trước — nếu có, dùng `URL.createObjectURL(blob)` thay vì URL mạng |
| `frontend/src/pages/PlaylistsPage.tsx` | Thêm nút "Tải xuống nghe offline" + icon trạng thái đã tải trên track row |
| `frontend/src/api.ts` | Không cần endpoint backend mới — chỉ `fetch()` thẳng `streamUrl()` hiện có rồi lưu blob |

**Không đổi backend.** Endpoint `GET /stream/{id}` (`handler.go:390`, `http.ServeFile` Range-seekable) đã đủ để tải nguyên file 1 lần cho việc lưu offline — không cần route mới.

**Phạm vi cố tình hẹp:** chỉ làm trên `PlaylistsPage.tsx` (MVP). `SearchPage.tsx` và `AlbumPage.tsx` cũng tự render track row riêng (grep xác nhận không có component `TrackRow` dùng chung — 3 trang tự lặp lại UI), nên thêm nút tải ở cả 3 nơi là việc x3 công sức. Xem bảng Trade-off.

## Risks
- **Service Worker hiện có (`sw2.js`) từng gây blank-page thật** ([[SW blank page postmortem]] — Cloudflare override no-cache header → stale precache). Để tránh lặp lại đúng lớp lỗi đó, thiết kế này **cố tình dùng IndexedDB thuần, không đụng Cache Storage của Service Worker** — 2 cơ chế cache độc lập hoàn toàn, sw2.js giữ nguyên logic hiện tại.
- **Quota trình duyệt có giới hạn** (thường vài trăm MB tới vài GB tuỳ browser/thiết bị). Nếu `saveOfflineTrack` ném `QuotaExceededError` mà không bắt, có thể làm hỏng luồng phát nhạc bình thường đang chạy song song trong cùng tab.
- **`streamUrl()` hiện gắn với cascade fallback chất lượng** (lossless → lossless-clean → 320, xử lý qua `errCode 3/4` trong `PlayerContext.tsx:541-592`) và correlation ID (`client_id`/`attempt_id`) dùng để nhóm log backend. Phát từ blob local phải bỏ qua đúng cascade này (không có gì để "fallback" khi phát từ file đã tải), không được làm hỏng cascade đó cho trường hợp phát online bình thường.
- **File lossless FLAC gốc có thể vài chục MB/bài** — tải nhiều bài chiếm dung lượng đáng kể. Nên cho chọn quality lúc tải (mặc định 320kbps để tiết kiệm), không mặc định tải bản lossless.

## Global constraints
- Không đổi endpoint `GET /stream/{id}` hay logic Range-serving hiện có trong `handler.go` — chỉ thêm 1 bước `fetch()` phía client gọi lại đúng URL đó.
- Không đổi `sw2.js`/Service Worker hiện tại theo bất kỳ hình thức nào — cache offline dùng IndexedDB, cơ chế tách biệt hoàn toàn khỏi vòng đời Service Worker.
- Không thêm dependency ngoài — IndexedDB là Web API chuẩn của trình duyệt, không cần thư viện (`idb`, `dexie`...).
- Không đổi cascade quality-fallback hiện có (`PlayerContext.tsx:541-592`) cho luồng phát online — nhánh offline mới phải hoàn toàn tách biệt, không lồng vào giữa cascade đó.

## Plan
- [ ] Task 1: `frontend/src/offlineStore.ts` mới — IndexedDB object store `offline_tracks` (key=trackId, value={blob, quality, downloadedAt}), 4 hàm CRUD, bọc quota lỗi bằng try/catch trả `{ok:false, reason}` thay vì throw
- [ ] Task 2: `PlayerContext.tsx` — trước khi gọi `streamUrl()`, check `getOfflineTrack(trackId)`; nếu có, phát qua `URL.createObjectURL(blob)`, bỏ qua hoàn toàn nhánh quality-fallback/correlation-ID (không áp dụng cho phát local); nếu không có, giữ nguyên luồng cũ 100%
- [ ] Task 3: `PlaylistsPage.tsx` — nút "Tải xuống" trên mỗi track row: gọi `fetch(streamUrl(trackId, '320'))` → blob → `saveOfflineTrack()`; icon check khi đã tải, nút xoá khi bấm lại
- [ ] Task 4: Xử lý quota — khi `saveOfflineTrack` trả lỗi, hiện thông báo ngắn (không phá UI), không tải tiếp
- [ ] Task 5: Verify — tải 1 track, bật DevTools "Offline", phát lại đúng track đó bằng blob; xoá khỏi offline rồi xác nhận không phát được khi offline; xác nhận luồng phát online (track chưa tải) không bị ảnh hưởng gì; `tsc --noEmit` sạch

## Agent Task Assignment
| Task | Agent (CLI) | Lý do chọn | Status |
|------|------|------|------|
| Task 1: offlineStore.ts | music-engineer | Domain `PlayerContext.tsx`/playback theo bảng persona; là file mới độc lập, thiết kế API cần đúng ngay từ đầu vì Task 2 phụ thuộc vào nó | pending |
| Task 2: PlayerContext.tsx offline-first | music-engineer | Đụng trực tiếp file lõi player + cascade quality-fallback hiện có — rủi ro phá luồng phát online nếu làm sai, cần đúng domain owner | pending |
| Task 3: UI nút tải trên PlaylistsPage | music-engineer | Cùng phiên với Task 1-2 để nhất quán API `offlineStore`, tránh 1 agent khác đoán sai contract | pending |
| Task 4: Xử lý quota | music-engineer | Phần nhỏ, làm liền sau Task 1 vì cùng file `offlineStore.ts` | pending |
| Task 5: Verify | music-engineer | Cần verify bằng nghe nhạc thật + DevTools Offline, không giao CLI rẻ | pending |

## Success criteria
- Tải 1 track → DevTools Application/IndexedDB thấy record `offline_tracks`; bật "Offline" trong DevTools Network, phát lại đúng track đó không có request mạng nào tới `/stream/{id}`.
- Xoá track khỏi offline → phát lại khi offline thất bại đúng như trước khi có tính năng (không giả vờ thành công).
- Track KHÔNG tải offline vẫn phát bình thường qua network — cascade quality-fallback (lossless→lossless-clean→320) không đổi hành vi, verify bằng cách ép lỗi mạng như trước.
- `tsc --noEmit` sạch, sw2.js không có thay đổi nào.

## Trade-off cần user xác nhận (không tự chọn ngầm)
| Quyết định | Phương án A | Phương án B |
|---|---|---|
| Phạm vi trang có nút tải | **Chỉ `PlaylistsPage.tsx`** (MVP, ít việc nhất, đúng Simplicity First) | Cả 3 trang có track row (`PlaylistsPage`, `SearchPage`, `AlbumPage`) — cần refactor trước thành 1 component `TrackRow` dùng chung (việc lớn hơn, ngoài phạm vi ban đầu) |
| Quality mặc định khi tải | **320kbps** (tiết kiệm dung lượng máy user) | Lossless gốc (đúng chất lượng nghe thường ngày nhưng tốn nhiều dung lượng hơn hẳn) |

## Render brief

### Task 1 — offlineStore.ts
1. *(add)* File mới `frontend/src/offlineStore.ts`, mở IndexedDB database `cozyroom-offline` với object store `offline_tracks` (keyPath `trackId`).
2. *(add)* 4 hàm: `saveOfflineTrack(trackId, blob, quality)`, `getOfflineTrack(trackId)` trả `{blob, quality, downloadedAt} | null`, `deleteOfflineTrack(trackId)`, `listOfflineTrackIds()`.
3. *(block)* Mọi thao tác ghi bọc try/catch — `QuotaExceededError` trả `{ok:false, reason:'quota'}` thay vì throw ra ngoài làm crash caller.

**Prose:** Chọn IndexedDB thay vì Cache Storage của Service Worker là quyết định thiết kế quan trọng nhất của cả đề xuất này — không phải vì IndexedDB kỹ thuật tốt hơn, mà vì `sw2.js` hiện tại đã từng là nguyên nhân trực tiếp của một sự cố blank-page thật trên production (Cloudflare override header cache khiến precache cũ bị kẹt). Bất kỳ thay đổi nào vào logic Service Worker đều mang rủi ro tái diễn đúng lớp lỗi đó, trong khi IndexedDB là một cơ chế lưu trữ hoàn toàn tách biệt, không đi qua vòng đời cài đặt/kích hoạt của Service Worker nên không thể vô tình làm hỏng nó.

### Task 2 — PlayerContext.tsx offline-first
1. *(add)* Trước mỗi lời gọi `streamUrl(...)` (các dòng ~199, ~373, ~650, ~677), thêm bước `await getOfflineTrack(trackId)`.
2. *(add)* Nếu có bản offline, gán `audio.src = URL.createObjectURL(blob)`, bỏ qua toàn bộ tham số `q`/`clientId`/`attemptId` — chúng vốn chỉ có ý nghĩa cho request mạng.
3. *(legacy)* Nếu không có bản offline, giữ nguyên 100% code đường cũ (`streamUrl()` + cascade fallback lỗi 3/4 dòng 541-592) — không đổi bất kỳ dòng nào trong nhánh này.

**Prose:** Điểm dễ sai nhất ở task này không phải là thêm nhánh mới, mà là đảm bảo nhánh cũ không bị chạm vào. `PlayerContext.tsx` hiện đã có một cơ chế fallback chất lượng khá tinh vi (thử lossless, nếu lỗi decode thì hạ xuống lossless-clean rồi 320kbps, đồng thời nhớ lại lựa chọn qua `saveQualityOverride`) — cơ chế này chỉ có ý nghĩa khi đang phát qua mạng, vì nó phản ứng với lỗi tải/giải mã theo thời gian thực. Khi phát từ blob đã có sẵn trên máy, không có "tải" hay "giải mã qua mạng" nào để fallback nữa, nên nhánh offline phải rẽ hẳn sang một đường code riêng, ngắn gọn, không cố lồng vào giữa cascade hiện có.

### Task 3 — UI nút tải trên PlaylistsPage
1. *(add)* Trên mỗi track row trong `PlaylistsPage.tsx`, thêm icon nút tải (⬇) cạnh các nút hiện có.
2. *(add)* Bấm → `fetch(streamUrl(trackId, '320'))` → đọc `response.blob()` → `saveOfflineTrack(trackId, blob, '320')` → đổi icon thành ✓ (đã tải).
3. *(add)* Bấm lại vào icon ✓ → `deleteOfflineTrack(trackId)` → icon trở lại ⬇.

**Prose:** Chỉ làm trên `PlaylistsPage.tsx` là một quyết định phạm vi có chủ đích, không phải thiếu sót — grep xác nhận `SearchPage.tsx` và `AlbumPage.tsx` mỗi trang tự render track row riêng, không có component `TrackRow` dùng chung nào trong codebase hiện tại. Thêm nút tải vào cả 3 nơi nghĩa là viết lặp lại 3 lần cùng một logic UI, hoặc phải tách refactor thành component chung trước — cả hai đều là việc lớn hơn nhiều so với yêu cầu gốc "tải nhạc nghe offline". MVP ở đúng 1 trang cho phép kiểm chứng toàn bộ luồng offline hoạt động đúng trước khi quyết định có đáng nhân rộng hay không.

### Task 4 — Xử lý quota
1. *(add)* Khi `saveOfflineTrack` trả `{ok:false, reason:'quota'}`, hiện thông báo ngắn kiểu "Không đủ dung lượng lưu trữ" (dùng đúng pattern toast/thông báo lỗi đang có trong app, không tự chế mới).
2. *(block)* Không để lỗi này làm gián đoạn track đang phát hoặc bất kỳ thao tác nào khác trong `PlaylistsPage.tsx`.

**Prose:** Quota trình duyệt là giới hạn thật, không phải trường hợp lý thuyết — người dùng tải nhiều album lossless liên tục hoàn toàn có thể chạm giới hạn vài trăm MB của một số trình duyệt di động. Việc bọc lỗi này ngay từ Task 1 (thay vì để nó rơi ra ngoài rồi mới vá) là cách tránh đúng loại lỗi "tưởng đã tải xong nhưng thực ra không" — nếu không xử lý, người dùng có thể tưởng nhầm một track đã sẵn sàng offline trong khi thực tế `saveOfflineTrack` đã âm thầm thất bại.

### Task 5 — Verify
1. *(add)* Tải 1 track qua nút mới, mở DevTools → Application → IndexedDB → xác nhận record tồn tại trong `offline_tracks`.
2. *(add)* Bật DevTools Network → Offline, phát lại đúng track đó → phát được, không có request `/stream/{id}` nào trong Network tab.
3. *(add)* Xoá track khỏi offline, thử phát lại khi vẫn đang Offline → phát thất bại đúng như hành vi trước khi có tính năng (không có ảo giác "vẫn phát được" do cache trình duyệt khác).
4. *(block)* Tắt Offline, phát 1 track KHÁC (chưa từng tải) → xác nhận cascade quality-fallback cũ (lossless→lossless-clean→320) vẫn hoạt động y hệt trước, không bị nhánh mới ảnh hưởng.
5. *(block)* `tsc --noEmit` sạch, không có thay đổi nào trong `frontend/dev-dist/sw.js`/service worker.

**Prose:** Phép thử quan trọng nhất ở đây không phải là "tải xong nghe được offline" (phần dễ), mà là xác nhận âm tính: track không tải vẫn phát bình thường qua mạng, và track đã xoá khỏi offline thật sự không phát được khi mất mạng — hai điều này chứng minh nhánh mới không vô tình che giấu lỗi mạng thật hoặc tạo ảo giác dữ liệu tồn tại khi nó đã bị xoá.

## Notes
- Phát sinh từ phiên `/fable5` trước: mapping video "Giải thích kiến trúc Spotify" (YouTube, transcript lấy qua yt-dlp) sang kiến trúc cozyroom — 3 ý đề xuất, 2/3 hoá ra không cần làm (quality-fallback đã có sẵn trong `PlayerContext.tsx`; A/B test + guardrail metric không áp dụng được vì app single-tenant). Ý còn lại (offline storage tier) là gap thật duy nhất, đã xác minh bằng grep (không có Cache API/IndexedDB nào ở client, "download" hiện tại toàn bộ là server-side).
- Liên quan: [[SW blank page postmortem]], [[Cozyroom is single-tenant]]

## Origin
- **Draft:** `wiki/sources/draft/140826-offline-music-download-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
