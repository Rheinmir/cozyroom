---
type: draft
title: Module 1/17 roadmap kaneo-port - Role/permission thuc cho Kanban (owner/admin/member/viewer)
status: proposed
tags: [feature, kanban, roles, permissions, kaneo-port, be-fe]
timestamp: 2026-08-04
---

# 040826-kanban-roles-permissions-be-fe
**Type:** draft
**Status:** proposed
**Tags:** feature, kanban, roles, permissions, kaneo-port, be-fe
**Proposed:** 2026-08-04
**Sequence diagram:** [html/040826-kanban-roles-permissions-be-fe-seq.html](../../../html/040826-kanban-roles-permissions-be-fe-seq.html)

## What
**Module 1/17** trong roadmap port tính năng kaneo vào Kanban cozyroom (đã chốt với user: bỏ billing + OAuth social login, còn lại làm hết, chia nhỏ module, deploy tuần tự). Module này thêm role/permission thật (owner/admin/member/viewer, permission theo resource+action) thay cho mô hình hiện tại: mọi user đã được owner approve đều **ngang quyền nhau tuyệt đối** — không có khái niệm role nào cả.

## Đối chiếu với kaneo thật (đã research trực tiếp source, không suy đoán)
- 4 role: `owner` (tĩnh) / `admin` / `member` / `viewer`, permission dạng statement `resource: [actions]` (`project:[create,read,update,delete,share]`, `task:[create,read,update,delete,assign]`, `label:[create,read,update,delete]`, `workspace:[read,update,delete,manage_settings]`)
- Role admin/member/viewer seed mặc định mỗi workspace, **editable** (owner có thể sửa permission set), tối đa 25 role/workspace
- Role gắn với **workspace** — nhưng cozyroom chưa có lớp workspace (đó là module 3, chưa làm) → xem mục Trade-off bên dưới

## Trade-off — ĐÃ CHỐT với user

**Role theo từng board (Phương án A đã chọn)**, không phải role global. Kéo theo hệ quả thiết kế quan trọng: role **không phải thuộc tính chung của user** — cùng 1 user có thể là `admin` ở board này nhưng `viewer` ở board khác. Vì vậy role không gắn trực tiếp vào `kanban_users`, mà qua bảng **membership** riêng: `kanban_board_members (board_id, user_id, role_id)` — 1 dòng cho mỗi (user, board) mà user đó có role trên đó.

- **Đọc (GET) vẫn giữ nguyên global** như constraint đã chốt từ đầu — mọi user đã approve đọc được mọi board, không cần membership. Membership/role chỉ chi phối **hành động ghi**.
- User chưa có dòng `kanban_board_members` cho 1 board cụ thể → không ghi được gì trên board đó (fail-closed), dù vẫn đọc được (qua gate cũ).
- Khi tạo board mới: tự seed 4 role cho board đó (ID riêng theo board, không dùng lại ID cố định `role_member` xuyên board như bản nháp trước) + tự gán người tạo (nếu không phải owner) làm `admin` trên board đó — để không tự khoá quyền chính mình trên board vừa tạo.
- Cần thêm 1 endpoint quản lý membership: `POST /api/boards/{id}/members` (gán/đổi role cho 1 user đã approve trên board đó) — vì nếu không, user cũ chỉ có quyền ghi trên board họ được approve lúc đầu, không có cách nào được cấp quyền trên board tạo sau này.

**Chưa làm ở module này** (để module riêng sau, đúng tinh thần chia nhỏ): cho owner tự sửa permission set của role (giống "Roles UI" của kaneo) — giữ 4 role cố định với permission mặc định hợp lý.

## Affected
| File / Symbol | Thay đổi |
|---|---|
| `backend/internal/db/db.go` | Bảng `kanban_roles` (id, board_id, name, permissions JSON text, is_system bool, position) + bảng `kanban_board_members` (board_id, user_id, role_id, PRIMARY KEY(board_id,user_id)); seed 4 role cho board `default` đã có; backfill user đã approve trước đây thành `member` trên board `default` |
| `backend/internal/api/auth_kanban.go` | Hàm mới `hasPermission(db, identity, boardID, resource, action) bool` (tra theo `kanban_board_members`); `approveUser` nhận thêm `board_id` + `role_id` (tạo dòng membership đầu tiên) |
| `backend/internal/api/boards.go` | `createBoard` tự seed 4 role riêng cho board mới + tự gán người tạo làm `admin` trên board đó; handler ghi (board/column/label) gọi `hasPermission`; thêm `POST /api/boards/{id}/members` (gán/đổi role cho user đã approve trên board cụ thể) |
| `backend/internal/api/notes.go` | Handler ghi (create/update/delete note, subtask, comment) gọi thêm `hasPermission(..., note.BoardID, ...)`; handler đọc (GET) **không đổi** |
| `backend/internal/api/routes.go` | Đăng ký `GET /api/boards/{id}/roles`, `POST /api/boards/{id}/members` |
| `frontend/src/api.ts` | `listBoardRoles(boardId)`, `upsertBoardMember(boardId, userId, roleId)`; `approveKanbanUser` nhận thêm `boardId`+`roleId` |
| `frontend/src/pages/NotesPage.tsx` | `AdminPendingPanel` thêm dropdown chọn role (theo board đang active) khi approve; thêm panel nhỏ gán role cho user đã approve trên board hiện tại |

## Risks
- **User đã approve trước migration có `role_id = NULL`** — nếu `hasPermission` fail-closed (từ chối khi không có role) mà quên backfill, toàn bộ user cũ bị khoá hết quyền ghi ngay sau deploy. Migration bắt buộc: `UPDATE kanban_users SET role_id='role_member' WHERE role_id IS NULL AND status='approved'`.
- **`hasPermission` phải luôn trả `true` ngay khi `identity.IsOwner`** — không có role nào được phép giới hạn owner712002, đây là bất biến xuyên suốt từ module Kanban gốc.
- **Role trỏ tới row đã bị xoá** → `hasPermission` phải fail-closed (từ chối), không phải crash hoặc fail-open (cho qua).
- Không đụng `verifyOwnerPassword`/`OwnerPassword` gốc ở `playlists.go`.
- Handler đọc (GET note/board/column/label) **giữ nguyên** — module này chỉ giới hạn hành động ghi, chưa giới hạn đọc (đúng yêu cầu, vì role viewer trong bản này vẫn đọc được mọi thứ).

## Global constraints
- `owner712002` phải luôn có mọi quyền, không ngoại lệ — không role nào áp dụng lên owner.
- Không đụng `verifyOwnerPassword`/`OwnerPassword`/Playlists/Ebook NSFW.
- Chưa cho owner tự sửa permission set của role (để module riêng sau) — 4 role cố định với permission mặc định lần này.
- `hasPermission` fail-closed: không có role hợp lệ → từ chối, không bao giờ mặc định cho qua.
- Không thêm OAuth, không thêm billing (đã chốt loại khỏi toàn roadmap).

## Plan
- [ ] Task 1: Migration `db.go` — bảng `kanban_roles` (theo board) + `kanban_board_members`; seed 4 role cho board `default`; backfill user cũ thành `member` trên `default`
- [ ] Task 2: `auth_kanban.go` — `hasPermission(db, identity, boardID, resource, action)`; `approveUser` nhận `board_id`+`role_id`
- [ ] Task 3: `boards.go` — `createBoard` tự seed role + tự gán admin cho người tạo; áp `hasPermission` vào handler ghi (board/column/label); thêm `POST /api/boards/{id}/members`
- [ ] Task 4: `notes.go` — áp `hasPermission(..., note.BoardID, ...)` vào handler ghi (note/subtask/comment)
- [ ] Task 5: Wire `routes.go`
- [ ] Task 6: `frontend/src/api.ts` — `listBoardRoles`, `upsertBoardMember`, mở rộng `approveKanbanUser`
- [ ] Task 7: `NotesPage.tsx` — dropdown chọn role khi approve (theo board active) + panel gán role cho user cũ trên board mới + verify toàn diện (viewer/member/admin/owner, user cũ không bị lock out, người tạo board mới không tự khoá mình)

## Agent Task Assignment
| Task | Agent (CLI) | Lý do chọn | Status |
|------|------|------|------|
| Task 1: Migration `db.go` | Claude Code (sonnet) | Backfill role trên user thật đã tồn tại — sai sót khoá quyền toàn bộ user, rủi ro cao | pending |
| Task 2: `auth_kanban.go` | Claude Code (sonnet) | `hasPermission` là lõi bảo mật mới — phải đúng fail-closed, không giao CLI rẻ | pending |
| Task 3: `notes.go` | Claude Code (sonnet) | Áp permission đúng resource/action từng handler, dễ sai nếu chép máy móc | pending |
| Task 4: `boards.go` | Claude Code (sonnet) | Cùng rủi ro như Task 3 | pending |
| Task 5: Wire `routes.go` | OpenCode (`opencode/big-pickle`) | Đăng ký route thuần theo pattern cũ | pending |
| Task 6: `frontend/src/api.ts` | OpenCode (`opencode/big-pickle`) | Boilerplate client, lặp khuôn mẫu đã có | pending |
| Task 7: `NotesPage.tsx` + verify | Claude Code (sonnet) | Verify toàn nhánh quyền cần theo dõi sát, không giao CLI rẻ | pending |

## Success criteria
- User role `viewer`: GET note/board OK, POST/PUT/DELETE note đều 403
- User role `member`: CRUD note/comment OK; tạo/xoá board/column/label → 403
- User role `admin`: CRUD mọi thứ trong phạm vi module này (chưa có action nào riêng cho admin vs member ngoài board/column/label — ghi rõ trong verify)
- `owner712002` không đổi hành vi ở bất kỳ endpoint nào
- User đã approve **trước** migration vẫn dùng được sau backfill (không bị khoá)
- `go build`/`go vet`/`tsc --noEmit` sạch

## Render brief

### Task 1 — Migration: `kanban_roles` + `role_id` + backfill
1. *(add)* `CREATE TABLE kanban_roles (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, permissions TEXT NOT NULL, is_system INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL DEFAULT 0)`.
2. *(add)* Seed 4 role cố định ID (`role_owner`,`role_admin`,`role_member`,`role_viewer`) với permission JSON tương ứng, `ON CONFLICT (id) DO NOTHING` để idempotent.
3. *(add)* `ALTER TABLE kanban_users ADD COLUMN IF NOT EXISTS role_id TEXT`.
4. *(block)* Backfill: `UPDATE kanban_users SET role_id = 'role_member' WHERE role_id IS NULL AND status = 'approved'` — chạy mỗi lần migrate, idempotent nhờ điều kiện `IS NULL`.

**Prose:** Bước backfill là bước rủi ro cao nhất — nếu thiếu, mọi user đã được owner approve trước module này sẽ có `role_id = NULL` và `hasPermission` (fail-closed theo thiết kế) sẽ từ chối toàn bộ hành động ghi của họ ngay khi module này lên production, tạo ra một regression nghiêm trọng cho người dùng thật đang hoạt động bình thường. Việc dùng ID cố định cho 4 role hệ thống (thay vì `genHexID()` ngẫu nhiên) giữ cho migration idempotent qua nhiều lần restart, đúng convention `ON CONFLICT DO NOTHING` đã dùng cho board/cột mặc định ở module Kanban trước.

### Task 2 — `auth_kanban.go`: `hasPermission` + approve nhận role + list roles
1. *(add)* `hasPermission(db, identity, resource, action) bool` — nếu `identity.IsOwner` trả `true` ngay; nếu không, JOIN `kanban_users.role_id` → `kanban_roles.permissions`, parse JSON, kiểm tra `resource` có chứa `action` không.
2. *(add)* `approveUser` nhận thêm `role_id` trong body (tuỳ chọn); nếu trống, dùng `role_member`; validate `role_id` tồn tại trong `kanban_roles` trước khi gán.
3. *(add)* `GET /api/kanban/roles` — trả danh sách role (id, name), qua `verifyKanbanAccess` (mọi identity đã xác thực đọc được, để dropdown chọn role dùng).
4. *(block)* `hasPermission` fail-closed: role không tồn tại hoặc JSON permission lỗi parse → trả `false`, không panic, không mặc định cho qua.

**Prose:** `hasPermission` là điểm bảo mật lõi mới của module này — nguyên tắc bất biến là owner712002 luôn short-circuit về `true` trước khi chạm tới bất kỳ logic role nào, giữ đúng cam kết "owner luôn full quyền" đã xuyên suốt từ module Kanban gốc. Với user thường, việc fail-closed (từ chối khi không chắc) là lựa chọn có chủ đích: một lỗi parse JSON permission hay một `role_id` mồ côi (trỏ tới role đã bị xoá) phải luôn kết thúc bằng từ chối quyền, không bao giờ vô tình mở quyền — đây là hướng an toàn hơn nhiều so với fail-open trong một hệ thống phân quyền.

### Task 3 — `notes.go`: áp permission vào handler ghi
1. *(add)* `createNote`/`updateNote`/`deleteNote` gọi thêm `hasPermission(db, identity, "note", "create"/"update"/"delete")` sau khi qua `verifyKanbanAccess`, trả 403 nếu không đủ quyền.
2. *(add)* `createSubtask`/`updateSubtask`/`deleteSubtask` dùng permission `note` (subtask coi như thuộc note cha, không tách resource riêng ở module này).
3. *(add)* `createComment`/`deleteComment` dùng permission `comment`.
4. *(legacy)* `listNotes`/`listSubtasks`/`listComments` (GET) **không đổi** — vẫn chỉ qua `verifyKanbanAccess`, đúng yêu cầu module này chưa giới hạn đọc.

**Prose:** Việc gộp subtask vào permission `note` (thay vì tạo resource `subtask` riêng) là quyết định tối giản có chủ đích cho module này — subtask luôn là con của 1 note cụ thể, tách quyền riêng cho nó tạo thêm một chiều phức tạp (2 permission phải đồng bộ) mà chưa có nhu cầu thực tế nào đòi hỏi (ví dụ "được sửa note nhưng không được sửa subtask của nó" không phải use-case đã được yêu cầu). Giữ nguyên hoàn toàn nhánh đọc là ranh giới rõ ràng của module này: viewer đọc được mọi thứ, chỉ hành động ghi mới bị áp permission.

### Task 4 — `boards.go`: áp permission vào handler ghi
1. *(add)* `createBoard`/`updateBoard`/`deleteBoard` gọi `hasPermission(db, identity, "board", action)`.
2. *(add)* `createColumn`/`updateColumn`/`deleteColumn` dùng permission `column`.
3. *(add)* `createLabel`/`deleteLabel` dùng permission `label`.
4. *(legacy)* Handler đọc (list) không đổi; logic chặn xoá board/cột còn note (đã có từ module Kanban gốc) giữ nguyên, permission check chạy **trước** check đó.

**Prose:** Thứ tự kiểm tra (permission trước, rồi mới business-rule "còn note thì không xoá được") giữ nguyên tinh thần fail-fast — một user không có quyền xoá board không cần biết board đó có note hay không, tránh rò rỉ thông tin không cần thiết (biết được "board rỗng" hay "board có note" thông qua thông báo lỗi khác nhau, dù nhỏ, vẫn là rò rỉ không cần thiết cho người không có quyền).

### Task 5 — Wire `routes.go`
1. *(add)* `mux.HandleFunc("GET /api/kanban/roles", kh.listRoles)` theo đúng pattern các route kanban khác.

**Prose:** Đăng ký route thuần, không có logic nghiệp vụ, phù hợp CLI rẻ.

### Task 6 — `frontend/src/api.ts`
1. *(add)* `export type KanbanRole = { id: string; name: string }`; `listKanbanRoles(creds)`.
2. *(add)* Mở rộng `approveKanbanUser(id, password, roleId?)` — gửi `role_id` trong body nếu có.

**Prose:** Lớp client mỏng, lặp khuôn mẫu đã có ở các hàm admin khác trong file, phù hợp CLI rẻ triển khai theo brief này.

### Task 7 — `NotesPage.tsx`: dropdown role khi approve + verify
1. *(add)* `AdminPendingPanel` gọi `listKanbanRoles` khi mở, hiện dropdown chọn role (mặc định "member") cạnh mỗi user pending, gửi kèm khi bấm "Duyệt".
2. *(block)* Verify thật: tạo user role viewer → xác nhận POST note bị 403; tạo user role member → xác nhận CRUD note OK nhưng tạo board bị 403; xác nhận owner712002 không đổi hành vi ở mọi endpoint; xác nhận user approve từ **trước** module này (nếu còn) vẫn hoạt động sau backfill.

**Prose:** Bước verify cuối là bằng chứng thật cho đúng bất biến quan trọng nhất của module — không được để sót một nhánh quyền nào (viewer/member/admin/owner) chưa kiểm chứng, và đặc biệt phải xác nhận user cũ (đã approve trước khi module này tồn tại) không bị khoá ngoài ý muốn sau khi cột `role_id` xuất hiện — đây là quy luật đã lặp lại xuyên suốt roadmap: mọi migration ảnh hưởng dữ liệu người dùng thật đều phải verify nhánh "dữ liệu cũ vẫn sống sót", không chỉ nhánh "dữ liệu mới hoạt động đúng".

## Notes
- Invoked via: user xác nhận "bỏ bill với oauth còn lại thì hợp lý, muốn nó có trong dự án, break nhỏ việc và triển khai từng module" sau khi agent research trực tiếp source kaneo → lên roadmap 17 module → bắt đầu module 1
- Đây là **module 1/17** — các module sau (Workspace, Invite email, Task ID/rich-text, Subtask=task con, Activity log, Attachment, Time tracking, Label theo workspace, Notification đa kênh, Search backend, MCP tool, Realtime WS, Import/export, Workflow rule, Slack/Discord/Telegram, GitHub/Gitea sync) sẽ là proposal riêng từng module, không làm chung lần này
- Liên quan: [[030826-kanban-notes-upgrade-be-fe]]

## Origin
- **Draft:** `wiki/sources/draft/040826-kanban-roles-permissions-be-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
