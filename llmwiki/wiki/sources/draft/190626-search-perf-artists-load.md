# 190626-search-perf-artists-load
**Type:** draft
**Status:** proposed
**Tags:** verify-before-commit, output-report
**Proposed:** 2026-06-19

## What
Fixed two performance issues: search taking 2-5s on every keystroke, and artists page loading slowly on every visit.

## Output
- Header.tsx: 300ms debounce on search input — prevents every keystroke from triggering yt-dlp
- youtube.go: in-memory 5-minute cache for YouTube search results (yt-dlp runs only once per unique query)
- vite.config.ts: changed `/api/(artists|albums|stats)` SW strategy from `NetworkFirst` to `StaleWhileRevalidate` — artists list served from cache instantly on revisit
- ArtistsPage.tsx: `staleTime: 5min` on React Query — no loading spinner on in-session navigation

## Files
| File | Action |
|------|--------|
| `frontend/src/components/Header.tsx` | modified — debounce |
| `backend/internal/api/youtube.go` | modified — search cache |
| `frontend/vite.config.ts` | modified — SW strategy |
| `frontend/src/pages/ArtistsPage.tsx` | modified — staleTime + TS fix |

## Notes
- Invoked via: `/verify-before-commit` skill
- Root cause of search: yt-dlp `ytsearch10:query` is a real YouTube network request (2-5s each), fired on every navigation change with no debounce and no cache
- Root cause of artists slowness: SW `NetworkFirst` always waits for backend response; cache only used as fallback. After sw.js→sw2.js rename cleared SW cache, every visit hits the backend
- `StaleWhileRevalidate` serves from SW cache instantly and revalidates in background — zero perceived latency after first load

## Origin
- **Draft:** `wiki/sources/draft/190626-search-perf-artists-load.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
