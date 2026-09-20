---
type: draft
title: Ve lai 10 icon sidebar theo phong cach ribbon Microsoft Office/Enterprise
status: proposed
tags: [feature, sidebar, icons, design, fe]
timestamp: 2026-08-30
---

# 300826-sidebar-ribbon-icons-fe
**Type:** draft
**Status:** proposed
**Tags:** feature, sidebar, icons, design, fe
**Proposed:** 2026-08-30
**Sequence diagram:** [html/300826-sidebar-ribbon-icons-fe-seq.html](../../../html/300826-sidebar-ribbon-icons-fe-seq.html)

## What
Vẽ lại toàn bộ 10 icon emoji trong `Sidebar.tsx` (🏠🎬📚📖📈🎵🗒️🤖📊📡) thành SVG custom theo phong cách ribbon của Microsoft Office/Enterprise — hình khối phẳng (flat), 1-2 tông màu mỗi icon, mỗi mục nav mang một màu accent riêng để dễ phân biệt nhanh khi lướt mắt (đúng cách Word/Excel/PowerPoint/OneNote mỗi app một màu app-icon riêng, dù chữ/UI xung quanh vẫn trung tính).

## Affected
| File / Symbol | Thay đổi |
|---|---|
| `frontend/src/components/Sidebar.tsx` | 10 chỗ `<span className="nav-link-icon">{emoji}</span>` → inline SVG tương ứng |
| `frontend/src/index.css` | Không cần class mới — SVG kích thước cố định `18x18`, dùng `currentColor` không cần thiết vì mỗi icon tự mang màu riêng (không theo `--text`) |

## Risks
- **Vi phạm có chủ đích "The One Accent Rule"** trong `DESIGN.md` (Paper White là accent duy nhất) — đây là ngoại lệ cục bộ, chỉ áp dụng cho 10 icon nav, không lan ra bất kỳ UI nào khác. Cần ghi rõ ngoại lệ này vào `DESIGN.md` sau khi merge để tránh hiểu lầm "màu đã lan ra toàn hệ thống" ở lần audit design sau.
- Icon màu phải vẫn đọc được trên cả trạng thái `.active` (nền `--surface-hover` sáng hơn) lẫn trạng thái nghỉ (nền `--bg` tối) — không đổi màu icon theo active/inactive, giữ y hệt cách Office giữ nguyên màu app-icon dù tab có active hay không.
- Sidebar có chế độ collapsed (`COLLAPSED_W`, chỉ hiện icon không hiện chữ) — icon phải đủ rõ ràng đứng một mình, không dựa vào text bên cạnh để phân biệt.
- Không đổi cấu trúc `NavLink`/routing/`title` (tooltip) hiện có — chỉ thay nội dung bên trong `<span className="nav-link-icon">`.

## Global constraints
- Không đụng backend, không đụng route/handler dùng chung nào khác trong `AppRoutes.tsx`/`routes.go`.
- Không đổi kích thước `.nav-link-icon` hiện tại (giữ layout sidebar nguyên vẹn) — SVG set `width`/`height` khớp kích thước emoji cũ đang chiếm.
- Giữ nguyên toàn bộ `title`/`aria-label`/text nav (đa ngôn ngữ `t(...)`) — chỉ đổi phần icon.

## Plan
- [x] Task 1: Thiết kế + implement 10 SVG icon phong cách ribbon vào `Sidebar.tsx`
- [x] Task 2: Verify trực quan bằng browser (cả 2 trạng thái expanded/collapsed, active/inactive)

## Agent Task Assignment
| Task | Agent (CLI) | Lý do chọn | Status |
|------|------|------|------|
| Task 1: Thiết kế + implement 10 icon | Claude Code (sonnet) | Toàn bộ 10 icon nằm chung 1 file (`Sidebar.tsx`) — tách cho nhiều agent chạy song song sẽ tự đụng nhau trên cùng file; đây cũng là việc cần gu thẩm mỹ nhất quán xuyên suốt 10 icon (không phải boilerplate lặp khuôn) nên không phù hợp tier OpenCode/Kiro | done |
| Task 2: Verify trực quan | Claude Code (sonnet) | Cần mở browser thật kiểm tra cả 4 tổ hợp trạng thái (expanded/collapsed × active/inactive), không phải việc CLI khác tự chạy được không cần giám sát | done |

## Verified (Playwright, dev server thật)
- Expanded + "Nghệ sĩ" active: 10 icon đủ màu, không trùng, không lệch dòng với text.
- Expanded + "Phim" active: đổi route active state chỉ đổi nền/text, màu icon giữ nguyên (mic vẫn cam, clapperboard vẫn đỏ-cam...).
- Collapsed (56px, chỉ icon): cả 10 icon vẫn rõ ràng đứng riêng, không bị cắt, không cần text hỗ trợ nhận diện.
- `tsc --noEmit` sạch, chỉ còn lỗi pre-existing không liên quan ở `TrendingChartMode.tsx`.

## Success criteria
- Cả 10 icon nav đổi từ emoji sang SVG, mỗi icon 1 màu accent riêng biệt, không icon nào trùng màu với icon liền kề
- Icon rõ ràng, đọc được ở cả sidebar mở rộng (220px) và thu gọn (56px, chỉ icon)
- Trạng thái `.active` (route hiện tại) không làm icon bị mất màu hay đổi màu — chỉ nền/text đổi như cũ
- Không phá layout — icon vẫn nằm đúng vị trí, không lệch dòng với text nav
- `tsc --noEmit` sạch (trừ lỗi pre-existing đã biết ở `TrendingChartMode.tsx`)

## Render brief

### Task 1 — 10 icon ribbon-style
1. *(add)* Mỗi icon là 1 SVG `viewBox="0 0 20 20"` `width={18} height={18}`, hình khối phẳng 1-2 tông màu, thay trực tiếp nội dung `<span className="nav-link-icon">`:
   - 🏠 Nghệ sĩ → **mic** (`#EA4300` cam đỏ ấm)
   - 🎬 Phim → **clapperboard** (`#D83B01` đỏ cam)
   - 📚 Sách điện tử → **sách mở** (`#2564CF` xanh dương, giống tông Word)
   - 📖 Truyện tranh → **bong bóng thoại + chấm** (`#038387` xanh ngọc, tách biệt hẳn với xanh dương của Ebooks)
   - 📈 Xu hướng → **mũi tên đi lên qua biểu đồ** (`#107C41` xanh lá, giống tông Excel)
   - 🎵 Playlists → **nốt nhạc đôi** (`#B4009E` hồng tím, giống tông Sway)
   - 🗒️ Notes → **notepad có tai giấy** (`#7719AA` tím, giống tông OneNote)
   - 🤖 Trợ lý AI → **sao 4 cánh gradient** (`linear-gradient` xanh dương→xanh ngọc `#5B5FC7`→`#00B7C3`, đúng motif Microsoft Copilot)
   - 📊 Số liệu nghe → **biểu đồ cột 3 cột** (`#C43E1C` đỏ nâu, tách biệt hẳn với xanh lá của Trending dù cùng là "chart")
   - 📡 Request Log → **3 vòng radar đồng tâm** (`#0078D4` xanh dương hệ thống, tông "admin/debug" trung tính)
2. *(legacy)* Không đổi `NavLink`, routing, `title`, hay `t(...)` text — chỉ đổi nội dung icon bên trong.

**Prose:** Bảng màu trên cố ý tránh trùng lặp giữa 2 cặp icon dễ nhầm nhất — Ebooks/Comics (cả 2 đều "sách") tách bằng xanh dương vs xanh ngọc, và Trending/Listening-stats (cả 2 đều "biểu đồ") tách bằng xanh lá vs đỏ nâu — vì mục tiêu của phong cách ribbon là giúp mắt phân biệt nhanh bằng màu trước khi kịp đọc chữ, hai icon cùng nhóm ý nghĩa mà trùng màu sẽ triệt tiêu chính lợi ích đó. Riêng icon AI dùng gradient thay vì màu phẳng vì đây là điểm nhấn duy nhất được phép "nổi bật hơn" — Copilot của Microsoft cũng là icon gradient duy nhất giữa một dàn icon flat-color, phản ánh đúng vai trò đặc biệt của tính năng AI trong sản phẩm này. Do `DESIGN.md` hiện hành theo nguyên tắc monochrome tuyệt đối, thay đổi này là một ngoại lệ có chủ đích, được cô lập vào đúng 10 icon nav — không phải một sự nới lỏng ngầm cho toàn hệ thống, và cần được ghi chú lại vào `DESIGN.md` sau khi merge để không bị hiểu nhầm là drift ở lần audit sau.

### Task 2 — Verify trực quan
1. *(block)* Chụp/kiểm tra bằng browser thật ở 4 tổ hợp: sidebar mở rộng + không active, sidebar mở rộng + đang active 1 route, sidebar thu gọn (56px, chỉ icon) — xác nhận icon vẫn rõ ràng không bị cắt, và trạng thái active không làm nhạt màu icon.
2. *(block)* `tsc --noEmit` xác nhận không phát sinh lỗi type mới ngoài lỗi pre-existing đã biết.

**Prose:** Sidebar có 2 chế độ hiển thị hoàn toàn khác nhau (mở rộng có chữ, thu gọn chỉ icon) và 2 trạng thái NavLink (active/inactive) — bỏ qua verify bất kỳ tổ hợp nào trong 4 tổ hợp này có nguy cơ ship một icon nhìn đẹp lúc mở rộng nhưng vỡ hình hoặc mất màu lúc thu gọn, đúng dạng lỗi chỉ lộ ra khi thực sự tương tác UI chứ không lộ qua type-check tĩnh.

## Notes
- Yêu cầu gốc từ user (gửi 2 lần qua design feedback trên `music.giatbh.io.vn`): "vẽ lại svg icon của tất cả nút trong tab này theo style ribbon của microsoft enterprise"
- Chạy qua `/orca-workflow` theo yêu cầu trực tiếp của user (bước query → propose → gate → dispatch)

## Origin
- **Draft:** `wiki/sources/draft/300826-sidebar-ribbon-icons-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
