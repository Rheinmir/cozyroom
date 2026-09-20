---
name: k8s-frontend-deploy
description: Build + push + rollout the frontend Docker image to K3S cluster via WSL2
---

# Skill: k8s-frontend-deploy

## Trigger
User says: "deploy frontend", "push to k8s", "release frontend", "chạy lên k8s", or after a frontend code fix is confirmed.

## Context
- K3S master is WSL2 distro `Ubuntu-22.04` on same physical machine — no SSH needed
- Project root accessible in WSL2 at `/mnt/c/Users/olive/orca/cozyroom`
- Private registry: `100.88.197.64:5000` (container: `k3s-registry`)
- K8S namespace: `cozyroom-k8s`, deployment: `frontend`
- `Dockerfile.frontend`: vite outputs to `../backend/dist` → image copies from `/app/backend/dist` ✓

## Steps

### 1. Build
```powershell
wsl -d Ubuntu-22.04 -- bash -c "cd /mnt/c/Users/olive/orca/cozyroom && docker build -t 100.88.197.64:5000/cozyroom-frontend:k8s -f Dockerfile.frontend . 2>&1 | tail -5"
```
Success indicator: `Successfully tagged 100.88.197.64:5000/cozyroom-frontend:k8s`

### 2. Push
```powershell
wsl -d Ubuntu-22.04 -- bash -c "docker push 100.88.197.64:5000/cozyroom-frontend:k8s 2>&1 | tail -3"
```
Success indicator: `k8s: digest: sha256:...`

### 3. Rolling restart
```powershell
wsl -d Ubuntu-22.04 -- bash -c "kubectl rollout restart deployment/frontend -n cozyroom-k8s && kubectl rollout status deployment/frontend -n cozyroom-k8s --timeout=120s"
```
Success indicator: `deployment "frontend" successfully rolled out`

### 4. Verify
```powershell
wsl -d Ubuntu-22.04 -- bash -c "kubectl get pods -n cozyroom-k8s"
```
All 3 `frontend-*` pods should show `Running` with fresh AGE (seconds).

## Abort conditions
- Build fails → check Dockerfile.frontend, do NOT change the `/app/backend/dist` copy path
- Registry unreachable → `wsl -- docker ps --filter name=k3s-registry` to check
- Rollout stuck → `wsl -- kubectl describe pod <pod> -n cozyroom-k8s` for events

## Notes
- Backend deploy: same pattern but use `Dockerfile` and `deployment/backend`
- Do NOT do `docker compose --force-recreate` on K8S2 without checking DB mounts (CLAUDE.md rule)
