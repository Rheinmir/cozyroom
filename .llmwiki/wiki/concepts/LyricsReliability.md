---
title: Lyrics Reliability — Silent Reload, Cache Poisoning, and Mobile Panel
date: 2026-05-17
type: concept
---

## Summary

Three separate reliability fixes to the lyrics system: (1) save triggers silent background refetch instead of full loading flash; (2) fetch errors no longer poison the session cache with empty results; (3) tools panel on mobile floats as a fixed overlay above playback controls.

## Fixes

### 1. Silent refetch after save

`doFetch()` gained a `silent = false` parameter. When `true`:
- Skips `setLoading(true)`, `setResults([])`, `setSources([])`, `setSelected(0)`
- Still updates state and cache when fetch completes
- Skips `setLoading(false)` in `finally`

`handleSave` now calls `doFetch(trackId, true)` so "Saved!" appears instantly without a blank-screen flash.

### 2. Empty-cache poisoning removed

Previously, `doFetch`'s `.catch()` block called `cache.set(id, [], [], false)`, storing empty arrays in sessionStorage. On the next track open (same `trackId`), the cache hit returned empty → "No lyrics found" even though the backend had results.

Fix: removed `cache.set(...)` from the `.catch()` block entirely. Failed fetches leave no sessionStorage entry; the next open re-fetches fresh.

### 3. Backend cache write survives client disconnect

`h.lyrics.SetCached(r.Context(), ...)` used the HTTP request context, which gets cancelled when the client disconnects mid-fetch. Changed to `h.lyrics.SetCached(context.Background(), ...)` so the SQLite write always completes regardless of client state.

### 4. Tools panel tap on mobile (⋮ button)

The `⋮` button's `onClick` was bubbling up to `npo-body`'s `handleNpoClick`, which toggled the tab bar instead of the tools panel. Fix: added `e.stopPropagation()` to the button's click handler.

### 5. Tools panel position on mobile

The `.lyrics-tools-panel` is `position: absolute` inside `lyrics-wrapper`. On mobile, `npo-controls` (playback buttons, ~150px tall) is a separate flex child below `npo-content`, so the absolute panel is buried under it.

Fix: override in mobile media query (`@media (max-width: 900px)`):
```css
.lyrics-tools-panel {
  position: fixed;
  bottom: 190px;
  left: 12px;
  right: 12px;
  z-index: 300;
}
```
`z-index: 300` clears `.npo` (z-index: 200).

## Origin

- **Draft:** `wiki/sources/draft/150526-lyrics-save-reload-fix-fe.md`
- **Commits:**
  - `6a6e8cd — feat: comics offline downloader, image optimisation, EH fixes, lyrics UX` (silent reload)
  - `d65f84b — fix(lyrics): prevent empty-cache poisoning and tools panel tap conflict` (cache + tap)
  - `32919cc — fix(lyrics): float tools panel above playback controls on mobile` (CSS fix)
- **Date promoted:** 2026-05-17
