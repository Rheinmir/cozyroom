---
type: source
title: Flannel cross-node partition postmortem - k8s-s2 mat flannel.1
tags: [incident, postmortem, k3s, flannel, network, k8s-s2]
timestamp: 2026-08-16
---

# 160826-flannel-crossnode-partition-postmortem
**Type:** source
**Tags:** incident, postmortem, k3s, flannel, network, k8s-s2

## Triệu chứng
- `postgres-standby-0` kẹt ở `Init:0/1` suốt 25h — init container loop `pg_isready -h <primary ClusterIP>` không bao giờ thành công dù primary (`postgres-0`) hoàn toàn khoẻ.
- `cloak-proxy` không TCP-dial được từ backend (`i/o timeout`), phát hiện qua tool `/debug` (`GET /api/debug/services`) vừa xây trong cùng phiên.

## Root cause
2 node vật lý khác nhau trong cluster (`rhein-13700hxes-4070-64-4t` — control-plane, và `rhein-k8s-s2-2698bv3-k620-8-128` — worker, nối qua Tailscale mesh, kernel khác hẳn xác nhận là máy vật lý riêng) mất kết nối overlay network 2 chiều ở đúng cặp node này — không phải lỗi network toàn cluster, không phải lỗi từng service riêng lẻ.

Xác nhận bằng chứng cụ thể:
- `kubectl describe node` báo `Ready`, không `MemoryPressure`/`DiskPressure` — kubelet/control-plane traffic (qua Tailscale) vẫn sống bình thường.
- Trên master: interface `flannel.1` (VXLAN) tồn tại, route đúng tới subnet của `k8s-s2` (`10.42.2.0/24 via flannel.1`).
- Trên `k8s-s2`: **`flannel.1` hoàn toàn không tồn tại** ("Device flannel.1 does not exist"), dù `k3s-agent` khởi động với `--flannel-iface=tailscale0` và process vẫn "active" (uptime node 11 ngày, KHÔNG hề reboot).
- Kết luận: tiến trình `k3s-agent` cha còn sống, nhưng phần Flannel bên trong nó (tạo `flannel.1`, sync route) đã chết/treo âm thầm mà không kéo sập cả service — kubelet vẫn báo Ready nhưng lớp mạng pod-to-pod xuyên node hoàn toàn không có gì nhận gói VXLAN.

## Fix
`sudo systemctl restart k3s-agent` trên node `k8s-s2` (`100.114.107.68`, SSH user `rhein`) — buộc Flannel khởi tạo lại `flannel.1` + đồng bộ lại route.

## Verify
- Trước fix: `nc -zv 10.42.2.45 8765` (pod IP cloak-proxy) → `Operation timed out`; test thêm 1 pod frontend khác cũng trên node đó → timeout y hệt (xác nhận lỗi toàn node, không riêng cloak-proxy).
- Sau fix: `flannel.1` xuất hiện lại trên `k8s-s2`, route `10.42.0.0/24 via flannel.1` + `10.42.3.0/24 via flannel.1` đúng khớp phía master.
- `nc -zv 10.42.2.45 8765` → `open`.
- `GET /api/debug/services` (qua domain thật) → cả 4 service `reachable:true`.
- `postgres-standby-0`: `Init:0/1` (25h) → `1/1 Running` (tự hoàn tất `pg_basebackup` ngay khi network thông).

## Ghi chú quan trọng
- Node này **không hề reboot** (uptime 11 ngày) — sự cố Flannel chết không nhất thiết trùng thời điểm "máy master chết" mà user báo ban đầu, có thể đã tồn tại từ trước đó, chỉ mới bị phát hiện khi build tool `/debug` (xem [[160826-debug-network-page-be-fe]]).
- Công cụ `/debug` mới xây (task khác trong cùng phiên) chính là thứ phát hiện ra `cloak-proxy` unreachable — minh chứng giá trị thực dụng ngay lần đầu dùng.
- Nếu sự cố tái diễn sau lần restart node/master tiếp theo: kiểm tra lại đúng quy trình này (`ip -br link show flannel.1` trên từng node) trước khi nghi ngờ DNS/CoreDNS như các lần trước.

## Origin
- Phát hiện: qua `GET /api/debug/services` (tool mới), điều tra trực tiếp bằng `kubectl`/SSH trong phiên 2026-08-16
- Liên quan: [[K3s infra topology]], [[Stream observability findings]], [[160826-debug-network-page-be-fe]]
