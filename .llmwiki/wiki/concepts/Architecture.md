# Architecture
**Type:** concept
**Tags:** architecture, go, react, sqlite, docker, wsl2

Two-container setup: nginx serves the React SPA and proxies backend routes; Go backend handles all API, streaming, and media serving. SQLite metadata store; media files bind-mounted from Windows host via WSL2.

## Notes

### System map
```
Windows Host (F:\250930music\, F:\Films\, F:\Ebooks\)
       │  bind-mount read-only → /music, /films, /ebooks
       ▼
[Docker / WSL2]

  [frontend container]  nginx :80 → exposed :18080
  ├── Static  /           → React SPA (try_files → index.html)
  ├── Proxy   /api/       → backend:8080
  ├── Proxy   /stream/    → backend:8080  (buffering off, timeout 1h)
  ├── Proxy   /stream-video/ → backend:8080  (buffering off)
  └── Proxy   /hls/       → backend:8080  (buffering off)

  [backend container]  Go :8080  (internal only)
  ├── REST API  /api/artists /api/albums /api/tracks /api/search
  ├── Smart Queue  /api/smart-queue
  ├── Stream  /stream/{id}  (Range headers, seek support)
  ├── Video   /stream-video/{id}  /hls/{id}/{file}
  ├── Ebooks  /api/ebooks/*  /api/ebook-covers/{id}
  ├── Comics  /api/scraper/*
  ├── Covers  /api/covers/{id}  /api/artist-images/{id}
  └── Enrichers, Lyrics, LastFM, Trending, Metrics

  SQLite  /data/metadata.db
  ├── artists / albums / tracks
  ├── ebooks / videos / lyrics_cache
  └── comics_downloads / playback / settings / trending

  /data/covers/          — album cover JPEGs extracted from tags
  /data/artist-images/   — artist portrait JPEGs from [[DeezerEnricher|Deezer]]
  /data/ebook-covers/    — PDF/epub cover images
  /data/comics/          — offline pre-fetched comics

[Browser]  React + TypeScript (Vite dev) / served from nginx (prod)
  ├── ArtistsPage / ArtistPage / AlbumPage / SearchPage
  ├── VideoPage / EbookReader / ComicsReader
  ├── PlayerContext — HTML5 Audio, queue, ShuffleMode, RepeatMode, Quality
  └── PlayerBar — controls + [[SmartRadio|Smart Radio]] toggle + quality toggle
```

### Deploy workflow (sau khi split)
```bash
# Sửa UI only — backend không restart
docker compose build frontend && docker compose up -d frontend

# Sửa backend only — UI không gián đoạn
docker compose build backend && docker compose up -d backend

# Full rebuild (BuildKit build 2 service song song)
docker compose up --build -d
```

### Startup sequence
```
main()
  db.Open()           → migrate (CREATE TABLE IF NOT EXISTS; ALTER TABLE ADD COLUMN genre)
  api.NewRouter()     → register all routes
  http.ListenAndServe → server ready immediately
  goroutine:
    if library.IsEmpty → library.Scan() (4–7 min over WSL2)
    enricher.FetchArtistImages() (incremental, ~5 min for 832 artists)
```

### Backend packages
| Package | Responsibility |
|---|---|
| `cmd/server` | Entry point; env config; wires goroutine chain |
| `internal/db` | SQLite open + additive migrations |
| `internal/library` | File walker, tag reader, cleanTitle, cover extractor |
| `internal/transcode` | ffmpeg pipe for FLAC→320kbps MP3 on-the-fly |
| `internal/enricher` | [[DeezerEnricher|Deezer API]] artist image fetcher |
| `internal/api` | All HTTP handlers + router |

### Key decisions
- `modernc.org/sqlite` — pure Go, no CGO, works in Alpine Docker
- `http.ServeFile` — handles Range headers natively for seek
- Background scan goroutine — server is instantly available even while scanning 2566 files
- `INSERT OR IGNORE` for artists/albums — preserves enriched data (image_path, cover_path) across rescans
- `INSERT OR REPLACE` for tracks — always reflects latest tags and cleanTitle
- Additive DB migrations — `ALTER TABLE ADD COLUMN` with ignored error if column exists
- ffmpeg in Docker runtime image — lossless → 320kbps transcode without separate service

### Frontend architecture
- React Query for all data fetching (artists, albums, tracks, search, smart-queue)
- `PlayerContext` wraps HTML5 Audio; all mutable state exposed via `useRef` to avoid stale closures in audio event listeners
- `ShuffleMode = 'off' | 'shuffle' | 'smart'` — smart mode calls `/api/smart-queue` and appends to queue dynamically
- Vite proxy in dev: `/api` and `/stream` → `:8080`

## Related
- [[concepts/Scanner]] — library scan details
- [[concepts/SmartRadio]] — smart queue algorithm
- [[concepts/DeezerEnricher]] — artist image pipeline
- [[sources/tech-stack-decisions]] — full decision rationale

## Origin
- **Source:** Implementation
- **Date:** 2026-05-03 (initial); 2026-05-04 (updated with all features); 2026-05-19 (frontend/backend container split)
