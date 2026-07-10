---
type: draft
title: Chuyển database Cozyroom từ PostgreSQL sang CockroachDB (distributed, multi-active, không master-slave)
status: proposed
tags: [cockroachdb, database, distributed, migration, ha, k3s]
timestamp: 2026-07-10
---

# 100726-cockroachdb-migration-db
**Type:** draft
**Status:** proposed
**Tags:** cockroachdb, database, distributed, migration, ha
**Proposed:** 2026-07-10
**Sequence diagram:** [html/100726-cockroachdb-migration-seq.html](../../../html/100726-cockroachdb-migration-seq.html)

## What
Thay PostgreSQL primary/standby bằng **CockroachDB cluster 3 node** (Postgres wire-compatible, multi-active qua Raft consensus) — xoá bỏ mô hình master-slave mà user đã tuyên bố "tệ nhất" ([[200626-db-antipattern]]), mọi node đều đọc/ghi được, mất 1 node app vẫn sống.

## Định vị so với proposal BASE (100726-base-architecture-be-fe)

CockroachDB **không phải BASE** — nó là **CP** trong CAP (serializable, strong consistency), nhưng đạt availability bằng **replication + Raft**: mất 1/3 node vẫn phục vụ đầy đủ, không cần promote tay như Postgres standby hiện tại. Hai proposal giải cùng một nỗi đau (DB SPOF) bằng hai triết lý khác nhau:

| | BASE app-layer (draft trước) | CockroachDB (draft này) |
|---|---|---|
| DB chết 1 node | app serve stale + queue write | **không có gì xảy ra** — cluster vẫn đọc/ghi |
| Mất quorum (2/3 node) | vẫn serve stale + queue | sập (CP) |
| Consistency | eventual (stale reads) | strong (serializable) |
| Code backend | +2 package mới | ~1 file sửa (advisory lock) |
| Ops | không đổi hạ tầng | +cluster 3 node, cần node 3 sống lại |

→ Draft BASE **tạm park** chờ user quyết: CockroachDB thay thế phần "DB HA"; softstate/outbox chỉ còn giá trị nếu muốn chống cả kịch bản mất quorum.

## Audit tương thích (đã quét code thật)

| Điểm | Hiện trạng | CockroachDB | Kết luận |
|------|-----------|-------------|----------|
| Driver | `database/sql` + pgx/v5 stdlib, `DATABASE_URL` env | wire-compatible | ✅ đổi connection string là chạy |
| Search | `ILIKE` thuần (`search.go`, `track.go`, `registry.go:1195`) | hỗ trợ native | ✅ không đổi query |
| `CREATE EXTENSION pg_trgm` (`db/db.go:26`) | đã tolerate lỗi (chỉ log) | không có CREATE EXTENSION | ✅ tự fallback, không sửa |
| Schema `migrate()` | CREATE TABLE IF NOT EXISTS, TEXT PK, FK, `EXTRACT(EPOCH...)` | hỗ trợ đủ | ✅ app tự tạo schema trên CRDB |
| **Advisory lock** (`enricher/aitrends.go:95,103`) | `pg_try_advisory_lock(hashtext(...))` | **KHÔNG hỗ trợ** (cả `hashtext`) | ❌ **phải thay** bằng lease table |
| Isolation | Postgres read committed | CRDB mặc định serializable → lỗi retry `40001` khi contention | ⚠️ cần retry helper hoặc `READ COMMITTED` (CRDB ≥23.2) |
| `sslmode=disable` | homelab nội bộ | CRDB insecure mode tương đương | ✅ giữ (đã chấp nhận trước đó) |

## Affected

| File / Symbol | How it changes |
|---------------|---------------|
| `backend/internal/enricher/aitrends.go` | Thay advisory lock bằng lease table `enrich_lease` (INSERT ON CONFLICT + expiry timestamp) — vẫn chặn được 3 pod chạy trùng EnrichWithAI ([[220626-trending-ai-dedup-lock]]) |
| `backend/internal/db/db.go` | Thêm bảng `enrich_lease` vào `migrate()`; thêm helper retry lỗi `40001` cho write path (hoặc set session `READ COMMITTED`) |
| `k8s/crdb-*.yaml` hoặc script bare-metal (MỚI) | CockroachDB 3 node — topology theo Quyết định 1 bên dưới |
| `k8s/db-adapter.yaml` | PgBouncer → HAProxy round-robin 3 CRDB node (PgBouncer chỉ trỏ 1 host); giữ nguyên tên Service `db-adapter` |
| `k8s/backend.yaml` | `DATABASE_URL` giữ nguyên host `db-adapter` — chỉ đổi port nếu dùng 26257 |
| `k8s/postgres.yaml`, `postgres-standby.yaml` | **KHÔNG XOÁ** — Postgres giữ nguyên làm fallback đến khi verify xong (rule bảo vệ DB trong CLAUDE.md) |

## Quyết định — ✅ USER ĐÃ CHỐT (2026-07-10, xem [[100726-ha-decisions-proscons]])

**Quyết định 1 — Topology: ✅ 1A — Bare metal trên 3 host WSL2, nối qua Tailscale.** CRDB chạy systemd trực tiếp từng host (tự dậy theo máy — hợp nhịp restart hàng tuần); K8s chỉ giữ Service/Endpoints trỏ ra 3 Tailscale IP. Khớp ADR [[200626-db-antipattern]].

**Quyết định 2 — Isolation: ✅ 2B — Giữ SERIALIZABLE + retry helper 40001.** User chọn mức consistency mạnh nhất, chấp nhận thêm code. Hệ quả scope T1 mở rộng: viết helper `db.WithRetry(fn)` bắt lỗi `40001`/`CR000` retry với backoff, và **wrap toàn bộ write path** — scanner upsert, cron enrichment, playlists, progress, AI logs, outbox flusher (khi BASE làm sau). Điểm phải cẩn thận: transaction phải idempotent-trong-retry (không side-effect ngoài DB bên trong closure retry).

## Thực tế vận hành (user, 2026-07-10) — HA quan trọng hơn tưởng

> "Cả 3 máy hàng tuần vẫn có thể restart vài ngày — không down toàn bộ, down vài máy."

Node nghỉ **vài ngày là chuyện thường tuần**, không phải sự cố hiếm. Hệ quả xếp theo mức nghiêm trọng:
1. **Backend là SPOF số 1, không phải DB:** `k8s/backend.yaml` hiện `replicas: 1` + `nodeSelector` khoá cứng node 1 — node 1 nghỉ là toàn app chết vài ngày, CRDB 3 node cũng vô nghĩa. Fix bắt buộc đi kèm: NFS cross-mount media (Quyết định 5A của [[100726-db-health-websocket-be-fe]]) → gỡ nodeSelector → `replicas ≥ 2` spread node. Backend phải sống miễn còn ≥1 máy.
2. **CRDB RF=3 chịu đúng 1 máy nghỉ.** 2/3 máy nghỉ chồng lấn = mất quorum = DB down toàn bộ. Với tần suất nghỉ như trên, kịch bản này là thường trực chứ không lý thuyết → (a) restart nên xếp lịch so le (1 máy/lần), (b) **un-park draft BASE** [[100726-base-architecture-be-fe]] làm lớp đỡ khi mất quorum: app vẫn browse (serve-stale) + nhận soft-write (outbox). CRDB lo HA khi mất 1 máy, BASE lo sống sót khi mất 2.
3. **cloudflared ×2 đã ổn** (chịu 1 máy nghỉ). Media trên máy nghỉ → ẩn theo cơ chế health/hide — đúng thiết kế.

## Risks

- **⛔ Precondition cứng: node thứ 3.** `rhein-e2144g` đang NotReady ([[160626-db-architecture-review]]). CRDB 2 node = **không chịu được mất node nào** (Raft cần quá bán). Chưa hồi sinh node 3 (hoặc thêm máy khác) thì migration này chỉ đổi SPOF lấy SPOF. Phải xử lý trước T2.
- **WSL2 clock skew:** CRDB tự kill node khi lệch giờ >500ms; WSL2 nổi tiếng trôi clock sau sleep. Bắt buộc bật time-sync (systemd-timesyncd/ntp) cả 3 host trước khi join cluster — đưa vào checklist T2.
- **Tài nguyên:** CRDB nặng hơn `postgres:16-alpine` đáng kể (khuyến nghị ≥2GB RAM/node, `--cache .25 --max-sql-memory .25` cho homelab).
- **Mất dữ liệu khi migrate:** chống bằng nguyên tắc **copy-không-move** — Postgres nguyên vẹn, import vào CRDB, đối chiếu row counts từng bảng, chỉ switch traffic sau khi khớp. Không bao giờ đụng PVC `k8s-pgdata`.
- **Backup đổi công cụ:** pg_dump → `cockroach sql --execute BACKUP` (hoặc dump qua psql-compat). Cron backup hiện có (nếu có) phải cập nhật.
- **Ghi trùng enrich:** lease table thay advisory lock có ngữ nghĩa khác (lock hết hạn theo TTL thay vì theo session) — TTL phải > thời gian chạy EnrichWithAI tối đa.

## Plan

- [x] **T1 — Code compat (scope theo QĐ2B): ✅ XONG 2026-07-10.** Kết quả verify trên CRDB v24.1.31 (Docker single-node, ephemeral): migrate() sạch; lease 4 bước pass (acquire→block→release→re-acquire, app-level negative path chứng minh E2E qua log "lease held by another pod"); contention test PASS (2 txn đụng nhau → 40001 thật → Transact retry → v=2 đúng serializable); backend smoke: stats/artists/search 200, trending ghi 14 repos qua Transact mới, scanner qua Transact OK. Files: `db/retry.go` + `retry_test.go` + `retry_crdb_test.go` (gated CRDB_TEST_URL) mới; `rebind.go` (Exec auto-retry), `db.go` (enrich_lease), `aitrends.go` (lease), `scanner.go` ×3, `github.go`, `ai.go`, `ebook.go` wrap. Lưu ý: `backup_test.go` là test SQLite-era đã hỏng từ trước — đánh dấu t.Skip + fix compile, không xoá. (a) thay advisory lock trong `aitrends.go` bằng lease table (`enrich_lease`: key, holder, expires_at; INSERT ON CONFLICT DO UPDATE WHERE expires_at < now()); (b) thêm bảng vào `migrate()`; (c) viết `db.WithRetry(fn)` bắt 40001 + backoff, wrap toàn bộ write path (scanner, cron, playlists, progress, AI logs) — audit từng call site, closure không được có side-effect ngoài DB. Verify: backend full smoke against CRDB single-node local (docker) chạy SERIALIZABLE, search/scan/playlists/trending OK; test ép 2 transaction đụng nhau → retry thành công không lộ lỗi ra ngoài.
- [ ] **T2 — Dựng cluster 3 node bare metal (QĐ1A):** systemd unit `cockroach.service` từng host (auto-start theo máy, thêm vào boot script WSL2 sẵn có); checklist: time-sync 3 host, node 3 sống, join qua Tailscale, `cockroach init`, K8s Service `db-adapter` Endpoints trỏ 3 Tailscale IP:26257, health `/#/overview` 3 node xanh. Verify: kill thử 1 node → cluster vẫn nhận query; reboot 1 máy → CRDB tự dậy theo máy.
- [ ] **T3 — Migrate data (copy-không-move):** app tự tạo schema trên CRDB qua `migrate()`; `pg_dump --data-only` → import; đối chiếu `SELECT count(*)` từng bảng Postgres vs CRDB khớp 100%. Postgres không đụng.
- [ ] **T4 — Switch traffic:** `db-adapter` PgBouncer → HAProxy trỏ 3 CRDB node (giữ tên Service — backend `DATABASE_URL` không đổi host); rollout backend; smoke prod music.giatbh.io.vn. Rollback = trỏ db-adapter về `postgres:5432` (1 lệnh).
- [ ] **T5 — Chaos verify HA thật:** tắt 1 CRDB node → site sống, browse + write OK, không cần thao tác tay; bật lại → node tự rejoin, ranges rebalance. Ghi kết quả vào wiki (điều Postgres primary/standby chưa bao giờ làm được — đóng nốt Task 4 còn pending của [[160626-db-architecture-review]]).

## Agent Task Assignment

| Task | Agent (CLI) | Lý do chọn | Status |
|------|-------------|------------|--------|
| T1 — code compat (lease table, isolation) | Claude main (claude-fable-5) | Sửa shared code `db.go` + concurrency semantics dễ sai âm thầm | pending |
| T2 — dựng cluster 3 node | Claude main (claude-fable-5) + user | Đụng hạ tầng thật (3 host, Tailscale, time-sync), cần user xác nhận từng bước | pending |
| T3 — migrate data | Claude main (claude-fable-5) + user giám sát | Đụng production data — rule CLAUDE.md bắt buộc user confirm, copy-không-move | pending |
| T4 — switch traffic | Claude main (claude-fable-5) | Đổi db-adapter + rollout, cần rollback plan sẵn | pending |
| T5 — chaos verify | Claude main (claude-fable-5) + user | Kill node thật trên cluster đang chạy | pending |

Tất cả trên một agent: chuỗi task phụ thuộc tuần tự chặt (compat → cluster → data → switch → verify), context migration phải liền mạch; tách agent rẻ không tiết kiệm được gì vì phần lớn công việc là hạ tầng + verify, không phải sinh code khối lượng lớn. HTML seq page do Claude render trực tiếp (standalone `/propose`).

## Success criteria

- Backend chạy trên CRDB: toàn bộ smoke pass (search ILIKE, scan, playlists, trending enrich với lease table, AI chat) — không sửa query nào ngoài `aitrends.go`.
- Row counts mọi bảng CRDB == Postgres tại thời điểm cutover; Postgres còn nguyên vẹn, rollback 1 lệnh.
- Tắt 1 trong 3 CRDB node: site vẫn browse + write bình thường, **không thao tác tay** (khác hẳn primary/standby hiện tại phải promote tay).
- Node bật lại tự rejoin, cluster báo healthy.
- Không còn `pg_advisory_lock` trong codebase; enrich vẫn chống chạy trùng (3 pod, chỉ 1 chạy).

## Notes
- [[100726-base-architecture-be-fe]] — proposal BASE app-layer, tạm park chờ user quyết sau khi CRDB xong
- [[160626-db-architecture-review]] — chẩn đoán SPOF gốc; CRDB chính là "Pattern B true distributed" nhưng mua sẵn thay vì tự build adapter
- [[200626-db-antipattern]] — triết lý user: DB bare metal, ghét master-slave → CRDB multi-active xoá hẳn khái niệm master
- [[220626-trending-ai-dedup-lock]] — advisory lock sẽ bị thay bằng lease table
- [[CapConsistency]] — lưu ý: CRDB là CP, không phải A; availability đạt qua replication

## Origin
- **Draft:** `wiki/sources/draft/100726-cockroachdb-migration-db.md`
- **Source:** yêu cầu user 2026-07-10: "chuyển db sang cockroach" (redirect từ proposal BASE cùng ngày)
- **Commit:** _(filled by `verify-before-commit`)_
- **Date promoted:** _(filled by `verify-before-commit`)_
