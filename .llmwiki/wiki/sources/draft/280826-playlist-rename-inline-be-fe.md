---
type: draft
title: Doi ten playlist inline - hover hien icon but, click de sua tai cho
status: proposed
tags: [feature, playlists, ui, be-fe]
timestamp: 2026-08-28
---

# 280826-playlist-rename-inline-be-fe
**Type:** draft
**Status:** proposed
**Tags:** feature, playlists, ui, be-fe
**Proposed:** 2026-08-28
**Sequence diagram:** [html/280826-playlist-rename-inline-be-fe-seq.html](../../../html/280826-playlist-rename-inline-be-fe-seq.html)

## What
Ở trang chi tiết playlist, hover vào tên playlist (`<h1 className="hero-title">`) hiện icon cây bút; bấm vào icon chuyển tên sang ô input để sửa tại chỗ (inline rename), Enter/blur để lưu, Esc để huỷ.

## Affected
| File / Symbol | Thay đổi |
|---|---|
| `backend/internal/api/playlists.go` | Thêm handler `renamePlaylist` (PATCH), gọi `verifyOwnerPassword` sẵn có — **không sửa** hàm đó |
| `backend/internal/api/routes.go` | Thêm route `PATCH /api/playlists/{id}` |
| `frontend/src/api.ts` | Thêm `renamePlaylist(id, name, password?)` |
| `frontend/src/pages/PlaylistsPage.tsx` | Thay `<h1 className="hero-title">` tĩnh bằng component hover-để-sửa; generalize state modal mật khẩu (hiện chỉ dùng cho delete) để dùng chung cho rename |
| `frontend/src/index.css` | Style hover-reveal cho nút bút + `.hero-title-input` khớp typography `.hero-title` |

## Risks
- Playlist **local** (lưu `localStorage` qua `getLocalPlaylists`/`saveLocalPlaylists`) không đi qua API backend — rename phải rẽ nhánh: local thì sửa thẳng `localStorage`, không cần mật khẩu; server (`is_local: false`) thì phải qua `verifyOwnerPassword` giống hệt delete.
- Modal mật khẩu hiện tại (`showPasswordModal`/`handlePasswordSubmit`) được viết chỉ để phục vụ `proceedDelete` — generalize sai có thể làm hỏng luồng xoá đang chạy tốt. Phải test lại cả 2 luồng (xoá + đổi tên) sau khi sửa.
- Tên rỗng hoặc chỉ toàn khoảng trắng → không được lưu (giữ đúng validate `strings.TrimSpace(...) == ""` đã có ở `createPlaylist`).
- Sau khi đổi tên playlist server thành công, `currentPlaylist` (derive từ `permLists` qua `useQuery`) phải được refresh (`loadLists()`) để tên mới hiện đúng ngay, không chỉ ở local state tạm.

## Global constraints
- Không đụng `verifyOwnerPassword` — chỉ *gọi* hàm này giống 3 handler kia, không sửa định nghĩa (constraint đã ghi nhận từ đợt kanban-notes-upgrade trước).
- Không đụng route/handler xoá (`deletePlaylist`) hay track add/remove (`addTrackToPlaylist`/`removeTrackFromPlaylist`) hiện có.
- Không thêm confirm dialog cho rename — đổi tên không phải thao tác phá huỷ, khác xoá.
- Không đụng `routes.go`/`handler.go`/`db.go`'s `migrate()` ngoài đúng 1 dòng route mới cần thiết.

## Plan
- [x] Task 1: Backend — handler `renamePlaylist` (PATCH /api/playlists/{id}) + wire `routes.go`
- [x] Task 2: `frontend/src/api.ts` — client `renamePlaylist`
- [x] Task 3: `PlaylistsPage.tsx` — component hover-hiện-bút + inline input, rẽ nhánh local/server, generalize password modal cho cả rename lẫn delete
- [x] Task 4: `index.css` — style hover-reveal + input khớp `.hero-title` + verify toàn bộ nhánh (local, server có/không có password cache, tên rỗng, Esc huỷ, xoá vẫn hoạt động bình thường)

## Verified (Playwright, mock API)
- Hover → pencil hiện; click → input; Escape → huỷ, giữ tên cũ.
- Server playlist, chưa cache password: Enter → mở đúng modal mật khẩu dùng chung → xác nhận đúng → PATCH gửi đúng `{name}` + header `X-Owner-Password` → tên mới hiện ngay.
- **Bug phát hiện qua verify, đã sửa:** modal mật khẩu gốc chỉ nằm trong nhánh JSX của list-view return (`if (selectedPlaylistId && currentPlaylist) return (...)` là 1 early-return riêng, không đi qua nhánh chứa modal) — mở modal từ detail-view (nơi rename UI sống) set state đúng nhưng modal không render. Fix: extract modal thành biến `passwordModal` dùng chung, render ở cả 2 nhánh return.
- Regression: xoá playlist server (từ list view) vẫn hoạt động đúng sau khi generalize state.
- Local playlist: rename lưu thẳng `localStorage`, không hiện modal mật khẩu.
- Tên rỗng/toàn khoảng trắng: bị chặn ở FE, giữ nguyên tên cũ.

## Agent Task Assignment
| Task | Agent (CLI) | Lý do chọn | Status |
|------|------|------|------|
| Task 1: Backend `renamePlaylist` + wire route | Claude Code (sonnet) | Chạm `playlists.go` — file có constraint "không đụng verifyOwnerPassword", cần cẩn thận | pending |
| Task 2: `api.ts` client | OpenCode (`opencode/big-pickle`) | Boilerplate client, lặp khuôn `deletePlaylist` | pending |
| Task 3: `PlaylistsPage.tsx` UI + generalize modal | Claude Code (sonnet) | Generalize state dùng chung giữa delete/rename cần judgement để không hỏng luồng xoá đang chạy tốt | pending |
| Task 4: CSS + verify toàn nhánh | Claude Code (sonnet) | Verify phải phủ cả nhánh cũ (delete) lẫn nhánh mới (rename) — cần theo dõi sát | pending |

## Success criteria
- Hover vào tên playlist → icon bút hiện ra (không hiện khi không hover)
- Bấm icon bút → tên chuyển thành input, đã điền sẵn tên hiện tại, focus sẵn
- Playlist local: sửa tên, Enter → lưu ngay vào `localStorage`, không hỏi mật khẩu
- Playlist server: sửa tên, Enter → nếu chưa có mật khẩu cache thì hiện đúng modal mật khẩu hiện có; nhập đúng → lưu, tên mới hiện ngay trên UI
- Nhập tên rỗng/toàn khoảng trắng → không lưu, giữ tên cũ
- Esc khi đang sửa → huỷ, giữ nguyên tên cũ
- Luồng xoá playlist (cả local và server) vẫn hoạt động đúng như trước sau khi generalize state

## Render brief

### Task 1 — Backend `renamePlaylist`
1. *(add)* `PATCH /api/playlists/{id}` — gọi `verifyOwnerPassword(r)` (hàm có sẵn, không sửa); decode body `{name string}`; `strings.TrimSpace` + reject nếu rỗng (400), giống hệt validate của `createPlaylist`.
2. *(add)* `UPDATE playlists SET name=$1 WHERE id=$2`; nếu `RowsAffected==0` → 404 "playlist not found" (theo đúng pattern `deletePlaylist`).
3. *(legacy)* Không đụng `verifyOwnerPassword`, không đụng `deletePlaylist`/`addTrackToPlaylist`/`removeTrackFromPlaylist`.

**Prose:** Handler này cố tình sao chép gần như nguyên khuôn của `deletePlaylist` (verify → lookup by path id → thao tác DB → check `RowsAffected`) và `createPlaylist` (validate tên rỗng bằng `TrimSpace`) thay vì viết logic mới, để không tạo thêm một cách xử lý lỗi khác trong cùng một file — nhất quán quan trọng hơn tối ưu ở một handler nhỏ thế này. Vì `playlists.go` có constraint rõ ràng "không đụng `verifyOwnerPassword`" đã ghi nhận trước đó, handler mới chỉ *gọi* hàm này y hệt 3 handler kia, không chạm vào định nghĩa của nó.

### Task 2 — `frontend/src/api.ts`
1. *(add)* `renamePlaylist(id, name, password?)` — PATCH, header `X-Owner-Password` nếu có `password`, body `{name}`; ném lỗi kèm status code khi `!r.ok`, đúng khuôn `deletePlaylist`.

**Prose:** Sao chép chính xác cấu trúc try/throw của `deletePlaylist` (bao gồm cách đọc lỗi từ `r.text()` khi thất bại) để `PlaylistsPage.tsx` có thể dùng chung logic bắt lỗi 401/412 đã viết sẵn cho luồng xoá (nhận diện sai mật khẩu) mà không cần viết thêm một nhánh catch khác.

### Task 3 — `PlaylistsPage.tsx` UI + generalize state
1. *(add)* Bọc `<h1 className="hero-title">` trong wrapper hover, thêm nút bút (SVG pencil, ẩn mặc định qua CSS, hiện khi hover wrapper); bấm nút → chuyển sang `<input>` autofocus, giá trị khởi tạo = tên hiện tại.
2. *(add)* Local playlist (`is_local`): Enter/blur → cập nhật thẳng `localLists` + `saveLocalPlaylists`, không mật khẩu, không confirm dialog (khác xoá — đổi tên không phải thao tác phá huỷ).
3. *(add)* Server playlist: có mật khẩu cache (`getSessionPassword()`) → gọi `renamePlaylist` thẳng, `loadLists()` refresh; chưa có → mở lại đúng modal mật khẩu hiện có (generalize `deletingId`-only state thành state phân biệt được đang xoá hay đang đổi tên, để `handlePasswordSubmit` gọi đúng hàm tương ứng).
4. *(legacy)* Esc trong lúc sửa → huỷ, không gọi API, khôi phục hiển thị `<h1>` với tên cũ. Luồng xoá (`handleDeleteClick`/`proceedDelete`) giữ nguyên hành vi.

**Prose:** Điểm rủi ro nhất của task này không phải là thêm UI mới (khá cơ học) mà là việc phải *generalize* state modal mật khẩu vốn viết riêng cho xoá — nếu làm ẩu, luồng xoá đang chạy ổn định có thể bị hỏng theo. Cách an toàn nhất là thêm một trường phân biệt hành động (đang xoá hay đang đổi tên) cạnh state cũ thay vì viết lại toàn bộ modal, rồi test lại cả hai luồng sau khi đổi — không tự tin "chắc không sao" mà không verify trực tiếp bằng trình duyệt. Đổi tên không phải hành động phá huỷ nên cố tình không thêm dialog xác nhận như xoá — thêm ma sát không cần thiết cho một thao tác vô hại chỉ làm chậm UX.

### Task 4 — CSS + verify
1. *(add)* `.hero-title-wrap:hover .hero-title-edit-btn { opacity: 1 }` (mặc định opacity 0, transition nhẹ); `.hero-title-input` khớp `font-size: clamp(24px, 5vw, 52px); font-weight: 900` của `.hero-title` để không giật layout khi chuyển qua lại giữa `<h1>` và `<input>`.
2. *(block)* Verify: tên rỗng bị chặn cả 2 phía (input rỗng không cho submit ở FE, backend trả 400 nếu lỡ gọi thẳng); server playlist chưa có password cache → đúng modal hiện lên; sai mật khẩu → báo lỗi giống hệt xoá ("Mật khẩu sai!").
3. *(legacy)* Verify riêng: xoá playlist (cả local và server) vẫn hoạt động đúng như trước khi generalize state ở Task 3.

**Prose:** Input khớp chính xác typography của `<h1>` (cùng `clamp()`, cùng `font-weight`) là chi tiết nhỏ nhưng quan trọng — nếu input dùng font-size cố định hoặc khác weight, chuyển từ xem sang sửa sẽ gây "nhảy" layout (hero image/nút play bên cạnh bị đẩy), phá vỡ cảm giác "sửa tại chỗ" mà tính năng này hướng tới. Verify bắt buộc chạy lại nhánh xoá cũ vì Task 3 đã đụng vào state dùng chung — im lặng bỏ qua bước này là cách phổ biến nhất một thay đổi nhỏ làm hỏng một tính năng khác không liên quan trực tiếp.

## Notes
- Yêu cầu gốc từ user: "tên playlist cho phép edit hover lên hiện hình cái bút edit"
- Liên quan: [[project_kanban-notes-upgrade-inflight]] (constraint không đụng `verifyOwnerPassword` đã ghi trong memory từ trước)

## Origin
- **Draft:** `wiki/sources/draft/280826-playlist-rename-inline-be-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
