---
name: playlist-tool-bugs-postmortem
description: Post-mortem 2026-05-27 — 2 bugs khiến agent không thể tạo playlist + play ngay được
metadata:
  type: source
---

# Playlist Tool Bugs Post-mortem (2026-05-27)

**Type:** bug-postmortem  
**Commit:** `7fe8faa`  
**Affected:** `backend/internal/mcp/registry.go`, `backend/internal/api/ai.go`

Agent hay fail khi user yêu cầu "tạo playlist và phát ngay". Logs cho thấy `play_track` được gọi với ID sai, cover ảnh trống, không có bài nào thực sự phát.

## Bug 1 — createPlaylistTool: ID sinh từ tên thay vì random

**Code lỗi:**
```go
id := fmt.Sprintf("%x", []byte(name)[:8]) // simple ID
```

**Hậu quả:**
- `"playlist năng động"` → ID = `"706c61796c697374"` (hex của 8 bytes đầu UTF-8 = "playlist")
- Model nhận ID này từ `create_playlist`, sau đó gọi `play_track(id="706c61796c697374")` — playlist ID không phải track ID → play không được gì, cover trống
- Nếu 2 playlist khác nhau có cùng 8 ký tự đầu → ID collision, INSERT thứ 2 fail

**Fix:**
```go
id := randomHexID() // crypto/rand 8 bytes
```

## Bug 2 — Không có `play_playlist` tool

**Vấn đề:** Không có tool nào lấy track đầu tiên của playlist để phát. Model bị buộc phải "sáng tạo" → thường gọi `play_track` với playlist ID (sai), hoặc hallucinate track ID.

**Fix:** Thêm tool `play_playlist(playlist_id)`:
- Query track đầu tiên theo `position ASC`
- Trả về `_frontend_action: play_track` với `album_id`, `title`, `artist` thật từ DB
- Nếu playlist rỗng → error rõ ràng: `"playlist is empty — add tracks first with add_to_playlist"`

## Bug 3 — Tool descriptions không đủ rõ

Model không biết playlist ID ≠ track ID vì descriptions không cảnh báo. Fix:
- `create_playlist` description: *"Returns playlist id — this is NOT a track id, do NOT pass it to play_track."*
- `add_to_playlist` description: *"track_id must come from search_music or list_tracks, NOT from create_playlist."*

## Fix hệ thống prompt

Thêm hướng dẫn 4 bước vào system prompt:
1. `create_playlist` → lấy `playlist_id`
2. `search_music` → lấy `track_id` thật
3. `add_to_playlist(playlist_id, track_id)`
4. `play_playlist(playlist_id)`

## Key Takeaways

- Khi tool trả về ID, phải ghi rõ trong description đó là loại ID gì và KHÔNG dùng ở đâu.
- Nếu có flow "A → B → C", phải có tool cho từng bước — không để model "đoán" bước cuối.
- Deterministic ID từ user input = bug tiềm ẩn (collision + model reuse sai context).
- Kiểm tra chat_logs với `failed=1` hoặc `tool_errors` sẽ lộ những lỗi này ngay.

## Origin

- **Source:** chat logs production, phân tích thủ công bởi Claude Code
- **Date:** 2026-05-27
- **Related:** [[concepts/MCPServer]], [[concepts/AIAgentRuntime]], [[concepts/FavoritePlaylistPill]]
