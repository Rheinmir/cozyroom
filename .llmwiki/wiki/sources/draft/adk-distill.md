# ADK (Agent Development Kit) — Distilled
> Source: [adk.dev](https://adk.dev) · Distilled: 2026-06-02

ADK là open-source framework của Google để build **production-grade AI agents**. Hỗ trợ Python, TypeScript, Go, Java, Kotlin. Điểm khác biệt: **code-first**, không phải no-code/drag-drop.

---

## 1. Core Architecture — Event-Driven Loop

```
User → Runner → Agent → LLM → Tools → Events → State Delta
```

Mọi thứ trong ADK đều là **Event**. Event là unit giao tiếp giữa:
- UI ↔ Runner ↔ Agent ↔ LLM ↔ Tools

Mỗi event có thể carry `state_delta` — bản ghi *những gì thay đổi* trong state sau turn đó. Điều này cho phép trace lại lịch sử thay đổi state một cách deterministic.

---

## 2. ⭐ State — The Session's Scratchpad

> **Đây là concept quan trọng nhất và dễ apply nhất.**

State là **key-value dictionary** gắn với một session, dùng để agent lưu/đọc thông tin trong suốt hội thoại. Điều đặc biệt là **prefix của key quyết định scope và lifetime**:

| Prefix | Scope | Visibility | Persist? |
|--------|-------|-----------|----------|
| *(none)* | Session | Conversation hiện tại | ✅ với DB |
| `user:` | User | Tất cả sessions của user đó | ✅ với DB |
| `app:` | App | Global — tất cả users | ✅ với DB |
| `temp:` | Invocation | Turn hiện tại only | ❌ không persist |

**Pattern quan trọng:**
```python
# Lưu preference của user — tồn tại qua mọi sessions
tool_context.state["user:favorite_genre"] = "jazz"

# Lưu progress của task hiện tại — chỉ trong session này
tool_context.state["current_queue_index"] = 3

# App-wide setting — tất cả users thấy
tool_context.state["app:maintenance_mode"] = False

# Intermediate calc — chỉ trong turn này, không lưu
tool_context.state["temp:search_results_raw"] = results
```

**Unified interface** — code của bạn không đổi, chỉ prefix thay đổi behavior.

**State changes → tracked as `state_delta`** trong event log → full auditability.

---

## 3. Sessions — Conversation Threading

Session = một luồng hội thoại liên tục. Một user có thể có nhiều sessions.

```
App
└── User A
    ├── Session 1 (hôm qua)
    └── Session 2 (hôm nay)  ← state được shared nếu dùng user: prefix
```

**SessionService** variants:
- `InMemorySessionService` — dev only, mất khi restart
- `DatabaseSessionService` — SQLite/PostgreSQL, persist
- `VertexAiSessionService` — cloud-managed

**Session object có:**
- `session_id`, `user_id`, `app_name`
- `events` — toàn bộ lịch sử hội thoại
- `state` — key-value scratchpad

---

## 4. Memory — Long-Term Knowledge

Memory ≠ State. Phân biệt:

| | State | Memory |
|--|-------|--------|
| Scope | Trong session/user/app | Cross-session, searchable |
| Access | Trực tiếp qua key | Qua semantic search / retrieval |
| Format | Key-value | Unstructured text, embeddings |
| Use case | Task progress, preferences | Facts, learned knowledge |

**MemoryService** — inject relevant memories vào system prompt:
```python
# Agent "nhớ" thông tin quan trọng về user
memory_service.add_memory("User thích nhạc jazz và ghét nhạc pop")
relevant = memory_service.search("user music taste")
# → inject vào system prompt
```

**Tránh "prompt pollution"** — không append toàn bộ history thô vào prompt. Memory service filter/compress để giữ token cost thấp.

---

## 5. Tools — Agent's Hands

Tools là functions agent có thể gọi để tương tác với thế giới. ADK support:

**Tool types:**
1. **Function Tools** — Python/Go function thông thường, wrapped tự động
2. **Agent-as-Tool** — agent khác được dùng như tool (hierarchical delegation)
3. **Built-in Tools** — Google Search, Code Execution, RAG
4. **MCP Tools** — tích hợp Model Context Protocol servers

**ToolContext** — context object pass vào tool:
```python
def play_track(track_id: str, tool_context: ToolContext):
    # Truy cập state từ bên trong tool
    tool_context.state["last_played"] = track_id
    tool_context.state["user:play_count"] += 1
```

**Structured output** — tools có thể return typed schemas thay vì raw text.

---

## 6. Callbacks — Intercept Points

Callbacks là **lifecycle hooks** để observe/modify agent behavior mà không cần fork framework:

```
Before/After Agent
Before/After Model (LLM call)
Before/After Tool
```

**Ứng dụng thực tế:**
- **Guardrails**: chặn content không phù hợp trước khi gửi LLM
- **Logging**: log mọi LLM call với token count
- **Context injection**: inject current time, user context vào mỗi turn
- **Caching**: cache LLM response cho input giống nhau

```python
def before_model_callback(callback_context, llm_request):
    # Inject context động vào system prompt
    llm_request.system += f"\nNow playing: {get_now_playing()}"
    return None  # None = continue, or return response để skip LLM call
```

---

## 7. Multi-Agent Architecture

ADK 2.0 được thiết kế tối ưu cho **Multi-Agent Systems (MAS)**:

### Orchestration Patterns

**Sequential:**
```
Orchestrator → Agent A → Agent B → Agent C → Result
```

**Parallel (Fan-out/Fan-in):**
```
Orchestrator → Agent A ┐
              → Agent B ┼→ Join → Result
              → Agent C ┘
```

**Loop (Iterative refinement):**
```
Orchestrator → Writer → Critic → [loop until quality ok] → Result
```

**Dynamic routing** — LLM orchestrator tự chọn agent phù hợp.

### Task API (ADK 2.0)
Agent-to-agent delegation với structured output:
```python
# Coordinator delegate sang specialist
result = await specialist_agent.run_as_task(
    "Tìm 5 bài jazz hay nhất của Miles Davis",
    output_schema=TrackList
)
```

### Agent-as-Tool pattern
```python
music_expert = LlmAgent(name="music_expert", ...)
search_agent = LlmAgent(
    tools=[music_expert]  # agent khác là tool
)
```

---

## 8. ADK 2.0 Graph Workflows

> **ADK Python 2.0 GA — graph workflows + collaborative agents**

**Graph-based execution engine** thay vì linear:
- **Nodes** = agents/tools
- **Edges** = data flow
- **Conditions** = routing logic
- **State** = shared context giữa nodes

Hỗ trợ: routing, fan-out/fan-in, loops, retries, **human-in-the-loop**.

**Human-in-the-loop**: agent pause và đợi human approval trước khi tiếp tục — ideal cho destructive actions.

---

## 9. Events & Artifact System

**Events** carry:
- `content` — text/tool calls
- `state_delta` — state changes trong turn này
- `actions` — side effects (transfer_to_agent, etc.)

**Artifacts** — handle binary/large data ngoài conversation:
- Files, audio, images
- Persist qua session
- Agent có thể produce/consume artifacts

---

## 10. Evaluation Framework

ADK có built-in eval:
```bash
adk eval agent/ eval_dataset.json
```

Eval dataset là JSON với `query` và `expected_tool_use` / `expected_response`. Chạy tự động để CI/CD gate agent quality.

---

## 11. Developer Experience

```bash
adk run agent/        # CLI runner
adk web               # Local UI với trace viewer
adk eval agent/ ...   # Eval runner
```

**Trace viewer** — visualize mọi event, state change, tool call trong từng turn.

---

## Key Insights cho Practitioners

1. **State prefix là killer feature** — một dict, bốn scopes, không cần thiết kế phức tạp
2. **Event-driven = auditable** — mọi state change đều có trace
3. **Agent-as-Tool** = composability mà không cần custom orchestration code
4. **Callbacks >> Subclassing** — extend behavior mà không fork
5. **Memory ≠ History** — compress và retrieve, không dump toàn bộ vào prompt
6. **Graph workflows** cho deterministic flows khi LLM reasoning không đủ reliable

## Origin
- legacy backfill (harness-update) — commit gần nhất: no-commit (untracked)
