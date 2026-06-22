**Status:** proposed
**Sequence diagram (hoạt họa):** [html/210626-player-duration-persist-seq.html](../../../html/210626-player-duration-persist-seq.html)

## Plan
- [ ] Task 1: Seed `duration` từ `track.duration_s` khi restore session — sửa line 94 `PlayerContext.tsx`

## Agent Task Assignment (BẮT BUỘC với MỌI proposal)
| Task | Agent | Model | Status |
|------|-------|-------|--------|
| Seed duration từ saved track.duration_s (1-line fix) | Claude main | claude-sonnet-4-6 | done |

## Files sẽ tạo/sửa
| File | Action | Lý do |
|------|--------|-------|
| `frontend/src/PlayerContext.tsx` | modify line 94 | Seed duration từ track.duration_s trong init state |

## Risks
- `track.duration_s` có thể = 0 với track bị lỗi scan → duration vẫn 0, không tệ hơn hiện tại
- `loadedmetadata` sẽ override với giá trị chính xác khi audio load xong → không có drift

## Root Cause
`PlayerContext.tsx:94` khởi tạo `duration = 0` bất kể `init.current?.track?.duration_s`.  
Sau F5: `track` + `progress` được restore từ localStorage ✓, nhưng `duration` = 0 cho đến khi `loadedmetadata` fire từ audio element.  
Progress bar style `pct = progress / duration * 100` → NaN → 0% → thanh trống + hiển thị `0:00`.

**Fix**: `useState(init.current?.track?.duration_s ?? 0)` — `track.duration_s` đã có sẵn trong SavedState.

## Origin
- **Draft:** `wiki/draft/orca/210626-player-duration-persist.md`
- **Commit:** `6a5cbf0` — fix: seed duration from track.duration_s on session restore
- **Date promoted:** 2026-06-21
