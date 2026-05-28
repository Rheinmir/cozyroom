# Cozyroom

Self-hosted personal media streaming — music, video, comics & ebooks from your local library.

**Stack:** Go backend · React/TypeScript frontend · SQLite metadata · Docker/WSL2

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
go mod tidy          # downloads modernc.org/sqlite, github.com/dhowden/tag
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

## Docker (production-like)

```bash
# 1. Build the frontend into backend/dist/
cd frontend && npm install && npm run build && cd ..

# 2. Start the container
docker compose up --build
# → http://localhost:8080
```

> Adjust the media paths in `docker-compose.yml` if your library is not at default locations:
> ```yaml
> - /mnt/d/Music:/music:ro   # change /mnt/d/Music to your WSL2 path
> ```

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/artists` | List all artists |
| GET | `/api/albums` | List all albums |
| GET | `/api/tracks` | List all tracks |
| GET | `/stream/{id}` | Stream audio file (supports Range) |

---

## Project layout

```
cozyroom/
├── backend/
│   ├── cmd/server/main.go        entry point
│   ├── internal/
│   │   ├── api/                  HTTP handlers + router
│   │   └── db/                   SQLite open + migrations
│   ├── dist/                     built frontend (git-ignored)
│   ├── go.mod
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx               landing page / health indicator
│   │   ├── main.tsx              React + QueryClient bootstrap
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.ts            proxies API, builds into backend/dist
│   └── package.json
├── data/                         SQLite DB (git-ignored)
├── docker-compose.yml
└── wiki/                         agent-maintained knowledge base
```