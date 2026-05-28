# Proposal: Gapless Playback & Early Preloading

## 1. Restatement
Implement an early preloading mechanism in the frontend player using a dual-audio object strategy to prepare the next track before the current one ends, eliminating loading delays (especially for transcoded streams).

## 2. Affected Files
- `frontend/src/PlayerContext.tsx` (Core playback logic)

## 3. Side Effects & Breakage Risks
- **AnalyserNode Disconnection:** The Web Audio API `AnalyserNode` (used for the visualizer) is tied to a specific `MediaElementSource`. Swapping audio objects might break the visualizer if not properly re-connected.
- **Resource Leaks:** Keeping multiple audio streams open might lead to memory leaks or excessive background transcoding on the backend if the user skips tracks very fast.
- **State Desync:** Managing `timeupdate`, `ended`, and `pause` event listeners across two swapping `Audio` objects introduces state management complexity.

## 4. Implementation Plan
1. **Dual Audio Setup:** Replace the single `audio.current` ref in `PlayerContext.tsx` with `activeAudio` and `standbyAudio` refs.
2. **Preload Trigger:** Add a `useEffect` that monitors the current track's `progress`. When `duration - progress <= 30` (30 seconds remaining, standard Spotify look-ahead window), determine the next track in the queue.
3. **Background Fetching:** Set `standbyAudio.current.src` to the next track's URL with `preload="auto"`. This forces the browser to open the connection and forces the backend to start transcoding/streaming early.
4. **Seamless Swap:** Update the `next()` and `onEnd()` functions. When transitioning, pause the current active audio, swap the references (standby becomes active), and instantly call `play()`.
5. **Audio Routing:** Update `initAudioCtx` to create `MediaElementSource` for *both* audio objects and route them to the same `AnalyserNode`, ensuring the visualizer works continuously across track swaps.

## 5. Success Criteria
- The transition between tracks at the end of a song is instantaneous (no noticeable network or transcode delay).
- The visualizer continues to work perfectly after switching tracks.
- No duplicate/ghost audio plays simultaneously.

## Origin
- **Draft:** `wiki/sources/draft/100526-gapless-playback-preloading-fe.md`
- **Commit:** `9dc66bd — feat(player): implement spotify-style gapless playback and update brand logos`
- **Date promoted:** 2026-05-10
