# 230626-sounds-serving-hostpath

**Status:** proposed
**Sequence diagram:** [html/230626-sounds-serving-hostpath-seq.html](../../../html/230626-sounds-serving-hostpath-seq.html)

## Context

Background sounds `.m4a` files (~220MB) hiện đang được:
1. Commit vào git repo → git history nặng vô lý
2. Baked vào Docker image → backend image 499MB, mỗi rebuild tốn 220MB push
3. Pattern đúng đã có sẵn: `/mnt/f/250930music`, `/mnt/f/Films`, `/mnt/f/Ebooks` đều là hostPath volume mounts

Mục tiêu: move sounds ra khỏi image + git, dùng hostPath giống music/films.

## Plan

- [ ] T1: Copy `.m4a` files lên k8s node hostPath `/mnt/f/sounds/ambient/`
- [ ] T2: Thêm volume mount trong backend k8s Deployment + `AMBIENT_SOUNDS_DIR` env var
- [ ] T3: Xoá sounds khỏi git + gitignore + bỏ `COPY sounds` khỏi Dockerfile
- [ ] T4: Verify `GET /api/ambient-sounds` list + stream qua hostPath

## Agent Task Assignment

| Task | Agent | Model | Status |
|------|-------|-------|--------|
| T1: Copy files to hostPath | Claude main | claude-sonnet-4-6 | pending |
| T2: k8s volume mount + env var | Claude main | claude-sonnet-4-6 | pending |
| T3: Untrack git + gitignore + Dockerfile | Claude main | claude-sonnet-4-6 | pending |
| T4: Verify end-to-end | Claude main | claude-sonnet-4-6 | pending |

## Files sẽ tạo/sửa

| File | Action | Lý do |
|------|--------|-------|
| `k8s/backend-deployment.yaml` (hoặc kubectl patch) | modify | thêm volume + volumeMount |
| `Dockerfile` | modify | xoá `COPY --from=builder /app/sounds ./sounds` |
| `.gitignore` | modify | thêm `backend/sounds/ambient/*.m4a`, `*.mp3` |
| `backend/sounds/ambient/*.m4a` + `*.mp3` | git rm --cached | untrack khỏi git, giữ file |

## Risks

- Cần mount `/mnt/f/sounds/ambient/` tồn tại trên node TRƯỚC khi apply → tạo thư mục trước
- `kubectl apply` hay `patch` deployment → pod restart → downtime ~30s (3 replicas nên không ai thấy)
- Sau khi git rm --cached, file vẫn còn trên disk — không mất data

## Origin

- **Draft:** `wiki/draft/orca/230626-sounds-serving-hostpath.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
