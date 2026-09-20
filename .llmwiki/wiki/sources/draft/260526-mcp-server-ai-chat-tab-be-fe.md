---
name: 260526-mcp-server-ai-chat-tab-be-fe
description: Proposal — Expose toàn bộ app features dưới dạng MCP tools + thêm tab AI Chat assistant điều khiển app bằng ngôn ngữ tự nhiên
---

# Proposal: MCP Server + AI Assistant Chat Tab

## 1. Restate

Refactor backend để expose tất cả app features (music, YouTube, playlists, trending, scan) dưới dạng **MCP tools** (Model Context Protocol), đồng thời thêm tab **AI Chat** trong frontend cho phép user nói chuyện tự nhiên với AI assistant — AI gọi các MCP tools để thực hiện hành động trực tiếp trong app.

---

## 2. Files affected

### Backend — mới

| File | Action |
|------|--------|
| `backend/internal/mcp/tools.go` | CREATE — định nghĩa tất cả MCP tools và schema |
| `backend/internal/mcp/compress.go` | CREATE — RTK-style response compression helpers (TrimTrack, Paginate, TruncStr…) |
| `backend/internal/mcp/server.go` | CREATE — MCP server: HTTP/SSE transport tại `/mcp` |
| `backend/internal/mcp/stdio.go` | CREATE — stdio transport cho external agents (Claude Desktop, agy) |
| `backend/internal/api/ai.go` | CREATE — `/api/ai/chat` handler: nhận message, gọi Claude API với tools, trả response + actions |
| `backend/cmd/mcp-server/main.go` | CREATE — standalone binary cho external MCP client |

### Backend — sửa

| File | Action |
|------|--------|
| `backend/internal/api/routes.go` | Thêm `POST /api/ai/chat`, `GET /mcp` (SSE), `POST /mcp` |
| `backend/cmd/server/main.go` | Thêm env `ANTHROPIC_API_KEY` |
| `Dockerfile` | Thêm build target cho `mcp-server` binary |

### Frontend — mới

| File | Action |
|------|--------|
| `frontend/src/pages/AIAssistantPage.tsx` | CREATE — chat UI: message list, input, action renderer |
| `frontend/src/pages/AIAssistantPage.css` | CREATE — chat bubble styles |

### Frontend — sửa

| File | Action |
|------|--------|
| `frontend/src/App.tsx` / router | Thêm route `/ai` |
| `frontend/src/components/Sidebar.tsx` | Thêm "AI Chat" nav item |
| `frontend/src/components/MobileNav.tsx` | Thêm AI tab icon |
| `frontend/src/i18n/en.json` / `vi.json` | Thêm keys cho AI chat UI |

---

## 3. Existing behaviour có thể break

- **Routes.go**: thêm 3 routes mới — không xung đột với existing paths
- **PlayerContext**: AI có thể yêu cầu play track — frontend phải intercept `action: play_track` từ chat response và gọi `playerCtx.play()`; không sửa PlayerContext logic
- **MobileNav**: thêm icon thứ 5 — kiểm tra layout không vỡ trên nhỏ nhất (320px)
- **GEMINI_API_KEY đang dùng**: không xung đột, AI chat dùng Anthropic key riêng
- **Không có breaking changes** cho existing endpoints

---

## 4. Design decisions — cần chọn

### A. MCP Transport

| Option | Mô tả | Pros | Cons |
|--------|--------|------|------|
| **A1: HTTP/SSE** (tại `/mcp`) | Standard MCP streamable HTTP — browser-compatible, in-app chat | Works từ browser, single backend | Cần CORS config |
| **A2: stdio binary** (`cmd/mcp-server`) | Separate binary, dùng cho Claude Desktop / agy / external agents | Zero browser overhead, standard external tool | Phải deploy riêng |
| **A3: Cả hai** ✅ | HTTP/SSE cho in-app chat; stdio binary cho external | Maximal compatibility | Thêm code |

**Khuyến nghị: A3** — stdio binary build từ cùng `mcp/tools.go`, HTTP handler dùng lại cùng tool implementations.

### B. AI Provider cho Chat Tab

| Option | Model | Pros | Cons |
|--------|-------|------|------|
| **B1: Anthropic Claude** ✅ | claude-haiku-4-5 (fast) | Native tool use, JSON schema tools, streaming | Cần `ANTHROPIC_API_KEY` mới |
| **B2: Gemini** | gemini-2.0-flash | `GEMINI_API_KEY` đã có | Function calling khác cú pháp, ít dễ dùng hơn |
| **B3: Client-side** | Gọi API từ browser | No backend change | API key exposed, CORS issues |

**Khuyến nghị: B1** — Anthropic SDK đã trong môi trường, native tool use chuẩn MCP.

### C. Player Control (AI không trực tiếp control browser)

AI không thể play track từ backend. Giải pháp:

**C1: Actions trong response** ✅ — Backend trả `{"text": "...", "actions": [{"type":"play_track","id":"abc"}]}`. Frontend nhận, dispatch qua PlayerContext. Simple, no extra infra.

**C2: SSE push** — Backend push action event qua SSE channel. Phức tạp hơn, không cần thiết.

**Khuyến nghị: C1** — `actions[]` array trong chat response JSON.

---

## 5. Implementation Plan

### Step 0 — MCP Tool Definitions (`backend/internal/mcp/tools.go`)

Định nghĩa tất cả tools — mỗi tool có `name`, `description`, `inputSchema` (JSON Schema), và `handler func`:

| Tool | Maps to | Input |
|------|---------|-------|
| `search_music` | `GET /api/search` | `{query: string}` |
| `list_artists` | `GET /api/artists` | — |
| `get_artist` | `GET /api/artists/{id}` | `{id: string}` |
| `list_albums` | `GET /api/albums` | `{artist_id?: string}` |
| `list_tracks` | `GET /api/tracks` | `{album_id: string}` |
| `play_track` | Frontend action | `{id: string, title: string, artist: string}` |
| `search_youtube` | `GET /api/youtube/search` | `{query: string}` |
| `download_youtube` | `POST /api/youtube/download` | `{id, title, artist}` |
| `list_playlists` | `GET /api/playlists` | — |
| `create_playlist` | `POST /api/playlists` | `{name: string}` |
| `add_to_playlist` | `POST /api/playlists/{id}/tracks` | `{playlist_id, track_id}` |
| `get_trending` | `GET /api/trending` | `{date?: string}` |
| `scan_library` | `POST /api/scan` | — |
| `get_stats` | `GET /api/stats` | — |

#### Response Compression — Caveman + RTK principles (BẮTBUỘC cho mọi tool)

MCP tool responses trả về cho AI context phải **tối thiểu token**. Áp dụng 4 nguyên tắc RTK:

**1. Strip filler fields** — chỉ giữ fields AI cần để gọi tool tiếp theo:

```go
// BAD — verbose, waste tokens
{"id":"a1b2c3d4e5f6a7b8","title":"Lạc Trôi","artist_id":"...","album_id":"...","duration_s":245,"file_path":"/music/...","genre":"V-Pop","year":2017,"track_num":1,"disc_num":1,"bit_rate":320}

// GOOD — caveman compact
{"id":"a1b2c3d4","t":"Lạc Trôi","ar":"Sơn Tùng MTP","dur":245}
```

**2. Paginate large lists** — `list_artists` trả 832 artists = ~15k tokens. Hard cap:
- `search_music`, `list_albums`, `list_tracks`: max **20** results
- `list_artists`: max **50** results + `{total: N, hint: "use search_music to narrow"}` 
- `get_trending`: max **15** repos, strip `description` field (longest field, low signal)
- `search_youtube`: max **8** results

**3. Group repetitive data** — nếu nhiều tracks cùng album, trả album một lần:
```json
{"album":"Skyfall EP","tracks":[{"id":"..","t":"Track 1","dur":180},{"id":"..","t":"Track 2","dur":210}]}
```

**4. Truncate long strings** — `description`, `bio`, `url` cap at 120 chars; `topics[]` max 5 items.

**Field name aliases** (dùng trong MCP responses, không thay đổi DB/API):

| Verbose | Compact |
|---------|---------|
| `title` | `t` |
| `artist` / `artist_name` | `ar` |
| `album` / `album_name` | `al` |
| `duration_s` | `dur` |
| `star_delta` | `Δ⭐` |
| `impact_score` | `imp` |
| `impact_label` | `tier` |

**Tool description strings** (in MCP schema) cũng phải caveman-style — AI đọc descriptions để chọn tool:
```
// BAD: "Search the music library for artists, albums, and tracks matching the given query string"
// GOOD: "Search music: artists+albums+tracks. Returns top 20."
```

**New file:** `backend/internal/mcp/compress.go` — shared compression helpers:
- `TrimTrack(t Track) map[string]any` — strip to `{id,t,ar,al,dur}`
- `TrimArtist(a Artist) map[string]any` — strip to `{id,name,albums}`
- `TrimRepo(r TrendingRepo) map[string]any` — strip to `{id,name,lang,Δ⭐,imp,tier}`
- `Paginate[T](items []T, max int) ([]T, int)` — cap + return total
- `TruncStr(s string, max int) string` — cap + "…" suffix

### Step 1 — HTTP/SSE MCP Server (`backend/internal/mcp/server.go`)

Implement [MCP spec](https://spec.modelcontextprotocol.io/) streamable HTTP transport:
- `GET /mcp` — SSE connection, server sends `tools/list` on connect
- `POST /mcp` — receive JSON-RPC 2.0 request (`tools/call`), execute handler, return result

### Step 2 — AI Chat Handler (`backend/internal/api/ai.go`)

```go
POST /api/ai/chat
Body: {"message": string, "history": [{role, content}]}
Response: {"text": string, "actions": [{type, ...params}]}
```

- Init Anthropic client với `ANTHROPIC_API_KEY`
- Convert MCP tools → Anthropic tool definitions
- Call `claude-haiku-4-5` với tools + message history
- Loop: if tool_use → execute tool → append tool_result → continue
- Final text_block + collect all `play_track` calls → return as `actions[]`

### Step 3 — Frontend Chat UI (`AIAssistantPage.tsx`)

```
┌────────────────────────────────────────┐
│  AI Assistant                    [⚙️]  │
├────────────────────────────────────────┤
│  [Bot] Xin chào! Tôi có thể giúp bạn  │
│        tìm nhạc, tải YouTube, quản lý  │
│        playlist...                      │
│                                         │
│  [You] Tìm nhạc Sơn Tùng và phát bài  │
│        đầu tiên                         │
│                                         │
│  [Bot] Tìm thấy 12 bài của Sơn Tùng   │
│        MTP. Đang phát "Lạc Trôi"...   │
│        [▶ Lạc Trôi - Sơn Tùng MTP]   │
├────────────────────────────────────────┤
│  [     Nhập tin nhắn...          ] [➤] │
└────────────────────────────────────────┘
```

- Message list với bubble UI (user right, bot left)
- Action renderer: `play_track` → hiển thị mini track card + dispatch `playerCtx.playTrack()`
- Streaming support: nhận text chunks qua fetch stream
- Mobile: full-screen sheet, keyboard-aware

### Step 4 — stdio MCP Binary (`backend/cmd/mcp-server/main.go`)

Wrap cùng `mcp/tools.go` handlers với stdio transport — đọc JSON-RPC từ stdin, write tới stdout. Build artifact: `mcp-server` binary.

Config Claude Desktop:
```json
{
  "mcpServers": {
    "cozyroom": {
      "command": "/path/to/mcp-server",
      "args": ["--base-url", "http://localhost:18080"]
    }
  }
}
```

### Step 5 — Nav integration

Thêm "AI" tab vào Sidebar (desktop) và MobileNav. Route `/ai`.

---

## 6. Success Criteria

- [ ] `GET /mcp` trả SSE với `tools/list` gồm 14 tools (descriptions caveman-style)
- [ ] `search_music("sơn tùng")` trả ≤20 results, mỗi result ≤5 fields (compact alias)
- [ ] `list_artists()` trả ≤50 results + `{total, hint}`, không có `file_path`/`image_path`
- [ ] `get_trending()` trả ≤15 repos, strip `description`, fields dùng compact aliases
- [ ] Token count của một tool response ≤ 500 tokens (kiểm tra thủ công với claude.ai tokenizer)
- [ ] `POST /mcp` với `tools/call search_music` trả kết quả đúng
- [ ] `POST /api/ai/chat {"message":"tìm nhạc sơn tùng"}` trả text + results
- [ ] AI chat tự động gọi tools khi cần (search, play, download) không cần user chỉ định
- [ ] `play_track` action từ AI → frontend thực sự phát bài hát
- [ ] stdio binary chạy được, nhận JSON-RPC qua stdin
- [ ] Chat UI render trên mobile không vỡ layout
- [ ] Lịch sử chat persist trong session (không cần cross-session)
- [ ] `ANTHROPIC_API_KEY` missing → trả lỗi rõ ràng, không crash

---

## 7. Out of scope (explicit)

- Cross-session chat history (localStorage/DB) — chỉ in-memory per session
- Voice input/output
- AI proactively pushing notifications
- Rate limiting / usage tracking

---

## Origin

- Requested: user session 2026-05-26
- Commit: 3247c88 — feat(mcp+ai): MCP server, stdio binary, and AI chat tab
- Status: IMPLEMENTED
