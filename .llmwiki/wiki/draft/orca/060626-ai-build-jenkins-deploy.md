# 060626-ai-build-jenkins-deploy
**Type:** draft
**Status:** implemented
**Tags:** orca-workflow, propose
**Proposed:** 2026-06-06

## Plan

### Feature 1 — AI Build Shortcut (password-gated)

Luồng: user nhập prompt vào AI chat → agent pull code → sửa code → build Docker → restart container → báo kết quả.

- [ ] **F1-1** Thêm 4 MCP tools vào `registry.go`:
  - `git_pull` — chạy `git pull` trong project dir, trả về output
  - `docker_build` — build image cho service chỉ định (backend/frontend), trả về build log (last 50 lines)
  - `docker_restart` — `docker compose up -d --force-recreate --no-deps <service>`, trả về status
  - `get_container_logs` — tail N dòng log từ container chỉ định
  
  Tất cả 4 tools require password trong `_meta.owner_password` field (hoặc check từ session memory).

- [ ] **F1-2** Tạo `backend/internal/api/devops.go`:
  - Handler `ExecGitPull(projectDir string)` — chạy `git pull`, capture stdout+stderr
  - Handler `ExecDockerBuild(service string)` — shell `docker compose build <service>`
  - Handler `ExecDockerRestart(service string)` — shell `docker compose up -d --force-recreate --no-deps <service>`
  - Handler `GetContainerLogs(container string, lines int)` — `docker logs --tail N <container>`
  - Mỗi handler có timeout 5 phút, return `{ok, output, error}`

- [ ] **F1-3** Register tools trong `mcp/registry.go` với schema + password check:
  ```go
  if !verifyOwnerPassword(input["owner_password"]) {
      return toolError("unauthorized")
  }
  ```

- [ ] **F1-4** Frontend: AI chat bubble hiển thị build output trong code block có scroll (không thay đổi giao diện chat khác).

---

### Feature 2 — Jenkins SSH Deploy to Demo Server

Luồng: AI agent trigger Jenkins job → Jenkins SSH vào server → pull + build + restart → báo demo link.

- [ ] **F2-1** Thêm 3 MCP tools:
  - `trigger_deploy` — trigger deploy pipeline (jenkins hoặc direct SSH), nhận `project`, `branch`, `env` params
  - `get_deploy_status` — poll trạng thái deploy (running/success/failed + last 20 log lines)
  - `get_demo_link` — trả về demo URL cho project đang chạy trên demo server

- [ ] **F2-2** Backend `devops.go` — deploy handler (2 modes, chọn qua env var `DEPLOY_MODE`):
  
  **Mode A — Direct SSH** (simple, không cần Jenkins):
  ```
  ssh user@server "cd /path/project && git pull && docker compose up -d --build"
  ```
  Dùng `golang.org/x/crypto/ssh` hoặc shell `ssh -i keyfile`.

  **Mode B — Jenkins API** (nếu có Jenkins):
  ```
  POST http://jenkins:8080/job/<name>/build
  GET  http://jenkins:8080/job/<name>/lastBuild/api/json
  ```

- [ ] **F2-3** Cloudflare tunnel routing:
  - Demo server chạy `cloudflared tunnel run` với config map nhiều service:
    ```yaml
    ingress:
      - hostname: demo-projectA.domain.com
        service: http://localhost:18081
      - hostname: demo-projectB.domain.com  
        service: http://localhost:18082
    ```
  - `get_demo_link` tool trả về hostname tương ứng với project.

- [ ] **F2-4** Env vars cần thêm vào `docker-compose.yml`:
  ```
  DEPLOY_MODE: ssh          # hoặc jenkins
  DEPLOY_SSH_HOST: user@server
  DEPLOY_SSH_KEY_PATH: /data/deploy_key
  JENKINS_URL: http://jenkins-server:8080
  JENKINS_TOKEN: <token>
  DEMO_BASE_URL: https://demo.giatbh.io.vn
  ```

- [ ] **F2-5** Frontend: Khi AI agent gọi `trigger_deploy`, chat hiển thị progress bar/spinner + link demo khi done. Dùng `_frontend_action` type `deploy_progress`.

---

## Files sẽ tạo/sửa

| File | Action | Lý do |
|------|--------|-------|
| `backend/internal/api/devops.go` | tạo mới | chứa tất cả exec handlers cho git/docker/ssh |
| `backend/internal/mcp/registry.go` | sửa | thêm 7 tools mới vào registry |
| `backend/internal/api/routes.go` | sửa | register devops handlers |
| `backend/cmd/server/main.go` | sửa | pass deploy config vào DevopsHandlers |
| `docker-compose.yml` (m stack) | sửa | thêm env vars DEPLOY_* |
| `frontend/src/components/ChatBubble.tsx` (hoặc tương đương) | sửa | render deploy progress action |

---

## Risks

- **Shell injection**: Tất cả `git pull`, `docker build`, `ssh` phải dùng `exec.Command(...)` với args riêng biệt, KHÔNG dùng `sh -c "string"` interpolation. Validate service name whitelist `[backend, frontend, cloak-proxy]`.
- **SSH key exposure**: Key file phải mount vào container với permission 600, không hardcode trong code.
- **Timeout & orphan processes**: Mỗi exec cần `context.WithTimeout(5 * time.Minute)` + `cmd.Process.Kill()` khi timeout.
- **Password leak**: `owner_password` trong MCP input không được log vào `chat_logs` table.
- **DB safety**: `docker_restart` PHẢI kiểm tra volume mount trước khi chạy (theo rule CLAUDE.md). Thêm pre-check: so sánh Mounts với expected path trước khi restart.

---

## Câu hỏi cần xác nhận

1. **Deploy mode**: Direct SSH hay Jenkins trước? (Nên làm SSH trước vì đơn giản hơn, Jenkins sau)
2. **Demo server**: Cozyroom hay generic cho tất cả projects?
3. **Cloudflare tunnel**: Đã có tunnel chạy sẵn chưa, hay cần setup từ đầu?
4. **SSH key**: Đường dẫn key file trên host là gì?
5. **Project dir** cho git pull: `/mnt/c/Users/olive/orca/workspaces/cozyroom/m` hay path khác?

## Origin
- **Draft:** `wiki/draft/orca/060626-ai-build-jenkins-deploy.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
