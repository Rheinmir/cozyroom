# Skill: deploy-k8s-frontend

Deploy frontend image lên K3S cluster. Build Docker image từ WSL2 (Ubuntu-22.04), push lên private registry, rollout restart K8S deployment.

## Trigger

Dùng khi user nói: "deploy", "lên k8s", "push lên cluster", "build và deploy frontend", "rollout frontend", "/deploy-k8s-frontend"

## Environment

| Resource | Value |
|----------|-------|
| WSL2 distro | `Ubuntu-22.04` (K3S master, same physical machine) |
| Private registry | `100.88.197.64:5000` |
| Namespace | `cozyroom-k8s` |
| Deployment | `frontend` |
| Dockerfile | `Dockerfile.frontend` |
| Image tag | `100.88.197.64:5000/cozyroom-frontend:k8s` |

> **Note:** WSL2 truy cập Windows filesystem qua `/mnt/c/`. Project ở `C:\Users\olive\orca\cozyroom` → trong WSL2 là `/mnt/c/Users/olive/orca/cozyroom`.

## Steps

### 1. Build image

```bash
wsl -d Ubuntu-22.04 -- bash -c "cd /mnt/c/Users/olive/orca/cozyroom && docker build -t 100.88.197.64:5000/cozyroom-frontend:k8s -f Dockerfile.frontend . 2>&1 | tail -10"
```

Expected: last line `Successfully tagged 100.88.197.64:5000/cozyroom-frontend:k8s`

### 2. Push to registry

```bash
wsl -d Ubuntu-22.04 -- bash -c "docker push 100.88.197.64:5000/cozyroom-frontend:k8s 2>&1 | tail -5"
```

Expected: `k8s: digest: sha256:...`

### 3. Rollout restart

```bash
wsl -d Ubuntu-22.04 -- bash -c "kubectl rollout restart deployment/frontend -n cozyroom-k8s"
```

Expected: `deployment.apps/frontend restarted`

### 4. Verify pods

```bash
wsl -d Ubuntu-22.04 -- bash -c "kubectl rollout status deployment/frontend -n cozyroom-k8s --timeout=90s"
```

Expected: `deployment "frontend" successfully rolled out`

## ⚠️ Notes

- `Dockerfile.frontend` dùng `vite build` output `../backend/dist` (không phải `./dist`) — đây là intentional, không sửa path trong Dockerfile
- Registry container phải đang chạy: `docker ps --filter name=k3s-registry` → `Up`
- Nếu build fail do node_modules: `docker build --no-cache ...`
- Nếu kubectl không nhận lệnh: kiểm tra `export KUBECONFIG=/etc/rancher/k3s/k3s.yaml` trong WSL2

## Related

- Backend deploy: build `Dockerfile` (Go binary), push `cozyroom-backend:k8s`, restart `deployment/backend`
- Full cluster deploy: build cả backend + frontend + cloak-proxy

## Bugs distilled (2026-06-11)

Hai bugs đã fix trước khi distill skill này:

### 1. Player progress bar / time 0:00 (PlayerContext.tsx)
**Root cause:** `trackRef.current` sync async qua `useEffect` → window stale khi YT↔local transition → `getActive()` trả wrong element → `timeupdate`/`loadedmetadata` bị filter → progress/duration = 0  
**Fix:** Thêm `trackRef.current = t` synchronously TRƯỚC `setTrack(t)` trong `startTrack`; fallback `setDuration` trong `onTime`

### 2. YouTube cover không retry (handler.go + RadialNav.tsx + PlayerBar.tsx)
**Root cause:** Backend trả HTTP 200 + 1×1 JPEG khi thumbnail fetch fail → `img.onerror` không fire → không retry  
**Fix:** Backend trả HTTP 503; frontend `onError` retry tối đa 4 lần với delay tăng dần (2s, 4s, 6s, 8s)

## Origin

- Distilled: 2026-06-11
- Session: design feedback `/album/86b29b373e3a839f`
