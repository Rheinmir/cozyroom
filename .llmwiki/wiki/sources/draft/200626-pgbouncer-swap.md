# 200626-pgbouncer-swap
**Type:** draft
**Status:** proposed
**Tags:** verify-before-commit, output-report, db-architecture
**Proposed:** 2026-06-20

## What
Swap db-adapter từ HAProxy TCP proxy sang PgBouncer connection pooler để hỗ trợ mục tiêu 3000 user đồng thời.

## Output
- `k8s/db-adapter.yaml` — rewritten: HAProxy → PgBouncer env-var config
- `llmwiki/html/200626-db-antipattern.html` — ADR docs page
- `llmwiki/wiki/sources/draft/200626-db-antipattern.md` — wiki draft

## Key Changes
| Setting | Value | Lý do |
|---------|-------|-------|
| `pool_mode` | `transaction` | Go `database/sql` thả connection sau mỗi query |
| `max_client_conn` | 5000 | Đủ cho 3000 user đồng thời |
| `default_pool_size` | 50 | Postgres thấy tối đa 50 server connections |
| `ignore_startup_parameters` | `extra_float_digits` | Go pq/pgx gửi param này |
| Password source | K8s secret `cozyroom-secret` | Không lưu credential trong ConfigMap |

## Architecture
```
Backend pods (N) → db-adapter:5432 (PgBouncer ×2) → postgres:5432
                     5000 client slots / 50 server conns
```

## Files
| File | Action |
|------|--------|
| `k8s/db-adapter.yaml` | rewritten — HAProxy → PgBouncer |
| `llmwiki/html/200626-db-antipattern.html` | created — ADR docs page |
| `llmwiki/wiki/sources/draft/200626-db-antipattern.md` | created |
| `llmwiki/wiki/index.md` | updated |
| `llmwiki/wiki/log.md` | updated |

## Notes
- Pre-existing vet error in `backend/internal/db/backup_test.go` — không liên quan đến thay đổi này
- Image `pgbouncer/pgbouncer:latest` dùng env vars thay vì config file
- Port mặc định của image là 6432 — phải set `PGBOUNCER_LISTEN_PORT=5432`
- Invoked via: `verify-before-commit` skill

## Origin
- **Draft:** `wiki/sources/draft/200626-pgbouncer-swap.md`
- **Commit:** 7d2a80c — perf: swap db-adapter HAProxy → PgBouncer, pool_mode=transaction
- **Date promoted:** 2026-06-20
