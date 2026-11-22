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

> **Path aliases.** Every `/api/...` path below is also served as `/api/v1/...` (canonical for new clients). Audio/video/images are also under `/media/`: `/media/audio/{id}` = `/stream/{id}`, `/media/video/{id}` = `/stream-video/{id}`, `/media/hls/...` = `/hls/...`, `/media/covers|artist-images|video-posters|ebook-covers/{id}` = `/api/<same>/{id}`, `/media/youtube/{id}` = `/api/youtube/stream/{id}`. The old paths keep working. Rewrites live in `backend/internal/api/aliases.go` and `nginx.conf`.

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
│   │   ├── pages/                AIAssistant, Trending, Albums, Artists, Playlists,...
│   │   └── i18n/                 EN/VI translations
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── cloak-proxy/                  HTTP proxy for AI providers
├── observability/                Prometheus config
├── llmwiki/                      Agent-maintained knowledge base
├── docker-compose.yml
└── nginx.conf
```
## Owner password

The owner password is read from the environment variable `COZYROOM_OWNER_PASSWORD` (k8s: Secret `cozyroom-owner`, key `password`, see `k8s/secret.yaml.example`). It is never in code, in the frontend bundle or in docs. Unset or empty means every owner endpoint refuses (fail closed). The browser asks the server (`GET /api/owner/check`, header `X-Owner-Password`); a password in a URL is not accepted. Wrong tries wait 500 ms and are capped at 10 per minute per client (then 429).
