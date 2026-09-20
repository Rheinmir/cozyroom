---
type: draft
title: Thay window.confirm/window.alert bang ConfirmDialog + Toast dung chung (Playlists, Notes)
status: proposed
tags: [feature, ui, confirm-dialog, toast, fe]
timestamp: 2026-08-03
---

# 030826-confirm-dialog-toast-fe
**Type:** draft
**Status:** proposed
**Tags:** feature, ui, confirm-dialog, toast, fe
**Proposed:** 2026-08-03
**Sequence diagram:** [html/030826-confirm-dialog-toast-fe-seq.html](../../../html/030826-confirm-dialog-toast-fe-seq.html)

## What
Thay `window.confirm(...)` / `window.alert(...)` (popup trình duyệt xấu, không theme được) bằng 1 `ConfirmDialog` + `Toast` dùng chung toàn app, theo đúng style glass hiện có (`.notes-detail-overlay`/`.notes-detail-panel`). Đã grep toàn `frontend/src` — chỉ đúng 2 file đang dùng: `PlaylistsPage.tsx` (1 `window.confirm`) và `NotesPage.tsx` (3 `window.confirm` + 15 `window.alert`).

## Affected
| File / Symbol | Thay đổi |
|---|---|
| `frontend/src/DialogContext.tsx` (mới) | `DialogProvider` + hook `useDialogs()` trả về `confirm(opts): Promise<boolean>` và `toast(message, type?)` |
| `frontend/src/AppRoutes.tsx` | Bọc thêm `<DialogProvider>` ngoài cùng, cùng vị trí với `BgSoundsProvider`/`PlayerProvider` đã có |
| `frontend/src/pages/PlaylistsPage.tsx` | 1 `window.confirm` → `await confirm(...)` |
| `frontend/src/pages/NotesPage.tsx` | 3 `window.confirm` → `await confirm(...)`; 15 `window.alert(err.message)` → `toast(err.message, 'error')` |
| `frontend/src/index.css` | Thêm section style `ConfirmDialog`/`Toast` (tái dùng token `--surface`/`--radius`/`--green` đã có) |

## Risks
- `handleDeleteClick` trong `PlaylistsPage.tsx` hiện là hàm đồng bộ (không async) — đổi sang `await confirm(...)` bắt buộc đổi hàm thành `async`, cần kiểm tra không có logic đồng bộ nào phía sau bị ảnh hưởng bởi việc chờ Promise (đã đọc code: chỉ có state update sau nhánh confirm, an toàn để await).
- `useDialogs()` chỉ hoạt động trong cây component nằm dưới `DialogProvider` — vì đặt ở `AppRoutes.tsx` (ngoài `Routes`), mọi page hiện có đều nằm trong phạm vi, không có page nào bị lọt ra ngoài.
- Không đổi hành vi nghiệp vụ nào (chỉ đổi lớp hiển thị confirm/alert) — logic xoá/tạo/cập nhật giữ nguyên 100%.

## Global constraints
- Không đổi logic nghiệp vụ của `deletePlaylist`, `deleteNote`, `deleteBoard`, `deleteColumn`, v.v. — chỉ đổi cách hỏi xác nhận và cách báo lỗi.
- Style `ConfirmDialog`/`Toast` phải dùng token màu đã có (`var(--surface)`, `var(--green)`, `var(--text)`...), không tạo màu mới, không dùng `var(--accent)` (không tồn tại — bug cũ đã gặp).
- Không thêm dependency npm mới (tự viết component, không dùng thư viện toast/modal ngoài).

## Plan
- [ ] Task 1: `DialogContext.tsx` (mới) — `DialogProvider` + `useDialogs()`, render `ConfirmDialog` overlay + `Toast` stack nội bộ
- [ ] Task 2: Wire `AppRoutes.tsx` — bọc `<DialogProvider>`
- [ ] Task 3: `PlaylistsPage.tsx` — thay 1 `window.confirm`
- [ ] Task 4: `NotesPage.tsx` — thay 3 `window.confirm` + 15 `window.alert`
- [ ] Task 5: `index.css` — style mới + verify `tsc --noEmit` sạch + test tay qua Chrome (xoá note/playlist, thấy dialog mới thay vì popup trình duyệt)

## Agent Task Assignment
| Task | Agent (CLI) | Lý do chọn | Status |
|------|------|------|------|
| Task 1: `DialogContext.tsx` | Claude Code (sonnet) | Component dùng chung mới, cần thiết kế API (`confirm`/`toast`) đúng ergonomic cho các page khác dùng lại sau này | pending |
| Task 2: Wire `AppRoutes.tsx` | Claude Code (sonnet) | Đụng file khung dùng chung, cần đặt đúng vị trí provider | pending |
| Task 3: `PlaylistsPage.tsx` | Claude Code (sonnet) | Đổi hàm đồng bộ → async, cần kiểm tra không phá logic khác | pending |
| Task 4: `NotesPage.tsx` | Claude Code (sonnet) | 18 call site, nhiều chỗ nằm trong closure của component con — cần rà đúng từng chỗ | pending |
| Task 5: `index.css` + verify | Claude Code (sonnet) | Verify tay qua Chrome cần theo dõi sát | pending |

## Success criteria
- Xoá playlist/note/board/cột → hiện modal xác nhận theme đúng app (không phải popup trình duyệt), Huỷ/Xác nhận hoạt động đúng
- Lỗi từ API (401, 409 "column còn note", v.v.) → hiện toast lỗi, không phải `alert()`
- `tsc --noEmit` sạch (ngoài lỗi pre-existing `TrendingChartMode.tsx`)
- Test tay qua Chrome: luồng xoá playlist + luồng xoá cột kanban còn note (phải thấy toast lỗi đúng nội dung "column còn note...")

## Notes
- Invoked via: user báo lỗi xoá cột + yêu cầu "tất cả nút confirm trên app có UI đàng hoàng" → hỏi phạm vi qua `AskUserQuestion` → chọn "Toàn app" → grep xác nhận chỉ 2 file bị ảnh hưởng (nhỏ hơn lo ngại ban đầu)
- Liên quan: [[FavoritePlaylistPill]]

## Origin
- **Draft:** `wiki/sources/draft/030826-confirm-dialog-toast-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
