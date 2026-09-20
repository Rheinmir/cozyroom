---
title: Comics Offline Downloader — Zero-Latency Local Serving
date: 2026-05-15
type: concept
---

## Summary

Background download engine that pre-fetches EH galleries and MD chapters to local disk on a 6-hour cycle. Default frontend grid shows only `status=done` items (instant load, no external requests). Search still queries external sources live.

## Architecture

### Backend

| Component | File | Role |
|-----------|------|------|
| `ComicsDownloader` goroutine | `backend/internal/api/comics_downloader.go` | 6h ticker, discover → enqueue → worker |
| `ComicsDownloadsRepo` | `backend/internal/repository/sqlite/comics_downloads.go` | `comics_downloads` table CRUD |
| `GET /api/scraper/downloads` | routes.go | List all download rows |
| `DELETE /api/scraper/downloads/{id}` | routes.go | Delete row + local dir |
| `POST /api/scraper/downloads/{id}/retry` | routes.go | Reset status to queued, restart worker |
| `GET /api/scraper/local/{source}/{id}/{file}` | routes.go | Serve local image file |

### DB schema

```sql
CREATE TABLE IF NOT EXISTS comics_downloads (
  id         TEXT PRIMARY KEY,
  source     TEXT NOT NULL,           -- "eh" | "md"
  title      TEXT NOT NULL,
  cover      TEXT,
  local_dir  TEXT,
  page_count INTEGER NOT NULL DEFAULT 0,
  downloaded INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'queued',  -- queued|downloading|done|failed
  error      TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
```

### Download lifecycle

1. Startup: reset any `status=downloading` rows to `queued` (crash recovery)
2. Every 6h: `discoverAndEnqueue()` — fetches EH/MD latest, inserts new items as `queued`
3. Worker loop: `queued` → `downloading` → download images → `done` (or `failed`)
4. EH rate limit: reuses `ehImageLimiter` (6/min)
5. EH cover URL: stored as raw `ehgt.org` CDN URL (unwrapped from `/api/scraper/eh/image?url=` proxy) to avoid rate-limiting covers

### Frontend

- Default grid on mount: `GET /api/scraper/downloads` filtered by source tab
- Status badges: `queued` / `downloading N/M` / `done` / `failed`
- Retry ↺ button on failed cards: calls `POST .../retry`
- Delete × button: calls `DELETE .../downloads/{id}`
- Reader for downloaded: generates `/api/scraper/local/{id}/{0000..N}.jpg` URLs
- Poll every 5s while any item is `queued` or `downloading`

## Key design decisions

- **MD 50-page cap**: chapters longer than 50 pages are truncated (`pages = pages[:50]`) to prevent unbounded downloads
- **EH cover via CDN not proxy**: avoids the 10/min proxy rate limit for grid thumbnail loading
- **`context.Background()` for DB writes**: request context gets cancelled on client disconnect, so cache writes use background context to survive

## Update — 2026-05-19: Per-site download strategy

**Problem:** EH images require session cookies (CDN blocks without auth) → all downloaded files were black/empty → reader showed black screen. MD only downloaded 1 chapter instead of all.

**Redesign:**
- Discovery (`discoverEH`/`discoverMD`) now uses `InsertCover()` → `status=idle`. No auto-queue.
- EH download routes all gallery images through cloak proxy via `fetchImageViaProxy()`. Never fetches CDN directly.
- MD download paginates all chapters (100/request), stores each chapter in `md/{mangaId}/{chapterId}/`.
- `verifyImage()`: checks file ≥ 1KB + valid JPEG/PNG/WebP magic bytes. Failed pages → error, not silent success.
- `downloadEH()` returns error if 0 pages downloaded (was silently returning nil).
- `CleanupV1()`: one-time DB reset on startup (flag `comics_dl_reset_v1` in settings) to clear old corrupt data.
- New endpoints: `POST /api/scraper/enqueue/eh/{gid}/{token}`, `POST /api/scraper/enqueue/md/{mangaId}`, `GET /api/scraper/local/{id}/chapters`.
- Idle EH cards: clickable → reads online via `/api/scraper/eh/image?url=` proxy (no download needed).
- `fetchHTML()` infinite recursion bug fixed (was calling itself instead of falling back to direct HTTP).

**Updated DB schema:**
```sql
status TEXT NOT NULL DEFAULT 'idle'  -- idle|queued|downloading|done|failed
token  TEXT                           -- EH gallery token
```

## Origin

- **Draft:** `wiki/sources/draft/150526-comics-offline-prefetch-backend-fe.md`
- **Commit:** `6a6e8cd — feat: comics offline downloader, image optimisation, EH fixes, lyrics UX`
- **Update commit:** `6f13c4a — feat: comics per-site download strategy, NPO tap zones, PWA update banner`
- **Date promoted:** 2026-05-17
