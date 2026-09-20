---
type: draft
title: Module 2/17 roadmap kaneo-port - Invite qua link (khong gui mail thuc, owner tu gui link)
status: proposed
tags: [feature, kanban, invitation, kaneo-port, be-fe]
timestamp: 2026-08-04
---

# 040826-kanban-invite-links-be-fe
**Type:** draft
**Status:** proposed
**Tags:** feature, kanban, invitation, kaneo-port, be-fe
**Proposed:** 2026-08-04
**Sequence diagram:** [html/040826-kanban-invite-links-be-fe-seq.html](../../../html/040826-kanban-invite-links-be-fe-seq.html)

## What
**Module 2/17** roadmap port kaneo. Thêm luồng invite: owner/admin của 1 board nhập email + chọn role → hệ thống sinh 1 link mời có token, owner tự gửi link đi bằng bất kỳ cách nào (Zalo/Telegram/email tay) — **không gửi mail thật** (đã hỏi lại user, chọn phương án không cần SMTP). Người nhận mở link, tự đặt username/password → **được approve ngay lập tức** với đúng role đã chọn (không qua hàng chờ pending như luồng tự đăng ký hiện có).

## Quan hệ với luồng đăng ký hiện có
**Không thay thế** — luồng tự đăng ký + owner duyệt tay (module Kanban gốc) vẫn giữ nguyên 100%, dùng khi không biết trước email người muốn thêm. Invite-link là đường **nhanh hơn**, dùng khi owner đã biết muốn thêm ai vào board nào với role gì — mở thẳng luôn, không cần vào lại panel duyệt sau đó.

## Affected
| File / Symbol | Thay đổi |
|---|---|
| `backend/internal/db/db.go` | Bảng `kanban_invitations` (id/token, board_id, email, role_id, status, created_at, expires_at) mới |
| `backend/internal/api/auth_kanban.go` (mới file `invitations.go` hoặc thêm vào đây) | `createInvitation`, `getInvitation` (public), `acceptInvitation` (public, tạo user status=approved ngay + membership + đăng nhập luôn), `listInvitations`, `revokeInvitation` |
| `backend/internal/api/routes.go` | Route mới: `POST/GET /api/boards/{id}/invitations`, `POST /api/boards/{id}/invitations/{invId}/revoke`, `GET /api/kanban/invitations/{token}` (public), `POST /api/kanban/invitations/{token}/accept` (public) |
| `frontend/src/api.ts` | Client cho các endpoint trên |
| `frontend/src/pages/InvitationAcceptPage.tsx` (mới) | Trang public xem preview lời mời + form đặt username/password |
| `frontend/src/AppRoutes.tsx` | Thêm route `/invitation/accept/:token` |
| `frontend/src/pages/NotesPage.tsx` | `AdminPendingPanel` thêm ô "Mời qua link": nhập email + chọn role → hiện link vừa tạo (nút copy) |

## Risks
- **Token phải sinh bằng `crypto/rand`** (giống session token), không dùng ID ngắn dễ đoán — token này cho phép tạo tài khoản **approved ngay**, mạnh hơn session token thông thường.
- **`acceptInvitation` phải kiểm tra status='pending' VÀ chưa hết hạn** trước khi cho tạo user — token đã dùng (`accepted`) hoặc bị revoke hoặc hết hạn phải từ chối rõ ràng, không tạo user.
- **`getInvitation` (public, không cần đăng nhập)** chỉ trả về thông tin tối thiểu (tên board, tên role, email đã mời) — **không** trả token của người khác hay dữ liệu board thật (note/member) qua endpoint này.
- Invite email trùng với username đã tồn tại → `acceptInvitation` phải báo lỗi rõ (username đã tồn tại), không tạo user mồ côi (user tạo được nhưng membership insert lỗi).
- Mời trùng email vào cùng 1 board khi đã có lời mời `pending` chưa hết hạn → trả lại **đúng link cũ** (idempotent) thay vì tạo thêm token mới gây rối.
- Endpoint tạo/xem danh sách/revoke invitation phải qua `hasPermission(board, "board", "update")` — dùng lại đúng permission đã có từ module 1, không tạo resource `invitation` riêng (giữ tối giản).

## Global constraints
- Không thêm SMTP/email thật ở module này — chỉ sinh link, owner tự gửi (đã xác nhận với user).
- Không đụng luồng tự đăng ký + owner duyệt tay hiện có (module Kanban gốc) — 2 luồng chạy song song, không thay thế nhau.
- Không đụng `verifyOwnerPassword`/Playlists/Ebook NSFW.
- `acceptInvitation` fail-closed: token sai/hết hạn/đã dùng/bị revoke → từ chối rõ, không tạo user.
- Không thêm OAuth, không thêm billing (đã chốt loại khỏi toàn roadmap).

## Plan
- [ ] Task 1: Migration `db.go` — bảng `kanban_invitations`
- [ ] Task 2: Backend — `createInvitation`, `listInvitations`, `revokeInvitation` (owner/admin của board, qua `hasPermission`)
- [ ] Task 3: Backend — `getInvitation` (public) + `acceptInvitation` (public, tạo user approved + membership + đăng nhập luôn)
- [ ] Task 4: Wire `routes.go`
- [ ] Task 5: `frontend/src/api.ts` — client cho 5 endpoint trên
- [ ] Task 6: `InvitationAcceptPage.tsx` (mới) + route `/invitation/accept/:token`
- [ ] Task 7: `NotesPage.tsx` — ô "Mời qua link" trong `AdminPendingPanel` + verify toàn diện (token hết hạn/revoke/dùng lại đều bị chặn đúng, accept thành công vào đúng board+role)

## Agent Task Assignment
| Task | Agent (CLI) | Lý do chọn | Status |
|------|------|------|------|
| Task 1: Migration `db.go` | Claude Code (sonnet) | Bảng mới độc lập, rủi ro thấp nhưng cần đúng convention token/expires | pending |
| Task 2: Backend tạo/list/revoke invitation | Claude Code (sonnet) | Permission + idempotent-invite-trùng cần judgement | pending |
| Task 3: Backend accept (public, tạo user) | Claude Code (sonnet) | Điểm bảo mật nhất — token mạnh hơn session, fail-closed bắt buộc đúng | pending |
| Task 4: Wire `routes.go` | OpenCode (`opencode/big-pickle`) | Đăng ký route thuần | pending |
| Task 5: `frontend/src/api.ts` | OpenCode (`opencode/big-pickle`) | Boilerplate client | pending |
| Task 6: `InvitationAcceptPage.tsx` | Claude Code (sonnet) | Trang public mới, cần đúng UX rõ ràng (hiện tên board/role trước khi hỏi mật khẩu) | pending |
| Task 7: `NotesPage.tsx` + verify | Claude Code (sonnet) | Verify nhánh fail-closed cần theo dõi sát | pending |

## Success criteria
- Owner tạo invite email X, role "member", board "default" → nhận link `/invitation/accept/<token>`
- Mở link (không cần đăng nhập trước) → thấy đúng tên board + role được mời
- Đặt username/password → tài khoản **approved ngay**, đăng nhập thẳng vào board đúng role đã mời (không qua hàng chờ pending)
- Dùng lại link đã accept → bị từ chối rõ ràng, không tạo user thứ 2
- Revoke invite → link ngừng hoạt động ngay
- Mời lại đúng email vào đúng board khi invite cũ còn pending → trả lại đúng link cũ, không tạo token mới
- Luồng tự đăng ký cũ không bị ảnh hưởng

## Render brief

### Task 1 — Migration `kanban_invitations`
1. *(add)* `CREATE TABLE kanban_invitations (id TEXT PRIMARY KEY, board_id TEXT NOT NULL, email TEXT NOT NULL, role_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER), expires_at INTEGER NOT NULL)`.
2. *(legacy)* Không đụng bảng nào khác.

**Prose:** Bảng độc lập hoàn toàn, không có khoá ngoại cứng tới `kanban_users` (vì lúc tạo invite, user nhận chưa tồn tại) — chỉ tới `kanban_roles`/`kanban_boards` theo id thường. Token dùng luôn làm `id` (khoá chính) thay vì tách 2 cột, giữ bảng đơn giản nhất có thể.

### Task 2 — Backend tạo/list/revoke invitation
1. *(add)* `POST /api/boards/{id}/invitations {email, role_id}` — qua `hasPermission(board,"board","update")`; nếu đã có invite `pending` chưa hết hạn cho đúng (board,email) → trả lại invite đó (idempotent), không tạo mới; ngược lại sinh token `crypto/rand` (32 byte, giống session token), `expires_at = now + 7 ngày`.
2. *(add)* `GET /api/boards/{id}/invitations` — list, cùng permission.
3. *(add)* `POST /api/boards/{id}/invitations/{invId}/revoke` — set `status='revoked'`.

**Prose:** Việc tái sử dụng đúng `hasPermission(board,"board","update")` từ module 1 thay vì tạo permission `invitation` riêng là quyết định tối giản có chủ đích — quản lý ai được vào board vốn đã là một phần của "cập nhật board", tách riêng thêm 1 resource permission cho việc này chỉ tạo thêm một chiều cấu hình mà chưa ai yêu cầu. Idempotent-invite-trùng (trả lại link cũ nếu còn pending) tránh tình huống owner bấm nhầm 2 lần ra 2 link khác nhau cho cùng 1 người, gây nhầm lẫn không cần thiết.

### Task 3 — Backend accept (public)
1. *(add)* `GET /api/kanban/invitations/{token}` (không cần `verifyKanbanAccess`) — trả `{board_name, role_name, email, status}` tối thiểu, không lộ dữ liệu board thật.
2. *(add)* `POST /api/kanban/invitations/{token}/accept {username, password}` (không cần đăng nhập trước) — validate `status='pending'` và `expires_at > now`; validate username chưa tồn tại; bcrypt hash; tạo `kanban_users` với `status='approved'` **ngay** (khác hẳn luồng tự đăng ký đi vào `pending`); tạo `kanban_board_members` với `board_id`+`role_id` từ invitation; set `status='accepted'`; sinh session token, đăng nhập luôn (trả về giống response của `/login`).
3. *(block)* Token sai/hết hạn/`accepted`/`revoked` → từ chối rõ, không tạo gì cả.

**Prose:** Đây là endpoint nhạy cảm nhất của module — nó tự cấp quyền `approved` ngay lập tức mà không qua bước owner duyệt tay, nên bản thân cái token phải đóng vai trò "bằng chứng đã được duyệt trước" — an ninh của cả module dồn hết vào việc token đủ khó đoán (`crypto/rand` 32 byte, giống session token) và việc kiểm tra trạng thái đủ nghiêm (fail-closed ở mọi nhánh: sai/hết hạn/dùng rồi/bị revoke). Trả session token ngay sau khi accept (giống hệt response `/login`) giúp người được mời vào thẳng board mà không phải qua thêm 1 bước đăng nhập riêng — trải nghiệm liền mạch từ "mở link" tới "đang ở trong board".

### Task 4 — Wire `routes.go`
1. *(add)* Đăng ký 5 route mới theo đúng pattern cũ, 2 route public (`GET /api/kanban/invitations/{token}`, `POST /api/kanban/invitations/{token}/accept`) không đứng sau gate nào trong handler tương ứng.

**Prose:** Route thuần, không logic nghiệp vụ.

### Task 5 — `frontend/src/api.ts`
1. *(add)* `createInvitation`, `listInvitations`, `revokeInvitation` (dùng `KanbanCreds` như các hàm admin khác); `getInvitationPreview(token)`, `acceptInvitation(token, username, password)` — 2 hàm này **không nhận creds** vì là public.

**Prose:** Client mỏng, lặp khuôn mẫu — điểm khác biệt duy nhất là 2 hàm public không cần `KanbanCreds`, phải để rõ trong type signature để không ai lỡ tay gọi kèm mật khẩu owner vào 1 endpoint public.

### Task 6 — `InvitationAcceptPage.tsx` (mới)
1. *(add)* Route `/invitation/accept/:token` (public, ngoài `DialogProvider`/`PlayerProvider` vẫn ổn vì các provider này không yêu cầu đăng nhập).
2. *(add)* Gọi `getInvitationPreview(token)` lúc mount → hiện "Bạn được mời vào board X với vai trò Y" (hoặc thông báo lỗi nếu token sai/hết hạn).
3. *(add)* Form username/password → gọi `acceptInvitation` → lưu token vào đúng `sessionStorage` key đã dùng cho luồng login thường (`cozyroom_kanban_token`...) → chuyển hướng sang `/notes`.

**Prose:** Trang này cố tình **không** dùng lại `GateScreen` của `NotesPage.tsx` — ngữ cảnh khác nhau (một bên là "tôi đã biết mình được mời vào đâu", một bên là "tôi tự đăng ký chưa biết được duyệt hay chưa") nên thông tin hiển thị trước khi hỏi mật khẩu cũng khác nhau, tách trang riêng giữ mỗi trang đơn giản đúng vai trò của nó thay vì nhồi nhiều nhánh điều kiện vào 1 component.

### Task 7 — `NotesPage.tsx` ô mời qua link + verify
1. *(add)* Trong `AdminPendingPanel`, thêm ô nhập email + dropdown role + nút "Tạo link mời" → hiện link kết quả kèm nút copy.
2. *(block)* Verify: accept 1 link → vào board đúng role; dùng lại link đó → bị chặn; revoke 1 link khác rồi thử accept → bị chặn; mời trùng email/board 2 lần khi lần đầu còn pending → nhận lại đúng link cũ.

**Prose:** Verify phải phủ đủ toàn bộ nhánh "thất bại" (dùng lại, revoke, hết hạn) chứ không chỉ nhánh "thành công" — đúng quy luật đã lặp lại từ module 1, vì bản thân giá trị của cơ chế invite nằm ở việc các nhánh chặn hoạt động đúng, không chỉ nhánh cho-qua.

## Notes
- Invoked via: user "tiếp tục" roadmap sau module 1 → hỏi lại cách gửi invite (mail thật hay chỉ link) → chọn chỉ sinh link, owner tự gửi
- Đây là module 2/17 — còn 15 module sau
- Liên quan: [[040826-kanban-roles-permissions-be-fe]]

## Origin
- **Draft:** `wiki/sources/draft/040826-kanban-invite-links-be-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
