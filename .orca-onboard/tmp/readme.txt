# Cozyroom

Self-hosted personal media streaming — music, video, comics & ebooks from your local library.

**Stack:** Go backend · React/TypeScript frontend · SQLite metadata · Docker/WSL2

> **Status:** Active development. AI agent integration (OpenRouter/DeepSeek/Gemini), MCP tools, trending analytics, YouTube streaming, playlist management, and bilingual i18n.

---

## Prerequisites

- Go 1.22+
- Node 20+
- Docker + Docker Compose (for containerised run)
- Media files accessible at configured paths (adjust in docker-compose.yml)

---

## Local development (no Docker)

### 1. Backend

```bash
cd backend
go mod tidy
mkdir -p ../data
go run ./cmd/server
# → http://localhost:8080/api/health
```

### 2. Frontend (separate terminal)

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173  (proxies /api and /stream to :8080)
```

---

## Docker

```bash
cd frontend && npm install && npm run build && cd ..
docker compose up --build
# → http://localhost:8080
```

> Adjust media paths in `docker-compose.yml` if your library is not at default locations.

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/artists` | List all artists |
| GET | `/api/albums` | List all albums |
| GET | `/api/tracks` | List all tracks |
| GET | `/api/trending/topics` | Trending topic time-series |
| GET | `/api/ai/chat` | AI chat (SSE streaming) |
| GET | `/api/ai/logs` | Chat log history |
| GET | `/api/ai/stats` | Token usage analytics |
| GET | `/api/ai/memory` | Agent memory CRUD |
| GET | `/api/playlists` | Playlist management |
| GET | `/api/search?q=` | Search tracks/artists/albums |
| GET | `/stream/{id}` | Stream audio (Range) |
| GET | `/api/youtube/search?q=` | YouTube search |
| POST | `/api/youtube/download` | yt-dlp download |
| GET | `/api/video/stream/{id}` | Video streaming (HLS) |
| GET | `/api/comics` | Comics library |
| GET | `/api/ebooks` | Ebook library |
| POST | `/api/lastfm/scrobble` | Last.fm scrobbling |

---

## Project layout

```
cozyroom/
├── backend/
│   ├── cmd/server/main.go
│   ├── internal/
│   │   ├── api/                  HTTP handlers + router
│   │   ├── db/                   SQLite + migrations
│   │   ├── mcp/                  MCP server + tools
│   │   ├── enricher/             Deezer/GitHub/TMDB/AI trends
│   │   ├── hls/                  Video transcoding (HLS)
│   │   ├── library/              Scanner (audio/video/ebook)
│   │   ├── transcode/            FFmpeg device profiles
│   │   └── usecase/              Business logic
│   ├── go.mod
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/           Sidebar, RadialNav, PlayerBar, LyricsView
│   │   ├─�