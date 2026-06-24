# 240626-bgsounds-glass

**Status:** proposed
**Sequence diagram:** [html/240626-bgsounds-glass-seq.html](../../../html/240626-bgsounds-glass-seq.html)

## Plan

- [ ] T1: Glassmorphism cho `.bgsounds-panel` — background translucent hơn, gradient border, sheen, icon gradient

## Agent Task Assignment

| Task | Agent | Model | Status |
|------|-------|-------|--------|
| T1: CSS glassmorphism bgsounds-panel | Claude main | claude-sonnet-4-6 | pending |

## Files sẽ tạo/sửa

| File | Action | Lý do |
|------|--------|-------|
| `frontend/src/index.css` | modify | bgsounds-panel glass effect |

## Risks

- `backdrop-filter` cần browser support (Chrome/Safari OK, Firefox cần flag — đã có sẵn)
- `::before` gradient border cần `overflow: visible` trên panel — hiện đang `overflow: hidden`, cần đổi

## Origin

- **Draft:** `wiki/draft/orca/240626-bgsounds-glass.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
