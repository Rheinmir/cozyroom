# Proposal: AI Agent Upgrade — Memory + Token Display

**Date:** 2026-05-26  
**Status:** APPROVED — implementing Minimal path  
**Module:** be + fe

---

## 1. Request

Upgrade AI Assistant tab từ reactive chatbot → true AI Agent bằng cách thêm persistent cross-session memory. Đồng thời hiển thị token usage (in/out) ngay dưới mỗi assistant reply.

---

## 2. Files affected

### Token display
- `backend/internal/api/ai.go` — thêm `TokensIn`, `TokensOut` vào `chatResponse`
- `backend/internal/api/ai_providers.go` — mỗi provider parse `usage` từ response
- `frontend/src/pages/AIAssistantPage.tsx` — hiển thị token count dưới bubble
- `frontend/src/index.css` — style `.ai-token-usage`

### Memory tools
- `backend/internal/db/db.go` — migration `agent_memory` table
- `backend/internal/mcp/registry.go` — thêm `remember` + `recall` tools
- `backend/internal/api/ai.go` — inject top memories vào system prompt mỗi turn

---

## 3. Breakage risks

- System prompt injection tăng `tokens_in` mỗi turn — expected, không phải bug
- `recall` tool dùng LIKE search → Vietnamese diacritics case issue (đã fix ở search.go, áp dụng tương tự)
- Memory có thể chứa stale facts — cần `forget(key)` tool để agent tự clean up

---

## 4. Implementation plan

### Phase A — Token display (2h)

1. Mỗi provider parse token usage từ response body:
   - Anthropic: `usage.input_tokens` + `usage.output_tokens`
   - Gemini: `usageMetadata.promptTokenCount` + `usageMetadata.candidatesTokenCount`
   - OpenRouter: `usage.prompt_tokens` + `usage.completion_tokens`
2. Thêm `TokensIn int`, `TokensOut int` vào `chatResponse`
3. Frontend: hiển thị `↑ 1,234 ↓ 89` nhỏ dưới model badge

### Phase B — Minimal Agent Memory (4h)

**DB migration:**
```sql
CREATE TABLE IF NOT EXISTS agent_memory (
    key        TEXT NOT NULL,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (key)
);
```

**2 new MCP tools:**
```
remember(key, value) → INSERT OR REPLACE INTO agent_memory
recall(query)        → SELECT * WHERE key LIKE '%query%' OR value LIKE '%query%' LIMIT 10
forget(key)          → DELETE FROM agent_memory WHERE key = ?
```

**System prompt injection:**
```go
// Trước mỗi chat — load top 8 memories, inject vào system prompt
rows := db.Query(`SELECT key, value FROM agent_memory ORDER BY updated_at DESC LIMIT 8`)
memBlock := formatMemories(rows)
systemPrompt = basePrompt + "\n\nBạn nhớ về user:\n" + memBlock
```

**Agent instructions (thêm vào system prompt):**
```
Khi user nói sở thích, thói quen, hoặc bạn học được điều gì về user → dùng remember() để lưu.
Khi cần context về user → dùng recall() trước.
```

---

## 5. Success criteria

- [ ] Mỗi assistant bubble hiện `↑ X ↓ Y tokens`
- [ ] Agent dùng `remember()` tự động khi user nói sở thích
- [ ] Session mới, agent vẫn biết facts đã lưu từ session trước
- [ ] `GET /api/ai/logs` có `tokens_in` + `tokens_out` per turn
- [ ] `forget()` xóa được memory cụ thể

---

## Fancy option (future)

Nếu minimal thành công, xét thêm:
- **Semantic vector memory** — sqlite-vec, recall bằng embedding similarity thay LIKE
- **Playback event feed** — skip/repeat/play events → auto-feed agent memory preferences
- **Async task queue** — `POST /api/ai/tasks` → goroutine pool → SSE stream progress
- **Proactive push** — agent tự trigger khi playlist hết / library có bài mới / trending update

---

## Origin

Session 2026-05-26. Phát sinh từ discussion về AI Agent Runtime (`concepts/AIAgentRuntime.md`).  
See also: [[MCPServer]], [[AIAgentRuntime]]
