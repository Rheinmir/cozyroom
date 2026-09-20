---
type: draft
title: Nang cap Kanban Quick Note thanh board giau chuc nang + he thong dang ky/approve nguoi dung rieng cho kanban (kieu Gitea)
status: proposed
tags: [feature, kanban, notes, kaneo-inspired, auth, approval, be-fe]
timestamp: 2026-08-03
---

# 030826-kanban-notes-upgrade-be-fe
**Type:** draft
**Status:** proposed
**Tags:** feature, kanban, notes, kaneo-inspired, auth, approval, be-fe
**Proposed:** 2026-08-03
**Sequence diagram:** [html/030826-kanban-notes-upgrade-be-fe-seq.html](../../../html/030826-kanban-notes-upgrade-be-fe-seq.html)

## What
Nâng cấp `/notes` (hiện là bảng Kanban 1-board, 3-cột-cứng, card chỉ có title+content, khoá bởi 1 mật khẩu tĩnh `owner712002` dùng chung) thành một board giàu chức năng hơn — lấy cảm hứng từ bộ tính năng board-level của [usekaneo/kaneo](https://github.com/usekaneo/kaneo) (nhiều board, cột tự đặt tên, task có label/priority/due-date/subtask/comment) — **cộng thêm** một hệ thống đăng ký tài khoản riêng cho kanban theo mô hình Gitea: ai cũng đăng ký được, nhưng phải chờ owner approve mới đăng nhập được. Sau khi approve, user thật được gán vào task (thay cho nhãn tên tự do). Phạm vi auth mới **chỉ áp dụng cho `/notes`** — Playlists và Ebook NSFW giữ nguyên cổng `owner712002` như hiện tại, không đụng.

## Quyết định phạm vi đã chốt qua hỏi lại user (3 vòng)
1. **Hướng port vs deploy riêng:** Port tính năng vào `/notes` hiện có, giữ nguyên stack Go + React + Postgres — không chạy kaneo như app tách biệt.
2. **(Đã bị đảo lại ở vòng 3, giữ đây để nêu lịch sử quyết định)** Ban đầu chọn "chỉ thêm assignee dạng nhãn tên, không xây tài khoản thật" — sau đó user yêu cầu thêm hệ thống đăng ký + owner approve kiểu Gitea, tức **đảo lại** thành tài khoản thật.
3. **Phạm vi hệ thống auth mới:** Chỉ áp dụng cho Kanban — **không** thay thế cơ chế `owner712002` ở Playlists/Ebook NSFW. `verifyOwnerPassword`/`OwnerPassword` hiện có giữ nguyên 100%, không sửa.

## Thiết kế auth đã chọn (để giữ tối giản, không thêm dependency ngoài)
- **Không JWT, không thư viện auth ngoài.** Bcrypt để hash password: `golang.org/x/crypto` đã có sẵn trong `go.mod` (hiện là `// indirect` — chỉ cần dùng trực tiếp `golang.org/x/crypto/bcrypt`, không thêm dependency mới nào).
- **Session:** token ngẫu nhiên sinh bằng `crypto/rand` (không dùng `math/rand`), lưu bảng `kanban_sessions (token, user_id, expires_at)`, client gửi kèm header `X-Kanban-Session` — cùng triết lý với `X-Owner-Password` đã có (đơn giản, không cookie/CSRF phức tạp, phù hợp app cá nhân dùng nội bộ).
- **Owner712002 vẫn hoạt động y nguyên** làm "admin bypass": mọi endpoint kanban chấp nhận **HOẶC** `X-Owner-Password: owner712002` hợp lệ **HOẶC** `X-Kanban-Session` hợp lệ của user đã được approve. Owner không cần tự đăng ký tài khoản để dùng board như trước; đồng thời owner712002 là credential duy nhất được phép approve/reject user mới (endpoint admin).
- **Approval flow (kiểu Gitea):** `POST /api/kanban/register {username, password}` → tạo row `status='pending'`, hash password ngay, KHÔNG cho login khi còn pending. Owner (qua `owner712002`) xem danh sách pending, approve hoặc reject. Chỉ `status='approved'` mới login được.

## Giới hạn cần nêu rõ (Claim Discipline)
Trang GitHub của kaneo không liệt kê chi tiết từng field của task (label/priority/due-date/subtask/comment) — tôi xác nhận được kaneo là project management tool React+Hono+Postgres, MIT, có kanban + multi-user/workspace, nhưng **chưa đọc trực tiếp schema/source của kaneo**. Bộ field board-level đề xuất dưới đây là bộ field phổ biến của các kanban tool cùng lớp (Trello/Linear/kaneo), coi là **PRIOR**, không phải **OBSERVED** 1:1 từ code kaneo — phần auth/approval là thiết kế riêng cho cozyroom, không lấy từ kaneo (kaneo dùng workspace/team thật, không phải mô hình approve-đăng-ký kiểu Gitea).

## Affected
| File / Symbol | Thay đổi |
|---|---|
| `backend/internal/db/db.go` | Thêm bảng `kanban_users`, `kanban_sessions`, `kanban_boards`, `kanban_columns`, `kanban_labels`, `kanban_note_labels`, `kanban_subtasks`, `kanban_comments`; mở rộng `kanban_notes` (`board_id`, `column_id`, `priority`, `due_date`, `assigned_user_id`); migration data 1 lần backfill note cũ vào board/cột mặc định |
| `backend/internal/api/auth_kanban.go` (mới) | `register/login/logout`, admin `list-pending/approve/reject`, helper `verifyKanbanAccess(r)` (owner712002 HOẶC session hợp lệ) |
| `backend/internal/api/notes.go` | Đổi gate từ `verifyOwnerPassword` sang `verifyKanbanAccess`; mở rộng field; thêm handlers subtask, comment |
| `backend/internal/api/boards.go` (mới) | CRUD board/column/label, qua `verifyKanbanAccess` |
| `backend/internal/api/routes.go` | Đăng ký route mới cho auth/boards/columns/labels/subtasks/comments |
| `frontend/src/api.ts` | Thêm client functions auth (register/login/logout, admin approve/reject) + mở rộng client note/board/column/label/subtask/comment |
| `frontend/src/pages/NotesPage.tsx` | Gate screen mới: tab Đăng nhập / Đăng ký (giữ thêm lối vào bằng `owner712002` làm admin mode); board switcher; cột động; card giàu field; task detail panel; panel admin duyệt user (chỉ hiện ở admin mode); tìm kiếm/lọc |
| `frontend/src/index.css` | Style mới cho toàn bộ UI trên |

## Risks
- **Migrate dữ liệu cũ không được làm mất note đã có** — phải tạo board mặc định + cột tương ứng `column_key` cũ rồi backfill `board_id`/`column_id` cho MỌI row trước khi frontend đổi sang đọc field mới.
- **Đổi gate từ `verifyOwnerPassword` sang `verifyKanbanAccess` ở `notes.go` là điểm rủi ro bảo mật lớn nhất của cả bản nâng cấp** — phải đảm bảo `verifyKanbanAccess` **strictly superset** của `verifyOwnerPassword` cũ (owner712002 phải luôn qua được, không được vô tình siết chặt hơn và tự khoá owner ra khỏi board của chính mình). Cần test cả 2 nhánh (owner712002 và session user) độc lập, không chỉ test 1 nhánh rồi coi là đủ.
- **Không cho user pending/rejected login** — nếu quên check `status='approved'` ở endpoint login, ai đăng ký cũng vào được ngay, phá vỡ toàn bộ mục đích của approval flow.
- **Password phải hash, không lưu plaintext** — dùng bcrypt cho `kanban_users.password_hash`; nếu code không hash mà lưu thẳng, đây là lỗ hổng bảo mật nghiêm trọng dù app chỉ dùng nội bộ.
- **Session token phải sinh bằng `crypto/rand`**, không dùng `math/rand` (dự đoán được) — token là "chìa khoá" thay cho mật khẩu mỗi request, yếu ở đây làm vô hiệu hoá toàn bộ lớp approval.
- **Không được đụng `verifyOwnerPassword`/`OwnerPassword` ở `playlists.go`** — Playlists/Ebook NSFW phải tiếp tục hoạt động y nguyên, đây là constraint cứng đã xác nhận qua hỏi lại user.
- **Người bị reject hoặc còn pending không được thấy bất kỳ dữ liệu board nào** qua bất kỳ đường nào (kể cả gọi thẳng API) — vì "pending" nghĩa là chưa được cấp quyền, không phải "xem được nhưng chưa sửa được".

## Trade-off cần user xác nhận (không tự chọn ngầm)

| Quyết định | Phương án A (khuyến nghị) | Phương án B |
|---|---|---|
| Kéo-thả | Giữ HTML5 DnD gốc + nút mũi tên thay thế cho mobile (không thêm dependency) | Thêm `@dnd-kit/core` (~15-20KB) cho UX mượt hơn trên touch |
| User đăng ký trùng username bị reject | Cho đăng ký lại với cùng username (xoá row reject cũ, tạo lại pending) | Khoá vĩnh viễn username đã bị reject 1 lần (chống spam nhưng cứng nhắc hơn) |
| Session hết hạn | TTL cố định (vd 30 ngày), phải login lại sau đó | Không hết hạn, chỉ mất khi logout thủ công (đơn giản hơn nhưng token sống mãi nếu lộ) |
| Label | Tự tạo label theo từng board (tên + màu tự chọn) | Bộ label cố định dựng sẵn (vd Bug/Feature/Urgent) |

## Global constraints
- Hệ thống đăng ký/approve mới **chỉ áp dụng cho `/notes`** — không đụng, không thay thế `verifyOwnerPassword`/`OwnerPassword` đang dùng ở `playlists.go` (Playlists, Ebook NSFW giữ nguyên hành vi 100%).
- `owner712002` vẫn phải luôn truy cập được toàn bộ kanban như trước (admin bypass) — không có kịch bản nào khiến owner tự bị khoá khỏi board của chính mình.
- Không thêm thư viện auth/JWT ngoài — chỉ dùng `golang.org/x/crypto/bcrypt` (đã có sẵn trong `go.mod`) + session token tự sinh bằng `crypto/rand`.
- Đăng ký mới **luôn** ở trạng thái `pending`, không tự động active — chỉ `owner712002` mới approve/reject được.
- User `pending`/`rejected` không được xem hoặc sửa bất kỳ dữ liệu board nào qua bất kỳ endpoint nào.
- Không mở rộng phạm vi tính năng ra ngoài `/notes` trong lần này (đã hỏi lại và user xác nhận giữ hẹp ở kanban).

## Plan
- [ ] Task 1: Migration `db.go` — bảng `kanban_users`/`kanban_sessions`/`kanban_boards`/`kanban_columns`/`kanban_labels`/`kanban_note_labels`/`kanban_subtasks`/`kanban_comments`; mở rộng `kanban_notes`; backfill note cũ vào board/cột mặc định
- [ ] Task 2: Backend `auth_kanban.go` (mới) — register/login/logout, admin list-pending/approve/reject, helper `verifyKanbanAccess(r)`, bcrypt hash, session token `crypto/rand`
- [ ] Task 3: Backend `notes.go` — đổi gate sang `verifyKanbanAccess`, mở rộng field, thêm subtask/comment handlers
- [ ] Task 4: Backend `boards.go` (mới) — board/column/label CRUD + reorder, qua `verifyKanbanAccess`
- [ ] Task 5: Wire `routes.go`
- [ ] Task 6: `frontend/src/api.ts` — client functions auth + mở rộng note/board/column/label/subtask/comment
- [ ] Task 7: `frontend/src/pages/NotesPage.tsx` — gate screen Đăng nhập/Đăng ký + admin mode owner712002, board switcher, cột động, task detail panel, panel duyệt user, tìm kiếm/lọc
- [ ] Task 8: `frontend/src/index.css` styling + verify toàn diện (migration integrity, cả 2 nhánh gate, approval flow thật, regression Playlists/Ebook NSFW)

## Agent Task Assignment
| Task | Agent (CLI) | Lý do chọn | Status |
|------|------|------|------|
| Task 1: Migration `db.go` | Claude Code (sonnet) | Migration data 1 lần trên bảng đang có dữ liệu thật + thêm bảng users/sessions — sai sót mất dữ liệu hoặc thiết kế sai schema auth khó sửa sau | pending |
| Task 2: `auth_kanban.go` | Claude Code (sonnet) | Auth/hashing/session — sai sót là lỗ hổng bảo mật thật, cần judgement cao, không phải chép mẫu | pending |
| Task 3: `notes.go` đổi gate | Claude Code (sonnet) | Đổi gate là điểm rủi ro bảo mật lớn nhất — phải tự tay verify superset, không giao CLI rẻ | pending |
| Task 4: `boards.go` mới | Claude Code (sonnet) | CRUD mới cùng rủi ro gate như Task 3 | pending |
| Task 5: Wire `routes.go` | OpenCode (`opencode/big-pickle`) | Đăng ký route thuần theo pattern cũ | pending |
| Task 6: `frontend/src/api.ts` | OpenCode (`opencode/big-pickle`) | Boilerplate CRUD/auth client, lặp khuôn mẫu đã có | pending |
| Task 7: `NotesPage.tsx` redesign | Claude Code (sonnet) | UI phức tạp nhất (auth flow + board + admin panel) — cần đúng UX, tránh over-engineer | pending |
| Task 8: `index.css` + verify | Claude Code (sonnet) | Verify bảo mật (2 nhánh gate, approval flow thật) cần theo dõi sát, không giao CLI rẻ | pending |

## Success criteria
- Đăng ký user mới → trạng thái `pending`, KHÔNG login được, KHÔNG thấy dữ liệu board nào
- Owner (qua `owner712002`) thấy danh sách pending, approve → user đó login được bằng username/password vừa đăng ký; reject → user đó vẫn không login được
- Owner vẫn vào được toàn bộ board như trước (admin bypass qua `owner712002`, không cần tự đăng ký)
- Task gán được cho user thật đã approve (không còn nhãn tên tự do)
- Toàn bộ note cũ vẫn hiển thị đầy đủ sau migration, đúng board/cột mặc định — không mất note nào
- Board/cột động: tạo board mới, thêm/sửa/xoá/sắp lại cột; task có label/priority/due-date/subtask/comment/assignee hoạt động đầy đủ
- `curl` không kèm `X-Owner-Password` lẫn `X-Kanban-Session` hợp lệ cho MỌI endpoint kanban mới → 401, không lộ dữ liệu
- Không regression ở `/api/playlists*`, `/api/ebooks/*/nsfw`

## Render brief

### Task 1 — Migration schema mới (users/sessions/boards/...) + backfill dữ liệu cũ
1. *(add)* Thêm `kanban_users (id, username UNIQUE, password_hash, status, is_owner, created_at, approved_at)`, `kanban_sessions (token PK, user_id, expires_at)`.
2. *(add)* Thêm `kanban_boards`, `kanban_columns`, `kanban_labels`, `kanban_note_labels`, `kanban_subtasks`, `kanban_comments`.
3. *(add)* `ALTER TABLE kanban_notes ADD COLUMN IF NOT EXISTS board_id/column_id/priority/due_date/assigned_user_id`.
4. *(add)* Backfill 1 lần: tạo board mặc định + 3 cột (todo/doing/done) từ `column_key` cũ, `UPDATE kanban_notes` khớp `board_id`/`column_id` cho mọi row hiện có.
5. *(legacy)* Không đụng bảng nào khác ngoài các bảng kanban.

**Prose:** Bước này gộp cả rủi ro dữ liệu cũ (như bản trước) và rủi ro thiết kế schema auth mới — bảng `kanban_users`/`kanban_sessions` phải tách biệt hoàn toàn với mọi cơ chế mật khẩu tĩnh hiện có (`OwnerPassword` vẫn là hằng số Go, không lưu trong DB), để không tạo ra 2 nguồn sự thật về "ai được coi là owner". `is_owner` trên `kanban_users` chỉ mang tính hiển thị/tương lai, KHÔNG phải cơ chế cấp quyền chính — quyền admin thật vẫn đến từ biết đúng `owner712002`, giữ đúng constraint "không đụng verifyOwnerPassword".

### Task 2 — `auth_kanban.go`: register/login/session + admin approve
1. *(add)* `POST /api/kanban/register {username, password}` → validate username chưa tồn tại, hash password bằng bcrypt, tạo row `status='pending'`.
2. *(add)* `POST /api/kanban/login {username, password}` → so khớp bcrypt, **chặn nếu `status != 'approved'`**, sinh token `crypto/rand` 32 byte, lưu `kanban_sessions`, trả token.
3. *(add)* `GET /api/kanban/admin/pending` + `POST /api/kanban/admin/users/{id}/approve|reject` — **chỉ** chấp nhận `X-Owner-Password: owner712002`, không chấp nhận session user thường (chống user tự approve lẫn nhau).
4. *(add)* Helper `verifyKanbanAccess(r) (identity, ok bool)` — thử `verifyOwnerPassword(r)` trước (owner712002 → identity="owner"), nếu không có thì thử `X-Kanban-Session` khớp session còn hạn của user `status='approved'` → identity=username; nếu cả 2 đều fail → `ok=false`.
5. *(block)* Login khi `status='pending'` hoặc `'rejected'` → 403, không tiết lộ lý do chi tiết (tránh dò username tồn tại).

**Prose:** Đây là phần nhạy cảm bảo mật nhất trong toàn bộ proposal — điểm mấu chốt là `verifyKanbanAccess` phải là **superset** đúng nghĩa của `verifyOwnerPassword` cũ: bất kỳ request nào hợp lệ theo cơ chế cũ (đúng header `X-Owner-Password`) phải luôn qua được cơ chế mới, không có ngoại lệ, để owner không bao giờ tự khoá mình ra khỏi dữ liệu của chính mình khi nâng cấp. Endpoint admin approve/reject cố tình **không** chấp nhận session user thường dù đã approve — nếu chấp nhận, một user thường có thể tự approve tài khoản khác (leo quyền), phá vỡ toàn bộ mục đích của approval flow kiểu Gitea.

### Task 3 — `notes.go`: đổi gate + mở rộng field + subtask/comment
1. *(block→add)* Đổi mọi `verifyOwnerPassword(r)` trong `notes.go` thành `verifyKanbanAccess(r)` — giữ nguyên logic 401 khi fail.
2. *(add)* Note create/update nhận thêm `board_id, column_id, priority, due_date, assigned_user_id, label_ids[]`; validate `board_id`/`column_id` cùng board.
3. *(add)* Handlers subtask (`/api/notes/{id}/subtasks*`) và comment (`/api/notes/{id}/comments*`), comment lưu `author_user_id` (lấy từ identity trả về bởi `verifyKanbanAccess`, không phải input tự do từ client — tránh giả danh người khác).
4. *(legacy)* Không đổi `verifyOwnerPassword`/`OwnerPassword` gốc trong `playlists.go`.

**Prose:** Điểm khác với các bản nâng cấp trước là comment giờ có "tác giả thật" — `author_user_id` phải lấy từ identity đã xác thực qua `verifyKanbanAccess`, không phải một trường `author_name` tự do gửi lên từ client, nếu không bất kỳ ai đã login cũng có thể mạo danh người khác trong comment. Việc đổi gate ở đúng 1 chỗ (hàm gọi) nhưng giữ nguyên toàn bộ logic 401 xung quanh giữ cho thay đổi tối giản, đúng tinh thần "surgical change" — không viết lại handler, chỉ thay điều kiện gate.

### Task 4 — `boards.go` mới: board/column/label CRUD
1. *(add)* `GET/POST/PUT/DELETE /api/boards*`, `/api/boards/{id}/columns*`, `/api/boards/{id}/labels*` — qua `verifyKanbanAccess`.
2. *(block)* Chặn xoá board/cột còn task bên trong — yêu cầu chuyển hết task trước.
3. *(legacy)* Không ảnh hưởng route khác.

**Prose:** Giống thiết kế đã có ở bản trước: chặn xoá cascade để tránh mất dữ liệu không có đường lùi. Vì giờ nhiều user thật cùng chia sẻ 1 không gian board, việc 1 người vô tình xoá nhầm board có task của người khác càng cần được chặn cứng ở tầng API, không chỉ dựa vào cảnh báo UI.

### Task 5 — Wire `routes.go`
1. *(add)* Đăng ký route Task 2/3/4 theo đúng pattern cũ.
2. *(legacy)* Không đổi route khác.

**Prose:** Thuần đăng ký route theo khuôn mẫu đã tồn tại, không cần phân tích nghiệp vụ, phù hợp CLI rẻ.

### Task 6 — `frontend/src/api.ts` mở rộng
1. *(add)* `registerKanbanUser`, `loginKanbanUser` (lưu token trả về vào `sessionStorage`), `logoutKanbanUser`, `listPendingUsers/approveUser/rejectUser` (admin, gửi `X-Owner-Password`).
2. *(add)* Mọi hàm note/board/column/label/subtask/comment client tự đính `X-Kanban-Session` (nếu có) hoặc `X-Owner-Password` (nếu đang ở admin mode).
3. *(legacy)* Không đổi hàm API khác trong file.

**Prose:** Lớp client giờ phải phân biệt 2 "chế độ" gửi header — admin mode (giữ nguyên `X-Owner-Password` như code cũ) và user mode (`X-Kanban-Session` mới) — nhưng cả hai đều là lớp mỏng bọc `fetch`, không có logic nghiệp vụ phức tạp, phù hợp CLI rẻ triển khai theo brief đã có sẵn ở đây.

### Task 7 — Redesign `NotesPage.tsx`
1. *(add)* Gate screen mới: 2 tab "Đăng nhập" / "Đăng ký", cộng ô "Vào bằng mật khẩu owner" (giữ đúng UI cũ cho admin mode).
2. *(add)* Sau đăng ký → màn hình "Đang chờ owner duyệt", không cho vào board.
3. *(add)* Panel admin (chỉ hiện khi ở admin mode): danh sách user pending, nút Approve/Reject.
4. *(add)* Board switcher, cột động, card giàu field (label/priority/due-date/assignee avatar/subtask progress), task detail panel (sửa field + checklist + comment thread có tên tác giả thật), thanh tìm kiếm/lọc.
5. *(legacy)* Giữ nguyên session key `cozyroom_owner_password` cho admin mode, thêm session key riêng cho user token (không tái dùng chung 1 key, tránh nhầm 2 loại credential).

**Prose:** Nguyên tắc "gate trước khi render" từ bản gốc được giữ nguyên và mở rộng: không gọi bất kỳ API board/note nào cho tới khi có credential hợp lệ (dù là owner712002 hay session user đã approve). Panel admin duyệt user là UI hoàn toàn mới, chỉ hiển thị ở admin mode để tránh user thường nhìn thấy hàng đợi đăng ký của người khác (rò rỉ thông tin không cần thiết) — đúng nguyên tắc "pending/rejected không được xem gì" đã ghi trong Global constraints.

### Task 8 — `index.css` styling + verify toàn diện
1. *(add)* Style cho toàn bộ UI mới, đúng theme đen-trắng-xám hiện tại (`var(--green)` + `color:#000`, không dùng `var(--accent)`).
2. *(block)* Verify migration: 100% note cũ hiển thị đúng sau khi đổi sang đọc `board_id`/`column_id`.
3. *(block)* Verify cả 2 nhánh gate độc lập: `owner712002` vẫn vào được mọi endpoint như cũ; user `pending` bị chặn ở mọi endpoint; user `approved` vào được đúng phạm vi.
4. *(block)* Verify approval flow thật: đăng ký → pending → owner approve → login thành công; đăng ký khác → owner reject → login thất bại.
5. *(legacy)* Verify không regression `/api/playlists*`, `/api/ebooks/*/nsfw`.

**Prose:** Bước cuối là bằng chứng thật cho đúng 2 loại rủi ro lớn nhất của bản nâng cấp này: mất dữ liệu cũ (Task 1) và lỗ hổng quyền truy cập (Task 2-3, đổi gate). Verify phải chạy cả nhánh "thất bại" (user pending/rejected bị chặn) chứ không chỉ nhánh "thành công" — một hệ thống approval mà chỉ test được nhánh cho-qua thì chưa chứng minh được gì về nhánh chặn, vốn là lý do chính để xây approval flow này.

## Notes
- Invoked via: `/fable5` → user request "đổi kanban sang full bộ kaneo" → làm rõ 3 vòng qua `AskUserQuestion`: (1) port vs deploy riêng → port; (2) mức đa user → ban đầu chọn "chỉ nhãn tên", (3) user đảo lại thành "đăng ký + owner approve kiểu Gitea", hỏi lại phạm vi → chỉ áp dụng cho kanban → `/propose`
- Chưa quyết (cần user chọn ở bước duyệt): kéo-thả HTML5 hay `@dnd-kit`; chính sách username bị reject có được đăng ký lại không; session có TTL hay không; label tự tạo hay bộ cố định — xem bảng Trade-off ở trên
- **Chưa làm:** đọc trực tiếp source/schema thật của `usekaneo/kaneo` — bộ field board-level là suy ra từ hiểu biết chung về kanban tool cùng lớp, không phải audit trực tiếp repo (xem mục Claim Discipline)
- Liên quan: [[FavoritePlaylistPill]], [[EbookEnhancements]]

## Origin
- **Draft:** `wiki/sources/draft/030826-kanban-notes-upgrade-be-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
