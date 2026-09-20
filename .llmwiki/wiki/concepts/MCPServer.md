---
name: MCPServer
description: MCP server và AI chat tab — 14 tools, RTK-style compression, HTTP/SSE + stdio transport, Claude haiku chat với tool use loop
---

# MCP Server + AI Assistant

## Overview

Cozyroom expose toàn bộ app features dưới dạng MCP tools. AI assistant tab cho phép user chat bằng ngôn ngữ tự nhiên — AI gọi tools để thực hiện hành động trực tiếp.

## Package `internal/mcp`

| File | Role |
|------|------|
| `tool.go` | `Tool` struct, `AnthropicTool` shape |
| `compress.go` | RTK-style response compression: `TrimTrack`, `TrimArtist`, `TrimRepo`, `Paginate[T]`, `TruncStr` |
| `registry.go` | `NewRegistry(ToolDeps)` → 14 tools backed by LibraryUsecase + sqlite |
| `server.go` | HTTP handler for `GET/POST /mcp` (JSON-RPC 2.0) |
| `stdio.go` | Stdio transport — `RunStdio(tools)` for external MCP clients |

## 14 MCP Tools

| Tool | Backed by |
|------|-----------|
| `search_music` | LibraryUsecase.SearchAll — max 20 results, compact aliases |
| `list_artists` | LibraryUsecase.ListArtists — max 50 + total |
| `get_artist` | LibraryUsecase.ArtistDetail |
| `list_albums` | LibraryUsecase.ListAlbums — max 20 |
| `list_tracks` | LibraryUsecase.ListTracks |
| `play_track` | Frontend action (id, title, artist) |
| `search_youtube` | `/api/youtube/search` hint (delegates to YouTubeHandlers) |
| `download_youtube` | Frontend action |
| `list_playlists` | Direct sqlite query |
| `create_playlist` | Direct sqlite insert |
| `add_to_playlist` | Direct sqlite insert |
| `get_trending` | Direct sqlite query — max 15 repos, TrimRepo fields |
| `scan_library` | Returns `{ok: true}` (trigger via scan goroutine) |
| `get_stats` | LibraryUsecase.GetStats |

## Response compression (Caveman + RTK)

All tools apply:
- **Field aliases**: `title→t`, `artist→ar`, `album→al`, `duration_s→dur`, `star_delta→Δ⭐`, `impact_score→imp`
- **Hard caps**: search ≤20, artists ≤50, trending ≤15, youtube ≤8
- **Strip**: `file_path`, `image_path`, `description`, `url` (unless needed)
- **Truncate**: long strings capped at 120 chars via `TruncStr`

## `/api/ai/chat` — AI Chat Handler

```
POST /api/ai/chat
Body: {"message": string, "history": [{role, content}]}
Response: {"text": string, "actions": [{type, id, title, artist}]}
```

- Uses `claude-haiku-4-5-20251001` via direct HTTP to Anthropic API
- Tool use loop: max 5 iterations
- `play_track` + `download_youtube` tool results → collected as `actions[]`
- `ANTHROPIC_API_KEY` missing → 503

## Standalone `cmd/mcp-server`

Binary for external MCP clients (Claude Desktop, agy, OpenCode):

```bash
# Run
COZYROOM_URL=http://localhost:18080 ./mcp-server

# Claude Desktop config
{
  "mcpServers": {
    "cozyroom": {
      "command": "/path/to/mcp-server",
      "env": {"COZYROOM_URL": "http://localhost:18080"}
    }
  }
}
```

Uses HTTP-backed tools (calls running backend) — no direct DB access.

## Frontend `AIAssistantPage`

Route: `/ai`. Bubble chat UI (user right, assistant left). Action renderer: `play_track` → `player.play(track)`. Enter to send, Shift+Enter newline. In-session history only.

## Origin

- Draft: `sources/draft/260526-mcp-server-ai-chat-tab-be-fe.md`
- Commit: 3247c88 — feat(mcp+ai): MCP server, stdio binary, and AI chat tab
- Date: 2026-05-26
