---
NOTE: Update this file's status to "implemented" and add commit hash after implementation is done.
status: implemented
commit: pending
---

# Proposal: Fix Rapid-Skip Bugs (Lyrics Race + Progress Bar)

Three bugs, all triggered by rapid track skipping or preloaded playback.

---

## Bug A — Lyrics stale-fetch race

### 1. Request

When the user skips tracks quickly, lyrics from an in-flight (now-stale) fetch overwrite the correct lyrics for the currently-playing track.

### 2. Affected files

| File | Change |
|------|--------|
| `frontend/src/api.ts` | Add optional `signal?: AbortSignal` to `fetchLyrics`; forward to `fetch()` |
| `frontend/src/components/LyricsView.tsx` | Accept `signal` in `doFetch`; abort previous request in `trackId` effect cleanup |

### 3. Risk

- Session-storage cache path bypasses fetch entirely → no risk.
- `fetchLyricsTranslation` has the same race but requires a manual tap; out of scope here.
- No other callers of `fetchLyrics`.

### 4. Implementation steps

1. **`api.ts`**: Add `signal?: AbortSignal` to `fetchLyrics` signature; pass it as `fetch(url, { signal })`.
2. **`LyricsView.tsx` — `doFetch`**: Accept `signal?: AbortSignal`; pass to `fetchLyrics`; in the catch block, check `err.name === 'AbortError'` and return early without touching state.
3. **`LyricsView.tsx` — `trackId` useEffect** (lines 85-98): Create `const controller = new AbortController()` at top; pass `controller.signal` to `doFetch`; return `() => controller.abort()` as cleanup.

~10 lines across 2 files.

### 5. Success criteria

- Skip 5 tracks rapidly → only the last track's lyrics appear; no flash of a prior track.
- Slow network (DevTools 3G throttle) → switching mid-fetch still shows correct lyrics.

---

## Bug B — Duration always shows 0:00

### 1. Request

After a track skip, the total duration in the progress bar shows "0:00" instead of the real track length.

### 2. Root cause

`startTrack()` calls `setDuration(0)` (PlayerContext.tsx:226) on every track change. Duration is only restored when `loadedmetadata` fires (line 244). When a track was **preloaded** on the standby audio element, `loadedmetadata` already fired — and was correctly ignored by the guard `if (el !== active)`. After the slot swap, the event never fires again, so duration stays 0.

### 3. Affected file

| File | Change |
|------|--------|
| `frontend/src/PlayerContext.tsx` | After slot swap in `startTrack`, read `getActive().duration` and call `setDuration()` directly if it's already finite |

### 4. Implementation steps

1. In `startTrack()` (PlayerContext.tsx:198-227), after the slot swap and `setDuration(0)`, add:
   ```ts
   const d = getActive().duration
   if (isFinite(d) && d > 0) setDuration(d)
   ```
   This handles the preloaded case where metadata is already available.

~3 lines in 1 file.

### 5. Success criteria

- Play a track normally → duration shows correctly.
- Skip to a preloaded (gapless) track → duration shows correctly immediately, not 0:00.

---

## Bug C — Progress bar shows no fill; dot only on hover

### 1. Request

The progress bar looks like a plain gray line. There is no visual fill showing how far into the track we are. The draggable dot is invisible until hovering.

### 2. Root cause

`.progress-bar` has a flat `background: #535353` with no played-portion color (index.css:692). The thumb is `opacity: 0` by default (line 705) and only appears on hover. No dynamic gradient is computed from `progress/duration`.

### 3. Affected files

| File | Change |
|------|--------|
| `frontend/src/index.css` | Make thumb always visible; keep hover grow behavior |
| `frontend/src/components/PlayerBar.tsx` | Pass inline `style` with CSS gradient to both `<input type="range">` elements to show played fill |

### 4. Implementation steps

1. **`PlayerBar.tsx`**: Compute `const pct = duration > 0 ? (progress / duration) * 100 : 0`. Pass `style={{ background: \`linear-gradient(to right, var(--green) ${pct}%, #535353 ${pct}%)\` }}` to both progress bar `<input>` elements (lines 175 and 285).
2. **`index.css`**: Change thumb `opacity: 0` → `opacity: 1` (always visible); keep `opacity` on hover only at `1` (no change needed there). Optionally bump thumb size slightly on hover for feel.

~5 lines across 2 files.

### 5. Success criteria

- Progress bar shows green fill from left proportional to playback position.
- The seek dot is always visible on the progress bar.
- Seeking by dragging still works.

---

## Origin

Bugs A reported 2026-05-19 (rapid skip → stale lyrics). Bugs B and C reported 2026-05-19 (duration always 0:00, no progress fill). Root causes identified via code inspection of `LyricsView.tsx:71-98`, `PlayerContext.tsx:198-244`, and `index.css:686-708`.
