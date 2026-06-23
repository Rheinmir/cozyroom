# 230626-ai-input-ux

**Status:** proposed
**Sequence diagram:** [html/230626-ai-input-ux-seq.html](../../../html/230626-ai-input-ux-seq.html)

## Context

2 UX issues trên `/ai` page:
1. `textarea.ai-input` — placeholder + cursor lệch lên top vì `rows=2`; cần center theo chiều dọc khi chưa có nội dung, chuyển về top khi Shift+Enter (multiline mode). Ghost text suggestion đã có cho slash commands — cần hoạt động đúng với cả mode mới.
2. `🛠 Tools / 📊 Analytics` links đang chiếm 1 hàng riêng (19px) giữa page title và messages → move vào cùng hàng `ai-controls-row` để tiết kiệm không gian.

## Plan

- [ ] T1: textarea — `rows={1}` mặc định + CSS center + `multiline` state (Shift+Enter toggle)
- [ ] T2: Move Tools/Analytics links vào `ai-controls-row` bên phải

## Agent Task Assignment

| Task | Agent | Model | Status |
|------|-------|-------|--------|
| T1: textarea centering + multiline state | Claude main | claude-sonnet-4-6 | pending |
| T2: Tools/Analytics vào controls-row | Claude main | claude-sonnet-4-6 | pending |

## Files sẽ tạo/sửa

| File | Action | Lý do |
|------|--------|-------|
| `frontend/src/pages/AIAssistantPage.tsx` | modify | rows→1, multiline state, move links |
| `frontend/src/index.css` | modify | .ai-input centered padding, .ai-controls-row justify-content |

## Risks

- `rows={1}` + CSS height cần khớp với `ai-ghost-text` overlay (position: absolute bên trong `ai-input-wrap`) — kiểm tra sau khi thay đổi
- Multiline state cần reset về `false` khi submit (clear input)

## Origin

- **Draft:** `wiki/draft/orca/230626-ai-input-ux.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
