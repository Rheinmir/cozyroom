---
name: 100626-cover-fetch-race-fix
description: Fix cover image disappearing — backend race conditions + frontend stale callbacks
metadata:
  type: project
---

# 100626-cover-fetch-race-fix
**Type:** draft
**Status:** proposed
**Tags:** audit, cover-fetch, race-condition
**Proposed:** 2026-06-10

## Findings — Root Causes

### Bug 1 (CRITICAL) — `serveResizedImage` TOCTOU race · `handler.go:65-115`
Hai concurrent requests cùng check `os.Stat(resizedPath)` → cả hai thấy file chưa có → cả hai gọi `os.Create()` + `jpeg.Encode()` cùng lúc → JPEG bị corrupt, cached vĩnh viễn 7 ngày.

```
Request A: Stat → not exist → Create → Encode [writing…]
Request B: Stat → not exist → Create → Encode [overwrites A mid-write] → corrupted file on disk
```

### Bug 2 (CRITICAL) — YouTube thumbnail fetch race · `handler.go:148-189`
Tương tự: hai requests `/api/covers/yt:ID` cùng thấy `yt_ID.jpg` chưa có → cả hai `os.Create` → cả hai `io.Copy` → file `yt_ID.jpg` bị corrupt, cached 7 ngày.

### Bug 3 (HIGH) — `downloadYTThumbnail` goroutine không timeout · `scanner.go:135`
`go downloadYTThumbnail(baseName, dest)` bắn goroutine không timeout, không lock. Nếu cùng YouTube video được scan 2 lần → 2 goroutines write cùng `dest` file.

### Bug 4 (MEDIUM) — Frontend stale image load callback · `PlayerBar.tsx:98-136`
`useEffect` tạo `new Image()` nhưng không cleanup. Khi đổi track nhanh: img của track cũ vẫn loading → `onload` fires → `setCoverColors` cập nhật palette của track cũ vào track mới. Không làm mất ảnh nhưng gây flash/wrong colors.

---

## Plan

- [ ] **Task 1** — Backend: dùng `singleflight.Group` cho `serveResizedImage` — key = `id_width`, chỉ 1 goroutine generate, còn lại chờ nhận kết quả
- [ ] **Task 2** — Backend: dùng `singleflight.Group` cho YouTube thumbnail fetch — key = `ytID`, chỉ 1 goroutine fetch, còn lại chờ
- [ ] **Task 3** — Backend: `downloadYTThumbnail` — thêm `context.WithTimeout(10s)` + dùng `http.NewRequestWithContext` thay `http.Get`
- [ ] **Task 4** — Frontend: cleanup `new Image()` trong `useEffect` ở `PlayerBar.tsx` — cancel stale loads khi track thay đổi

## Files sẽ sửa
| File | Action | Lý do |
|------|--------|-------|
| `backend/internal/api/handler.go` | modify | Thêm singleflight cho serveResizedImage + YouTube cover |
| `backend/internal/library/scanner.go` | modify | Thêm context timeout cho downloadYTThumbnail |
| `frontend/src/components/PlayerBar.tsx` | modify | Cleanup stale image load in useEffect |

## Risks
- `singleflight` cần import `golang.org/x/sync/singleflight` — đã có trong go.sum chưa cần check
- Thay đổi backend là global var `var coverSF singleflight.Group` hoặc field trong `handlers` struct
- Frontend change là additive (cleanup function) — không breaking

## Out of scope
- Cache TTL / ETag headers (không liên quan trực tiếp đến ảnh biến mất)
- Resized cache cleanup (disk leak nhưng không gây broken images)
- PlaylistsPage useDominantColor (minor memory leak, không visible bug)
