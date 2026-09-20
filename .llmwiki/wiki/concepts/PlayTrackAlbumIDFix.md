# Play Track Album ID Fix
**Type:** concept
**Tags:** bugfix, mcp, album, sql, play_track

Bug: `play_track` tool returned `album_id=""` because the SQL query joined `LEFT JOIN artists ON t.artist_id` but `tracks` has no `artist_id` column — artist ID is on `albums`. Fixed both lookup paths (ID-based + title fallback).

## Notes

- Old SQL: `LEFT JOIN artists ar ON ar.id = t.artist_id` → `t.artist_id` doesn't exist, album_id always NULL
- Fixed SQL: `LEFT JOIN albums al ON al.id = t.album_id LEFT JOIN artists ar ON ar.id = al.artist_id`
- Two queries fixed: primary (ID lookup) + fallback (title fuzzy search)
- Affected tools: `playTrackTool()` (both paths), `playPlaylistTool()` (already correct after fix), `listTracksTool()` queries
- `playYouTubeStreamTool()` explicitly passes `"album_id": ""` (YouTube tracks have no album)
- Frontend `AIAssistantPage.tsx:241` uses `action.album_id || ''` to construct Track — empty album_id would break cover image (`/api/covers/`)
- [[MCPServer]] — tool definitions, [[MCPToolsCheatsheet]] — full tool list

## Origin
- **Source:** `backend/internal/mcp/registry.go:247-263`
- **Commits:** `961fe96 fix(ai): play_track tool now looks up album_id so cover image loads`, `4e9d5f1 fix(ai): play_track tool verifies track ID from DB, falls back to title search`
- **Date:** 2026-05-27
