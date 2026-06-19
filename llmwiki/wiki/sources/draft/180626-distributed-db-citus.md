---
name: 180626-distributed-db-citus
type: draft
status: implemented
tags: architecture, distributed-db, citus, postgres, k8s
date: 2026-06-18
implemented: 2026-06-18
---

# Distributed Database — Citus trên 3 physical nodes

**Status:** proposed
**Sequence diagram (hoạt họa):** [html/180626-distributed-db-citus-seq.html](../../../html/180626-distributed-db-citus-seq.html)

## Tóm tắt

Thay thế Postgres StatefulSet trong K8s pod bằng **Citus distributed Postgres** chạy trực tiếp trên 3 physical nodes (Docker on node, không phải K8s-managed). Mỗi node giữ 1 phần data. Tất cả backends kết nối vào coordinator và thấy 1 DB duy nhất.

---

## Các tiếp cận sai — loại trừ

| # | Tiếp cận | Lý do loại |
|---|----------|------------|
| ❌1 | Streaming replication | Copy toàn bộ data — nhân bản không phải phân tán |
| ❌2 | Separate DB per service | Data split, không có unified view |
| ❌3 | DB trong K8s pod | User reject |
| ❌4 | Single centralized Postgres | Không distributed, SPOF |
| ❌5 | Manual routing trong app code | Coupling cứng, app phải biết topology |
| ❌6 | FDW thuần | Query planning kém, không true sharding |

---

## Kiến trúc đề xuất

```
Physical Node 1 (192.168.x.1 / Tailscale)
  └── Docker: citus-coordinator + citus-worker-1
        Postgres port 5432 exposed on host

Physical Node 2 (192.168.x.2 / Tailscale)
  └── Docker: citus-worker-2
        Postgres port 5432 exposed on host

Physical Node 3 (192.168.x.3 / Tailscale)
  └── Docker: citus-worker-3
        Postgres port 5432 exposed on host

K8s Backend pods → connect to Node-1:5432 (coordinator)
                 → thấy 1 DB duy nhất
```

### Phân loại bảng

| Loại | Bảng | Lý do |
|------|------|-------|
| **Distributed** (sharded by hash) | `tracks`, `albums`, `lyrics`, `ebooks`, `comics`, `playback_progress` | Data lớn, sharding giúp phân tải |
| **Reference** (replicated to all nodes) | `playlists`, `playlist_tracks`, `settings`, `artists`, `lyrics_cache` | Data nhỏ, cần join nhanh với distributed tables |

Distribution column: `id` (hash-based sharding)

---

## Plan

- [ ] Task 1: Xác định IP/hostname 3 physical nodes + kiểm tra Citus docker image availability
- [ ] Task 2: Deploy Citus coordinator trên Node-1 (Docker on host, port 5432)
- [ ] Task 3: Deploy Citus workers trên Node-2 và Node-3, đăng ký vào coordinator
- [ ] Task 4: Tạo schema (distributed + reference tables) trên coordinator
- [ ] Task 5: Migrate data từ K8s Postgres → Citus coordinator (pg_dump → COPY với sharding key)
- [ ] Task 6: Cập nhật K8s backend DB_URL → trỏ vào coordinator (Node-1 host IP)
- [ ] Task 7: Verify unified view — query từ 2 backend khác nhau cho cùng kết quả

## Agent Task Assignment

| Task | Agent (CLI) | Lý do chọn | Status |
|------|-------------|------------|--------|
| Task 1: Xác định nodes | Claude main | Cần kubectl + docker inspect | done |
| Task 2: Deploy coordinator | Claude main | Cần write docker-compose + kubectl | done |
| Task 3: Deploy workers | Claude main | Cần access vào cả 3 nodes | done |
| Task 4: Tạo schema | Claude main | SQL DDL + Citus-specific commands | done |
| Task 5: Migrate data | Claude main | pg_dump + kubectl + COPY | done |
| Task 6: Update backend config | Claude main | Edit K8s ConfigMap/Secret | done |
| Task 7: Verify | Claude main | Smoke test qua live API | done |

## Files sẽ tạo/sửa

| File | Action | Lý do |
|------|--------|-------|
| `infra/citus/docker-compose.coordinator.yml` | create | Citus coordinator config cho Node-1 |
| `infra/citus/docker-compose.worker.yml` | create | Citus worker config cho Node-2/3 |
| `infra/citus/init.sql` | create | Schema + distribute_table() calls |
| `infra/citus/migrate.sh` | create | Data migration script |
| `k8s/backend.yaml` | modify | DB_URL → coordinator host |

## Risks

- **Coordinator SPOF**: Node-1 down → coordinator inaccessible → all queries fail. Mitigation: Citus HA coordinator (2 coordinators) — có thể add sau.
- **Cross-shard joins**: Queries join distributed tables sẽ chậm hơn local joins. Mitigation: Reference tables cho các bảng join thường xuyên.
- **Migration downtime**: pg_dump + COPY sẽ cần maintenance window ngắn.
- **Tailscale latency**: Cross-node queries có thêm ~1-2ms latency. Acceptable cho music app.

## Origin

- **Draft:** `wiki/sources/draft/180626-distributed-db-citus.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
