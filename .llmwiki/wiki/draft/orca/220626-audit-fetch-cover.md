# 220626-audit-fetch-cover

**Status:** proposed
**Sequence diagram:** [html/220626-audit-fetch-cover-seq.html](../../../html/220626-audit-fetch-cover-seq.html)

## Bối cảnh

Bug thường gặp: client thấy nhạc có nhưng không có hình ảnh. Audit toàn bộ luồng cover art —
từ backend extract/serve đến frontend render/fallback.

## Phát hiện chính

**Backend (7 điểm silent fail):**
- `cover_path` lưu trong DB dưới dạng path string (e.g. `/api/covers/{id}`); nếu rỗng → API trả 404 không log
- ID3 `Picture()` = nil → `cover_path = ""` (no log) — `scanner.go:~284`
- `pdftoppm` crash khi extract PDF cover → `cover_path = ""` (no log) — `ebook_scanner.go:~86`
- YouTube: tất cả 4 quality URLs fail → HTTP 503 (logged nhưng client nhận bare 503)
- Deezer/TMDb enricher fail → `artist.image_path / video.poster_path = ""` (logged)
- `serveResizedImage()`: gọi `http.ServeFile()` ngay cả khi file không tồn tại → 404 silent — `handler.go:~125`
- Không có fallback placeholder image ở bất kỳ endpoint nào

**Frontend (4 điểm):**
- `useDominantColor` (PlaylistsPage): không set `crossOrigin="anonymous"` → `canvas.getImageData()` throws SecurityError → default color `#282837` forever (HIGH)
- `npo-bg` img trong PlayerBar: không có `onError` → blank background im lặng (MEDIUM)
- SearchPage album grid: không có `onError` → broken image icon (MEDIUM)
- PlayerBar color extraction: `cancelled` flag có, nhưng rapid skip vẫn có nhỏ race window (LOW)

## Plan

- [ ] T1: Fix `useDominantColor` — add `crossOrigin='anonymous'` + `onerror` fallback
- [ ] T2: Fix `npo-bg` + SearchPage — thêm `onError` handlers đồng nhất
- [ ] T3: Backend placeholder — serve `placeholder.jpg` khi cover file không tồn tại (404 + 503 paths)
- [ ] T4: Backend logging — add `log.Printf` tại ID3 no-cover + PDF extract fail

## Agent Task Assignment

| Task | Agent | Model | Status |
|------|-------|-------|--------|
| T1: Fix useDominantColor (PlaylistsPage.tsx) | Claude main | claude-sonnet-4-6 | pending |
| T2: Fix npo-bg + SearchPage onError (PlayerBar.tsx, SearchPage.tsx) | Claude main | claude-sonnet-4-6 | pending |
| T3: Backend placeholder cover (handler.go) | Claude main | claude-sonnet-4-6 | pending |
| T4: Backend logging silent fails (scanner.go, ebook_scanner.go) | Claude main | claude-sonnet-4-6 | pending |

## Files sẽ tạo/sửa

| File | Action | Lý do |
|------|--------|-------|
| `frontend/src/pages/PlaylistsPage.tsx` | sửa | T1: crossOrigin + onerror trên useDominantColor |
| `frontend/src/components/PlayerBar.tsx` | sửa | T2: onError cho npo-bg img |
| `frontend/src/pages/SearchPage.tsx` | sửa | T2: onError + err state cho album grid covers |
| `backend/internal/api/handler.go` | sửa | T3: fallback placeholder khi ServeFile 404 |
| `backend/internal/library/scanner.go` | sửa | T4: log khi ID3 Picture() = nil |
| `backend/internal/library/ebook_scanner.go` | sửa | T4: log khi pdftoppm fail |
| `backend/static/placeholder.jpg` | tạo | T3: placeholder cover image |

## Risks

- T3 placeholder: cần chọn ảnh placeholder phù hợp UI (có thể dùng SVG embed thay JPG để không cần thêm static asset)
- T2: PlayerBar là shared component — cần test không break existing onLoad logic
- T4 logging: chỉ add log, không thay đổi logic → rủi ro thấp

## Origin

- **Draft:** `wiki/draft/orca/220626-audit-fetch-cover.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
