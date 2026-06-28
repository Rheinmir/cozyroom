---
type: draft
status: proposed
tags: [redesign-existing-projects, output-report]
proposed: 2026-06-28
---

# 280626-redesign-audit-ux

## What
Chạy design audit theo `/redesign-existing-projects` skill — tìm và sửa 12 CSS/UX issues trong index.css, TrendingChartMode.tsx, và mcpTools.ts; hoàn thành phần B&W refactor còn sót từ session trước.

## Output

### index.css — 10 issues fixed
| Issue | Fix |
|-------|-----|
| `.shell { height: 100vh }` (iOS Safari bug) | → `100dvh` |
| `.ai-ghost-text` dùng `-apple-system` stack | → Geist (font consistency) |
| `.bgsounds-check` fallback `#1db954` (Spotify green cũ) | → `#ffffff` |
| `.nav-link { border-radius: 4px }` (quá cứng) | → `8px` |
| `.nav-link { transition: color .15s }` (thiếu background) | → thêm `background .15s` |
| `.nav-link:hover` không có background | → thêm `rgba(255,255,255,.05)` |
| `.search-input { transition: all }` (layout repaints) | → `background, border-color` |
| `.page-title` thiếu letter-spacing | → `-0.02em` |
| `.back-btn:hover` chỉ đổi color, không motion | → thêm `translateX(-2px)` |
| Body orbs opacity thấp sau B&W refactor | → tăng `.18→.22` / `.10→.13` |
| `transition: all` ở `.tools-filter-btn`, `.quality-btn`, `.load-more-btn` | → specific props |
| `.stats-bar` số không tabular | → `font-variant-numeric: tabular-nums` |
| `height: 100vh` còn sót ở reader, epub | → `100dvh` |

### TrendingChartMode.tsx — B&W refactor hoàn chỉnh
- `TIER_COLORS`: orange/yellow/blue/purple → greyscale `e8e8e8/aaa/666/3a3a3a`
- `COLORS` arrays (donut, treemap): vivid → greyscale progressions
- Delta tspan colors, cell fills → greyscale

### mcpTools.ts — categoryColor B&W
- 8 vivid hues → greyscale spectrum theo category

### Deploy
- K3S cluster: commit `9777db8` deployed thành công

## Files
| File | Action |
|------|--------|
| `frontend/src/index.css` | modified — 13 targeted fixes |
| `frontend/src/pages/TrendingChartMode.tsx` | modified — B&W color completion |
| `frontend/src/data/mcpTools.ts` | modified — categoryColor greyscale |

## Notes
- Invoked via: `/redesign-existing-projects` skill
- Priority order: font fix → 100vh → nav transitions → colors → typography
- LANG_COLORS kept as-is (official language colors = categorical data, không phải UI chrome)
- Commit: `9777db8`

## Origin
- **Draft:** `wiki/draft/uiux/280626-redesign-audit-ux.md`
- **Commit:** `9777db8` — fix: redesign audit — 12 CSS/UX issues corrected
- **Date promoted:** _(filled by verify-before-commit)_
