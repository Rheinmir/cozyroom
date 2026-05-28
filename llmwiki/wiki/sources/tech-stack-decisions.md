# Tech Stack Decisions — Cozyroom
**Type:** source
**Tags:** architecture, go, react, sqlite, docker, wsl2

Go backend + React/TypeScript frontend + SQLite metadata store, all running in a single Docker container in WSL2, streaming music files bind-mounted from the Windows host.

## Notes

### Stack Summary

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + TypeScript | Spotify-style UI; Vite for dev/build |
| Backend | Go | HTTP API + audio streaming |
| Database | SQLite | Metadata index (artist, album, track) |
| Storage | Local filesystem via Docker | Bind-mount from Windows host |
| Container | Docker (WSL2 on Windows 11) | Single docker-compose.yml |

### Architecture

```
Windows Host (F:\250930music\)
        │  bind-mount read-only → /music
        ▼
[Docker / WSL2]  Go Backend :8080
  ├── /api/artists, /api/albums, /api/tracks
  ├── /api/search, /api/smart-queue
  ├── /api/covers/{id}, /api/artist-images/{id}
  └── /stream/{id}[?q=320]  (byte-range or ffmpeg transcode)

     SQLite  /data/metadata.db
  ├── artists / albums / tracks (with genre column)

[Browser]  React + TypeScript (Vite)
  ├── Spotify dark UI
  ├── HTML5 Audio API + PlayerContext (queue, ShuffleMode, RepeatMode, Quality)
  └── React Query for all data fetching
```

### Key Decisions
- **Pure-Go SQLite** (`modernc.org/sqlite`) — avoids CGO issues in Docker
- **Go serves static frontend** — Go binary serves built React `dist/`, no separate Nginx container
- **`github.com/dhowden/tag`** — ID3/Vorbis tag parsing for library scan
- **`http.ServeFile`** — handles `Range` headers natively for seek support
- **No Navidrome** — custom build gives full control over UI and API design
- **ffmpeg in Docker runtime** — lossless → 320kbps MP3 transcode via pipe to ResponseWriter
- **[[DeezerEnricher|Deezer API]]** (no auth) — artist image enrichment, picture_xl (1000px)
- **Weighted random SQL** — `score * RANDOM()` for smart genre-aware shuffle

### DB Schema (current)
```sql
CREATE TABLE artists (id TEXT PRIMARY KEY, name TEXT NOT NULL, image_path TEXT);
CREATE TABLE albums  (id TEXT PRIMARY KEY, artist_id TEXT NOT NULL, title TEXT NOT NULL,
                      year INT, cover_path TEXT);
CREATE TABLE tracks  (id TEXT PRIMARY KEY, album_id TEXT NOT NULL, title TEXT NOT NULL,
                      track_num INT, duration_s INT, file_path TEXT NOT NULL,
                      genre TEXT NOT NULL DEFAULT '');
-- genre added via: ALTER TABLE tracks ADD COLUMN genre TEXT NOT NULL DEFAULT ''
```

See also: [[project-requirements]]

## Origin
- **Source:** Derived from `01-Project-Kickoff.md` + user input (2026-05-03)
- **Date:** 2026-05-03
