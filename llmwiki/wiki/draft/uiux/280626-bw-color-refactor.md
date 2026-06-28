---
type: draft
status: proposed
tags: [high-end-visual-design, output-report]
proposed: 2026-06-28
---

# 280626-bw-color-refactor

## What
Refactor toàn bộ frontend cozyroom từ bảng màu tím/teal (purple accent `#a855f7`) sang bảng màu trắng đen tuyệt đối, kể cả gradient và inline styles trong 36 components; đồng thời fix SW `CacheFirst` gây cover image bị ẩn sau rollout.

## Output

### B&W Color Palette
- CSS variables: `--green`, `--purple` → `#ffffff`; `--green-hover` → `#e0e0e0`
- Body ambient orbs: rgba tím/teal → rgba trắng với opacity giảm 35-50%
- AI avatar: `linear-gradient(140deg,#2a2a2a,#555555)` tránh white-on-white
- Tier/error/functional colors → `#888888` (mid grey)
- 2 PowerShell batch passes: comma-separated + space-separated rgba patterns

### SW Cache Fix
- `vite.config.ts`: `CacheFirst` → `StaleWhileRevalidate` + `cacheableResponse: {statuses:[200]}` cho cả `covers` và `artist-images`
- Ngăn chặn cache response fail trong rollout window → display:none

### Deployed
- K3S cluster: `docker build → push 100.88.197.64:5000 → kubectl rollout restart`

## Files
| File | Action |
|------|--------|
| `frontend/src/index.css` | modified — 208 color substitutions |
| `frontend/src/components/RadialNav.tsx` | modified — 12 color changes |
| `frontend/src/components/PlayerBar.tsx` | modified — 2 changes |
| `frontend/src/pages/AIStatsPage.tsx` | modified — 10 changes |
| `frontend/src/pages/ComicsPage.tsx` | modified — 28 changes |
| `frontend/src/pages/ComicsPageMobile.tsx` | modified — 30 changes |
| `frontend/vite.config.ts` | modified — SW cache strategy |
| `llmwiki/wiki/concepts/frontend-component-map.md` | regenerated |

## Notes
- Invoked via: `/high-end-visual-design` skill
- AI avatar fix: sau batch replace cả 2 màu → trắng, avatar bị white-on-white; fix riêng với dark grey gradient
- SW CacheFirst không có `cacheableResponse` là root cause của cover image bug sau rollout — không phải backend issue
- Commit: `4c36e87`

## Origin
- **Draft:** `wiki/draft/uiux/280626-bw-color-refactor.md`
- **Commit:** `4c36e87` — feat: B&W color refactor + fix SW CacheFirst image caching
- **Date promoted:** _(filled by verify-before-commit)_
