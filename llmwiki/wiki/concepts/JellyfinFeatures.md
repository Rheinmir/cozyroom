# Jellyfin-Inspired Features

Four features distilled from Jellyfin's architecture and applied to Cozyroom.

## 1. Abstract Metadata Provider System

**Pattern:** `enricher.ArtistImageProvider` / `enricher.VideoPosterProvider` interfaces.

- `DeezerProvider` — fetches artist images (existing [[DeezerEnricher]], refactored to satisfy the interface)
- `TMDbProvider` — fetches video poster art from The Movie Database API when `TMDB_API_KEY` env var is set
- `FetchArtistImages(provider, repo, dir)` and `FetchVideoPosters(provider, repo, dir)` are the generic runner functions — both run as background goroutines at startup

New DB columns: `videos.poster_path` (TEXT). Posters served at `GET /api/video-posters/{id}`.

## 2. Trickplay / BIF (Thumbnail Scrubber)

**Endpoint:** `GET /api/trickplay/{id}` → JSON metadata; `/api/trickplay/{id}/sprite` → PNG sprite sheet.

- FFmpeg command: `fps=1/10, scale=160x90, tile=10x999` → single PNG with 10-column grid
- Generation is lazy: triggered on first metadata request if not yet ready, runs in a background goroutine
- DB column `videos.trickplay_ready INTEGER` tracks completion; `VideoRepository.SetTrickplayReady` flips it
- Output stored in `TRICKPLAY_DIR` (default `/data/trickplay/`)
- Metadata response: `{ ready, interval_s: 10, cols: 10, frame_width: 160, frame_height: 90, count, sprite_url }`
- Frontend uses CSS `background-position` to show the correct cell when hovering the seek bar

## 3. Device Profile & Adaptive Playback

**Function:** `transcode.CanDirectPlay(userAgent, filePath) bool`

Decision table:
- `.mp4` / `.m4v` → always direct play (all modern browsers support H264+AAC in MP4)
- `.mkv` / `.webm` → direct play only if Chrome or Firefox detected in User-Agent
- other → HLS transcoding (current pipeline)

**Endpoint:** `GET /api/videos/{id}/stream` — smart redirect: `302` to `/stream-video/{id}` (direct) or `/hls/{id}/index.m3u8` (HLS) based on result.

## 4. Resume State

**Endpoints:**
- `POST /api/playback/progress` body `{ item_type, item_id, position_s }` — upsert position
- `GET /api/playback/progress/{type}/{id}` — return last saved position (default 0 if none)

**Schema:** `playback_progress(item_type TEXT, item_id TEXT, position_s REAL, updated_at INTEGER)` — composite PK on `(item_type, item_id)`.

Intended use: frontend reports progress every ~10s during playback; uses the saved position to auto-seek on next open.

## Origin

- **Draft:** `wiki/sources/draft/110526-jellyfin-features-extraction.md`
- **Commit:** `024d9c5 — feat(backend): implement 4 Jellyfin-inspired features`
- **Date promoted:** 2026-05-11
