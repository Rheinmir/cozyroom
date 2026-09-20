# 100626-player-progress-time-stale-fix
**Type:** draft
**Status:** done
**Tags:** bugfix, player, progress-bar, duration
**Proposed:** 2026-06-10

## Root Cause

`PlayerContext.tsx` line 193:
```typescript
useEffect(() => { trackRef.current = track }, [track])
```

`trackRef.current` is synced **async** (after next render) — not synchronously in `startTrack`. During the window between `setTrack(t)` being called and that `useEffect` running, `trackRef.current` still holds the **old** track.

`getActive()` (line 74) reads `trackRef.current`:
```typescript
const getActive = useCallback(() => {
  if (trackRef.current?.id?.startsWith('yt:')) return audioYT.current
  return activeSlot.current === 'A' ? audioA.current : audioB.current
}, [])
```

**Bug scenario — YT → local track transition:**
1. Old track is `yt:xxx`. `activeSlot` gets flipped to new local element.
2. `setTrack(newLocalTrack)` called — React schedules re-render.
3. Audio starts playing on `audioA`/`audioB`.
4. `timeupdate` + `loadedmetadata` fire on local audio element.
5. `onTime`/`onMeta` check: `if (el !== getActive()) return` — `getActive()` still returns `audioYT.current` (stale `trackRef.current`).
6. ALL events filtered → `progress` stays 0, `duration` stays 0 → display shows `0:00 0:00`.
7. `loadedmetadata` fires only once — missed forever → duration never recovers.

Same race in reverse (local → YT transition).

## Plan
- [x] **Fix 1**: In `startTrack`, add `trackRef.current = t` synchronously BEFORE `setTrack(t)` — eliminates stale window entirely (1-line fix)
- [x] **Fix 2**: In `onTime` handler, add duration fallback: if `el.duration` is finite/positive, call `setDuration(el.duration)` — catches any future missed `loadedmetadata`

## Files sẽ sửa
| File | Action | Lý do |
|------|--------|-------|
| `frontend/src/PlayerContext.tsx` | modify | 2 surgical changes: `startTrack` + `onTime` |

## Risks
- Fix 1 is very safe: just makes ref update synchronous (same as existing pattern for other refs like `qualityRef`, `repeatRef`)
- Fix 2 adds a cheap conditional check on every `timeupdate` — negligible perf impact; `setDuration` only calls setState when condition is true

## Origin
- **Draft:** `wiki/draft/orca/100626-player-progress-time-stale-fix.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
