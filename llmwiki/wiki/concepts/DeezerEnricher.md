# Deezer Artist Image Enricher
**Type:** concept
**Tags:** enricher, deezer, artist-images, background-job, go

Background goroutine that fetches artist portrait photos from the Deezer public API and stores them locally. Runs automatically on every container start after any library scan.

## Notes

### Why Deezer
- No API key or OAuth required (unlike Spotify, Last.fm)
- Returns `picture_xl` (1000×1000 px) — high quality for circular avatar display
- Rate limit is permissive; ~3 req/sec is well within bounds
- Fallback chain: `picture_xl` → `picture_big` → `picture_medium`

### Flow
```
Container start
  └─ goroutine: [scan if empty] → enricher.FetchArtistImages()
       SELECT id, name FROM artists WHERE image_path = '' OR NULL
       for each artist:
         GET api.deezer.com/search/artist?q={name}&limit=1
         download picture_xl → /data/artist-images/{artistID}.jpg
         UPDATE artists SET image_path = '/api/artist-images/{id}'
         sleep 350ms
```

### Incremental design
Only fetches artists with empty `image_path`. Safe to interrupt and restart — re-runs will pick up where they left off. For 832 artists: ~5 minutes total (350ms × 832).

### Serving images
`GET /api/artist-images/{id}` — same pattern as `/api/covers/{id}`. Validated with `^[0-9a-f]{16}$` regex before serving from filesystem.

### Frontend integration
- `GET /api/artists` returns `image_url` (omitted if empty)
- `GET /api/albums?artist_id=X` returns `artist_image_url` per album row (JOIN with artists)
- `ArtistsPage`: card shows `<img>` if `image_url` present, else letter avatar fallback
- `ArtistPage`: hero circle shows `<img>` if `artist_image_url` present, else letter fallback

### Match quality
Uses Deezer's first search result — accurate for well-known international artists, less reliable for Vietnamese artists with uncommon names. No name-similarity check applied; trust Deezer's ranking.

## Related
- [[concepts/Architecture]] — enricher is part of startup goroutine chain

## Origin
- **Source:** `backend/internal/enricher/deezer.go`
- **Date:** 2026-05-04
