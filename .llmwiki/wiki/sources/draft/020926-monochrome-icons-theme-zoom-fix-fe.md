---
type: draft
title: Icon ve don sac, them light/dark theme, fix zoom-on-focus tren macOS/iOS
status: proposed
tags: [feature, bugfix, theme, sidebar, pwa, fe]
timestamp: 2026-09-02
---

# 020926-monochrome-icons-theme-zoom-fix-fe
**Type:** draft
**Status:** proposed
**Tags:** feature, bugfix, theme, sidebar, pwa, fe
**Proposed:** 2026-09-02
**Sequence diagram:** [html/020926-monochrome-icons-theme-zoom-fix-fe-seq.html](../../../html/020926-monochrome-icons-theme-zoom-fix-fe-seq.html)

## What
3 việc gộp từ 1 lần feedback của user: (1) đổi 10 icon sidebar từ ribbon-color về lại đơn sắc; (2) thêm hệ thống theme Light/Dark cho toàn app; (3) sửa lỗi bấm vào ô input (search và 7 ô khác) đôi khi bị tự động zoom trên Safari/WebKit (macOS PWA + iOS) do font-size dưới 16px.

**Vấn đề traffic-light window buttons trên macOS KHÔNG có trong plan này** — xem giải thích ở mục Risks, đây là giới hạn kỹ thuật thật, không phải việc bị bỏ sót.

## Affected
| File / Symbol | Thay đổi |
|---|---|
| `frontend/src/components/Sidebar.tsx` | 10 icon SVG bỏ màu riêng (`fill="#EA4300"` v.v.) → dùng `currentColor` theo `--text`; thêm nút toggle theme cạnh `.lang-toggle` |
| `frontend/src/index.css` | Thêm block `:root[data-theme="light"]` override 7 token (`--bg/--surface/--elevated/--surface-hover/--text/--text-muted/--text-faint`); bump `font-size` lên `16px` cho 8 class input |
| `frontend/index.html` | Thêm inline `<script>` nhỏ đọc `localStorage` và set `data-theme` trên `<html>` TRƯỚC khi React mount — tránh nháy sai theme (FOUC) |

## Risks

- **Traffic-light (đóng/thu nhỏ/phóng to) là chrome do hệ điều hành/trình duyệt vẽ, không phải do web app render** — không có CSS/JS/manifest field nào của web app điều khiển được kích thước hay vị trí của nó. Đây là giới hạn kỹ thuật cứng của nền tảng PWA trên macOS, không thể "sửa" từ phía code — nếu đúng là nút đó (không phải cụm nút nào khác trong app), plan này không có task nào cho nó.
- **Nhiều nút trong app đang hardcode `color: #000` đi kèm `background: var(--green)`** (giả định `--green` luôn là trắng) — nếu light-mode đổi luôn `--green`/`--purple` (accent) thì các nút đó sẽ bị chữ đen trên nền đen, không đọc được. **Quyết định: KHÔNG đổi `--green`/`--purple` theo theme** — accent giữ nguyên trắng/đen ở cả 2 theme (nút accent đọc được trên cả nền sáng lẫn tối), chỉ đổi 7 token cấu trúc (nền, surface, text).
- **4646 dòng CSS, không phải mọi màu đều đi qua token** — một số nơi có thể còn hardcode màu trắng/đen trực tiếp thay vì `var(--text)` (tương tự phát hiện cũ ở draft `170626-ui-theme-consistency-all-pages.md`, dù draft đó đề xuất theme khác không dùng ở đây). Plan này sửa đúng 7 token cấu trúc dùng `var()` — chỗ nào hardcode ngoài token sẽ không tự đổi theo theme, cần verify kỹ ở Task 4 và ghi nhận chỗ nào lộ ra để xử lý riêng sau, không cố gánh hết trong 1 lần.
- Bump font-size input lên 16px có thể làm một vài ô input chật hẹp (ví dụ `.dropdown-input`, `.lyrics-pw-input` đang 12px) trông hơi khác — chấp nhận đánh đổi vì đây là fix đúng chuẩn ngành cho lỗi zoom, không có cách nào giữ nguyên font nhỏ mà vẫn tránh zoom.

## Global constraints

- Không đụng `--green`/`--purple` (accent) theo theme — chỉ 7 token cấu trúc đổi.
- Không đụng cấu trúc component nào khác ngoài Sidebar.tsx (thêm toggle) — mọi page khác tự động ăn theme qua CSS var, không cần sửa từng page.
- Không thêm dependency mới (theme toggle viết tay bằng `data-theme` attribute + `localStorage`, không cần thư viện).
- Không có task cho traffic-light macOS — ngoài khả năng của web app.

## Plan
- [x] Task 1: Sidebar icon — bỏ màu riêng, dùng `currentColor` (đơn sắc theo `--text`)
- [x] Task 2: Thêm 7 token light-mode + toggle UI trong Sidebar + persist `localStorage` + inline script chống FOUC
- [x] Task 3: Bump font-size ≥16px cho 7 class input đang dưới ngưỡng (fix zoom-on-focus)
- [x] Task 4: Verify — cả 2 theme trên nhiều page, input không còn zoom, không regression icon/theme

## Agent Task Assignment
| Task | Agent (CLI) | Lý do chọn | Status |
|------|------|------|------|
| Task 1: Icon về đơn sắc | Claude Code (sonnet) | File vừa sửa xong đợt ribbon-color trước, cần hiểu đúng thay đổi cũ để revert sạch không sót | done |
| Task 2: Light/dark theme + toggle | Claude Code (sonnet) | Đụng token dùng chung toàn app (`index.css` `:root`) + cần quyết định đúng phạm vi (accent không đổi) — rủi ro cao nếu làm ẩu | done |
| Task 3: Fix font-size 7 input | Claude Code (làm trực tiếp, không dispatch) | Đã có sẵn context trong phiên, dispatch OpenCode tốn round-trip không cần thiết cho việc nhỏ | done |
| Task 4: Verify toàn diện | Claude Code (sonnet) | Cần mở browser thật kiểm tra cả 2 theme lẫn input zoom, không phải việc CLI khác tự chạy được | done |

## Verified — và 1 phát hiện quan trọng lúc verify

- Icon sidebar: đơn sắc đúng ở cả 2 theme, đọc rõ trên nền tương ứng.
- Toggle Dark/Light: đổi ngay lập tức, không cần reload, đúng trạng thái active.
- FOUC: set `localStorage` light trước, reload → `data-theme` đã là `light` ngay sau khi trang commit (kiểm tra ở mốc 50ms) — không nháy dark→light.
- `.search-input` xác nhận `font-size: 16px` qua `getComputedStyle` thật trong browser (không chỉ đọc CSS tĩnh).
- **Phát hiện lúc verify (đúng như Risk đã cảnh báo trước):** lần chụp ảnh đầu tiên ở theme light lộ ra 3 chỗ hardcode `rgba(5,5,5,...)` ngoài token — `.sidebar` (`.85` alpha), `.top-header` (`.7` alpha), `.player-bar::before` (`.88` alpha) — khiến sidebar/header/player-bar vẫn tối dù đã chuyển sang Light. Cả 3 đều nằm trong success criteria ("Sidebar" được nêu tên tường minh), nên sửa ngay trong Task 2 thay vì hoãn: thêm 3 token mới `--sidebar-glass`/`--header-glass`/`--player-glass` (mỗi token giữ đúng alpha gốc của chỗ nó thay thế, chỉ đổi giá trị RGB theo theme) — không dùng chung 1 token vì 3 chỗ có alpha khác nhau (.85/.7/.88), ghép chung sẽ làm sai độ trong suốt gốc.
- Re-verify sau khi sửa: cả 2 theme nhất quán toàn bộ viewport (sidebar, header, main content, player bar).

## Success criteria
- 10 icon sidebar hiện đơn sắc (theo `--text`), đổi active/hover state vẫn đúng như icon emoji ban đầu
- Có nút bật/tắt Light/Dark ở sidebar, đổi theme ngay lập tức không cần reload, nhớ lựa chọn qua các lần mở app
- Mở app ở theme đã lưu trước đó → không nháy sai theme dù chỉ 1 frame (không FOUC)
- Cả 2 theme đọc được rõ ràng ở tối thiểu: Artists, Album, Player bar, Sidebar, Now Playing overlay
- Bấm vào ô search hoặc bất kỳ ô input nào trong 8 class đã sửa trên Safari/WebKit → không còn tự động zoom
- `tsc --noEmit` sạch (trừ lỗi pre-existing `TrendingChartMode.tsx`)

## Render brief

### Task 1 — Sidebar icon về đơn sắc
1. *(block)* Bỏ `fill="#EA4300"` / `fill="#D83B01"` / ... và `stopColor` gradient AI-icon — 10 SVG hiện tại đang hardcode màu riêng từng icon.
2. *(add)* Đổi toàn bộ `fill`/`stroke` trong 10 SVG sang `currentColor` (hoặc bỏ hẳn, để CSS `color` của `.nav-link` cha quyết định qua kế thừa) — khớp đúng hành vi icon emoji gốc trước khi có ribbon-style: 1 màu, đổi theo `--text`/`--text-muted` như text nav bên cạnh.
3. *(legacy)* Cấu trúc SVG path/shape của từng icon giữ nguyên (mic, clapperboard, sách, v.v.) — chỉ đổi cách tô màu, không vẽ lại hình.

**Prose:** Đây là revert có chủ đích của quyết định ribbon-color trước đó — quay lại đúng "One Accent Rule" nguyên bản của `DESIGN.md`. Dùng `currentColor` thay vì gán lại `var(--text)` trực tiếp trong từng SVG để icon tự động kế thừa đúng màu của `.nav-link`/`.nav-link.active` mà không cần thêm CSS riêng — nhất quán với cách text nav đã hoạt động từ trước, và tự động đúng ở cả 2 theme sáng/tối sau khi Task 2 hoàn thành mà không cần sửa gì thêm ở icon.

### Task 2 — Light/dark theme
1. *(add)* Trong `index.css`, thêm block `:root[data-theme="light"] { --bg: #f7f7f8; --surface: #ffffff; --elevated: #f0f0f0; --surface-hover: rgba(0,0,0,.05); --text: rgba(0,0,0,.87); --text-muted: rgba(0,0,0,.55); --text-faint: rgba(0,0,0,.32); }` — giữ nguyên đúng 3 tầng opacity text (.87/.55/.32) đã có ở dark mode, chỉ đảo cực trắng/đen.
2. *(legacy)* `--green`/`--purple` (accent) KHÔNG xuất hiện trong block light — giữ nguyên giá trị trắng đã định nghĩa ở `:root` gốc, áp dụng cho cả 2 theme.
3. *(add)* Trong `frontend/index.html`, thêm `<script>` nhỏ trong `<head>`, trước bundle React: đọc `localStorage.getItem('cozyroom-theme')`, nếu có giá trị thì `document.documentElement.setAttribute('data-theme', value)` ngay lập tức.
4. *(add)* Trong `Sidebar.tsx`, thêm nút toggle cạnh `.lang-toggle` (VI · EN) hiện có — cùng style, bấm đổi `data-theme` trên `document.documentElement` + lưu `localStorage.setItem('cozyroom-theme', ...)`.

**Prose:** Cách viết `:root[data-theme="light"]` override thay vì `.light`/class-based là để khớp đúng convention `data-theme` đã dùng ở nơi khác trong hệ sinh thái công cụ của dự án (artifact viewer), và để script chống-nháy trong `index.html` chỉ cần set 1 attribute duy nhất trước khi bất kỳ CSS nào được áp dụng. Quyết định không đổi `--green`/`--purple` theo theme không phải là thiếu sót mà là lựa chọn an toàn có chủ đích — codebase có nhiều chỗ hardcode `color: #000` đi kèm giả định `--green` luôn là trắng (xác nhận qua khảo sát trước khi viết proposal này), đổi accent theo theme sẽ âm thầm làm chữ biến mất trên nút ở chính xác nửa số trường hợp (khi theme đổi accent thành đen) mà không có lỗi console nào báo hiệu — một loại lỗi im lặng khó phát hiện qua test thông thường.

### Task 3 — Fix zoom-on-focus (8 input)
1. *(add)* Đổi `font-size` về tối thiểu `16px` cho: `.ai-input` (hiện `0.9rem`≈14.4px), `.sidebar-lastfm-input` (12px), `.search-input` (14px), `.artist-filter-input` (13px), `.channel-search-input` (14px), `.lyrics-pw-input` (12px), `.dropdown-input` (12px), và ô con của `.channel-search-input-wrap` nếu có font-size riêng dưới ngưỡng.
2. *(legacy)* Không đổi `padding`/`border-radius`/màu sắc/layout nào khác của các class này — chỉ đúng thuộc tính `font-size`.

**Prose:** Safari/WebKit (cả iOS lẫn macOS khi chạy PWA) tự động zoom trang khi người dùng focus vào một ô input có `font-size` nhỏ hơn `16px` — đây là hành vi accessibility có chủ đích của Apple (đảm bảo chữ đủ lớn để đọc khi gõ), không phải bug của trình duyệt, và cách khắc phục chuẩn ngành duy nhất là đảm bảo mọi input focusable có font-size từ 16px trở lên, không phải tắt zoom bằng `user-scalable=no` (cách đó chặn luôn zoom hợp lệ của người dùng khiếm thị, vi phạm accessibility còn nặng hơn vấn đề đang sửa). User chỉ báo cụ thể ô search, nhưng khảo sát cho thấy đây là lỗi hệ thống lặp lại ở 7 ô input khác — sửa đồng loạt trong cùng 1 lần vì cùng nguyên nhân, cùng 1 dòng sửa, tránh phải quay lại sửa từng ô một khi user báo tiếp ở chỗ khác.

### Task 4 — Verify toàn diện
1. *(block)* Test 2 theme trên tối thiểu: Artists (list + detail), AlbumPage, Player bar, Now Playing overlay, Sidebar (expanded/collapsed) — xác nhận đọc được rõ ràng, không có chữ biến mất/chìm vào nền ở theme nào.
2. *(block)* Test input zoom: kiểm tra `font-size` áp dụng đúng ≥16px trên cả 8 class qua browser thật (không chỉ đọc CSS tĩnh).
3. *(add)* Test FOUC: set `localStorage` theme = light trước, reload trang, xác nhận không nháy dark→light dù 1 frame.
4. *(legacy)* Xác nhận icon sidebar vẫn đúng vị trí/kích thước sau khi bỏ màu riêng, active state vẫn rõ ràng ở cả 2 theme.

**Prose:** Vì Task 2 đụng vào token màu dùng chung cho TOÀN BỘ app (không riêng 1 page), verify không thể chỉ kiểm tra 1-2 màn hình rồi coi là xong — phải chủ động rà qua nhiều page đại diện để bắt được những chỗ hardcode màu ngoài token (nếu có) trước khi user tự phát hiện. Test FOUC là bước dễ bị bỏ qua nhất vì lỗi của nó chỉ xuất hiện trong đúng khung thời gian tải trang đầu tiên — verify tĩnh (đọc code) không bắt được, bắt buộc phải thao tác reload thật.

## Notes
- Yêu cầu gốc từ user: "mấy logo màu đổi thành đơn sắc thêm theme đi, với app trên mac bị 1 vấn đề là bộ nút ấn quá nhỏ để có thể ấn được, ấn search đôi khi bị zoom nữa thay vì khoá cứng window như 1 app bình thường"
- Đã hỏi lại user 2 điểm mơ hồ trước khi viết proposal: (1) xác nhận muốn revert icon về đơn sắc + theme Light/Dark (không phải accent-color switcher); (2) xác nhận "bộ nút" là traffic-light window, không phải cụm nút trong app — dẫn tới quyết định không có task nào cho traffic-light (ngoài khả năng sửa từ web code)
- Chạy qua `/orca-workflow` → `/query` (không có tiền lệ trực tiếp, 1 draft cũ 170626 đã lỗi thời không dùng) → `/propose`
- Liên quan: [[300826-sidebar-ribbon-icons-fe]] (đợt đổi màu icon trước, giờ revert lại)

## Origin
- **Draft:** `wiki/sources/draft/020926-monochrome-icons-theme-zoom-fix-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
