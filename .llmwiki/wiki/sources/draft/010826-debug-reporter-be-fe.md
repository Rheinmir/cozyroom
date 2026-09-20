---
type: draft
title: Nut debug noi element picker bao loi luu queue DB
status: proposed
tags: [feature, debug-tool, element-picker, mcp, be-fe]
timestamp: 2026-08-01
---

# 010826-debug-reporter-be-fe
**Type:** draft
**Status:** proposed
**Tags:** feature, debug-tool, element-picker, mcp, be-fe
**Proposed:** 2026-08-01
**Sequence diagram:** [html/010826-debug-reporter-be-fe-seq.html](../../../html/010826-debug-reporter-be-fe-seq.html)

## What
Thêm nút debug nhỏ nổi trên mọi màn hình frontend — bật lên cho phép click chọn đúng vùng UI đang lỗi (element picker: highlight outline theo con trỏ, khoá lại khi click), viết mô tả, gửi lên backend lưu vào 1 bảng Postgres persistent (không phải ring buffer in-memory như `/api/debug/requests` hiện có, vì báo lỗi cần giữ lâu dài chờ xử lý). Agent đọc được qua 2 MCP tool mới; tạo GitHub issue lên `rheinmir/setup` chỉ làm bằng `gh issue create` thủ công khi user yêu cầu cụ thể — không tự động.

## Tiền lệ đã tra cứu (qua `/query`)

- `backend/internal/api/reqlog.go` (`/api/debug/requests`) đã có tiền lệ: endpoint debug **public, không gate password** — bug-report endpoint mới đi theo đúng convention này (không dùng `verifyOwnerPassword`), vì đây là công cụ debug nội bộ giống nhau về bản chất.
- Khác biệt quan trọng: `/api/debug/requests` dùng ring buffer in-memory 500 dòng (mất khi restart pod) — phù hợp cho log request tức thời. Bug report thì cần **giữ lâu dài chờ xử lý** → bắt buộc bảng Postgres thật, không ring buffer.
- Kiến trúc MCP tool đã có sẵn (`backend/internal/mcp/registry.go`, 23 tool theo [[MCPToolsCheatsheet]]) — thêm 2 tool mới (`list_bug_reports`, `get_bug_report`) đúng pattern read-only tool đã có (`list_artists`, `get_stats`...).
- `CAPABILITIES.md` liệt kê skill `/raise-issue` và `/orca-issue` nhưng **cả 2 KHÔNG có trong danh sách skill thực sự khả dụng của phiên hiện tại** — file này có ghi chú tự sinh "SINH BẰNG CODE... chạy lại để cập nhật", nên đây nhiều khả năng là tài liệu cũ/chưa đồng bộ. Không phụ thuộc 2 skill đó — việc tạo GitHub issue dùng thẳng `gh issue create` (đã xác nhận `gh` CLI có sẵn) khi user yêu cầu, độc lập hoàn toàn với việc 2 skill kia có cài đúng hay không.
- `tour-guide` skill dùng convention `data-tour` attribute để đánh dấu element ổn định — tái dùng đúng attribute này khi suy ra "component hint" cho report (ưu tiên `data-tour` nếu có, fallback về className/tagName).

## Affected

| File | Thay đổi |
|---|---|
| `backend/internal/db/db.go` | Migration bảng mới `debug_reports` |
| `backend/internal/api/debugreports.go` (mới) | Handlers `POST /api/debug/reports`, `GET /api/debug/reports` — không gate password |
| `backend/internal/api/routes.go` | Đăng ký 2 route mới |
| `backend/internal/mcp/registry.go` | Thêm 2 tool: `list_bug_reports`, `get_bug_report` |
| `frontend/src/api.ts` | Thêm hàm `createDebugReport` |
| `frontend/src/components/DebugReporter.tsx` (mới) | Nút nổi + overlay element picker + form mô tả |
| `frontend/src/AppRoutes.tsx` | Mount `<DebugReporter />` cạnh `InstallBanner`/`PlayerBar` |
| `frontend/src/index.css` | Style tối giản cho nút, overlay highlight, form |

## Risks

- **Overlay picker có thể chặn nhầm click bình thường nếu bật nhầm chế độ** — bắt buộc picker overlay CHỈ chiếm quyền bắt sự kiện click khi user đã chủ động bật nút debug; tắt đi thì mọi thứ hoạt động y hệt trước, không còn overlay nào tồn tại trong DOM.
- **Trùng vị trí z-index với RadialNav/PlayerBar/MobileNav** (đều là fixed-position UI) — cần test bằng mắt sau khi thêm, đặt nút debug ở góc chưa ai dùng (góc trên, tránh PlayerBar dưới cùng và Sidebar bên trái).
- **Bảng `debug_reports` phát triển không giới hạn** nếu không ai xử lý — chấp nhận được cho bản đầu (đây là "hàng đợi" chờ người xử lý thủ công, không phải hệ thống tự dọn); không thêm cơ chế tự xoá trong bản đầu.
- **Không có ảnh chụp màn hình** trong bản đầu (đã xác nhận với user, ưu tiên đơn giản trước) — chỉ ghi route + component hint + toạ độ + mô tả text; nếu sau này cần debug hình ảnh, làm bổ sung riêng.
- **`gh issue create` là thao tác công khai, hiện ra ngoài** (tạo issue thật trên GitHub) — chỉ chạy khi user yêu cầu rõ ràng ở từng lần, không tự động hoá, đúng "Executing actions with care" — không đưa vào bất kỳ luồng tự động nào của tính năng này.

## Global constraints

- Không gate password cho endpoint bug-report — đúng convention debug tool nội bộ đã có (`/api/debug/requests`).
- Bảng `debug_reports` dùng Postgres thật, không phải ring buffer — báo lỗi phải sống sót qua restart pod.
- Không tự động tạo GitHub issue ở bất kỳ đâu trong luồng — việc đó luôn là hành động thủ công, riêng biệt, do user yêu cầu.
- Overlay picker không được có mặt trong DOM/không bắt sự kiện gì khi ở trạng thái tắt — không ảnh hưởng bất kỳ tương tác nào khác của app khi không dùng.
- Không đụng `PlayerContext.tsx` hay bất kỳ logic phát nhạc nào — đây là overlay UI độc lập hoàn toàn.
- Không bắt buộc chụp ảnh màn hình ở bản đầu — chỉ text + metadata vị trí/route.

## Plan

- [ ] Task 1: Migration `db.go` — bảng `debug_reports` (id, route, component_hint, x, y, description, user_agent, status, created_at)
- [ ] Task 2: Backend `debugreports.go` — `POST/GET /api/debug/reports`, không gate password; wire vào `routes.go`
- [ ] Task 3: MCP tools `list_bug_reports`/`get_bug_report` trong `registry.go`
- [ ] Task 4: `frontend/src/api.ts` — hàm `createDebugReport`
- [ ] Task 5: `DebugReporter.tsx` — nút nổi + element picker overlay (highlight theo hover, khoá khi click, suy ra component hint ưu tiên `data-tour`) + form mô tả + submit; mount vào `AppRoutes.tsx`
- [ ] Task 6: Verify — build sạch, deploy, gửi 1 report test end-to-end, xác nhận MCP tool đọc được, xác nhận picker không chặn tương tác khi tắt và không ảnh hưởng phát nhạc

## Agent Task Assignment

| Task | Agent (CLI) | Lý do chọn | Status |
|------|------|------|------|
| Task 1: Migration `db.go` | Claude Code (sonnet) | Đụng file migration dùng chung, theo đúng convention Postgres hiện tại | pending |
| Task 2: Backend `debugreports.go` + wire routes | Claude Code (sonnet) | Endpoint mới cần đúng quyết định "không gate" (khác Kanban Note) — cần judgement | pending |
| Task 3: MCP tools | Claude Code (sonnet) | Đụng `registry.go` dùng chung cho 23 tool khác — cần cẩn trọng không phá tool cũ | pending |
| Task 4: `frontend/src/api.ts` | OpenCode (`opencode/big-pickle`) | Boilerplate CRUD client thuần, copy pattern gọi API đã có sẵn trong file | pending |
| Task 5: `DebugReporter.tsx` + mount | Claude Code (sonnet) | Element picker overlay cần đúng UX an toàn (không chặn nhầm click khi tắt) — cần judgement kỹ thuật, tránh over-engineer | pending |
| Task 6: Verify end-to-end | Claude Code (sonnet) | Cần verify thật trên production (build, deploy, test report thật, xác nhận không ảnh hưởng player) — không giao CLI rẻ | pending |

## Success criteria

- Nút debug hiện ở mọi route (kiểm vài trang: `/`, `/videos`, `/ai`, `/notes`)
- Bật picker → hover hiện outline đúng element, click → form mô tả hiện ra tại đúng vị trí
- Submit → `POST /api/debug/reports` lưu thành công vào Postgres; `GET /api/debug/reports` (hoặc MCP tool `list_bug_reports`) thấy lại đúng report vừa gửi với route + component hint + mô tả
- Tắt picker → không còn overlay nào trong DOM, mọi tương tác UI khác (kể cả phát nhạc) hoạt động y hệt trước khi thêm tính năng
- `go build`/`go vet`/`tsc --noEmit` sạch, không regression ở PlayerContext/gapless/lyrics

## Render brief

### Task 1 — Migration bảng `debug_reports`
1. *(add)* Thêm `CREATE TABLE IF NOT EXISTS debug_reports (id TEXT PRIMARY KEY, route TEXT NOT NULL, component_hint TEXT NOT NULL DEFAULT '', x INTEGER NOT NULL DEFAULT 0, y INTEGER NOT NULL DEFAULT 0, description TEXT NOT NULL, user_agent TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open', created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER))` vào `db.go`, đặt cạnh các bảng debug/log khác.
2. *(legacy)* Không đụng bảng nào khác đã có.

**Prose:** Bảng này độc lập hoàn toàn, không khoá ngoại tới track/album/artist vì báo lỗi là dữ liệu vận hành riêng, không gắn với thư viện nhạc. Cột `status` mặc định `'open'` để sau này có thể lọc báo cáo đã xử lý mà không cần xoá dữ liệu — đơn giản, đủ dùng cho một hàng đợi chờ người xử lý thủ công.

### Task 2 — Backend handlers, không gate password
1. *(add)* `POST /api/debug/reports` nhận `{route, component_hint, x, y, description, user_agent}`, sinh id, insert vào `debug_reports`.
2. *(add)* `GET /api/debug/reports` trả danh sách (mới nhất trước), dùng cho cả UI triage sau này lẫn MCP tool.
3. *(legacy)* Không dùng `verifyOwnerPassword` — đúng convention `/api/debug/requests` đã có, đây là công cụ nội bộ không cần bảo vệ bằng mật khẩu.

**Prose:** Quyết định không gate mật khẩu ở đây khác hẳn Kanban Note (nơi dữ liệu là riêng tư cá nhân) — báo lỗi kỹ thuật không phải dữ liệu nhạy cảm, và việc thêm rào cản mật khẩu chỉ khiến việc báo lỗi nhanh trở nên phiền phức hơn, đi ngược mục đích chính của tính năng là hạ thấp chi phí báo lỗi xuống mức thấp nhất có thể.

### Task 3 — MCP tools cho agent đọc queue
1. *(add)* `list_bug_reports` — không input hoặc `status?: string` tuỳ chọn, trả danh sách rút gọn.
2. *(add)* `get_bug_report` — input `id: string`, trả đầy đủ 1 report.
3. *(legacy)* Không đụng 23 tool đã có trong `registry.go`.

**Prose:** Đây là bước nối agent vào hàng đợi báo lỗi mà không cần user tự copy-paste nội dung report cho agent — agent có thể tự `list_bug_reports` để thấy còn gì tồn đọng, giống hệt cách các tool đọc-only khác (`list_artists`, `get_stats`) đã hoạt động trong hệ thống này.

### Task 4 — Frontend API client
1. *(add)* `createDebugReport(payload)` trong `api.ts`, POST tới endpoint mới, không cần header mật khẩu.
2. *(legacy)* Không đổi hàm API khác.

**Prose:** Lớp mỏng bọc `fetch` theo đúng khuôn mẫu các hàm khác trong file, không có logic phức tạp — phù hợp giao cho CLI rẻ hơn xử lý.

### Task 5 — Component `DebugReporter.tsx` + mount
1. *(add)* Nút nổi nhỏ (góc trên, tránh trùng PlayerBar/Sidebar/RadialNav) toggle chế độ picker.
2. *(add)* Khi bật: overlay full-screen lắng nghe `mousemove` dùng `document.elementFromPoint` vẽ khung highlight quanh element đang hover; `click` khoá lại element đó, chặn sự kiện gốc (`preventDefault`/`stopPropagation`) để không kích hoạt hành động thật bên dưới.
3. *(add)* Suy ra "component hint": ưu tiên thuộc tính `data-tour` gần nhất, fallback className, fallback tagName.
4. *(add)* Hiện form nhỏ tại vị trí click để nhập mô tả, submit gọi `createDebugReport`.
5. *(block)* Khi tắt picker → gỡ hết overlay + listener khỏi DOM, không còn dấu vết nào.
6. *(add)* Mount `<DebugReporter />` trong `AppRoutes.tsx` cạnh `InstallBanner`.

**Prose:** Nguyên tắc an toàn quan trọng nhất của component này là tính "tắt là sạch hoàn toàn" — khi picker đang tắt, không được có bất kỳ overlay, listener, hay state nào còn sót lại có thể vô tình chặn hoặc làm chậm tương tác bình thường của người dùng, đặc biệt là các tương tác liên quan tới phát nhạc vốn cần phản hồi tức thời. Việc chặn sự kiện gốc khi picker ĐANG bật (`preventDefault`/`stopPropagation`) là chủ đích — trong lúc đang chọn vùng lỗi, click không được vô tình kích hoạt hành động thật của element bên dưới (ví dụ bấm nhầm nút play), nhưng ngay khi tắt picker, toàn bộ hành vi phải trở về y hệt trạng thái trước khi có tính năng này tồn tại.

### Task 6 — Verify end-to-end
1. *(add)* Build + typecheck sạch, deploy K8s.
2. *(add)* Test thật: bật picker, chọn 1 element, gửi mô tả, xác nhận backend lưu đúng và đọc lại được (kể cả qua MCP tool).
3. *(block)* Nếu phát hiện overlay chặn tương tác bình thường lúc tắt, hoặc bất kỳ ảnh hưởng nào tới phát nhạc → dừng, sửa lại trước khi coi là xong.
4. *(legacy)* Xác nhận `/api/debug/requests` (ring buffer cũ) không bị đụng, vẫn hoạt động song song độc lập.

**Prose:** Vì đây là tính năng chèn một overlay toàn màn hình có khả năng bắt sự kiện chuột trên MỌI trang của app, bước verify không thể chỉ dừng ở "gửi được 1 report thành công" — phải chủ động thử tắt/bật nhiều lần, thử tương tác với player trong lúc picker tắt, để chắc chắn tính năng mới không âm thầm để lại tác dụng phụ trên toàn bộ trải nghiệm ứng dụng.

## Notes
- Invoked via: `/orca-workflow` → `/query` → `/propose` skill (gọi từ lệnh `/orca-cli` nhưng nội dung là feature request, không phải thao tác Orca CLI thật)
- Tạo GitHub issue lên `rheinmir/setup` (tag `orca`) là bước THỦ CÔNG riêng biệt bằng `gh issue create`, thực hiện khi user yêu cầu cụ thể — không nằm trong phạm vi code của proposal này
- Liên quan: [[MCPToolsCheatsheet]], [[MCPServer]]

## Origin
- **Draft:** `wiki/sources/draft/010826-debug-reporter-be-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
