# Proposal: Migrate SQLite → PostgreSQL (separate container)

**Date:** 2026-05-28  
**Status:** draft  
**Trigger:** SQLite single-file không có backup guarantee; irreplaceable user data (playlists, chat logs, agent memory, progress, scheduled tasks) đã mất khi WSL distro chết.

---

## Problem

SQLite lưu tất cả data trong một file `/data/metadata.db`:
- **Rebuildable** (scan cache): artists, albums, tracks, videos, lyrics_cache, comics_cache
- **NOT rebuildable** (user data): playlists, chat_logs, agent_memory, playback_progress, ebooks.progress, trending_daily AI enrichments, scheduled_tasks

Không có backup strategy. File mount vào WSL filesystem — khi distro die, data die.

---

## Goal

Thay SQLite bằng PostgreSQL chạy trong container riêng. Postgres có proper backup (pg_dump, WAL, point-in-time recovery), persistent volume, và không phụ thuộc WSL distro lifecycle.

---

## Scope

### Files thay đổi

| File | Action |
|------|--------|
| `docker-compose.yml` | Thêm `postgres` service + named volume |
| `backend/go.mod` | Replace `modernc.org/sqlite` → `pgx/v5` + `pgx/stdlib` |
| `backend/internal/db/db.go` | Rewrite: pgx connection, migrations via SQL |
| `backend/internal/repository/sqlite/*.go` (13 files) | Rename dir → `postgres/`, rewrite SQL |
| `backend/cmd/server/main.go` | Đổi DB_PATH env → DATABASE_URL |
| `llmwiki/wiki/concepts/Architecture.md` | Update sau khi commit |

### Files KHÔNG thay đổi

- `backend/internal/domain/` — interface đã clean, giữ nguyên
- `backend/internal/api/` — handlers không touch DB trực tiếp
- `frontend/` — không liên quan
- `nginx.conf`, `Dockerfile.frontend` — không liên quan

---

## Implementation plan

### Step 1 — Docker Compose: thêm postgres service

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: cozyroom
      POSTGRES_USER: cozyroom
      POSTGRES_PASSWORD: cozyroom
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cozyroom"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    ...
    environment:
      DATABASE_URL: "postgres://cozyroom:cozyroom@postgres:5432/cozyroom?sslmode=disable"
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  pgdata:
```

### Step 2 — Go driver

Replace `modernc.org/sqlite` → `github.com/jackc/pgx/v5` + `github.com/jackc/pgx/v5/stdlib` (dùng `database/sql` interface giữ nguyên).

### Step 3 — SQL syntax migration

| SQLite | PostgreSQL |
|--------|-----------|
| `INSERT OR IGNORE INTO t ...` | `INSERT INTO t ... ON CONFLICT DO NOTHING` |
| `INSERT OR REPLACE INTO t ...` | `INSERT INTO t ... ON CONFLICT (id) DO UPDATE SET ...` |
| `unixepoch()` | `EXTRACT(EPOCH FROM NOW())::INTEGER` |
| `PRAGMA busy_timeout` | Remove |
| `TEXT PRIMARY KEY` | `TEXT PRIMARY KEY` (same) |
| FTS5 virtual table | `pg_trgm` extension + `GIN` index |
| `VACUUM INTO` | `pg_dump` |

### Step 4 — Search migration (search.go)

SQLite dùng FTS5. Postgres dùng `pg_trgm`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_tracks_title_trgm ON tracks USING GIN (title gin_trgm_ops);
CREATE INDEX idx_artists_name_trgm ON artists USING GIN (name gin_trgm_ops);
CREATE INDEX idx_albums_title_trgm ON albums USING GIN (title gin_trgm_ops);
```

Query: `WHERE title ILIKE '%' || $1 || '%'` — đủ tốt cho personal library scale.

### Step 5 — db.go migrations

Thay additive ALTER TABLE pattern bằng proper migration sequence với `IF NOT EXISTS` / `IF NOT EXISTS` guard. Giữ `CREATE TABLE IF NOT EXISTS` cho idempotency.

### Step 6 — Backup strategy (bonus, sau migrate)

```bash
# Daily pg_dump vào /data/backups/
pg_dump -U cozyroom cozyroom > /data/backups/cozyroom_$(date +%Y%m%d).sql
```

Có thể thêm cronjob trong postgres container hoặc sidecar.

---

## Data migration

WSL data đã mất → **start fresh**. Không cần migration script. Library rescan sẽ rebuild scan cache. User data (playlists, history) không còn để migrate.

---

## Risk

| Risk | Mitigation |
|------|-----------|
| pgx/stdlib khác `modernc` edge cases | Test với `database/sql` wrapper — interface giống nhau |
| FTS5 → pg_trgm search quality | ILIKE đủ cho personal library; upgrade tsvector sau nếu cần |
| `INSERT OR REPLACE` semantics khác Postgres | Verify từng repo file, đặc biệt tracks (preserve cover_path) |
| Postgres cold start race condition | `depends_on: condition: service_healthy` với healthcheck |

---

## Tasks (sau khi duyệt)

1. `docker-compose.yml` — thêm postgres service + pgdata volume
2. `go.mod` — swap driver
3. `db.go` — rewrite connection + migrations
4. `repository/postgres/` — tạo folder, migrate 13 files (SQL syntax)
5. `cmd/server/main.go` — env var DATABASE_URL
6. Test: `docker compose up --build`, verify `/api/health`, `/api/artists`
7. Wiki update: Architecture.md

---

## Origin

- **Trigger:** User request 2026-05-28 — SQLite không đủ tốt, data mất khi WSL die
- **Decision:** PostgreSQL 16 Alpine, pgx/v5 driver, pg_trgm cho search
