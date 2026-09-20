# 250626-mcp-ambient-sounds

**Status:** proposed
**Sequence diagram:** [html/250626-mcp-ambient-sounds-seq.html](../../../html/250626-mcp-ambient-sounds-seq.html)

## Context

Background sounds đã hoạt động qua UI. Agent chưa thể điều khiển vì không có MCP tool nào. Cần 3 tools:
- `list_ambient_sounds` — trả danh sách sounds khả dụng
- `play_ambient_sound` — phát 1 sound theo name + volume tuỳ chọn
- `stop_ambient_sound` — dừng sound đang phát

Pattern: tools trả `_frontend_action` → `executeAction()` trong `AIAssistantPage` dispatch tới `BgSoundsContext`.

## Plan

- [ ] T1: Go backend — file `backend/internal/mcp/registry_ambient.go` (3 tools) + đăng ký vào `NewRegistry()`
- [ ] T2: React frontend — xử lý 3 action types trong `executeAction`, hook `useBgSounds()`, cập nhật `mcpTools.ts`

## Agent Task Assignment

| Task | Agent | Model | Status |
|------|-------|-------|--------|
| T1: Go MCP tools ambient | Claude main | claude-sonnet-4-6 | done |
| T2: React executeAction + mcpTools | Claude main | claude-sonnet-4-6 | done |

## Files sẽ tạo/sửa

| File | Action | Lý do |
|------|--------|-------|
| `backend/internal/mcp/registry_ambient.go` | create | 3 MCP tool functions |
| `backend/internal/mcp/registry.go` | modify | đăng ký 3 tools vào NewRegistry() |
| `frontend/src/pages/AIAssistantPage.tsx` | modify | executeAction + useBgSounds |
| `frontend/src/data/mcpTools.ts` | modify | thêm 3 tool entries cho slash suggestion |

## Risks

- `AIAssistantPage` cần import `useBgSounds` — kiểm tra circular dependency
- `ambientDir()` trong `handler_ambient.go` là private — copy logic (4 dòng) vào registry_ambient.go thay vì export

## Origin

- **Draft:** `wiki/draft/orca/250626-mcp-ambient-sounds.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
