# 170626-ui-theme-consistency-all-pages
**Type:** draft
**Status:** proposed
**Tags:** frontend, theme, css, ui-audit
**Proposed:** 2026-06-17
**Sequence diagram:** [html/170626-ui-theme-consistency-seq.html](../../../html/170626-ui-theme-consistency-seq.html)

## Yêu cầu
Audit và fix theme consistency cho toàn bộ màn hình còn lại — áp dụng đồng bộ purple dark theme (đã có ở Artists/Album/Search) sang các page chưa được cập nhật.

## Theme mới cần áp dụng nhất quán
```
Background:    #050505 / #0a0a0f
Accent:        #a855f7 (purple), secondary #2dd4bf (teal)
Cards:         background: rgba(255,255,255,.035)
               box-shadow: inset 0 0 0 1px rgba(255,255,255,.06)
               border-radius: 22px
Play buttons:  background: #fff; color: #070708
Chart palette: #a855f7 → #2dd4bf → #818cf8 → #f59e0b (không dùng green/blue)
Error color:   #ef4444 hoặc rgba(239,68,68,.x)
```

## Audit findings — màn hình bị ảnh hưởng

| Page | File | Vấn đề |
|------|------|--------|
| **VideosPage** | `pages/VideosPage.tsx` | Toàn bộ inline styles, thiếu rounded corners 22px, card hover purple |
| **VideoPlayerPage** | `pages/VideoPlayerPage.tsx` | Hardcoded `#000`, `#fff`, thiếu glassmorphism |
| **EbooksPage** | `pages/EbooksPage.tsx` | Không có CSS class nào trong index.css, inline styles |
| **EbookReaderPage** | `pages/EbookReaderPage.tsx` | Settings overlay không có CSS, reader header thiếu theme |
| **ComicsPage** | `pages/ComicsPage.tsx` | Toàn bộ inline styled, `var(--surface2)` undefined, NSFW badge #e74c3c hardcoded |
| **ComicsPageMobile** | `pages/ComicsPageMobile.tsx` | Same as ComicsPage + mobile-specific layout |
| **TrendingChartMode** | `pages/TrendingChartMode.tsx` | Chart colors hardcoded green/blue (#4ade80, #60a5fa), không dùng purple palette |
| **AIStatsPage** | `pages/AIStatsPage.tsx` | Recharts COLORS array không match purple/teal theme |
| **PlaylistsPage** | `pages/PlaylistsPage.tsx` | Thiếu glassmorphism cards, modal overlay không có CSS |

## Files sẽ tạo/sửa
| File | Action | Lý do |
|------|--------|-------|
| `frontend/src/index.css` | sửa | Thêm CSS classes cho Videos, Ebooks, Comics, Playlists |
| `frontend/src/pages/VideosPage.tsx` | sửa | Chuyển inline styles → CSS classes |
| `frontend/src/pages/VideoPlayerPage.tsx` | sửa | Chuyển hardcoded colors → CSS vars |
| `frontend/src/pages/EbooksPage.tsx` | sửa | Chuyển inline styles → CSS classes |
| `frontend/src/pages/EbookReaderPage.tsx` | sửa | Thêm CSS cho reader header + settings overlay |
| `frontend/src/pages/ComicsPage.tsx` | sửa | Chuyển inline → CSS, fix undefined var(--surface2) |
| `frontend/src/pages/ComicsPageMobile.tsx` | sửa | Same as ComicsPage |
| `frontend/src/pages/TrendingChartMode.tsx` | sửa | Đổi COLORS sang purple/teal palette |
| `frontend/src/pages/AIStatsPage.tsx` | sửa | Đổi COLORS sang purple/teal palette |
| `frontend/src/pages/PlaylistsPage.tsx` | sửa | Thêm glassmorphism + modal CSS |

## Plan
- [ ] **Task 1 — VideosPage + VideoPlayerPage**: Tạo `.video-card`, `.video-grid`, `.video-hero`, `.video-player-wrap` CSS classes; chuyển inline styles → CSS; rounded corners 22px; card hover purple glow
- [ ] **Task 2 — EbooksPage + EbookReaderPage**: Tạo `.ebook-grid`, `.ebook-card`, `.ebook-cover`, `.reader-header`, `.reader-settings-overlay`, `.reader-mode-btn` CSS classes; NSFW badge dùng theme red
- [ ] **Task 3 — ComicsPage + ComicsPageMobile**: Fix `var(--surface2)` → `var(--elevated)`; NSFW badge dùng theme; tạo `.comics-card`, `.comics-grid`, `.comics-tag` CSS classes; chuyển hover states khỏi inline
- [ ] **Task 4 — TrendingChartMode + AIStatsPage**: Đổi COLORS array sang `['#a855f7','#2dd4bf','#818cf8','#f59e0b','#f87171','#34d399']`; update chart axis/tooltip colors sang `var(--text-muted)`
- [ ] **Task 5 — PlaylistsPage**: Tạo `.password-modal-overlay`, `.playlist-modal` CSS; glassmorphism cards; fix boxShadow inline → CSS
- [ ] **Task 6 — Build + Deploy**: Build frontend, push image, rollout restart

## Agent Task Assignment
| Task | Agent | Model | Status |
|------|-------|-------|--------|
| Task 1 — Videos CSS | Claude main | claude-sonnet-4-6 | pending |
| Task 2 — Ebooks CSS | Claude main | claude-sonnet-4-6 | pending |
| Task 3 — Comics CSS | Claude main | claude-sonnet-4-6 | pending |
| Task 4 — Chart colors | Claude main | claude-sonnet-4-6 | pending |
| Task 5 — Playlists CSS | Claude main | claude-sonnet-4-6 | pending |
| Task 6 — Build & Deploy | Claude main | claude-sonnet-4-6 | pending |

## Risks
- ComicsPage/ComicsPageMobile có nhiều inline styles phức tạp — cần test kỹ sau khi chuyển sang CSS
- EbookReaderPage có reader themes (light/dark/sepia) — không được break existing reader functionality
- TrendingChartMode dùng Recharts — cần pass colors đúng API (stroke, fill, không phải CSS var)

## Origin
- **Draft:** `wiki/sources/draft/170626-ui-theme-consistency-all-pages.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
