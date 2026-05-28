# Project Requirements — Cozyroom
**Type:** source
**Tags:** requirements, business, cozyroom, music-streaming

Self-hosted personal music streaming platform that replicates the Spotify experience using a local music library. Serves audio from a Windows host folder via Docker/WSL2 with no cloud dependency.

## Notes

### Goal
Eliminate reliance on Spotify by running a private music server that streams directly from local files — no cloud, no subscription, no tracking.

### Key User Workflows
1. **Browsing** — Artists → Albums → Tracks, cover art and metadata from ID3 tags
2. **Playback** — Go backend streams audio via byte-range HTTP; frontend uses HTML5 Audio API
3. **Library management** — Drop files in Windows music folder; backend rescans and updates SQLite index
4. **Search** — Artist, album, or track name; served from SQLite

### Core Constraints
- Music files on Windows host (e.g. `D:\Music`), bind-mounted read-only as `/music` in Docker
- Single Docker container in WSL2; no external services
- SQLite is a derived metadata index — ID3/Vorbis tags are source of truth
- No DRM or external API integration — all data is local
- Single admin user at MVP; no multi-user auth needed

### Out of Scope (MVP)
- Mobile native apps (mobile browser acceptable)
- Upload via UI
- Collaborative playlists / social features
- Audio transcoding

## Origin
- **Source:** Derived from `01-Project-Kickoff.md` + user input (2026-05-03)
- **Date:** 2026-05-03
