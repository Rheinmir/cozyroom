# 050626-playlist-play-btn-fix-fe
**Type:** draft
**Status:** proposed
**Tags:** design-feedback, output-report
**Proposed:** 2026-06-05

## What
Replaced broken 36px white text-button with proper 56px green SVG play button in PlaylistsPage hero section.

## Output
- Added `.hero-play-btn` CSS class (56px, `var(--green)`, hover scale)
- Updated `PlaylistsPage.tsx` button: `play-btn` → `hero-play-btn`, text "Phát" → SVG triangle + `aria-label`
- Confirmed no error telemetry exists in frontend

## Files
| File | Action |
|------|--------|
| `frontend/src/index.css` | modified — added `.hero-play-btn` block |
| `frontend/src/pages/PlaylistsPage.tsx` | modified — class + SVG icon swap |

## Notes
- Root cause: `.play-btn` designed for 36px PlayerBar, reused in hero = tiny white circle with raw text
- `var(--text)` = white in dark mode → white circle, black text "Phát" = looked broken
- No Sentry/analytics/error logging in frontend (confirmed by grep)
- Invoked via: design feedback / `computer-use` skill

## Origin
- **Draft:** `wiki/draft/cave/050626-playlist-play-btn-fix-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
