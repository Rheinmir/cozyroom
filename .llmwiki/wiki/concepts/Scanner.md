# Scanner
**Type:** concept
**Tags:** scanner, library, id3, metadata, sqlite, go

Library scanner that walks the music directory, reads audio metadata tags, and upserts artists/albums/tracks into SQLite. Runs as a background goroutine on startup so the HTTP server is immediately available.

## Notes

### ID generation
All IDs are the first 8 bytes of SHA-256, formatted as 16-char lowercase hex:
```go
id8(s) = fmt.Sprintf("%x", sha256.Sum256([]byte(lower(trim(s))))[:8])
```
- Artist ID: `id8(artistName)`
- Album ID: `id8(artistID + albumTitle)` — scoped under artist to avoid collisions
- Track ID: `id8(filePath)` — stable across rescans as long as file doesn't move

### Tag reading
Uses `github.com/dhowden/tag` for ID3v1/v2, Vorbis comments (FLAC/OGG), and MP4/M4A atoms.
Fields read: Artist, Album, Title, Genre, Year, TrackNumber, Picture (cover art).

Tag parse errors are silently ignored — the file is still indexed with filename-derived metadata.

### Title cleaning
Many files downloaded from streaming services have their ID3 Title set to the filename, e.g.:
```
"01 Rolling in the Deep_20250703_094206"
```
`cleanTitle()` normalises these:
1. Strip timestamp suffix: `_YYYYMMDD_HHMMSS`
2. Strip leading track-number prefix: `^\d+[.\-\s]+`

Applied to both the filename fallback and to ID3 titles that contain the timestamp pattern.

### Cover art
Embedded `Picture()` data is written to `/data/covers/{albumID}.jpg` on first encounter (per album). Stored path `/api/covers/{albumID}` is written to `albums.cover_path`.

### Genre column
`tracks.genre` stores the raw ID3/Vorbis genre string. Used by the [[SmartRadio|Smart Radio]] algorithm for weighted similarity scoring. Added via additive `ALTER TABLE` migration (safe to run on existing DB).

### Rescanning
`INSERT OR IGNORE` for artists/albums (stable, don't overwrite enriched data like image_path).
`INSERT OR REPLACE` for tracks (always reflects latest tags and cleanTitle output).

### Performance note
WSL2 filesystem access to Windows mounts (`/mnt/f/...`) costs ~100–200 ms per file open. 2566 files ≈ 4–7 minutes. Running as a goroutine after server start keeps startup instant.

## Related
- [[concepts/Architecture]] — where scanner fits in startup sequence
- [[concepts/SmartRadio]] — consumes genre field populated here

## Origin
- **Source:** Implementation; `backend/internal/library/scanner.go`
- **Date:** 2026-05-03 (initial); 2026-05-03 (cleanTitle); 2026-05-04 (genre)
