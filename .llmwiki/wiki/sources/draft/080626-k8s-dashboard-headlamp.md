# 080626-k8s-dashboard-headlamp
**Type:** draft
**Status:** proposed
**Tags:** propose, infra, k8s
**Proposed:** 2026-06-08

## What
Add a web-based Kubernetes management dashboard to the K3S cluster (master 100.88.197.64 + K8S2 worker).

## Existing files affected

| File | Change |
|------|--------|
| `k8s/` | Add `k8s/headlamp.yaml` (new) |
| `INFRA.md` | Add dashboard URL + access instructions |

No application code changes. No existing k8s resources modified.

## Existing features that could break

- NodePort 30080 (Cozyroom frontend) — no conflict; dashboard uses 30090
- Existing pods in `cozyroom-k8s` — deployed in separate namespace `headlamp`; no impact
- Cloudflare tunnel — optional new route; existing routes unchanged

## Options

### Option A: Headlamp (Recommended)
- Modern React UI, in-cluster deployment, HTTP NodePort works
- Easy to add Cloudflare tunnel route
- No TLS required for internal access
- Access: `http://<node>:30090`

### Option B: Kubernetes Dashboard (Official)
- Feature-rich, official
- Requires TLS + RBAC token auth — more complex setup
- Old UI, needs metrics-server for resource graphs
- Access: must use `kubectl proxy` or HTTPS NodePort

### Option C: k9s (terminal)
- Zero in-cluster footprint
- SSH only — no web UI, no remote sharing
- Already installable on master: `curl -sSLo k9s.tar.gz https://...`

**Tradeoff**: Headlamp = web UI, HTTP-friendly, Cloudflare-compatible. Official dashboard = more features, harder to deploy. k9s = zero footprint but terminal-only.

## Implementation plan (Headlamp)

1. Create `k8s/headlamp.yaml`:
   - Namespace `headlamp`
   - ServiceAccount `headlamp`
   - ClusterRoleBinding → `cluster-admin` (homelab, no multi-tenant concern)
   - Deployment: `ghcr.io/headlamp-k8s/headlamp:latest`, 1 replica, no nodeSelector (can run on either node)
   - Service: NodePort 30090
2. Apply: `kubectl apply -f k8s/headlamp.yaml`
3. Verify pod Running, NodePort accessible
4. Update INFRA.md with access URL
5. (Optional) Add Cloudflare tunnel route `k8s.giatbh.io.vn → http://100.88.197.64:30090`

**Also flag**: PV paths `/tmp/k8s-pgdata` and `/tmp/k8s-cozyroom-data` are under `/tmp/` — wiped on node reboot. Should move to permanent path (e.g., `/var/lib/cozyroom/`) in a follow-up. Not blocking this proposal.

## Success criteria

- `kubectl get pods -n headlamp` → pod Running
- `http://100.88.197.64:30090` or `http://100.114.107.68:30090` → Headlamp web UI loads
- Can browse pods/deployments/services in `cozyroom-k8s` namespace from UI
- No existing pods restarted or disrupted

## Notes
- Invoked via: `/propose` skill
- Related outdated wiki items: `070626-k3s-cozyroom-master-control-plane.md` says 4 pods — actually 5 (postgres-standby added); PV `/tmp/` paths are transient

## Origin
- **Draft:** `wiki/sources/draft/080626-k8s-dashboard-headlamp.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
