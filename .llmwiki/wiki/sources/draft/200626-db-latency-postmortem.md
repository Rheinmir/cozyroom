# 200626-db-latency-postmortem
**Type:** draft
**Status:** proposed
**Tags:** docs-site-macos, postmortem, output-report
**Proposed:** 2026-06-20

## What
Postmortem về sự cố site down do HAProxy routing DB connections qua Tailscale IP bị broken — chẩn đoán + 4 fixes trong 1 session.

## Output
- HTML dashboard: `llmwiki/html/200626-db-latency-postmortem.html`
- 5 sections: triệu chứng timeline, root cause SVG (broken vs fixed path), chuỗi sự kiện, 4 bản vá (before/after), kết quả KPI + pod status table

## Root Cause
`db-adapter` HAProxy config routing tới `100.88.197.64:5432` (Tailscale IP) — Postgres không expose port này, chỉ accessible qua K8s service `postgres:5432`. Mỗi DB query timeout sau 60s.

## Fixes Applied
| Fix | File | Change |
|-----|------|--------|
| HAProxy route | `k8s/db-adapter.yaml` | `100.88.197.64:5432` → `postgres:5432` |
| Node affinity | `k8s/db-adapter.yaml` | NotIn: rhein-e2144g (broken networking) |
| stats query | `backend/internal/repository/postgres/stats.go` | 3 COUNT(*) → 1 subquery |
| artistDetail | `backend/internal/repository/postgres/artist.go` | 3 queries → 1 LEFT JOIN |

## Files
| File | Action |
|------|--------|
| `llmwiki/html/200626-db-latency-postmortem.html` | created |
| `llmwiki/wiki/sources/draft/200626-db-latency-postmortem.md` | created |

## Notes
- Invoked via: `/docs-site-macos` skill
- Commits: 731c79b, 7271417, 7c9cc5c

## Origin
- **Draft:** `wiki/sources/draft/200626-db-latency-postmortem.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
