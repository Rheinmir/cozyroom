---
type: concept
title: K3s infra topology
tags: [infra, k3s, kubectl, prometheus, grafana]
timestamp: 2026-07-19
---

# K3s infra topology
**Type:** concept
**Tags:** infra, k3s, kubectl, prometheus, grafana

WSL2 distro `Ubuntu-22.04` trên máy Windows chạy Claude Code **chính là node control-plane k3s** (`rhein-13700hxes-4070-64-4t`, Tailscale IP `100.88.197.64`) — `kubectl` chạy được thẳng từ trong đó qua `wsl bash -c "kubectl ..."`, không cần SSH (không key nào hoạt động cho user `rhein`/`ubuntu`).

3 node thật (`kubectl get nodes`):
- `rhein-13700hxes-4070-64-4t` (100.88.197.64) — control-plane, Ready, chính là WSL2 này. `backend.yaml` dùng `nodeSelector` ghim thẳng vào node này.
- `rhein-k8s-s2-2698bv3-k620-8-128` (100.114.107.68) — worker, Ready. Chạy Prometheus dạng Docker Compose độc lập (không phải trong k3s) ở port 9090, config `/home/rhein/monitoring/prometheus.yml`, reload bằng `docker kill -s HUP prometheus`.
- `rhein-e2144g-p630-16-256` (100.97.8.41) — NotReady (chưa hồi sinh).

Grafana chạy trên **node master** (100.88.197.64:3001) — khác host với Prometheus (100.114.107.68:9090), dù tài liệu cũ ngụ ý chung 1 host `network_mode: host`. Pushgateway sống ở `100.88.197.64:9091`, dùng được như kênh đẩy metric hợp lệ khi không scrape trực tiếp được (ví dụ kubelet cadvisor cần bearer-token chưa cấu hình).

## Notes
- [[Stream observability findings]] — chi tiết những gì tìm được khi dùng đường truy cập này để sửa quan sát hệ thống

## Origin
- **Source:** ghi nhận trực tiếp qua `kubectl`/`docker` trên WSL2, phiên 2026-07-19
- **Commit:** _(concept page, không gắn 1 commit code cụ thể)_
- **Date:** 2026-07-19
