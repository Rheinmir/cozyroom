# Proposal: AI Chat Sessions (Rooms)

## Problem

Hiện tại `chat_logs` lưu từng turn riêng lẻ. Nút "↩ Mở" chỉ restore 1 exchange (user_msg + ai_msg). Không có khái niệm "session" nên không thể quay lại toàn bộ 1 cuộc trò chuyện.

## Solution

Thêm `session_id` vào `chat_logs`. Mỗi cuộc chat tạo 1 UUID mới, gửi kèm mọi message trong session đó. Lịch sử hiển thị theo session → click = mở lại toàn bộ.

## DB Change

```sql
ALTER TABLE chat_logs ADD COLUMN session_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_chat_logs_session ON chat_logs(session_id);
```

## Backend Changes

### `backend/internal/db/db.go`
```go
db.Exec(`ALTER TABLE chat_logs ADD COLUMN session_id TEXT NOT NULL DEFAULT ''`)
db.Exec(`CREATE INDEX IF NOT EXISTS idx_chat_logs_session ON chat_logs(session_id)`)
```

### `backend/internal/api/ai.go`
- `chatRequest` thêm `SessionID string json:"session_id"`
- `saveLog(...)` thêm param `sessionID string` → store in INSERT
- `logs` handler: thêm query `GET /api/ai/sessions` — trả danh sách sessions (grouped): `[{session_id, first_msg, last_at, turn_count}]`
- `sessionMessages` handler: `GET /api/ai/sessions/{id}/messages` — trả tất cả turns trong session

### `backend/internal/api/routes.go`
```go
mux.HandleFunc("GET /api/ai/sessions",              aiH.sessions)
mux.HandleFunc("GET /api/ai/sessions/{id}/messages", aiH.sessionMessages)
```

## Frontend Changes

### `AIAssistantPage.tsx`
- Khi component mount → generate `sessionId = crypto.randomUUID()` (useRef, không đổi trong session)
- Gửi `session_id: sessionId` trong mọi request tới `/api/ai/chat/stream`
- Panel "Lịch sử chat" → đổi sang load `/api/ai/sessions` (grouped view)
- Mỗi session row hiển thị: `first_msg` (truncated), `last_at`, `turn_count`
- Nút "↩ Mở room" → fetch `/api/ai/sessions/{id}/messages` → build messages + history đầy đủ

### Session restore flow
```
click "↩ Mở room"
  → GET /api/ai/sessions/{id}/messages
  → [{user_msg, ai_msg, actions, model, provider, tokens_in, tokens_out}]
  → setMessages([greeting, ...turns.flatMap(t => [userBubble(t), assistantBubble(t)])])
  → setHistory([...turns.flatMap(t => [{role:'user', content: t.user_msg}, {role:'assistant', content: t.ai_msg}])])
  → sessionId = id  (tiếp tục append vào session cũ)
  → setLogsOpen(false)
```

## API

```
GET /api/ai/sessions
  → [{session_id, preview, last_at, turns}]

GET /api/ai/sessions/{id}/messages
  → [{id, user_msg, ai_msg, actions, model, provider, tokens_in, tokens_out, created_at}]
```

## Scope

- BE: ~60 lines (migration + 2 handlers)
- FE: ~80 lines (sessionId gen, request field, sessions list UI, restore logic)
- Không breaking change: cũ default `session_id = ''`

## Origin

Requested 2026-05-27. Context: [[AIAgentRuntime]] [[MCPToolsCheatsheet]]
