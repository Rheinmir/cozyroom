# 210626-design-softness-polish
**Type:** draft
**Status:** done
**Tags:** design, css, ui-polish, output-report
**Proposed:** 2026-06-21
**Sequence diagram:** [html/210626-design-softness-polish-seq.html](../../../html/210626-design-softness-polish-seq.html)

## Context

User yêu cầu live app trông 1:1 và "mềm" hơn so với thiết kế mẫu trong `Cozyroom (standalone).html`.

**Root cause analysis** (so sánh screenshots `standalone-new.png` vs `artists-final.png`):

| Vấn đề | Standalone | Live app |
|--------|-----------|---------|
| Orb ambient (body::before/after) | Hiện rõ, purple haze phía trên trái | Bị flat, ít nhìn thấy |
| Artist card density | 5 cards → minmax(160px) → ~220px/card | 868 cards → ~160px/card (quá chật) |
| Artist avatar | Letter gradient màu sắc (colorful, soft) | Ảnh album art thật (sharp, harsh) |
| Card glassmorphism | Subtle glass edge rõ | Inset border quá mờ (.06 alpha) |
| Hover glow | Rõ, purple glow | Nhạt hơn |

**All fixes = CSS-only + React thêm chip vào 6 trang** trong `index.css` và các page components.

**Phạm vi trang thư viện cần library-tag chip:**
| Trang | File | Chip label | Note |
|-------|------|-----------|------|
| Nghệ sĩ | ArtistsPage.tsx | THƯ VIỆN | ✓ đã trong plan |
| Playlists | PlaylistsPage.tsx | THƯ VIỆN | có page-title |
| Sách điện tử | EbooksPage.tsx | THƯ VIỆN | dùng ebooks-page class |
| Truyện tranh | ComicsPage.tsx | THƯ VIỆN | dùng layout riêng |
| Xu hướng | TrendingPage.tsx | THƯ VIỆN | dùng trending-title |
| Phim | VideosPage.tsx | _skip_ | Netflix-style layout khác paradigm, không phù hợp |

## Plan
- [x] Task 1: Tăng ambient orb visibility (body::before opacity .42→.52, size +10%; body::after .34→.44)
- [x] Task 2: Soften artist avatar photos (filter + vignette inner shadow trên .artist-avatar img)
- [x] Task 3: Artist grid spacing (minmax 160→180px, gap 20→24px)
- [x] Task 4: Card glassmorphism tăng (background .035→.05, inset border .06→.10, hover purple glow .32→.45)
- [x] Task 5: Thêm library-tag chip "Thư viện" vào 5 trang: Artists, Playlists, Ebooks, Comics, Trending (CSS class + JSX mỗi trang)

## Agent Task Assignment
| Task | Agent | Model | Status |
|------|-------|-------|--------|
| CSS orb + photo soften + grid + glassmorphism (task 1–4) | Claude main | claude-sonnet-4-6 | done |
| Breadcrumb chip React + CSS — 5 trang (task 5) | Claude main | claude-sonnet-4-6 | done |

## Files sẽ tạo/sửa
| File | Action | Lý do |
|------|--------|-------|
| `frontend/src/index.css` | modify | ambient orb, avatar filter, grid spacing, card glass, .library-tag CSS |
| `frontend/src/pages/ArtistsPage.tsx` | modify | thêm library-tag chip |
| `frontend/src/pages/PlaylistsPage.tsx` | modify | thêm library-tag chip |
| `frontend/src/pages/EbooksPage.tsx` | modify | thêm library-tag chip |
| `frontend/src/pages/ComicsPage.tsx` | modify | thêm library-tag chip |
| `frontend/src/pages/TrendingPage.tsx` | modify | thêm library-tag chip |

## Risks
- Tăng orb opacity quá cao → background lòe loẹt. Giới hạn .52 (test trước)
- Artist photo filter có thể làm ảnh trông tối hơn. Dùng `brightness(0.92)` nhẹ nhàng
- `minmax(180px)` → trên viewport nhỏ (900px) vẫn ok vì breakpoint mobile ẩn sidebar
- Inset border tăng lên .10 vẫn rất subtle, không ảnh hưởng đến readability

## Origin
- **Source:** `Cozyroom (standalone).html` — reference design mẫu do user cung cấp; so sánh trực tiếp với screenshots `standalone-new.png` và `artists-final.png`
- **Draft:** `wiki/draft/orca/210626-design-softness-polish.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
