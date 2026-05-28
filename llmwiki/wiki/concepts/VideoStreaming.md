# Video Streaming

## Architecture Decision
**Modular Monolith** — video is a new domain inside the existing Go binary, sharing SQLite and the [[CleanArchitecture|Clean Architecture]] layers. Microservices were evaluated and rejected: Docker Compose networking complexity, SQLite cross-domain queries, and operational overhead outweigh any benefit at this scale.

## Domain Layers
| Layer | File | Purpose |
|-------|------|---------|
| Entity | `internal/domain/entity.go` | `Video{ID, Title, DurationS, SizeBytes, FilePath, CreatedAt}` |
| Repository interface | `internal/domain/repository.go` | `VideoRepository` (List, GetByID, Upsert, IsEmpty) |
| SQLite impl | `internal/repository/sqlite/video.go` | `videos` table; upsert on ID conflict |
| Usecase | `internal/usecase/video.go` | `VideoUsecase.ListVideos`, `GetVideo` |
| HTTP handlers | `internal/api/video.go` | `GET /api/videos`, `GET /stream-video/{id}` |
| [[concepts/Scanner|Scanner]] | `internal/library/video_scanner.go` | Walks `/films` on startup; indexes `.mp4/.mkv/.ts/.avi` |

## HLS Streaming
All files in `F:\Films` are `.ts` (MPEG-TS). Chrome/Firefox cannot play this container natively. The backend generates HLS on the fly:

**`internal/hls.Manager`:**
- On first request for `/hls/{id}/index.m3u8`, starts an ffmpeg job: `-c:v copy -c:a aac -f hls -hls_time 4 -hls_list_size 0`
- Blocks until `index.m3u8` first appears on disk (~4 seconds, first segment ready)
- ffmpeg continues generating segments in background; updates `index.m3u8` incrementally
- Adds `#EXT-X-ENDLIST` when complete — hls.js then knows it's VOD not live
- Segments cached in `/data/hls/{id}/` — **re-run only if ENDLIST is absent** (disk cache)

**Speed:** `-c:v copy` skips video decoding/encoding → ~130x real-time. A 40-min episode is fully segmented in <20s.

**Routes:**
- `GET /hls/{id}/index.m3u8` — serve playlist (no-cache headers so hls.js always gets updates)
- `GET /hls/{id}/{seg}` — wait for segment file, serve with `Content-Type: video/mp2t`
- `GET /stream-video/{id}` — kept as fallback for non-.ts files (http.ServeContent with Range)

## Frontend
- `/videos` → `VideosPage.tsx` — film grid with title + file size
- `/video/:id` → `VideoPlayerPage.tsx` — `hls.js` attaches to `<video ref>`, polls playlist, handles buffering and seeking
- Safari: uses native HLS via `video.canPlayType('application/vnd.apple.mpegurl')`
- Vite dev proxy: `/hls`, `/stream-video` → `localhost:8080`

## Known Limitations
- **Seeking to un-generated segments** will stall until ffmpeg reaches that point (only an issue in the first ~20s of first play on a cold cache)
- **`duration_s` is always `0`** — ffprobe at scan time was deferred; hls.js infers duration from the playlist instead

## Infrastructure
- `docker-compose.yml`: `F:\Films` → `/mnt/f/Films` (WSL) → `/films` (container)
- `FILMS_PATH` env var (default `/films`) controls the scan root
- ffmpeg is already in the alpine runtime image (`apk add --no-cache ffmpeg`)

## Origin
- **Draft:** `wiki/sources/draft/110526-media-streaming-architecture-proposal-backend.md`
- **Commit:** `f400c80 — feat(video): add video streaming with MPEG-TS transcoding support`
- **Date promoted:** 2026-05-11
