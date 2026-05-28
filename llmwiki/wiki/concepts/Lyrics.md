# Lyrics

## Summary
Multi-source lyrics engine that fetches from 4 providers and presents them with a source selector, source monitor panel, cache badge, and refresh button. Both desktop and mobile share the same `LyricsView` component.

## Sources (priority order)
| # | Source | Type | Notes |
|---|--------|------|-------|
| 1 | **Sidecar `.lrc`** | local file | Checked in `/data/lyrics/{trackID}.lrc` first, then adjacent to audio file |
| 2 | **LRCLIB** | synced + plain | Free public API; strong on Western catalogue |
| 3 | **NetEase Cloud** | synced LRC | Unofficial API; strong on Vietnamese/Chinese |
| 4 | **QQ Music** | synced LRC | Unofficial API; backup for Asian catalogue |

## Backend (`backend/internal/api/lyrics.go`)

### Endpoints
- `GET /api/lyrics/{id}` — returns `{ results, sources, cached }`.
  - Sidecar and Embedded lyrics always read fresh from disk first.
  - If online cache is missing: **blocking parallel fetch** of all online sources, ensuring fresh results are returned even if local lyrics exist.
  - `sources[]` always includes all sources with `found`, `lines`, `err` fields — powers the monitor panel.
- `POST /api/lyrics/{id}` — writes `{ lrc: string }` to `/data/lyrics/{trackID}.lrc` (writable volume); invalidates online DB cache. Password gate is FE-only.
- `DELETE /api/lyrics/{id}` — busts the BE SQLite cache for a track (used by Refresh button).

### Caching layers
1. **FE sessionStorage** — keyed `lyr:{trackID}`, stores `{ results, sources, beCached }`. Validated on read (stale format auto-evicted).
2. **BE SQLite `lyrics_cache`** — stores online-source results as JSON blob. Sidecar is always re-read from disk, never cached.

### Save path
`/data/lyrics/{trackID}.lrc` — separate from the read-only `/music` volume. `fetchSidecar` checks this path first, then falls back to the audio-adjacent `.lrc`.

### LRC parser
Handles `[MM:SS.cs]`, `[MM:SS.ms]`, multiple timestamps per line. Always returns `[]` (never `nil`) so JSON encodes as `[]` not `null`.

## Frontend (`frontend/src/components/LyricsView.tsx`)
- **Source dropdown** — sources with data only; `✦` = synced (timed) lyrics.
- **Auto-Selection** — automatically picks the best source: prefers synced (LRC) lyrics, then prefers non-embedded sources to ensure quality.
- **Source monitor** (`n/n` button) — expandable panel showing all sources: `●` found (with line count), `○` not found (with error if any).
- **Cache badge** (`cached`) — shown when online data was served from BE SQLite cache.
- **Refresh button** (`↻`) — clears FE sessionStorage + calls `DELETE /api/lyrics/{id}`, then re-fetches all sources fresh synchronously.
- **Save** — builds LRC from `synced[]` variable (already `?? []` safe), POSTs to BE. Error messages are step-specific: password / no data / LRC build error / `HTTP {status}: {body}`.
- Auto-scroll karaoke: active line highlighted, past 25% opacity, future 45%.

## Desktop overlay (`PlayerBar.tsx`)
- Icon button (≡) in `player-right` toggles a full-screen overlay (`inset: 0 0 var(--player-h) 0`) respecting the responsive player bar height variable.
- Layout: album cover left (260×260px) + lyrics right.

## PWA update behaviour
`skipWaiting: true` + `clientsClaim: true` in Workbox config ensures new deploys activate immediately without requiring tab close.

## Origin
- **Commit:** `1a24b9f — feat: parallel multi-source lyrics with desktop overlay + save`
- **Updated:** 2026-05-12 — fixed reload logic (synchronous fetch) and added `pickBest` source selection (prevents bad embedded lyrics overwrite).
- **Commit:** `a986968 — fix: ensure lyrics reload is synchronous and prioritizes high-quality sources to prevent 'embedding' overwrite`
- **Date promoted:** 2026-05-12
