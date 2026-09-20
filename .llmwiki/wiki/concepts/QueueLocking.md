# Queue Locking (lockedQueueRef)
**Type:** concept
**Tags:** player, queue, smart-radio, locking

`lockedQueueRef` boolean prevents `fillSmartQueue()` from contaminating explicit playlist queues. When user plays a playlist, smart radio fill is blocked; when user switches to smart shuffle mode, the lock is released.

## Notes

- Lock set `true` in `play()` when `newQueue && newQueue.length > 1` (multi-track playlist/queue)
- Lock set `false` in `play()` when `shuffleModeRef.current === 'smart'` and no multi-track queue provided
- Lock set `false` in `handleSetShuffleMode('smart')` — user explicitly wants smart radio
- `fillSmartQueue()` guard: `if (q.length - nextIdx < 10 && !lockedQueueRef.current)` skips fill when locked
- Companion fix in `fe07e92`: `pass tracks array through action extraction` ensures `play_queue` actions pass the full `tracks[]` to avoid empty queue
- [[SmartRadio]] — weighted random queue algorithm, [[GaplessPlayback]] — queue management

## Origin
- **Source:** `frontend/src/PlayerContext.tsx:178,317,446-449,566`
- **Commit:** working tree on top of `5bcef19` (diff uncommitted)
- **Date:** 2026-05-27
