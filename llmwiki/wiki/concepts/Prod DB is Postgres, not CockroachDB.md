---
type: concept
title: "Prod DB is Postgres, not CockroachDB"
tags: [database, postgres, cockroachdb, infra]
timestamp: 2026-08-02
---

# Prod DB is Postgres, not CockroachDB
**Type:** concept
**Tags:** database, postgres, cockroachdb, infra

`k8s/db-adapter.yaml` mô tả 1 HAProxy round-robin đứng trước 3 node CockroachDB bare-metal (comment trong file trỏ tới `100726-cockroachdb-migration-db.md`), nhưng tính tới 2026-08-02, Deployment `db-adapter` **thực tế đang chạy** trong cluster là `pgbouncer/pgbouncer:latest` — cuộc migration đã bị rollback (theo đúng comment "ROLLBACK" trong chính file yaml), và production là **PostgreSQL 16.14** thật. ConfigMap `db-adapter-haproxy-config` là rác còn sót lại từ lần thử nghiệm đã bỏ, pgbouncer đang chạy không hề dùng tới nó.

**Vì sao phát hiện:** trong lúc sửa search tiếng Việt có dấu, viết fix theo cú pháp CockroachDB (kiểu `STRING`, các quirk của `CREATE FUNCTION`) vì tin vào file yaml, deploy xong thì lỗi `type string does not exist` vì Postgres không có kiểu `STRING`. Mất nguyên 1 vòng debug đuổi theo giả thuyết sai "1 node CockroachDB nào đó không khoẻ" trước khi nhận ra tiền đề ban đầu đã sai.

**Cách áp dụng:** trước khi viết bất kỳ SQL đặc thù theo engine nào (khác biệt cú pháp/kiểu dữ liệu/extension giữa CockroachDB và Postgres) cho project này, luôn xác minh **image đang chạy thật**, không tin file yaml trên đĩa: `kubectl get deployment db-adapter -n cozyroom-k8s -o jsonpath='{.spec.template.spec.containers[0].image}'`. Đừng suy luận trạng thái hạ tầng thật từ comment, tên file (hậu tố `.postgres-backup` vẫn còn từ config cũ), hay tài liệu đề xuất migration trong wiki — những thứ đó mô tả ý định/lịch sử, không nhất thiết là trạng thái đang chạy thật.

## Notes
- Liên quan tới [[Cozyroom is single-tenant]] — cùng đợt research schema DB thật

## Origin
- **Source:** debug thật lỗi search tiếng Việt trên production, 2026-08-02
- **Commit:** _(xem git log quanh fix search Vietnamese-diacritic, 2026-08-02)_
- **Date:** 2026-08-02
