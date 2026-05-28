# Player Bugfixes — Rapid Skip & Progress Bar (2026-05-19)

Three bugs fixed in one commit, all related to rapid track skipping and the gapless preload system.

## Bug A — Lyrics stale-fetch race

**Symptom:** Skipping tracks quickly could show lyrics from a previously-playing track.

**Root cause:** `doFetch` in `LyricsView.tsx` used plain `.then()` with no cancellation. When the user skipped A→B, fetch A could resolve after B started, calling `setResults()` with the wrong data.

**Fix:** `AbortController` created per `trackId` effect run in `LyricsView.tsx`. The effect cleanup calls `controller.abort()` on every track change. `fetchLyrics` in `api.ts` accepts an optional `signal` and forwards it to `fetch()`. `AbortError` is caught silently in `doFetch` without touching state.

## Bug B — Duration stuck at 0:00 after gapless track

**Symptom:** When a track played via gapless preload (dual-audio slot swap), the total duration showed 0:00 indefinitely.

**Root cause:** `startTrack()` resets `duration` to 0. Duration is normally restored when `loadedmetadata` fires on the active audio element. But for preloaded tracks the event already fired on the standby element — and was correctly ignored by the active-slot guard. After the swap, the event never fires again.

**Fix:** After `setDuration(0)` in `startTrack()`, immediately read `getActive().duration`. If it's already a finite positive number (preloaded case), call `setDuration(d)` directly.

## Bug C — Progress bar no fill; thumb hidden until hover

**Symptom:** Progress bar appeared as a plain gray line; the seek dot was only visible on hover.

**Root cause:** `.progress-bar` CSS had a static `background: #535353` with no played-portion gradient. Thumb `opacity` was `0` by default.

**Fix:** Compute `pct = (progress / duration) * 100` in `PlayerBar.tsx`; apply `style={{ background: \`linear-gradient(to right, #fff ${pct}%, #535353 ${pct}%)\` }}` to both `<input type="range">` elements (desktop player bar + now-playing overlay). Thumb `opacity` changed to `1` in `index.css`.

## Affected files

| File | Change |
|------|--------|
| `frontend/src/api.ts` | `fetchLyrics` accepts optional `AbortSignal` |
| `frontend/src/components/LyricsView.tsx` | `doFetch` wired to `AbortController`; effect cleanup aborts on track change |
| `frontend/src/PlayerContext.tsx` | `startTrack` reads preloaded duration after slot swap |
| `frontend/src/components/PlayerBar.tsx` | White fill gradient on both progress bar inputs |
| `frontend/src/index.css` | Thumb `opacity: 1` always visible |

## Origin

- **Draft:** `wiki/sources/draft/190526-lyrics-stale-fetch-race-fix-fe.md`
- **Commit:** `6b8f4b9 — fix(player): abort stale lyrics fetches, fix preloaded duration, show progress fill`
- **Date promoted:** 2026-05-19
