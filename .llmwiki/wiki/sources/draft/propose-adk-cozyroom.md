# Proposal: Áp dụng ADK Concepts vào Cozyroom

> Status: **DRAFT** · Chờ review  
> Nguồn: [adk-distill.md](./adk-distill.md)  
> Codebase: Go backend · React/TS frontend · SQLite

---

## Bối cảnh

Cozyroom đang có AI chat với:
- `agent_memory` table (key/value, query top 8 rows vào system prompt)
- Tool calls qua MCP layer
- History capped 8 turns
- SSE streaming
- `SessionID` field trong `chatRequest` (chưa được dùng thực sự)

**Pain points hiện tại:**
1. Memory flat — không phân biệt user-specific vs app-wide vs session-scoped
2. `remember()` / `recall()` là tool calls → tốn token, latency thêm 1 round-trip
3. History bị cắt (8 turns) mà không có strategy
4. State không có audit trail

---

## Phase 1 — Scoped State (ADK State Prefixes) ⭐ Priority

> **Core insight từ ADK**: Một dict, bốn scopes, zero extra infrastructure.

### Vấn đề cụ thể

`agent_memory` hiện tại là flat table:
```sql
SELECT key, value FROM agent_memory ORDER BY updated_at DESC LIMIT 8
```

Không có phân biệt:
- Memories về user cụ thể nào?
- Thứ gì là session-specific vs persisted?
- App-wide settings (e.g. language preference) vs user preference?

### Đề xuất: Migrate sang Scoped State

**Schema mới** (backward compatible):

```sql
-- Thay agent_memory bằng agent_state
CREATE TABLE IF NOT EXISTS agent_state (
    scope      TEXT NOT NULL DEFAULT 'user',  -- 'session' | 'user' | 'app'
    scope_id   TEXT NOT NULL,                  -- session_id | user_id | 'global'
    key        TEXT NOT NULL,
    value      TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (scope, scope_id, key)
);

-- Migration: copy agent_memory → agent_state với scope='user', scope_id='default'
INSERT OR IGNORE INTO agent_state (scope, scope_id, key, value, updated_at)
SELECT 'user', 'default', key, value, updated_at FROM agent_memory;
```

**Tương đương ADK State Prefixes → Cozyroom mapping:**

| ADK Prefix | Cozyroom Scope | scope_id | Ví dụ |
|------------|---------------|----------|-------|
| `user:` | `scope='user'` | user ID (hoặc `'default'`) | genre preference, listening habits |
| `app:` | `scope='app'` | `'global'` | language setting, featured playlist |
| `session:` | `scope='session'` | session_id | current queue context, mid-task state |
| `temp:` | in-memory only | — | search results buffer (không persist) |

**Go implementation:**

```go
// internal/ai/state.go
type StateScope string

const (
    ScopeSession StateScope = "session"
    ScopeUser    StateScope = "user"
    ScopeApp     StateScope = "app"
)

type AgentState struct {
    db *sql.DB
}

func (s *AgentState) Get(scope StateScope, scopeID, key string) (string, bool) {
    var val string
    err := s.db.QueryRow(
        `SELECT value FROM agent_state WHERE scope=? AND scope_id=? AND key=?`,
        scope, scopeID, key,
    ).Scan(&val)
    return val, err == nil
}

func (s *AgentState) Set(scope StateScope, scopeID, key, value string) error {
    _, err := s.db.Exec(`
        INSERT INTO agent_state(scope, scope_id, key, value, updated_at)
        VALUES(?,?,?,?,unixepoch())
        ON CONFLICT(scope, scope_id, key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
        scope, scopeID, key, value,
    )
    return err
}

// LoadContext: inject scoped context vào system prompt
func (s *AgentState) LoadContext(sessionID, userID string) string {
    var parts []string

    // 1. App-wide settings
    rows, _ := s.db.Query(`SELECT key, value FROM agent_state WHERE scope='app' AND scope_id='global'`)
    // ... scan rows

    // 2. User memories (top 8 most recent)
    rows, _ = s.db.Query(`SELECT key, value FROM agent_state WHERE scope='user' AND scope_id=? ORDER BY updated_at DESC LIMIT 8`, userID)
    // ... scan rows

    // 3. Session state (current context)
    rows, _ = s.db.Query(`SELECT key, value FROM agent_state WHERE scope='session' AND scope_id=?`, sessionID)
    // ... scan rows

    return strings.Join(parts, "\n")
}
```

**Tool interface thay đổi** — tools nhận thêm `StateContext`:

```go
// Thay vì tool tự query DB trực tiếp:
type ToolContext struct {
    State   *AgentState
    Session string
    UserID  string
}

// remember() và recall() không cần là tools nữa — auto-inject vào prompt
// Nhưng agent vẫn có thể gọi state_set() nếu muốn explicit
```

**System prompt auto-build:**
```go
func (h *AIHandlers) aiSystemPromptWith(np *nowPlayingInfo, sessionID string) string {
    base := aiSystemPromptBase
    base += h.state.LoadContext(sessionID, "default")
    // now-playing context...
    return base
}
```

**Verifiable goal:** `SELECT * FROM agent_state WHERE scope='user'` trả về memories của user. `SELECT * FROM agent_state WHERE scope='session' AND scope_id=?` trả về state của session đó.

---

## Phase 2 — Session Persistence + State Delta Audit

> **ADK insight**: Mọi state change đều có audit trail qua event log.

### Session Tracking thực sự

`chatRequest.SessionID` hiện tại được nhận nhưng không persist. Đề xuất persist session:

```sql
CREATE TABLE IF NOT EXISTS chat_sessions (
    session_id  TEXT PRIMARY KEY,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    last_active INTEGER NOT NULL DEFAULT (unixepoch()),
    turn_count  INTEGER NOT NULL DEFAULT 0
);

-- State delta audit log (optional, lightweight)
CREATE TABLE IF NOT EXISTS state_deltas (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    turn       INTEGER NOT NULL,
    scope      TEXT NOT NULL,
    scope_id   TEXT NOT NULL,
    key        TEXT NOT NULL,
    old_value  TEXT,
    new_value  TEXT,
    timestamp  INTEGER NOT NULL DEFAULT (unixepoch())
);
```

**Benefit:**
- Session resume — user đóng tab rồi mở lại, context không mất
- Audit: "agent đã nhớ gì sau mỗi turn?"
- Debug: trace lại tại sao agent đưa ra quyết định nào

**Verifiable goal:** Sau restart server, `GET /api/ai/sessions/{id}` trả về session state còn nguyên.

---

## Phase 3 — Callbacks cho Context Injection

> **ADK insight**: Callbacks là "intercept points" — extend behavior mà không fork.

### Middleware Pattern (Go equivalent of Callbacks)

```go
// internal/ai/callbacks.go
type TurnContext struct {
    SessionID  string
    UserID     string
    State      *AgentState
    NowPlaying *nowPlayingInfo
    TurnIndex  int
}

type BeforeModelHook func(ctx *TurnContext, systemPrompt *string)
type AfterToolHook   func(ctx *TurnContext, toolName string, result any)

// Đăng ký hooks:
h.RegisterBeforeModel(injectTimeContext)      // inject thời gian hiện tại
h.RegisterBeforeModel(injectNowPlayingCtx)    // inject bài đang phát
h.RegisterBeforeModel(injectUserState)        // inject user memories
h.RegisterAfterTool(auditStateChanges)        // log state delta
```

**Use cases cụ thể cho Cozyroom:**

1. **`injectTimeContext`** — inject thời gian + timezone vào mỗi turn (hiện đã làm inline, extract ra callback)

2. **`injectListeningContext`** — inject "bài đang phát, playlist hiện tại, queue length" từ frontend state

3. **`updateListeningHistory`** (AfterTool) — khi tool `play_track` thành công, auto-update `session:last_played` và `user:play_count`

4. **`guardRailChecker`** (BeforeModel) — kiểm tra nếu user đang download nhiều → throttle

**Verifiable goal:** Log file cho thấy mỗi turn có timestamp injection, và state_deltas table update sau mỗi tool call.

---

## Phase 4 (Future) — Multi-Agent / Specialist Pattern

> **ADK insight**: Agent-as-Tool → hierarchical delegation.

Cozyroom đang có nhiều domains: music, video, ebooks, trending. Hiện tại một agent xử lý tất cả.

**Đề xuất dài hạn**: Orchestrator + Specialists

```
User Query
    ↓
Orchestrator Agent
    ├── MusicAgent     (search, play, playlist)
    ├── VideoAgent     (stream, queue, recommendations)  
    ├── EbookAgent     (library, read progress)
    └── TrendingAgent  (analytics, insights)
```

Mỗi specialist có:
- System prompt riêng, ngắn gọn và focused
- Tools chỉ liên quan domain của mình
- Shared state qua scoped prefix (`user:*` shared, `session:music:*` isolated)

**Trigger:** Khi codebase đủ mature và có nhu cầu thêm specialists.

---

## Implementation Order

```
Phase 1 ← Bắt đầu ngay, high value, low risk
  └── Migrate agent_memory → agent_state (backward compatible)
  └── Refactor aiSystemPromptWith() để dùng LoadContext()
  └── Expose scope trong remember/recall tools

Phase 2 ← Sau Phase 1, medium effort
  └── Thêm chat_sessions table
  └── Persist session state
  └── Optional: state_deltas audit log

Phase 3 ← Refactor, clean code
  └── Extract callback/hook system
  └── Move inline injections vào hooks

Phase 4 ← Future, requires product decision
  └── Multi-agent routing
  └── Specialist agents
```

---

## Risk & Tradeoffs

| Concern | Mitigation |
|---------|-----------|
| Migration phá agent_memory cũ | Schema mới, migrate data, giữ table cũ 1-2 weeks |
| scope_id='default' single-user assumption | Cozyroom is self-hosted personal use — OK |
| State audit log tốn disk | Optional feature, default off |
| Multi-agent tăng latency | Chỉ làm khi thực sự cần, Phase 4 là future |

---

## Quick Win (1 session)

**Chỉ cần làm 3 việc để có Scoped State ngay:**

1. Thêm `scope` + `scope_id` columns vào `agent_memory` (hoặc tạo table mới)
2. Sửa `aiSystemPrompt()` để query theo scope
3. Update `remember()` tool để nhận `scope` parameter (`user` | `session` | `app`)

Không cần thay đổi gì ở frontend hay MCP layer.

## Origin
- legacy backfill (harness-update) — commit gần nhất: no-commit (untracked)
