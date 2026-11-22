---
title: UI URL Path Standard (mega homelab app)
date: 2026-11-23
type: concept
tags: [routes, urls, fe, pwa, redirects]
---

# UI URL Path Standard

## Summary
Every UI URL is defined once in `frontend/src/routes.ts`. Scheme: `/<module>/<collection>/<id>`, plural collections. Old URLs redirect to the new ones.

## Table (`ROUTES`)
| Module | Routes |
|---|---|
| music | `/music` (Artists), `/music/artists/:id`, `/music/albums`, `/music/albums/:id`, `/music/tracks`, `/music/playlists`, `/music/discover`, `/music/search?q=`, `/music/stats` |
| video | `/video`, `/video/:id` |
| read | `/read/books`, `/read/books/:id`, `/read/comics` |
| explore | `/explore/trending` |
| ai / notes | `/ai`, `/ai/stats`, `/notes` |
| system | `/system/tools`, `/system/debug` |
| root | `/` redirects to `/music` (a module hub page comes later) |

## Rules
- No raw path strings in components. Use `ROUTES.x` for fixed routes and `paths.album(id)` etc. for id/query URLs.
- Header search scope uses `isRoute()` (exact match), so detail pages (`/music/albums/:id`) do not take over the search box.
- Old URLs: `LEGACY_REDIRECTS` (15 rows) renders `<LegacyRedirect>`: keeps `:id`, `?query`, `#hash` and router state; `replace` so Back does not loop. Remove after two releases (owner decides).
- Unchanged on purpose: `/video/:id`, `/ai`, `/ai/stats`, `/notes`, all `/api/*`, `/stream*`, `/hls`, `/mcp`, `/metrics`.
- Overlay state: the Now Playing overlay is the `?np=` param: `np=1` (player tab), `np=lyrics`, `np=queue` (queue panel inside the overlay). Opening pushes one history entry (router state `{np:true}`); Back, Esc and the close button close it (Back when we pushed it, else replace, so a deep link stays in the app). Tab and queue changes use replace. Other params (`?q=`) are kept. The standalone bar queue stays plain state. Code: `PlayerContext.tsx` (`npoOpen`, `npoTab`, `npoQueue`).
- Next steps (not done yet): `/media/*` and `/api/v1/*` aliases with nginx, service worker regex + version bump, home hub page.

## Gotchas
- nginx `location /mcp` is a prefix match; no new UI prefix may start with `/mcp`, `/api`, `/stream`, `/hls`, `/metrics`.
- Prefix checks like `pathname.startsWith('/music/albums')` would also match the detail page. Use `isRoute()`.
- RadialNav "active" check treats `ROUTES.music` as exact-only (else it is active on every `/music/*` page).

## Origin
- Issue room `rebuild-the-vinyl-player-screen-to-match-the-refer`, Step 2 plan (message m1a204000b776beb), approved with owner answers (m1a20401e69b06cc).
- Code: branch `kozu/routes-table` (7cf5766, no URL change), `kozu/url-paths` (bb642c7, new scheme + redirects, now on main), `kozu/np-url` (overlay state).
- Reviewed by Kusa: routes.ts step ĐẠT.
