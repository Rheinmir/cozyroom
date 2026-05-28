# AI Datetime Injection in System Prompt
**Type:** concept
**Tags:** ai, prompt, datetime, utc+7

AI system prompt dynamically includes current date/time in UTC+7 so the agent knows today's date — prevents "I don't know what date it is" responses.

## Notes

- `aiSystemPromptWith()` appends `"Thời gian hiện tại: " + time.Now().In(vn).Format(...)` to the base prompt
- Timezone: `time.FixedZone("UTC+7", 7*3600)` — consistent with `saveLog()` which also stores timestamps in UTC+7
- Now-playing context (`\nĐang phát: ...`) is appended after datetime, separated by single newline (was double)
- Both `chat()` and `chatStream()` call `aiSystemPromptWith(req.NowPlaying)` before provider init
- [[MCPServer]] — system prompt base also contains playlist flow instructions and tool use rules

## Origin
- **Source:** `backend/internal/api/ai.go:25-33`
- **Commit:** working tree on top of `5bcef19`
- **Date:** 2026-05-27
