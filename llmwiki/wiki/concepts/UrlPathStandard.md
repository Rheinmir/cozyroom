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
| root | `/` = home hub (`pages/HomePage.tsx`): greeting + library counts, Continue card (player state only), 7 module tiles |

## Rules
- No raw path strings in components. Use `ROUTES.x` for fixed routes and `paths.album(id)` etc. for id/query URLs.
- Header search scope uses `isRoute()` (exact match), so detail pages (`/music/albums/:id`) do not take over the search box.
- Old URLs: `LEGACY_REDIRECTS` (15 rows) renders `<LegacyRedirect>`: keeps `:id`, `?query`, `#hash` and router state; `replace` so Back does not loop. Remove after two releases (owner decides).
- Unchanged on purpose: `/video/:id`, `/ai`, `/ai/stats`, `/notes`, all `/api/*`, `/stream*`, `/hls`, `/mcp`, `/metrics`.
- Overlay state: the Now Playing overlay is the `?np=` param: `np=1` (player tab), `np=lyrics`, `np=queue` (queue panel inside the overlay). Opening pushes one history entry (router state `{np:true}`); Back, Esc and the close button close it (Back when we pushed it, else replace, so a deep link stays in the app). Tab and queue changes use replace. Other params (`?q=`) are kept. The standalone bar queue stays plain state. Code: `PlayerContext.tsx` (`npoOpen`, `npoTab`, `npoQueue`).
- API and media paths: `/api/v1/*` is canonical for REST; `/media/audio|video|hls|covers|artist-images|video-posters|ebook-covers|youtube/...` for bytes. Old paths keep working. Implemented as a REWRITE, not duplicate routes: Go `aliasPaths` middleware (`backend/internal/api/aliases.go`, outermost in `NewRouter`) and nine `rewrite ... last` lines at the top of `nginx.conf`. A rewritten URI re-enters the old `location` blocks, so SSE, timeouts, no-buffering and Range apply unchanged. Keep the two tables in sync.
- Handlers, metrics labels, the debug request log and auth all see the OLD path. Auth is inside the handlers (`verifyOwnerPassword`, kanban tokens), not path middleware, so /api/v1 is protected exactly like /api (test `TestAliasKeepsAuth`).
- Frontend: `src/endpoints.ts` (`API`, `MEDIA`). Backend JSON still emits old-style `cover_url` (`/api/covers/...`); `imgSrc` and the service worker accept both forms.
- Service worker: runtime caching regexes accept both `/api` and `/media` forms; file name stays `sw3.js` (content change makes autoUpdate refresh it).
- Home hub: tiles link to /music, /video, /read/books, /ai, /notes, /explore/trending, /system/tools. Sidebar logo and the mobile Home button go to `/`. Data: `fetchStats` + `PlayerContext` only. Styles: `.hub-*` in index.css, existing tokens only (no DESIGN.md exception); light theme text is darkened to keep >= 4.5:1.
- Next steps (not done yet): backend emitting new-style URLs; remove legacy aliases after two releases (owner decides).

## Gotchas
- nginx `rewrite` runs before `location` matching; the URI passed to the backend is the rewritten, decoded one.
- nginx `location /mcp` is a prefix match; no new UI prefix may start with `/mcp`, `/api`, `/stream`, `/hls`, `/metrics`.
- Prefix checks like `pathname.startsWith('/music/albums')` would also match the detail page. Use `isRoute()`.
- RadialNav "active" check treats `ROUTES.music` as exact-only (else it is active on every `/music/*` page).

## Origin
- Issue room `rebuild-the-vinyl-player-screen-to-match-the-refer`, Step 2 plan (message m1a204000b776beb), approved with owner answers (m1a20401e69b06cc).
- Code: `kozu/routes-table` (7cf5766), `kozu/url-paths` (bb642c7), `kozu/np-url` (ff3efc5), all on main; `kozu/media-api-v1` (API and media aliases).
- Reviewed by Kusa: routes.ts step ĐẠT.
