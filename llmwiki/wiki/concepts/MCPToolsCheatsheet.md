---
name: mcp-tools-cheatsheet
description: Danh sách đầy đủ MCP tools của Cozyroom — tên, input, output, _frontend_action
metadata:
  type: concept
---

# MCP Tools Cheatsheet

Tất cả tools trong `backend/internal/mcp/registry.go`. Model nhận danh sách này qua system prompt.

## Music Library

| Tool | Input | Output / Action |
|------|-------|-----------------|
| `search_music` | `query: string` | `{results: [{id, title, artist, album, duration_s}], count}` |
| `list_artists` | — | `{artists: [{id, name}], total}` |
| `get_artist` | `artist_id: string` | `{id, name, albums: [{id, title, year}]}` |
| `list_albums` | `artist_id?: string` | `{albums: [{id, t, ar, y}], total}` |
| `list_tracks` | `album_id: string` | `{tracks: [{id, title, artist, duration_s}]}` |
| `get_stats` | — | `{artists, albums, tracks}` |
| `scan_library` | — | `{ok, tracks_found}` |

## Playback Control

| Tool | Input | Output / Action |
|------|-------|-----------------|
| `play_track` | `id: string, title?: string, artist?: string` | `_frontend_action: play_track` — verifies id in DB, falls back to title search |
| `next_track` | — | `_frontend_action: next_track` |
| `prev_track` | — | `_frontend_action: prev_track` |
| `set_shuffle_mode` | `mode: off\|shuffle\|smart` | `_frontend_action: set_shuffle_mode` |
| `set_repeat` | `mode: off\|one\|all` | `_frontend_action: set_repeat` |

## YouTube

| Tool | Input | Output / Action |
|------|-------|-----------------|
| `search_youtube` | `query: string` | `{results: [{id, title, duration, thumbnail, uploader}], count}` — calls yt-dlp |
| `play_youtube_stream` | `id: string (YT video ID), title?, artist?` | `_frontend_action: play_track` với `id: "yt:VIDEO_ID"` |
| `download_youtube` | `id: string, title: string, artist?: string` | `_frontend_action: download_youtube` — async, không phát ngay |

## Playlists

| Tool | Input | Output / Action |
|------|-------|-----------------|
| `list_playlists` | — | `{playlists: [{id, name}]}` |
| `create_playlist` | `name: string` | `{id, name}` — id là random hex, **KHÔNG phải track id** |
| `add_to_playlist` | `playlist_id: string, track_id: string` | `{ok: true}` |
| `play_playlist` | `playlist_id: string` | `_frontend_action: play_track` — track đầu tiên theo position |

## Agent Memory

| Tool | Input | Output |
|------|-------|--------|
| `remember` | `key: string, value: string` | `{ok: true}` |
| `recall` | `key?: string` | `{facts: [{key, value, updated_at}]}` |
| `forget` | `key: string` | `{ok: true}` |

## Trending / Other

| Tool | Input | Output |
|------|-------|--------|
| `get_trending` | `date?: string` | `{date, repos: [{name, url, stars, description, ai_score, tier}]}` |

---

## Frontend Action Handlers (`executeAction` in AIAssistantPage.tsx)

| `_frontend_action` | Handler |
|--------------------|---------|
| `play_track` | `player.play(t, [t])` — cần `id, title, artist, album_id, duration_s` |
| `download_youtube` | `POST /api/youtube/download` |
| `next_track` | `player.next()` |
| `prev_track` | `player.prev()` |
| `set_shuffle_mode` | `player.setShuffleMode(mode)` |
| `set_repeat` | `player.setRepeat(mode)` |

---

## Known Gaps / Audit Items

- [ ] Không có `toggle_play` (play/pause toggle) tool
- [ ] Không có `get_queue` tool (list queue tracks)
- [ ] `search_youtube` timeout nếu yt-dlp chậm (không có context timeout)
- [ ] `play_track` id fall-through: nếu cả DB lookup lẫn title search đều fail → phát sai track
- [ ] `now_playing` context inject qua system prompt (không phải tool) → model không thể query on-demand
- [ ] `scan_library` blocking (sync) — nên async với progress callback

## Origin

- **Source:** `backend/internal/mcp/registry.go`, `frontend/src/pages/AIAssistantPage.tsx`
- **Date:** 2026-05-27
- **Related:** [[concepts/MCPServer]], [[concepts/AIAgentRuntime]], [[sources/270526-playlist-tool-bugs-postmortem]]
