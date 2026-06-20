# 200626-db-antipattern
**Type:** draft
**Status:** proposed
**Tags:** docs-site-macos, architectural-decision-record, db-architecture, antipattern
**Proposed:** 2026-06-20

## What
Architectural Decision Record giải thích tại sao DB trong K8s pod là antipattern — bao gồm lịch sử kiến trúc từ SQLite → Postgres → Citus plan → K8s StatefulSet, lý do Tailscale IP tồn tại trong HAProxy config, và kiến trúc DB đúng cho homelab.

## Output
- HTML dashboard: `llmwiki/html/200626-db-antipattern.html`
- 5 sections:
  1. Biên niên kiến trúc — timeline 6 bước với SVG diagrams
  2. Tại sao Tailscale IP tồn tại — SVG broken vs fixed path
  3. DB trong K8s là antipattern — 6 antipattern cards + comparison table
  4. Master-slave: overkill cho homelab — diagram simple vs complex
  5. Kiến trúc đúng — recommendation cards + migration steps

## Key Insight
Tailscale IP `100.88.197.64:5432` trong HAProxy config là DI VẬT từ thiết kế đúng — khi Citus coordinator chạy bare metal, Tailscale IP là cách đúng để reach nó. Vấn đề phát sinh khi Postgres fallback vào K8s pod (không expose Tailscale), nhưng HAProxy config không được cập nhật.

## User Philosophy
- "Tôi chưa bao giờ muốn cho DB vào pod K8s để scale"
- "Tệ nhất là mô hình master-slave"
- DB nên chạy bare metal, stateless apps trong K8s

## Architectural Lineage
| Giai đoạn | DB Location | HAProxy Config | Status |
|-----------|-------------|----------------|--------|
| SQLite | File in Docker | N/A | ✓ Simple |
| Postgres host | Docker on host | host IP | ✓ Correct |
| Plan db-adapter | Bare metal via Tailscale | `100.88.197.64:5432` | ✓ Intended |
| Citus plan (abandoned) | Bare metal coordinator | `100.88.197.64:5432` | ⚠ Abandoned |
| K8s StatefulSet | K8s pod | `100.88.197.64:5432` (stale) | ❌ Config mismatch |
| Fix (tình thế) | K8s pod | `postgres:5432` | ✓ Site up |
| Target | Bare metal | host/Tailscale IP | ✓ Ideal |

## Files
| File | Action |
|------|--------|
| `llmwiki/html/200626-db-antipattern.html` | created |
| `llmwiki/wiki/sources/draft/200626-db-antipattern.md` | created |

## Related
- [[200626-db-latency-postmortem]] — postmortem về outage cụ thể
- [[160626-db-architecture-review]] — thiết kế db-adapter ban đầu
- [[180626-distributed-db-citus]] — Citus plan (abandoned)

## Origin
- **Source:** user conversation 2026-06-20, session 7c2c3cdd-af35-4627-a589-93f3e25da939
- **Commit:** 7d2a80c — perf: swap db-adapter HAProxy → PgBouncer, pool_mode=transaction
- **Date promoted:** 2026-06-20
