# 070626-k3s-cozyroom-master-control-plane
**Type:** draft
**Status:** implemented
**Tags:** propose, infra, k8s, k3s
**Proposed:** 2026-06-07
**Implemented:** 2026-06-07

## What
Deploy Cozyroom on K3S cluster: workstation master WSL2 (100.88.197.64) = control plane, K8S2 (100.114.107.68) = worker node. Runs parallel to existing Docker Compose on port 18080.

## Output
- K3S v1.35.5 server on master, agent on K8S2
- Local registry on master port 5000 (Docker registry:2 container)
- All 3 images built and pushed: cozyroom-backend, cozyroom-frontend, cozyroom-cloak
- k8s/ manifests created and applied
- All 4 pods Running:
  - backend (master) — nodeSelector to master for /mnt/f/ media mounts
  - postgres (master) — fresh test DB at /tmp/k8s-pgdata
  - frontend (K8S2) — cross-node DNS to backend works
  - cloak-proxy (K8S2)
- NodePort 30080 accessible from both nodes
- API health: `{"status":"ok","version":"0.1.0"}`

## Access
- K8S test: http://100.88.197.64:30080 or http://100.114.107.68:30080
- Production Docker Compose: http://100.88.197.64:18080 (unchanged)

## K8S1 Status
K3S agent installed but **cannot start** — cgroupv1 (WSL2 not restarted after systemd=true added to wsl.conf).
Fix: run `wsl --shutdown` on K8S1's Windows host, then reopen WSL. K3S agent service will auto-start via systemd.

## Key Decisions
1. **Media files**: nodeSelector pinning backend + postgres to master (nodeSelector: kubernetes.io/hostname: rhein-13700hxes-4070-64-4t)
2. **Parallel test**: K8S on NodePort 30080, Docker Compose stays on 18080
3. **Registry**: local Docker registry:2 on master port 5000, K3S registries.yaml with HTTP mirror
4. **Test DB**: fresh postgres at /tmp/k8s-pgdata (NOT production DB)

## Files
| File | Action |
|------|--------|
| `k8s/namespace.yaml` | created |
| `k8s/secret.yaml` | created |
| `k8s/postgres.yaml` | created |
| `k8s/backend.yaml` | created |
| `k8s/frontend.yaml` | created |
| `k8s/cloak-proxy.yaml` | created |

## Notes
- Supersedes/extends [[060626-ansible-k8s-cozyroom-deploy]] Phase 2
- K8S1 node needs WSL restart before it can join
- Invoked via: `/propose` skill

## Origin
- **Draft:** `wiki/sources/draft/070626-k3s-cozyroom-master-control-plane.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
