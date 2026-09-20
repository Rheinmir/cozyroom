---
name: Mobile UI
description: Responsive mobile layout — bottom nav, mini player bar, slide-up now-playing sheet (≤640px breakpoint)
type: concept
---

# Mobile UI

## What was built

At `≤640px` (phone-sized viewports) the app switches from the desktop sidebar+player layout to a mobile-native three-layer design:

| Layer | Desktop | Mobile |
|---|---|---|
| Navigation | Left sidebar (220px) | Bottom tab bar — Home / Search |
| Content | Right of sidebar | Full width, scrollable |
| Player | 88px bar across bottom | 64px mini bar; tap → full sheet |

## Layout (CSS grid)

**Desktop:** `grid-template-rows: 1fr 88px 0px` — sidebar column + main + player + hidden nav row.

**Mobile (`≤640px`):**
```
grid-template-rows: 1fr 64px 56px
grid-template-areas:
  "main-wrapper"
  "player"
  "mobilenav"
```
Sidebar `display: none`; `MobileNav` fills the `mobilenav` row.

## Components

### `MobileNav` (`components/MobileNav.tsx`)
Bottom tab bar with Home and Search `NavLink`s. Styled with `.mobile-nav` / `.mobile-nav-btn` / `.mobile-nav-btn.active`. Hidden on desktop via `display: none`.

### Mini player bar (`PlayerBar.tsx` — `.player-mini`)
- Cover thumbnail (44×44) + truncated track title + play/pause button
- Entire bar is clickable (`setSheetOpen(true)`)
- `.player-full` (desktop layout) is `display: none` on mobile

### Now-playing sheet (`.sheet-backdrop` / `.sheet`)
- `position: fixed; inset: 0; z-index: 200` — always in DOM, `opacity: 0; pointer-events: none` when closed
- Opens: `opacity: 1; pointer-events: all` on backdrop; `translateY(0)` on sheet
- Animation: `transition: transform 0.35s cubic-bezier(.32,.72,0,1)` (iOS-style spring)
- Content (top → bottom): drag handle, square cover art, title + equalizer, progress bar, shuffle/prev/play/next/repeat controls, [[SmartRadio|Smart Radio]] + quality badges
- Close: tap backdrop or drag handle

## Files changed

| File | Change |
|---|---|
| `frontend/src/components/MobileNav.tsx` | New — bottom tab bar |
| `frontend/src/components/PlayerBar.tsx` | Added `sheetOpen` state, `.player-mini`, full sheet JSX |
| `frontend/src/App.tsx` | Added `<MobileNav />` inside shell grid |
| `frontend/src/index.css` | Shell grid updated, mobile breakpoint, sheet/nav/mini-player styles |

## What was NOT changed

- `Sidebar.tsx` — untouched; hidden by CSS only
- `PlayerContext.tsx` — no changes
- All pages — layout adjustments only (padding, hero stacking, grid min-width)

## PWA (installable app)

Added via `vite-plugin-pwa` so the app can be installed to the home screen without an APK.

| What | Detail |
|---|---|
| Manifest | `name`, `short_name`, `theme_color #1DB954`, `display: standalone`, `orientation: portrait` |
| Icons | _(removed — pending new Cozyroom logo)_ |
| Service worker | `registerType: autoUpdate`, `devOptions: { enabled: true }` so the install prompt works in dev mode |
| Install banner | `InstallBanner.tsx` — listens for `beforeinstallprompt`, shows inline "Cài ngay" button; hides once installed or dismissed |
| iOS | Requires Safari → Share → Add to Home Screen (no `beforeinstallprompt` support on Safari) |

## Media Session API

Wires the OS lock-screen / notification player controls to the in-app player.

Set in `PlayerContext.tsx` via two `useEffect`s:

1. **On track change** — sets `navigator.mediaSession.metadata` (title + cover artwork) and registers action handlers: `play`, `pause`, `nexttrack`, `previoustrack`, `seekto`
2. **On isPlaying change** — updates `navigator.mediaSession.playbackState`

Cover artwork uses an absolute URL (`window.location.origin + /api/covers/{album_id}`) so the OS can fetch it.

## SPA routing fix (Go backend)

`http.FileServer` returns 404 for routes like `/artist/123` on hard reload because no such file exists in `dist/`.

Replaced with `spaHandler` (`backend/internal/api/spa.go`):
```go
// Falls back to index.html when the requested path doesn't exist on disk
```
All API routes (`/api/…`, `/stream/…`) still match first via `ServeMux` specificity.

## Deployment topology

```
Phone browser
    ↓ HTTPS
music.giatbh.io.vn  (Cloudflare)
    ↓
cloudflared tunnel  (WSL systemd service)
    ↓ localhost:18080
Docker container  (cozyroom-backend)
    ├── Go backend  :8080  →  serves /api/*, /stream/*, SPA fallback
    └── ./dist/            ←  Vite production build (npm run build)
```

Cloudflared no longer points at the Vite dev server (5174); the production build is embedded in the Docker image.

## Files changed (this session)

| File | Change |
|---|---|
| `frontend/vite.config.ts` | Added `vite-plugin-pwa` with manifest + devOptions |
| `frontend/index.html` | Added PWA meta tags, apple-touch-icon, theme-color |
| `frontend/public/icon-{192,512}.png` | PWA icons |
| `frontend/src/components/InstallBanner.tsx` | New — inline install prompt |
| `frontend/src/App.tsx` | Added `<InstallBanner />` |
| `frontend/src/index.css` | `.install-banner` styles |
| `frontend/src/PlayerContext.tsx` | Media Session API integration |
| `backend/internal/api/spa.go` | New — SPA fallback handler |
| `backend/internal/api/routes.go` | Use `spaHandler` instead of bare `http.FileServer` |

## Touch-to-reveal overlay controls (2026-05-19)

Three buttons in the now-playing overlay start hidden (`opacity: 0; pointer-events: none`) and reveal for 3 s on any `touchstart` via the `.npo--ctrls-active` class:

| Button | Selector | Location |
|--------|----------|----------|
| Close / back chevron | `.npo-btn-back` | top-left of `.npo-header` |
| Lyrics settings (⋮) | `.lyrics-tools-toggle` | top-right, `position: fixed` inside LyricsView |
| Translate shortcut (🌐) | `.npo-translate-btn` | bottom-right of `.npo-controls`, `position: absolute` |

The translate button calls `lyricsRef.current.toggleTranslation()` (exposed via `forwardRef` + `useImperativeHandle` on LyricsView). PlayerBar holds a `trActive` mirror state (fed by `onTranslateActiveChange` callback) purely for the button's active CSS class — all translation fetch logic stays inside LyricsView.

## Left-Zone Tap to Return to Now Playing (2026-05-19)

Để tối ưu hóa trải nghiệm vuốt chạm trên thiết bị di động, cơ chế toast hiện/ẩn tab cũ (hiển thị tab 3 giây rồi ẩn khi chạm) đã được gỡ bỏ hoàn toàn. Thay vào đó:
- **Tab Bar luôn hiển thị**: Thanh chọn tab (Now Playing / Lyrics) ở phía dưới cùng luôn cố định trên mobile để người dùng dễ nhận biết và chuyển đổi nhanh.
- **Vùng chạm phản hồi nhanh (npo-back-zone)**: 
  - Khi đang ở tab **Lyrics**, một vùng chạm trong suốt kích thước 50% chiều rộng màn hình phía bên trái `.npo-back-zone` (`left: 0; top: 0; width: 50%; height: 100%; position: absolute`) sẽ tự động được hiển thị đè lên vùng thông tin bài hát ẩn.
  - Chạm vào bất kỳ vùng trống nào ở nửa bên trái màn hình sẽ lập tức chuyển người dùng quay trở lại tab **Now Playing** (`setMobileTab('player')`) mà không làm ảnh hưởng đến các nút chức năng hay trình điều khiển nhạc hiện tại.

---

## Origin

- **Drafts:** 
  - `wiki/sources/draft/040526-mobile-ui-fe.md`
  - `wiki/sources/draft/190526-remove-tab-toast-lyrics-back-fe.md`
- **Commit:** `8aacc82 — feat: mobile UI — bottom nav, mini player bar, slide-up now-playing sheet`
- **Date promoted:** 2026-05-04
- **Extended by commit:** `f703b53 — feat: PWA install, SPA routing fix, Media Session controls`
- **Extended by commit:** `b57c912 — fix(player): remove tab toast, add left-zone tap back to player`

