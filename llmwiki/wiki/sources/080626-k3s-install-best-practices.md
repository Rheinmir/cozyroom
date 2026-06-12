# K3S Cluster Install: Best Practices & Lessons Learned

**Type:** source
**Date:** 2026-06-08
**Tags:** k3s, kubernetes, cluster, ops, tailscale

## Cluster Topology (This Homelab)

| Node | Tailscale IP | Role | OS |
|------|-------------|------|-----|
| master-wsl2 | 100.88.197.64 | Control plane | Ubuntu WSL2 |
| k8s2 | 100.114.107.68 | Worker | Linux (bare metal/VM) |
| k8s1 | 100.97.8.41 | Standalone Docker host | Ubuntu WSL2 |

K3S runs on master + k8s2. K8S1 is standalone Docker (not K3S worker).

---

## K3S Install

### Master (control plane)
```bash
curl -sfL https://get.k3s.io | sh -
# Get join token
cat /var/lib/rancher/k3s/server/node-token
```

### Worker join
```bash
curl -sfL https://get.k3s.io | K3S_URL=https://<MASTER_IP>:6443 K3S_TOKEN=<TOKEN> sh -
```

### Verify
```bash
kubectl get nodes -o wide
kubectl get pods -A
```

---

## Critical: Network via Tailscale

K3S defaults to using primary NIC IP. In WSL2/multi-home setups, must pin to Tailscale IP.

```bash
# Master - force advertise Tailscale IP
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--node-ip=100.88.197.64 --advertise-address=100.88.197.64 --flannel-iface=tailscale0" sh -

# Worker - use master Tailscale IP
K3S_URL=https://100.88.197.64:6443
```

Without this, nodes can't reach each other after Tailscale IP changes or when WSL2 IP changes on restart.

---

## WSL2-Specific Issues

### No systemd on old WSL
- K3S needs systemd or a workaround
- On old WSL (no `wsl --version`): use `[boot] command=` in wsl.conf
- K3S start on old WSL: `nohup k3s server &` in boot script

### Flannel in WSL2
- Default flannel backend (VXLAN) may fail on WSL2 kernel
- Use `--flannel-backend=host-gw` or `wireguard-native`
- WSL2 kernel lacks some VXLAN modules

### /mnt paths
- WSL2 mounts Windows drives at `/mnt/c/`, `/mnt/d/`
- Don't use Windows paths for K3S data dirs → use Linux filesystem only
- K3S default data at `/var/lib/rancher/k3s/` → OK on WSL2

---

## kubectl Access from Windows

```bash
# Copy kubeconfig from master
scp ubuntu@100.88.197.64:/etc/rancher/k3s/k3s.yaml ~/.kube/config
# Fix server address
sed -i 's/127.0.0.1/100.88.197.64/' ~/.kube/config
```

Or on WSL2 locally:
```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
```

---

## Monitoring Stack Deployment

Deploy as Docker Compose on K3S worker node (K8S2), NOT as K3S workloads — simpler, no ingress complexity needed for homelab.

**Location:** `/home/rhein/monitoring/` on K8S2
**Services:** prometheus, grafana, node-exporter, cadvisor, postgres-exporter

### Prometheus reload without lifecycle API

Prometheus not started with `--web.enable-lifecycle` → use SIGHUP:
```bash
docker kill -s HUP prometheus
```

Or add flag in docker-compose:
```yaml
command:
  - '--web.enable-lifecycle'
```

Then: `curl -X POST http://localhost:9090/-/reload`

---

## cAdvisor Multi-Host Setup

Deploy on every host to be monitored:
```bash
docker run -d --name=cadvisor --restart=unless-stopped --privileged \
  --volume=/:/rootfs:ro --volume=/var/run:/var/run:ro \
  --volume=/sys:/sys:ro --volume=/var/lib/docker/:/var/lib/docker:ro \
  --volume=/dev/disk/:/dev/disk:ro --publish=8888:8080 \
  gcr.io/cadvisor/cadvisor:latest
```

Add each host to `prometheus.yml`:
```yaml
- job_name: cadvisor
  static_configs:
    - targets: ["100.114.107.68:8888"]
      labels:
        instance: k8s2-demo
    - targets: ["100.88.197.64:8888"]
      labels:
        instance: master-wsl2
    - targets: ["100.97.8.41:8888"]
      labels:
        instance: k8s1-jenkins
```

**cAdvisor requires Docker CE (not docker.io)** — v0.47+ needs `/run/containerd/containerd.sock`.
Ubuntu `docker.io` package doesn't provide this socket.

---

## node-exporter in WSL2

Standard rootfs mount fails in WSL2 (not a shared/slave mount).
Use `--pid=host --net=host` instead:
```bash
docker run -d --name=node-exporter --restart=unless-stopped \
  -p 9100:9100 --pid=host --net=host \
  prom/node-exporter:latest
```

Do NOT use: `-v /:/host:ro,rslave` → fails with "not a shared or slave mount"

---

## Prometheus Job Naming

Use **generic job names** — not host-specific:
- `job="node"` not `job="k8s2-node"`
- `job="cadvisor"` not `job="k8s2-cadvisor"`

Use `instance` label for per-host filtering. Mixing conventions breaks dashboards when adding new hosts.

Stale series from old job names persist 30 days in TSDB — plan renames carefully.

---

## Origin
- **Source:** Session 2026-06-07/08, K3S deployment + monitoring stack
- **Commit:** _(filled by verify-before-commit)_
