---
type: draft
title: Infographic so sánh kiến trúc DB cluster K8s — cũ (Postgres primary/standby) vs mới (CockroachDB 3-node)
status: proposed
tags: [docs-site-macos, output-report, infographic, cockroachdb, architecture]
timestamp: 2026-07-11
---

# 110726-db-architecture-infographic
**Type:** draft
**Status:** proposed
**Tags:** docs-site-macos, output-report, infographic, cockroachdb, architecture
**Proposed:** 2026-07-11

## What
Infographic HTML (docs-site-macos liquid-glass) so sánh kiến trúc DB cluster K8s **cũ** (Postgres primary/standby, manual failover) vs **mới** (CockroachDB 3-node bare metal, multi-active Raft) — trọng tâm là lợi thế đạt được và cái giá phải trả khi đổi DB.

## Output
7 section: (00) Tổng quan topology — diagram kéo-thả so sánh 2 kiến trúc song song; (01) Failure handling — timeline "node chết thì sao" cũ (phút~giờ, cần người) vs mới (giây, tự động); (02) Consistency model — bảng READ COMMITTED vs SERIALIZABLE+retry; (03) Lợi thế đạt được — 6 card; (04) Cái giá phải trả — 4 card; (05) Rủi ro chưa đóng — bảng mức độ (mất quorum, node 3 chưa ổn định, backend vẫn SPOF #1); (06) Trạng thái hiện tại — checklist 5-phase roadmap.

Nội dung tổng hợp từ 3 proposal đã có trong phiên: `100726-cockroachdb-migration-db.md`, `100726-ha-decisions-proscons.md`, `100726-db-health-websocket-be-fe.md`.

## Files
| File | Action |
|------|--------|
| `llmwiki/html/110726-db-architecture-old-vs-new.html` | created |
| `llmwiki/wiki/sources/draft/110726-db-architecture-infographic.md` | created |

## Notes
- Invoked via: `/docs-site-macos` skill
- Preview: `http://localhost:8765/llmwiki/html/110726-db-architecture-old-vs-new.html`
- [[100726-cockroachdb-migration-db]] · [[100726-ha-decisions-proscons]] · [[100726-db-health-websocket-be-fe]]

## Origin
- **Draft:** `wiki/sources/draft/110726-db-architecture-infographic.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
