---
type: concept
title: Stream observability findings
tags: [infra, observability, prometheus, grafana, incident]
timestamp: 2026-07-19
---

# Stream observability findings
**Type:** concept
**Tags:** infra, observability, prometheus, grafana, incident

Phát hiện thật từ đợt triển khai observability 2026-07-19 — không phải suy đoán:

- **Backend chạy QoS class BestEffort** (xác nhận qua cgroup path `kubepods-besteffort.slice`) — nghĩa là `backend.yaml` không có `resources.requests/limits` nào. Khi node thiếu CPU/RAM, pod này bị evict trước tiên và schedule lại sau cùng — nguyên nhân hạ tầng thật, khớp với số liệu prod: 213/628 = 34% request `/stream/{id}` mất hơn 10s, `music_stream_errors_total{quality=320kbps}=3`.
- Dashboard Grafana "Cozyroom Infra" (uid `cozyroom-infra-v2`) có **cả 3 datasource Prometheus đăng ký đều trỏ về `localhost:9090`** — không thể truy cập được từ host của Grafana (Prometheus nằm ở node khác, xem [[K3s infra topology]]). Đã sửa datasource mặc định (uid `afoai5tn0ym0wf`) trỏ đúng `100.114.107.68:9090`. **Chưa sửa** (ngoài phạm vi session đó): 13 panel gốc của dashboard vẫn query theo job name cũ (`k8s2-node`, `master-node`, `k8s1-node`, `k8s2-cadvisor`) không còn tồn tại trong `prometheus.yml` — job thật giờ là `node`/`cadvisor` generic + label `instance`.
- `prometheus.yml` có 1 scrape job chết từ trước (`cozyroom-prod`, target `100.88.197.64:18080`) — chưa dọn, không nằm trong phạm vi session đó.
- `cozyroom-secret` không có key `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` — nghĩa là toàn bộ tính năng cảnh báo Telegram của `postgres-monitor.yaml` (và `stream-health-monitor` CronJob mới) chưa từng hoạt động thật, chỉ âm thầm no-op.
- Chuyện "user đặt `replicas: 3`" hoá ra là nói về `frontend` (đúng, 3/3 thật) chứ không phải `backend` (thật ra chỉ 1/1, khớp với git) — không phải bug, chỉ là hiểu nhầm giữa 2 component.

## Notes
- [[K3s infra topology]] — vị trí thật của từng node/service liên quan tới các phát hiện trên

## Origin
- **Source:** `llmwiki/wiki/sources/draft/180726-stream-observability-infra.md` (proposal + kết quả đầy đủ)
- **Commit:** _(xem draft gốc)_
- **Date:** 2026-07-19
