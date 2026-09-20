# 210626-phim-poster-grid-redesign
**Type:** draft
**Status:** proposed
**Tags:** design, css, ui-polish, videos, ebooks, comics, playlists, trending
**Proposed:** 2026-06-21
**Sequence diagram (hoạt họa):** [html/210626-phim-poster-grid-redesign-seq.html](../../../html/210626-phim-poster-grid-redesign-seq.html)

## Context

Tất cả tabs cần align với `Cozyroom (standalone).html`. Hai vấn đề chính:
1. **Chip labels sai** — tất cả đang dùng "Thư viện" generic, reference dùng label riêng mỗi tab
2. **Layout Phim hoàn toàn khác** — Netflix hero/rows, reference là poster grid portrait

**Delta analysis — chip labels (source: `posterMeta` + per-view sections trong standalone HTML):**

| Tab | Chip hiện tại | Chip reference |
|-----|--------------|----------------|
| Nghệ sĩ | "Thư viện" ✅ | "Thư viện" |
| Phim | không có ❌ | "Bộ sưu tập" |
| Sách điện tử | "Thư viện" ❌ | "Kệ sách" |
| Truyện tranh | "Thư viện" ❌ | "Tủ truyện" |
| Playlists | "Thư viện" ❌ | "Bộ sưu tập" |
| Xu hướng | "Thư viện" ❌ | "Bảng xếp hạng" |

**Delta analysis — layout Phim:**

| Yếu tố | Live app | Reference |
|--------|---------|-----------|
| Layout | Netflix hero + horizontal scroll rows | Simple poster grid (portrait 2:3) |
| Chip | không có | "Bộ sưu tập" |
| Note text | không | "Thả poster phim của bạn vào đây" |
| Card | 16:9 landscape | 2:3 portrait, glassmorphism |

## Plan
- [ ] Task 1: Fix chip labels — 5 files (EbooksPage, ComicsPage, PlaylistsPage, TrendingPage → đổi label; VideosPage → thêm chip mới)
- [ ] Task 2: Rewrite `VideosPage.tsx` — xóa Netflix hero/rows/slider, thay bằng poster grid portrait + "Bộ sưu tập" chip
- [ ] Task 3: Update `index.css` — xóa 44 `.netflix-*` rules, thêm `.video-poster-grid` + `.video-poster-card` (portrait glassmorphism)

## Agent Task Assignment
| Task | Agent | Model | Status |
|------|-------|-------|--------|
| Fix chip labels — 5 pages | Claude main | claude-sonnet-4-6 | pending |
| Rewrite VideosPage.tsx | Claude main | claude-sonnet-4-6 | pending |
| Replace netflix-* CSS với poster grid CSS | Claude main | claude-sonnet-4-6 | pending |

## Files sẽ tạo/sửa
| File | Action | Lý do |
|------|--------|-------|
| `frontend/src/pages/EbooksPage.tsx` | modify | "Thư viện" → "Kệ sách" |
| `frontend/src/pages/ComicsPage.tsx` | modify | "Thư viện" → "Tủ truyện" |
| `frontend/src/pages/PlaylistsPage.tsx` | modify | "Thư viện" → "Bộ sưu tập" |
| `frontend/src/pages/TrendingPage.tsx` | modify | "Thư viện" → "Bảng xếp hạng" |
| `frontend/src/pages/VideosPage.tsx` | rewrite | Netflix → poster grid + thêm chip "Bộ sưu tập" |
| `frontend/src/index.css` | modify | Xóa `.netflix-*` (44 rules), thêm `.video-poster-grid`, `.video-poster-card` |

## Risks
- Xóa 44 `.netflix-*` rules → phải grep toàn frontend để đảm bảo không component nào khác dùng
- `aspect-ratio: 2/3` cho poster cards cần `object-fit: cover` để hình không méo
- Chip label "Bảng xếp hạng" cho Trending — dài hơn chip labels khác, cần test visual
- Phim group headers (folder grouping) → giữ lại grouping nhưng dùng section header thay netflix-row-title

## Origin
- **Source:** `Cozyroom (standalone).html` — `posterMeta` object + `isTrending` section + Playlists section
- **Screenshots so sánh:** Image #1 (live) vs Image #2 (reference) từ user
- **Draft:** `wiki/draft/orca/210626-phim-poster-grid-redesign.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
