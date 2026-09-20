---
type: draft
title: Kanban Quick Note - bang note rieng tu 1 nguoi dung gate bang mat khau owner712002
status: done
tags: [feature, kanban, notes, owner-password, be-fe]
timestamp: 2026-07-23
---

# 230726-kanban-quick-note-be-fe
**Type:** draft
**Status:** done — implement + deploy K8s thật trong phiên 2026-07-23, verify CRUD full lifecycle qua curl trên production
**Tags:** feature, kanban, notes, owner-password, be-fe
**Proposed:** 2026-07-23
**Sequence diagram:** [html/230726-kanban-quick-note-be-fe-seq.html](../../../html/230726-kanban-quick-note-be-fe-seq.html)

## Kết quả thật (implement + deploy 2026-07-23)

Toàn bộ 5 task đã code xong, build + push image + rollout thật lên cluster production (không phải môi trường thử):

- `go build ./...` + `go vet ./...` sạch; `npx tsc --noEmit` sạch cho mọi file mới sửa (1 lỗi TS còn lại ở `TrendingChartMode.tsx` là pre-existing, không liên quan)
- Build & push `100.88.197.64:5000/cozyroom-backend:k8s` (digest `sha256:0a118cf0...`) và `.../cozyroom-frontend:k8s` (digest `sha256:7f883373...`)
- `kubectl rollout restart deployment/backend deployment/frontend -n cozyroom-k8s` → cả 2 `successfully rolled out`, `backend` 1/1 0 restart, `frontend` 3/3 0 restart sau rollout
- Verify gate thật qua `curl`: `GET /api/notes` không kèm `X-Owner-Password` → `401`; kèm đúng `owner712002` → `200 []`
- Verify CRUD full lifecycle thật trên Postgres production: `POST /api/notes` → tạo thành công (`id: edde5672e1d82205`), `GET` thấy lại đúng note, `DELETE` → `204`, `GET` lại → rỗng — dọn sạch để user tự thử từ đầu
- `/notes` route trả `200` qua SPA fallback đúng như các route khác

Không có regression: site chính (`/`) vẫn `200`, không đụng gì tới `verifyOwnerPassword`/`OwnerPassword` gốc.

## What
Thêm một trang Kanban Quick Note riêng tư cho 1 người dùng (owner) — toàn bộ trang bị khoá sau màn hình nhập mật khẩu `owner712002`, không phải chỉ khoá từng thao tác ghi như cơ chế Playlists hiện có. Tái sử dụng đúng pattern xác thực đã tồn tại trong code (`verifyOwnerPassword` ở backend, password modal ở frontend) thay vì dựng cơ chế mới.

## Tiền lệ đã tra cứu (qua `/query`)

- Backend: `backend/internal/api/playlists.go` dòng 19-27 đã có sẵn `const OwnerPassword = "owner712002"` và hàm `verifyOwnerPassword(r *http.Request) bool` (check header `X-Owner-Password` hoặc query `password`) — cùng package `api` nên handler mới gọi thẳng được, không cần export thêm hay import gì mới.
- Frontend: `frontend/src/components/FavoritePill.tsx` dòng ~178-190 đã có sẵn pattern modal nhập mật khẩu, so khớp chuỗi `'owner712002'` phía client, rồi lưu vào state `sessionPassword` trong phiên làm việc để khỏi hỏi lại nhiều lần.
- Khác biệt quan trọng với Playlists: Playlists cho phép XEM công khai, chỉ khoá thao tác GHI. Yêu cầu lần này là khoá **toàn bộ trang** (cả xem lẫn sửa) vì đây là note riêng tư 1 người — nên gate phải chặn ngay khi vào route `/notes`, không đợi tới lúc bấm nút ghi.
- Không có concept "note" hay "kanban" nào tồn tại trong wiki trước đây — đây là tính năng hoàn toàn mới, không đụng dữ liệu/bảng nào có sẵn.
- Đã migrate SQLite → PostgreSQL (`280526-sqlite-to-postgres.md`) — bảng mới phải theo đúng convention Postgres hiện tại: placeholder `$1 $2...`, timestamp dạng `INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)` (khớp `db.go`).

## Affected

| File | Thay đổi |
|---|---|
| `backend/internal/db/db.go` | Thêm migration bảng mới `kanban_notes` |
| `backend/internal/api/notes.go` (mới) | Handlers CRUD + reorder cho kanban note, gọi `verifyOwnerPassword` có sẵn |
| `backend/internal/api/routes.go` | Đăng ký route mới `/api/notes*`, wire `NotesHandlers` |
| `frontend/src/api.ts` | Thêm hàm client `listNotes/createNote/updateNote/moveNote/deleteNote`, đính kèm header `X-Owner-Password` |
| `frontend/src/pages/NotesPage.tsx` (mới) | Màn hình gate mật khẩu (tái dùng pattern modal) + bảng Kanban 3 cột + CRUD card |
| `frontend/src/AppRoutes.tsx` | Thêm route `/notes` |
| `frontend/src/components/Sidebar.tsx` | Thêm mục điều hướng "Notes" |

## Risks

- **Gate chỉ ở client là chưa đủ:** nếu chỉ chặn UI (ẩn nội dung cho tới khi nhập đúng mật khẩu) mà API backend không tự kiểm tra lại, ai cũng có thể gọi thẳng `GET /api/notes` qua curl mà không cần mật khẩu, lộ nội dung note riêng tư. Bắt buộc `verifyOwnerPassword` phải áp dụng cho **cả GET lẫn write**, khác với Playlists (Playlists chỉ áp cho write vì danh sách playlist vốn là public).
- **Mật khẩu là hằng số trong code, gửi qua header mỗi request** — đúng y hệt rủi ro đã tồn tại ở Playlists/Ebook NSFW (không phải rủi ro mới do proposal này tạo ra), chấp nhận được vì đây là app cá nhân dùng nội bộ, không phải sản phẩm nhiều người dùng.
- **Không có thư viện drag-and-drop nào trong `package.json` hiện tại** (đã kiểm tra, không có `@dnd-kit`, `react-beautiful-dnd`, `sortable`...). Cần chọn 1 trong 2 hướng — xem phần "Lựa chọn kéo-thả" bên dưới, không tự chọn ngầm.
- Thêm mục Sidebar mới có thể ảnh hưởng khoảng cách/tràn danh sách điều hướng trên mobile — cần xem lại bằng mắt sau khi thêm (không phải regression logic, chỉ là layout cần verify).

## Lựa chọn kéo-thả (trade-off, không tự chọn ngầm)

| Phương án | Ưu điểm | Nhược điểm |
|---|---|---|
| **A. HTML5 Drag and Drop API gốc** (khuyến nghị cho bản đầu) | Không thêm dependency mới, code ít, đúng tinh thần "quick note" tối giản | Trải nghiệm kéo-thả trên **mobile/touch gần như không hoạt động** nếu không polyfill thêm — app này có hẳn `MobileUI.md` nên đây là điểm cần cân nhắc thật |
| **B. Thêm thư viện nhẹ (`@dnd-kit/core`)** | Hỗ trợ touch/mobile tốt, UX mượt hơn, được duy trì tốt | Thêm ~15-20KB dependency mới — cần lý do rõ ràng để thêm, không phải mặc định |

**Đề xuất:** làm phương án A trước (kéo-thả chuột trên desktop), kèm 2 nút mũi tên "chuyển cột trái/phải" trên mỗi card để **thao tác thay thế trên mobile không cần kéo-thả** — vừa tối giản vừa không bỏ sót mobile. Nếu sau này thấy cần UX kéo-thả mượt trên điện thoại thật, nâng cấp sang B trong proposal riêng.

## Global constraints

- Gate mật khẩu áp dụng cho **mọi** endpoint `/api/notes*` (kể cả GET), không chỉ endpoint ghi — khác quy ước Playlists, vì đây là dữ liệu riêng tư cần giấu hoàn toàn.
- Không thêm bảng/cột nào ngoài `kanban_notes` — không mở rộng sang tag, due-date, multi-board, multi-user ngoài yêu cầu.
- Không thêm dependency npm mới trong bản đầu (đi phương án A ở trên) trừ khi user chọn ngược lại.
- Tái dùng đúng `verifyOwnerPassword`/`OwnerPassword` đã có trong `playlists.go` — không định nghĩa lại hằng số mật khẩu ở file mới.
- Cột kanban cố định (Todo/Doing/Done hoặc tương đương) — không cho user tự tạo/xoá cột trong bản đầu.

## Plan

- [x] Task 1: Migration `db.go` — thêm bảng `kanban_notes` (id, column_key, title, content, position, created_at, updated_at)
- [x] Task 2: Backend `notes.go` — `GET/POST /api/notes`, `PUT /api/notes/{id}` (sửa nội dung + đổi cột/vị trí), `DELETE /api/notes/{id}` — tất cả gọi `verifyOwnerPassword`; wire vào `routes.go`
- [x] Task 3: `frontend/src/api.ts` — hàm client CRUD, tự đính `X-Owner-Password` từ state đã nhập
- [x] Task 4: `frontend/src/pages/NotesPage.tsx` — màn hình gate mật khẩu (tái dùng session key `cozyroom_owner_password` từ FavoritePill) → bảng Kanban 3 cột, thêm/sửa/xoá card, kéo-thả HTML5 + nút chuyển cột thay thế cho mobile
- [x] Task 5: Wire `AppRoutes.tsx` (`/notes`) + `Sidebar.tsx` (mục "Notes"); build + push image + rollout thật; verify curl trực tiếp (401 không password, 200 có password) + CRUD full lifecycle thật trên Postgres production

## Agent Task Assignment

| Task | Agent (CLI) | Lý do chọn | Status |
|------|------|------|------|
| Task 1: Migration `db.go` | Claude Code (sonnet) | Đụng file migration dùng chung, cần đọc đúng convention Postgres hiện tại trước khi thêm — rủi ro cao nếu sai cú pháp default | done |
| Task 2: Backend `notes.go` + wire routes | Claude Code (sonnet) | Endpoint mới phải áp dụng gate đúng cho cả GET (khác quy ước Playlists) — cần judgement, không phải chép mẫu máy móc | done |
| Task 3: `frontend/src/api.ts` | OpenCode (`opencode/big-pickle`) | Boilerplate CRUD client thuần, copy pattern gọi API + header đã có sẵn trong file | done |
| Task 4: `frontend/src/pages/NotesPage.tsx` | Claude Code (sonnet) | UI mới có gate mật khẩu + kéo-thả — cần đúng UX tối giản theo Global constraints, tránh over-engineer | done |
| Task 5: Wire routes/Sidebar + verify | Claude Code (sonnet) | Bước verify cuối cần chạy thật (gate chặn đúng, dữ liệu bền sau reload) — cần theo dõi sát, không giao CLI rẻ | done |

## Success criteria

- Vào `/notes` khi chưa nhập mật khẩu → không thấy bất kỳ nội dung note nào (kể cả gọi thẳng `curl /api/notes` không kèm password → 401/403, không lộ dữ liệu)
- Nhập đúng `owner712002` → thấy bảng Kanban 3 cột, tạo/sửa/xoá card hoạt động, lưu xuống Postgres thật
- Kéo-thả đổi cột/vị trí trên desktop hoạt động; trên mobile có nút thay thế chuyển cột
- F5 reload sau khi nhập đúng mật khẩu 1 lần trong phiên → không phải nhập lại (giữ đúng hành vi session hiện có của Playlists)
- Không có regression ở `/api/playlists*` hay `/api/ebooks/*/nsfw` (dùng chung `verifyOwnerPassword` nhưng không đổi logic hàm đó)

## Render brief

### Task 1 — Migration bảng `kanban_notes`
1. *(add)* Thêm block migration mới trong `db.go`, đặt cạnh các bảng khác (playlists, ebooks...), dùng đúng convention `INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)` cho `created_at`/`updated_at`.
2. *(add)* Cột `column_key TEXT NOT NULL` lưu 1 trong 3 giá trị cố định (`todo`/`doing`/`done`), `position INTEGER NOT NULL` để sắp thứ tự trong cột.
3. *(legacy)* Không đụng bất kỳ bảng nào khác đã có (`playlists`, `ebooks`, `tracks`...).

**Prose:** Bảng mới này độc lập hoàn toàn với schema hiện có — không có khoá ngoại trỏ tới bảng nào khác vì note không gắn với track/album/artist nào cả, đây là dữ liệu tự do của riêng người dùng owner. Việc dùng `column_key` dạng text tự do (thay vì enum cứng ở tầng DB) giữ cho migration đơn giản nhất có thể, đúng tinh thần tối giản của một tính năng "quick note" — nếu sau này cần thêm cột thứ 4, chỉ cần thay đổi ở tầng ứng dụng, không cần migration schema mới.

### Task 2 — Backend handlers + wire routes
1. *(add)* Viết `notes.go` với struct `NotesHandlers{db *sql.DB}`, 4 handler: list/create/update/delete, mỗi handler gọi `verifyOwnerPassword(r)` **trước tiên**, kể cả handler GET list.
2. *(add)* Đăng ký route trong `routes.go`: `GET/POST /api/notes`, `PUT /api/notes/{id}`, `DELETE /api/notes/{id}`.
3. *(legacy)* Không đổi `verifyOwnerPassword`/`OwnerPassword` đã có — dùng nguyên trạng, đảm bảo Playlists/Ebook NSFW không bị ảnh hưởng.
4. *(block)* Nếu thiếu/sai mật khẩu → trả `401 Unauthorized`, không trả kèm bất kỳ nội dung note nào trong body lỗi.

**Prose:** Điểm khác biệt quan trọng nhất so với việc chép y nguyên pattern Playlists nằm ở chỗ handler `GET /api/notes` (liệt kê danh sách) cũng phải gọi `verifyOwnerPassword` — trong khi `GET /api/playlists` ở Playlists lại cố ý để công khai không cần mật khẩu, vì playlist vốn là thứ có thể chia sẻ xem được. Ở đây thì ngược lại: đây là ghi chú riêng tư của một người dùng duy nhất, nên ngay cả việc "xem được có gì trong đó" cũng phải được coi là hành động cần bảo vệ, không chỉ hành động ghi. Bỏ sót bước này là lỗi bảo mật thật — ai gọi thẳng `curl https://music.giatbh.io.vn/api/notes` mà không có gì chặn thì đọc được toàn bộ nội dung riêng tư của owner.

### Task 3 — Frontend API client
1. *(add)* Thêm các hàm `listNotes()`, `createNote(payload)`, `updateNote(id, payload)`, `deleteNote(id)` trong `api.ts`, mỗi hàm tự đính header `X-Owner-Password` lấy từ state mật khẩu đã nhập ở `NotesPage`.
2. *(legacy)* Không đổi các hàm API khác đã có trong cùng file.

**Prose:** Đây là lớp mỏng bọc quanh `fetch`, hoàn toàn theo đúng khuôn mẫu các hàm API khác đã tồn tại trong `api.ts` — không có logic mới cần suy nghĩ nhiều, chỉ là lặp lại cấu trúc gọi API + gắn header đã được các tính năng trước (Playlists) chứng minh hoạt động đúng. Vì tính chất lặp-khuôn-mẫu rõ ràng này, đây là việc phù hợp để giao cho một CLI rẻ hơn xử lý thay vì tốn thời gian phân tích của Claude.

### Task 4 — Trang Kanban `NotesPage.tsx`
1. *(add)* Màn hình gate: nếu chưa có mật khẩu đúng trong state phiên, hiển thị modal nhập mật khẩu (tái dùng UI pattern từ `FavoritePill.tsx`) thay vì render bất kỳ nội dung note nào — nội dung note không được fetch cho tới khi mật khẩu đúng.
2. *(add)* Sau khi gate qua, gọi `listNotes()` và render 3 cột cố định (Todo/Doing/Done), mỗi card có nút sửa/xoá.
3. *(add)* Kéo-thả bằng HTML5 Drag and Drop API gốc (phương án A đã chọn) để đổi cột/vị trí trên desktop; thêm 2 nút mũi tên trái/phải trên mỗi card làm phương án thay thế cho thao tác chạm trên mobile.
4. *(legacy)* Không đụng CSS/component dùng chung của các trang khác ngoài việc thêm class riêng cho Kanban.

**Prose:** Thiết kế màn hình theo đúng nguyên tắc "gate trước khi render" chứ không phải "render rồi che bằng CSS" — nếu chỉ ẩn nội dung bằng overlay mờ trong khi component con vẫn gọi API lấy dữ liệu về, dữ liệu vẫn nằm trong bộ nhớ trình duyệt và có thể lộ ra qua DevTools dù giao diện trông như đã khoá. Cách làm đúng là không gọi `listNotes()` cho tới khi state mật khẩu đã được xác nhận đúng — kết hợp với việc backend cũng tự kiểm tra lại (Task 2), tạo thành hai lớp bảo vệ độc lập thay vì chỉ dựa vào một lớp UI có thể bị bỏ qua. Việc chọn kéo-thả HTML5 gốc thay vì thêm thư viện là quyết định có chủ đích để giữ tính năng này nhẹ và nhanh triển khai, đổi lại phải bù thêm nút điều hướng thủ công cho mobile để không bỏ rơi trải nghiệm trên điện thoại — một sự đánh đổi tường minh, không phải thiếu sót.

### Task 5 — Wire routing + Sidebar + verify
1. *(add)* Thêm route `/notes` vào `AppRoutes.tsx`, thêm mục điều hướng "Notes" vào `Sidebar.tsx`.
2. *(block)* Verify: gọi thẳng `curl /api/notes` không kèm mật khẩu → phải nhận lỗi từ chối, không nhận được danh sách note nào.
3. *(add)* Verify: nhập đúng mật khẩu trên UI → CRUD + kéo-thả hoạt động, F5 lại vẫn còn dữ liệu (đã lưu Postgres) và không bị hỏi lại mật khẩu trong cùng phiên.
4. *(legacy)* Verify không có regression ở Playlists/Ebook NSFW (cùng dùng `verifyOwnerPassword`).

**Prose:** Bước cuối này đóng vai trò là bằng chứng thật rằng cả hai lớp gate (UI không render nếu chưa đúng mật khẩu, và API tự chối nếu thiếu mật khẩu) đều hoạt động độc lập với nhau — nếu chỉ verify qua UI mà bỏ qua việc gọi thẳng API bằng `curl`, rất dễ bỏ sót trường hợp lớp bảo vệ phía backend bị thiếu trong lúc code Task 2, và tính năng "riêng tư" sẽ chỉ riêng tư trên danh nghĩa. Việc xác nhận Playlists/Ebook NSFW không bị ảnh hưởng cũng quan trọng vì cả ba tính năng cùng dùng chung một hàm `verifyOwnerPassword` — bất kỳ thay đổi vô tình nào ở đó đều có thể âm thầm phá vỡ hai tính năng đã chạy ổn định từ trước.

## Notes
- Invoked via: `/orca-workflow` → `/query` → `/propose` skill
- Chưa quyết: giữ nguyên 3 cột cố định Todo/Doing/Done, hay đổi tên/cho phép user tự đặt tên cột? Đề xuất giữ cố định cho bản đầu (đúng Global constraints), có thể mở rộng sau nếu cần.
- Liên quan: [[FavoritePlaylistPill]], [[EbookEnhancements]]

## Origin
- **Draft:** `wiki/sources/draft/230726-kanban-quick-note-be-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
