# Progress Restore on Page Reload
**Type:** concept
**Tags:** player, progress, persistence, beforeunload

Saves `currentTime` to `localStorage` on tab close (`beforeunload` event), complementing existing `onPause` save — ensures playback position is restored after page reload or accidental tab close.

## Notes

- `window.addEventListener('beforeunload', handler)` — handler reads `getActive().currentTime`, merges into existing `hs-player` localStorage state
- Reuses existing `STORAGE_KEY` + `SavedState` shape — no new schema
- `getActive` ref dependency ensures correct audio element (A/B slot) is read
- Cleanup: `removeEventListener('beforeunload', handler)` on unmount
- Existing restore logic (mount `useEffect` at PlayerContext.tsx:102) reads `s.progress` and seeks `audioA.current.currentTime = s.progress` — so the saved progress is automatically restored on next page load
- [[GaplessPlayback]] — dual-audio architecture, [[AudioReliability]] — error handling

## Origin
- **Source:** `frontend/src/PlayerContext.tsx:124-137`
- **Commit:** working tree on top of `5bcef19`
- **Date:** 2026-05-27
