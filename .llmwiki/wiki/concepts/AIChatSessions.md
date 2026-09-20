# AI Chat Sessions / Rooms
**Type:** concept
**Tags:** ai, sessions, rooms, chat

Persistent conversation rooms for AI chat — each chat turn tagged with a UUID session_id. Users can re-enter a full previous conversation and continue from where they left off.

## Notes

- Backend endpoints: `GET /api/ai/sessions` (grouped by session_id, 50 latest), `GET /api/ai/sessions/{id}/messages` (all turns ASC)
- DB migration: `ALTER TABLE chat_logs ADD COLUMN session_id TEXT NOT NULL DEFAULT ''`, partial index `idx_chat_logs_session WHERE session_id != ''`
- Frontend: `sessionIdRef = useRef(crypto.randomUUID())` — one UUID per page lifecycle
- `restoreSession(sessionId)`: fetches `/api/ai/sessions/{id}/messages`, rebuilds full `messages[]` + `history[]` arrays, sets `sessionIdRef.current = sessionId` so new turns append to the same session
- Sessions panel: collapsible list under "📋 Lịch sử chat", each row shows date, turn count, preview text, "↩ Vào room" button
- `saveLog()` now passes `req.SessionID` to DB, `chatResponse` returns `LogID` for dislike button binding
- [[AIAnalytics]] — log entries feed into the same chat_logs table

## Origin
- **Source:** `backend/internal/api/ai.go:730-833` (sessions + sessionMessages handlers, saveLog session_id), `backend/internal/db/db.go:198-199` (migration), `frontend/src/pages/AIAssistantPage.tsx:184-204` (restoreSession)
- **Commit:** working tree on top of `5bcef19`
- **Date:** 2026-05-27
