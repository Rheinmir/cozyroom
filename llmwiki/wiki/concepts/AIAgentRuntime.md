# AI Agent Runtime

## Tên gọi chính xác

Lớp tích hợp biến một LLM thành agent thực thụ được gọi là **AI Agent Runtime** (hay *Agent Tool Harness*, *Agentic Loop Host*).

| Tên gọi | Ngữ cảnh |
|---------|----------|
| **AI Agent Runtime** | Tên chung — toàn bộ lớp middleware |
| **Agentic Loop** | Vòng lặp tool_use → execute → append → repeat |
| **Tool Registry** | Kho định nghĩa tools (MCP registry) |
| **Provider Adapter** | Wrapper chuẩn hoá API của mỗi LLM provider |
| **MCP Host** | Thuật ngữ spec MCP — app sở hữu tools và dispatch |
| **Agent Executor** | LangChain — cùng concept |
| **Function Calling Orchestrator** | OpenAI — cùng concept |

---

## Kiến trúc tổng quan

```
User message
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  AI Agent Runtime  (backend/internal/api/ai.go)     │
│                                                     │
│  1. Provider Adapter   ←── model string (client)   │
│     anthropic / gemini / openrouter                 │
│                                                     │
│  2. Agentic Loop  (max N iterations)                │
│     ┌──────────────────────────────────┐            │
│     │  call(msgs, tools) → text+calls │            │
│     │  for each call:                  │            │
│     │    tool.Handler(input) → result  │            │
│     │    if _frontend_action → queue   │            │
│     │  appendAssistant + appendResults │            │
│     └──────────────────────────────────┘            │
│                                                     │
│  3. Response Assembly                               │
│     text + actions[] + model + provider             │
│                                                     │
│  4. Chat Logger → SQLite chat_logs                  │
└─────────────────────────────────────────────────────┘
    │                          │
    ▼                          ▼
Frontend bubble UI       Tool Registry
(model badge + actions)  (MCP tools)
```

---

## Các lớp chi tiết

### Lớp 1 — Tool Registry (MCP)

Định nghĩa **tất cả capabilities** app muốn expose cho model.

```go
// Template một tool
func myFeatureTool(d ToolDeps) Tool {
    return Tool{
        Name:        "do_thing",
        Description: "Mô tả ngắn gọn. Returns X. Giới hạn Y.",
        InputSchema: map[string]any{
            "type": "object",
            "properties": map[string]any{
                "param": map[string]any{"type": "string", "description": "..."},
            },
            "required": []string{"param"},
        },
        Handler: func(input map[string]any) (any, error) {
            p := strInput(input, "param")
            // ... thực thi
            // RTK: trả về compact fields, giới hạn array size
            return map[string]any{"result": p}, nil
        },
    }
}
```

**Rules cho Description:**
- Nói rõ input gì → output gì → giới hạn gì (ví dụ: "Returns ≤20")
- Model đọc description để quyết định dùng tool nào → description tệ = tool không được dùng

**Rules cho Handler (RTK compression):**
- Dùng field alias ngắn: `t`=title, `ar`=artist, `dur`=duration, `Δ⭐`=star_delta
- Hard cap array: `Paginate(slice, 20)`
- Truncate string dài: `TruncStr(s, 80)`
- Không bao giờ trả `file_path`, `image_path`, URL nội bộ
- Target: ≤500 tokens mỗi tool response

**Frontend Action Tools** — tool không thực thi server-side mà trả signal về FE:
```go
Handler: func(input map[string]any) (any, error) {
    return map[string]any{
        "_frontend_action": "play_track",   // key magic
        "id":               strInput(input, "id"),
        "title":            strInput(input, "title"),
        "artist":           strInput(input, "artist"),
    }, nil
},
```
Backend sẽ detect `_frontend_action` và thêm vào `actions[]` trong response.

---

### Lớp 2 — Provider Adapter

Interface chuẩn hoá để agentic loop không biết mình đang dùng provider nào:

```go
type aiProvider interface {
    initMessages(history []ChatMessage, userMsg string) any
    call(msgs any, tools []Tool) (text string, calls []toolCall, done bool, err error)
    appendAssistant(msgs any, text string, calls []toolCall) any
    appendToolResults(msgs any, calls []toolCall, results []string) any
    ModelID() string
    Provider() string
}
```

**Quirks từng provider cần xử lý:**

| Provider | Tool format | Schema types | History role | Stop signal |
|----------|-------------|--------------|--------------|-------------|
| Anthropic | `tools[]` + `tool_use` content blocks | lowercase (`string`) | `user`/`assistant` | `stop_reason == "end_turn"` |
| Gemini | `function_declarations` + `functionCall` parts | **UPPERCASE** (`STRING`) | `user`/`model` | `finishReason == "STOP"` |
| OpenRouter | `tools[]` OpenAI-compat + `tool_calls` | lowercase | `user`/`assistant`/`system` | `finish_reason == "stop"` |

Gemini quan trọng: schema type phải uppercase (`STRING`, `OBJECT`, `ARRAY`). Implement `geminiSchema()` converter.

**Provider selection logic:**
```go
// Client gửi model string → backend routing:
// "" (empty)     → auto: Anthropic > Gemini > OpenRouter (theo thứ tự key có)
// "claude-*"    → Anthropic
// "gemini-*"    → Gemini
// else          → OpenRouter (openai/*, meta-llama/*, mistral/*, v.v.)
```

---

### Lớp 3 — Agentic Loop

```go
msgs := provider.initMessages(history, userMessage)
var finalText string
var actions []map[string]any

for i := 0; i < 6; i++ {           // max 6 vòng — phòng vòng lặp vô hạn
    text, calls, done, err := provider.call(msgs, tools)
    if err != nil { /* return error */ }
    if text != "" { finalText = text }
    if done || len(calls) == 0 { break }

    results := make([]string, len(calls))
    for j, tc := range calls {
        result, err := tool.Handler(tc.Input)
        // detect _frontend_action → append to actions[]
        results[j] = json.Marshal(result)
    }

    msgs = provider.appendAssistant(msgs, text, calls)
    msgs = provider.appendToolResults(msgs, calls, results)
}
// → finalText + actions[]
```

Số vòng lặp tối đa: **6** là đủ cho hầu hết workflows (search → play = 2 vòng). Tăng lên 10 nếu workflow phức tạp hơn.

---

### Lớp 4 — System Prompt

```
Assistant cho <AppName>. Dùng tools để <danh sách khả năng>.
Trả lời tiếng Việt nếu user nói tiếng Việt.
```

Nguyên tắc:
- Ngắn gọn — system prompt dài làm loãng attention
- Liệt kê khả năng chính (không cần liệt kê từng tool — description của tool đã làm điều đó)
- Language instruction cuối

---

### Lớp 5 — Chat Logger + Failure Detector

```go
type chatLogEntry struct {
    ID         string  // UnixNano → unique, sortable
    CreatedAt  string  // UTC+7, "2006-01-02 15:04:05"
    Model      string
    Provider   string
    UserMsg    string
    AiMsg      string
    Actions    string  // JSON
    Failed     int     // 0=ok, 1=failed
    FailReason string  // not_found / cannot / apology / no_results
}
```

**Failure detection heuristic:**
```go
func detectFailure(userMsg, aiMsg string, actions []map[string]any) (bool, string) {
    if len(actions) > 0 { return false, "" }  // actions = success
    
    lower := strings.ToLower(aiMsg)
    checks := []struct{ pat, reason string }{
        // Vietnamese
        {"không tìm thấy", "not_found"},
        {"không thể", "cannot"},
        {"xin lỗi", "apology"},
        {"rất tiếc", "apology"},
        // English
        {"not found", "not_found"},
        {"unable to", "cannot"},
        {"can't find", "not_found"},
        {"no results", "no_results"},
    }
    // ...
}
```

Log dùng để:
1. **Debug tool quality** — `GET /api/ai/logs?failed=1` → xem user yêu cầu gì mà AI fail
2. **Improve tool descriptions** — failure nhiều ở loại request nào → description tool tương ứng mô tả chưa đủ
3. **Detect missing tools** — failure category mới xuất hiện → cần thêm tool mới

---

## Template triển khai cho app mới

### Checklist (theo thứ tự)

```
□ 1. Xác định capabilities
      - Liệt kê: "App có thể làm gì?" → mỗi capability = 1 tool
      - Phân loại: server-side vs frontend-action

□ 2. Tạo Tool Registry (internal/mcp/registry.go)
      - Implement từng Tool{Name, Description, InputSchema, Handler}
      - Apply RTK: compact fields, Paginate, TruncStr
      - Frontend action tools: return {"_frontend_action": "..."}

□ 3. Tạo Provider Adapters (internal/api/ai_providers.go)
      - Implement aiProvider interface cho mỗi provider cần hỗ trợ
      - Handle quirks: Gemini uppercase schema, OpenRouter system msg
      - Add ModelID() + Provider() methods

□ 4. Wiring AI Handler (internal/api/ai.go)
      - AIHandlers{keys..., tools, db}
      - selectProvider() routing logic
      - Agentic loop (max 6 iter)
      - saveLog() + detectFailure()
      - chatResponse{Text, Actions, Model, Provider}

□ 5. Routes (internal/api/routes.go)
      - POST /api/ai/chat
      - GET  /api/ai/logs

□ 6. nginx proxy
      - /api/ → backend (thường đã có)
      - /mcp  → backend (phải thêm riêng nếu dùng MCP HTTP endpoint)

□ 7. DB Migration (internal/db/db.go)
      - chat_logs table

□ 8. Frontend
      - Chat UI: input + messages + send button
      - Model selector input (empty = auto)
      - Assistant bubble: model badge (provider + model string)
      - executeAction() dispatcher → PlayerContext / router / etc.

□ 9. i18n
      - ai.greeting, ai.placeholder, ai.send, ai.model_placeholder

□ 10. Verify
       - Go build + vet
       - TSC clean
       - Docker rebuild
       - Test: chat → tool call → action dispatched → log saved
```

### File structure

```
backend/internal/
  mcp/
    tool.go          Tool struct, AnthropicTool, ToAnthropic()
    compress.go      RTK helpers: TrimTrack, TrimArtist, Paginate, TruncStr
    registry.go      NewRegistry(deps) → []Tool
    server.go        HTTP handler (/mcp GET+POST JSON-RPC)
    stdio.go         Standalone binary transport (optional)
  api/
    ai.go            AIHandlers, aiProvider interface, agentic loop, logger
    ai_providers.go  anthropicProvider, geminiProvider, openRouterProvider

frontend/src/
  pages/
    AIAssistantPage.tsx   Chat UI
  i18n/
    en.json / vi.json     ai.* keys
  index.css               .ai-* styles
```

---

## Tối ưu hoá AI Agent Client

### Điều hướng tốt (Model biết dùng tool nào)

**Tool description** là yếu tố quan trọng nhất:
```
Xấu:  "Search for music"
Tốt:  "Search music: artists+albums+tracks. Returns top 20. Use for any music query."
Tốt:  "Play a track in the player. Must call search_music first to get track id."
```

Explicit dependency hint (`Must call X first`) giúp model chain tools đúng thứ tự.

### Giảm token

1. **RTK compact response** — mỗi tool trả ≤500 tokens
2. **History dạng text-only** — không serialize tool_use blocks vào history (phức tạp + tốn tokens). History chỉ lưu `{role, content: string}`
3. **Hard cap results** — Paginate(20) cho search, Paginate(15) cho trending, v.v.
4. **Tool count** — ≤20 tools. Nhiều hơn làm tăng context overhead mỗi call

### Fail-safe

- Max iterations = 6 (tránh infinite loop nếu model không emit `done`)
- Timeout: `proxy_read_timeout 300s` ở nginx
- Tool not found → trả `{"error": "tool X not found"}` thay vì panic

### Debug

```bash
# Xem tất cả logs
curl /api/ai/logs

# Chỉ failures
curl /api/ai/logs?failed=1

# Tools available
curl /mcp
```

---

## SSE Streaming (Live Status Updates)

Thay vì chờ `···` cả phút, dùng SSE để push status realtime.

### Backend

```go
// POST /api/ai/chat/stream
func (h *AIHandlers) chatStream(w http.ResponseWriter, r *http.Request) {
    flusher := w.(http.Flusher)  // MUST: middleware cần forward Flush()
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("X-Accel-Buffering", "no")  // nginx: tắt buffer

    send := func(v any) {
        b, _ := json.Marshal(v)
        fmt.Fprintf(w, "data: %s\n\n", b)
        flusher.Flush()
    }

    // status events trong agentic loop:
    // {"status": "Đang kết nối model..."}
    // {"status": "Model X đã nhận, đang thực thi..."}
    // {"status": "Đang tìm kiếm nhạc..."}   ← khi gọi tool
    // {"text": "...", "actions": [...], "model": "...", ...}  ← kết quả cuối
    // {"error": "..."}  ← lỗi
}
```

**Pitfall**: Nếu có metrics middleware bọc ResponseWriter, phải thêm `Flush()` method:
```go
type statusWriter struct { http.ResponseWriter; status int }
func (sw *statusWriter) Flush() {
    if f, ok := sw.ResponseWriter.(http.Flusher); ok { f.Flush() }
}
```
Thiếu cái này → `w.(http.Flusher)` assertion fail → "streaming not supported".

### nginx
```nginx
location /api/ai/chat/stream {
    proxy_pass http://backend:8080;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 120s;
}
```

### Frontend
```typescript
const res = await fetch('/api/ai/chat/stream', { method: 'POST', ... })
const reader = res.body!.getReader()
let buf = ''
while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n'); buf = lines.pop() ?? ''
    for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const ev = JSON.parse(line.slice(6))
        if (ev.status) setStatusText(ev.status)        // update loading bubble
        else if (ev.text !== undefined) { /* final */ }
        else if (ev.error) { /* show error */ }
    }
}
```

---

## OpenRouter Fallback Chain

Free tier models rate-limit frequently. Production pattern: free first, paid as backstop.

```go
var openRouterFallbacks = []string{
    "deepseek/deepseek-v4-flash:free",   // 1M context, free
    "google/gemma-4-31b-it:free",        // 262K context, reliable
    "google/gemma-4-26b-a4b-it:free",
    "inclusionai/ling-2.6-flash",        // $0.01/1M — paid cheapest
    "qwen/qwen3.5-9b",                   // $0.04/1M
    "deepseek/deepseek-v4-flash",        // $0.10/1M — last resort
}
```

Khi fallback, gửi status cho user qua onStatus callback:
```go
type openRouterProvider struct {
    ...
    onStatus func(string)  // injected từ chatStream handler
}
```

**TRÁNH**: `nvidia/nemotron-3-super-120b-a12b:free` — tốn 9–11k token, trả text rỗng.

---

## Token Tối Ưu

### Input token cao do

1. **Tool schemas verbose** — loại bỏ `description` trong property-level schemas, chỉ giữ `type`
2. **History không giới hạn** — cap 8 turns server-side: `hist = hist[len(hist)-8:]`
3. **System prompt phình** — giữ ngắn, chỉ inject top-8 memory facts

Kết quả thực tế: 3,000 → 900 tokens/request sau optimization.

---

## Tool ID Verification

Small models hay truyền sai `id` (nhầm field `title` cho `id`). Pattern phòng thủ:

```go
// Trong playTrackTool handler:
err := db.QueryRow(`SELECT id, album_id, ... FROM tracks WHERE id = ?`, id).Scan(...)
if err != nil && title != "" {
    // fallback: search by title (Unicode-safe 3-variant LIKE)
    db.QueryRow(`SELECT ... WHERE title LIKE ? OR title LIKE ? OR title LIKE ?`,
        "%"+title+"%", "%"+strings.ToLower(title)+"%", "%"+strings.ToUpper(title)+"%").Scan(...)
}
// return realID từ DB — không bao giờ trust model-provided ID trực tiếp
```

---

## Empty Text Fallback

Một số model (nhỏ, free) gọi tool đúng nhưng không generate text sau đó. Hai lớp phòng thủ:

1. **System prompt**: `"Sau khi gọi tool xong, LUÔN viết 1 câu thông báo kết quả cho user."`
2. **Backend synthesis**: nếu `finalText == ""` sau loop → tổng hợp từ actions:
```go
if finalText == "" {
    for _, a := range actions {
        if a["type"] == "play_track" {
            finalText = fmt.Sprintf("Đang phát \"%s\" của %s.", title, artist)
        }
    }
    if finalText == "" { finalText = "Xong rồi!" }
}
```

---

## Agent Memory

Persistent memory qua SQLite + 3 tools + system prompt injection:

```sql
CREATE TABLE agent_memory (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)
```

```go
// System prompt injection (top 8 facts):
func aiSystemPrompt() string {
    // SELECT key, value FROM agent_memory ORDER BY updated_at DESC LIMIT 8
    return base + "\n\nBạn nhớ về user:\n- " + strings.Join(facts, "\n- ")
}

// Tools: remember(key, value), recall(query), forget(key)
// recall dùng 3-variant LIKE cho Unicode Vietnamese
```

Memory panel FE: GET/PUT/DELETE `/api/ai/memory` — user xem, export JSON, import JSON, xóa từng fact.

---

## Checklist đầy đủ (session 2)

```
□ 11. SSE streaming endpoint + nginx proxy_buffering off
□ 12. Middleware: forward Flush() interface
□ 13. OpenRouter onStatus callback + fallback chain
□ 14. Tool schemas: bỏ property descriptions
□ 15. History cap server-side (8 turns)
□ 16. Agent memory (DB + 3 tools + system prompt + REST API)
□ 17. Memory panel UI (view/export/import/delete)
□ 18. Token display per bubble (↑in ↓out)
□ 19. play_track: DB verify ID + title fallback + return duration_s
□ 20. Empty text: synthesize từ actions hoặc "Xong rồi!"
□ 21. onLoad handler cho cover img (opacity fix)
```

---

## Origin

Extracted from Cozyroom implementation sessions 2026-05-26 (v1) and 2026-05-27 (v2). Code lives in:
- `backend/internal/mcp/` — tool registry + MCP protocol
- `backend/internal/api/ai.go` + `ai_providers.go` — runtime + adapters + SSE
- `frontend/src/pages/AIAssistantPage.tsx` — streaming chat UI + memory panel

Template repo: https://github.com/Rheinmir/integrated-agent-chat

See also: [[MCPServer]] for full tool list and RTK compression details.
