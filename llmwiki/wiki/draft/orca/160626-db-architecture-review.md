# 160626-db-architecture-review
**Type:** draft
**Status:** implemented
**Tags:** architecture, database, distributed, adapter, k8s
**Proposed:** 2026-06-16
**Sequence diagram:** [html/160626-db-architecture-seq.html](../../../html/160626-db-architecture-seq.html)

## Vấn đề được đặt ra
> "Chain thiếu 1 con adapter để đọc dữ liệu từ các DB distributed. DB đang làm quá nhiều việc (làm cả việc của adapter) nên nếu chết ở master thì bê con lại cũng chết."

## Chẩn đoán hiện trạng

### Topology hiện tại — SPOF tại master DB
```
Client → CF Tunnel → k8s Service
                         ↓
                  Backend ×3 (NodeSelector: rhein-13700hxes — do media hostPath)
                         ↓  (kết nối trực tiếp — không có adapter layer nào)
                  Postgres PRIMARY  ← làm CẢ 2 việc: lưu trữ + aggregation hub
                         ↓
                  Postgres STANDBY  ← streaming replication, KHÔNG auto-promote
```

**Vấn đề cốt lõi:**
- Postgres primary làm vai trò **storage** lẫn **adapter** (hub tập trung duy nhất)
- Không có layer nào giữa Backend và DB để route/aggregate/failover
- Standby không có auto-failover (không có Patroni/pgpool) → khi primary chết phải promote tay
- Backend 3 pod nhưng đều chỉ serve từ 1 DB master → "HA giả"

### Constraint thực tế
```
rhein-13700hxes: /mnt/f/music, /mnt/f/Films, /mnt/f/Ebooks  ← media CHỈ ở đây
rhein-k8s-s2:   storage riêng, không mount được /mnt/f/
rhein-e2144g:   NotReady
```
Media bị bind vào 1 node vật lý → distributed DB một mình không giải quyết HA thực sự nếu không kèm distributed storage.

### Constraint k8s hiện tại
```
k8s cluster
├── frontend    Deployment ×3  (nodeAffinity: NotIn rhein-e2144g)
├── backend     Deployment ×3  (nodeSelector: rhein-13700hxes — locked vì media hostPath)
├── postgres    StatefulSet    (hostPath: /tmp/k8s-pgdata — DANGER: mất khi reboot!)
└── cloudflared Deployment ×1
```

---

## Kiến trúc đúng — Adapter nằm giữa Backend và DB

> ⚠️ **Adapter KHÔNG phải trước Client** — đó là load balancer/API gateway, không giải quyết DB SPOF.
> Adapter đặt **giữa Backend và các Postgres node**. Backend nói chuyện với Adapter như 1 DB endpoint duy nhất.

### Target topology sau khi implement
```
k8s cluster
├── frontend    Deployment ×N  (không đổi)
├── backend     Deployment ×N  (không đổi — chỉ đổi DB_HOST=db-adapter)
├── db-adapter  Deployment ×N  (NEW — stateless pod, scale horizontal thoải mái)
│                   ↓ route/aggregate
│         ┌─────────────────────────────┐
│         ↓                             ↓
│   Postgres @Node1              Postgres @Node2
│   /var/lib/k8s-pgdata          /var/lib/k8s-pgdata
│   rhein-13700hxes              rhein-k8s-s2
└── cloudflared Deployment ×1  (không đổi)
```

### DB Adapter làm gì
| Responsibility | Mô tả |
|----------------|-------|
| **Query routing** | Track X trên Node nào → gửi query đúng node |
| **Aggregation** | `SELECT * FROM artists WHERE name LIKE '%..%'` → fan out tất cả nodes, merge result |
| **Failover** | Node1 down → không route về đó, trả partial result từ các node còn lại |
| **Health check** | Ping các Postgres node định kỳ, cập nhật routing table |
| **Stateless** | Không giữ session/state → scale horizontal, không tạo SPOF mới |

### Thay đổi với Backend
Chỉ 1 dòng env trong `k8s/backend.yaml`:
```yaml
- name: DB_HOST
  value: db-adapter   # trước là: postgres
```
Không đổi query logic, không đổi schema.

### Thay đổi với Frontend/các service khác
**Không có gì thay đổi.** FE, cloudflared, các service khác giữ nguyên k8s Deployment như bình thường.

---

## Plan

- [ ] **Task 1: Fix ngay — Postgres hostPath `/tmp/` → `/var/lib/`** (data mất khi reboot)
- [ ] **Task 2: Pattern A — Thêm Patroni auto-failover** (ngắn hạn, giảm downtime ngay)
- [ ] **Task 3: Pattern B — Build DB Adapter service** (dài hạn, proper distributed arch)
- [ ] **Task 4: Verify HA thực sự** (kill primary, kiểm tra service còn sống)

## Agent Task Assignment
| Task | Agent | Model | Status |
|------|-------|-------|--------|
| Fix Postgres hostPath | Claude main | claude-sonnet-4-6 | done |
| Thêm auto-promote + Telegram alert | Claude main | claude-sonnet-4-6 | done |
| Build DB Adapter (HAProxy) | Claude main | claude-sonnet-4-6 | done |
| HA verification (chaos test) | Claude main | claude-sonnet-4-6 | pending |

---

## Pattern so sánh

### Pattern A — Patroni auto-failover (ngắn hạn)
```
Backend ×N → HAProxy → Patroni cluster
                           ├── Primary  ←streaming→  Standby
                           └── auto-promote khi Primary chết (~30s)
```
- Thêm Patroni + HAProxy, không rewrite app
- DB vẫn tập trung nhưng không còn single point of failure nhờ auto-promote
- **Effort:** Trung bình | **HA:** DB HA ✓, nhưng chưa distributed

### Pattern B — DB Adapter + mỗi node chạy Postgres riêng (dài hạn) ✅ Recommended
```
Backend ×N → db-adapter ×N (k8s Deployment, stateless)
                  ├→ Postgres @Node1 (/var/lib/k8s-pgdata, rhein-13700hxes)
                  └→ Postgres @Node2 (/var/lib/k8s-pgdata, rhein-k8s-s2)
```
- Adapter stateless → scale ngang, không SPOF mới
- Mỗi node độc lập: Node1 chết → chỉ mất media của Node1
- **Effort:** Cao | **HA:** True distributed ✓

### Pattern C — Bỏ k8s, Docker Compose per node + Nginx upstream
```
Node1: docker compose (backend + postgres) + nginx
Node2: docker compose (backend + postgres) + nginx
Cloudflared → Nginx upstream (round-robin)
```
- Đơn giản nhất về ops, bỏ k8s overhead
- Mất auto-restart, rolling update
- **Effort:** Trung bình | **HA:** Passive HA (failover chậm)

---

## Recommendation

**Giai đoạn 1 (ngắn hạn — làm ngay):**
1. Fix Postgres `hostPath: /tmp/` → `/var/lib/` (ticking time-bomb)
2. Pattern A: thêm Patroni auto-failover
3. Alert Telegram khi Primary down

**Giai đoạn 2 (dài hạn):**
1. Build `db-adapter` service (Go, stateless, Deployment ×N)
2. Mỗi node có Postgres riêng, Adapter giữ routing table
3. Backend chỉ đổi `DB_HOST=db-adapter`

**Pattern C** viable nếu muốn bỏ k8s hoàn toàn, nhưng mất lợi ích orchestration.

## Về câu hỏi "phải dùng DB gì?"
Không phải về loại DB — đây là vấn đề **kiến trúc vai trò**. Postgres là đúng. Chỉ cần tách:
- **DB** = lưu trữ thuần tuý
- **Adapter** = routing + aggregation + failover logic

## Risks
- Pattern B: media distributed cần quyết định — rsync/NFS từ Node1 sang Node2, hoặc chấp nhận partial library per node
- Pattern A (Patroni) thêm complexity k8s nhưng là bước incremental an toàn
- DB Adapter cần implement routing table — đơn giản nhất là static config (track_node_map), phức tạp hơn là dynamic discovery
- `pg_trgm` extension dùng cho full-text search — cần đảm bảo extension có mặt trên cả Postgres @Node2

## Files sẽ tạo/sửa
| File | Action | Lý do |
|------|--------|-------|
| `k8s/postgres.yaml` | sửa | Đổi hostPath `/tmp/` → `/var/lib/` |
| `k8s/postgres-standby.yaml` | sửa | Đổi hostPath `/tmp/` → `/var/lib/` |
| `k8s/db-adapter.yaml` | tạo mới | Deployment + Service cho DB Adapter |
| `backend/cmd/db-adapter/main.go` | tạo mới | Adapter service (Go) |
| `k8s/backend.yaml` | sửa | DB_HOST env: `postgres` → `db-adapter` |

## Origin
- **Draft:** `wiki/draft/orca/160626-db-architecture-review.md`
- **Sequence diagram:** `llmwiki/html/160626-db-architecture-seq.html`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
