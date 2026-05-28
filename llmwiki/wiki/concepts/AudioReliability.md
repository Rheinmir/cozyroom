# Proposal: Fix Audio Interruption During Playback

## 1. Request Understanding
The client machine loses sound in the middle of a song. This needs investigation and a fix to ensure stable playback.

## 2. Affected Files / Functions
- `backend/internal/transcode/transcode.go`: `ToMP3_320` function (missing context).
- `backend/internal/api/handler.go`: `stream` handler (needs to pass request context).
- `frontend/src/PlayerContext.tsx`: `PlayerProvider` component (missing error listeners).
- `backend/internal/metrics/metrics.go`: Define new error counters.

## 3. Potential Side Effects
- **UI Notifications**: Handling errors in the frontend might reveal underlying network issues that were previously "silent" failures.
- **Resource Cleanup**: Killing ffmpeg processes more aggressively might cause "broken pipe" errors in backend logs, which are expected when a client disconnects.

## 4. Proposed Implementation Plan
1.  **Frontend Instrumentation**:
    - Add `error` event listeners to `audioA` and `audioB` in `PlayerContext.tsx`.
    - Log `el.error.code` and `el.error.message` to the console for debugging.
    - Implement a basic retry logic or show a toast if a `NETWORK_ERROR` (code 2) occurs.
2.  **Backend Process Management**:
    - Update `ToMP3_320` in `backend/internal/transcode/transcode.go` to accept `context.Context`.
    - Use `exec.CommandContext(ctx, ...)` instead of `exec.Command`.
    - Pass `r.Context()` from the HTTP handler in `backend/internal/api/handler.go`.
3.  **Observability**:
    - Add `StreamErrorsTotal` to `backend/internal/metrics/metrics.go`.
    - Increment this counter in the `stream` handler if transcoding fails or if the pipe breaks.

## 5. Success Criteria
- [ ] Frontend logs descriptive error messages when playback fails.
- [ ] Backend ffmpeg processes are terminated immediately when the client cancels the request (verified via `ps` or task manager during testing).
- [ ] No more "ghost" ffmpeg processes running after a song is skipped or stopped.
- [ ] `/metrics` endpoint shows `hs_stream_errors_total` when failures occur.

## Origin
- **Draft:** `wiki/sources/draft/120526-fix-audio-interruption-audio.md`
- **Commit:** `25c1af5 — feat(audio): prevent silent audio interruptions and resource leaks via frontend retries and backend context management`
- **Date promoted:** 2026-05-12
