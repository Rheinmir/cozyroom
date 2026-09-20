---
name: drawer-ai-stardelta-fix
description: Fix drawer AI display + star delta always 0 + date picker hidden — 3 targeted bugs
type: draft
---

# Proposal: Drawer AI cards + Star Delta fix + Date Picker

## Request (1 sentence)
Fix 3 bugs found after Chart Mode ship: (1) tier drawer shows no AI analysis, (2) star_delta always 0 because delta query compares against midnight boundary, (3) date picker hidden when only 1 date.

## Affected files

| File | Change |
|------|--------|
| `frontend/src/pages/TrendingChartMode.tsx` | `RepoDrawer` — add AI rows (problem_solved, tech_used, simple_flow) |
| `backend/internal/enricher/github.go` | `SaveTrendingSnapshot` — fix delta query: `sampled_at < now` not `< today+T00:00:00Z` |
| `frontend/src/pages/TrendingPage.tsx` | date picker: show when `dates.length >= 1`, not `> 1` |

## Breakage risk

- **None** for (1) — pure additive UI
- **Low** for (2) — delta calc fix; existing data in DB stays, new snapshots will compute correctly; repos first seen ever still show 0 (correct — no prior baseline)
- **None** for (3) — show/hide condition change only

## Plan

### Fix 1 — Drawer AI rows (frontend only)
In `RepoDrawer`, after the existing `.tc-drawer-meta` line, add:
```tsx
{(r.problem_solved || r.tech_used || r.simple_flow) && (
  <div className="tc-drawer-ai">
    {r.problem_solved && <div><span className="tc-drawer-ai-label">{t('trending.solved')}</span>{r.problem_solved}</div>}
    {r.tech_used     && <div><span className="tc-drawer-ai-label">{t('trending.technology')}</span>{r.tech_used}</div>}
    {r.simple_flow   && <div><span className="tc-drawer-ai-label">{t('trending.flow')}</span>{r.simple_flow}</div>}
  </div>
)}
```
Add `.tc-drawer-ai` + `.tc-drawer-ai-label` styles to `index.css`.

### Fix 2 — Star delta (backend)
`github.go` line 125 — change:
```go
// Before
}, r.ID, today+"T00:00:00Z").Scan(&prevStars)

// After
}, r.ID, now).Scan(&prevStars)
```
This compares against the most recent snapshot strictly before `now`, so the 12h-tick Run 2 sees Run 1 as "previous" and computes a real delta.

### Fix 3 — Date picker (frontend)
`TrendingPage.tsx` line 189 — change:
```tsx
// Before
{dates.length > 1 && (

// After
{dates.length >= 1 && (
```

## Success criteria
- Drawer shows problem_solved / tech_used / simple_flow for each repo
- After the next 12h tick, star_delta shows non-zero values for repos whose star count changed
- Date picker is visible even on first day (single date)

## Origin
- Draft: this file
- Date: 2026-05-24
