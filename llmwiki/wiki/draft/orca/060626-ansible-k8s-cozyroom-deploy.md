# 060626-ansible-k8s-cozyroom-deploy
**Type:** draft
**Status:** proposed
**Tags:** orca-workflow, propose, infra
**Proposed:** 2026-06-06

## Painpoint gốc

`cozyroom_pgdata` là Docker named volume → mất sạch khi `docker compose down -v` hoặc prune. Media dirs rỗng. Không có backup. Không có IaC để rebuild nhanh.

---

## Plan

### Phase 0 — Ngay bây giờ: Fix data persistence (K8S2, ~30 phút)

- [ ] **P0-1** Migrate postgres từ named volume → bind mount:
  - `pg_dump` data hiện có (nếu có)
  - Stop postgres container
  - Tạo `/home/rhein/cozyroom/postgres-data/` trên K8S2
  - Sửa `docker-compose.override.yml` trên K8S2: thêm `postgres → volumes: ./postgres-data:/var/lib/postgresql/data`
  - Restart → verify data còn

- [ ] **P0-2** Tạo backup script `/home/rhein/cozyroom/scripts/backup.sh` trên K8S2:
  ```bash
  #!/bin/bash
  DEST=/home/rhein/backups/cozyroom
  mkdir -p $DEST
  DATE=$(date +%Y%m%d_%H%M)
  sudo docker exec cozyroom-postgres-1 pg_dump -U cozyroom cozyroom \
    | gzip > $DEST/pg_$DATE.gz
  # Keep last 7 days
  find $DEST -name "pg_*.gz" -mtime +7 -delete
  ```

- [ ] **P0-3** Cron job trên K8S2: `0 3 * * * /home/rhein/cozyroom/scripts/backup.sh`

---

### Phase 1 — Ansible (quản lý K8S1 + K8S2)

Repo: tạo `ansible/` folder trong project root (hoặc separate repo `rheinmir/infra`).

- [ ] **A-1** `ansible/inventory.yml`:
  ```yaml
  all:
    children:
      demo_servers:
        hosts:
          k8s2:
            ansible_host: 100.114.107.68
            ansible_user: rhein
            ansible_ssh_private_key_file: ~/.ssh/deploy_key
      ci_servers:
        hosts:
          k8s1:
            ansible_host: 100.97.8.41
            ansible_user: ubuntu
            ansible_password: rheinmir
  ```

- [ ] **A-2** `ansible/playbooks/provision-k8s2.yml`:
  - Install Docker (đã có, idempotent check)
  - Install k3s server
  - Create dirs: `/home/rhein/cozyroom/postgres-data/`, `/home/rhein/backups/`
  - Configure cron backup
  - Install cloudflared (on K8S2 separately, hoặc rely on K8S1 tunnel)

- [ ] **A-3** `ansible/playbooks/deploy-cozyroom.yml`:
  - git pull latest
  - docker compose up --build (hoặc kubectl apply khi có k3s)
  - Verify health check

- [ ] **A-4** `ansible/playbooks/backup.yml`:
  - Trigger pg_dump
  - rsync backup files to K8S1
  - Notify via Telegram/Discord nếu fail

- [ ] **A-5** `ansible/vars/vault.yml` (ansible-vault encrypted):
  - DB passwords, API keys, SSH creds

---

### Phase 2 — k3s Setup (K8S2 single-node)

> K8S1 là WSL2 → không nên dùng làm k3s node (networking quirks, không có systemd đúng nghĩa). K8S2 làm single-node cluster, expand sau.

- [ ] **K-1** Install k3s trên K8S2:
  ```bash
  curl -sfL https://get.k3s.io | sh -
  ```
  → k3s tự cài local-path provisioner (PVC persistent tự động)

- [ ] **K-2** `k8s/namespace.yml` — namespace `cozyroom`

- [ ] **K-3** `k8s/postgres/`:
  - `statefulset.yml` — postgres:16, replica 1
  - `pvc.yml` — PVC 20Gi, storageClass `local-path` → data ghi vào `/var/lib/rancher/k3s/storage/`
  - `service.yml` — ClusterIP
  - `secret.yml` — DB password (kubectl secret)

- [ ] **K-4** `k8s/backend/`:
  - `deployment.yml` — Cozyroom backend, 1 replica
  - `service.yml`
  - `configmap.yml` — env vars (non-secret)

- [ ] **K-5** `k8s/frontend/`:
  - `deployment.yml` — nginx/frontend, 1 replica
  - `service.yml` — NodePort 18080

- [ ] **K-6** `k8s/media-pv.yml` — HostPath PV cho `/home/rhein/media/`

- [ ] **K-7** `k8s/backup-cronjob.yml` — K8s CronJob: pg_dump daily 3AM → `/home/rhein/backups/`

---

### Phase 3 — Jenkins CI/CD (K8S1)

- [ ] **J-1** Jenkins Pipeline `Jenkinsfile` in project root:
  ```groovy
  pipeline {
    stages {
      stage('Pull') { steps { sh 'git pull' } }
      stage('Build') { steps { sh 'docker compose build' } }
      stage('Deploy') { steps { 
        sh 'kubectl apply -f k8s/ --namespace cozyroom'
        // hoặc: sshpass deploy script
      }}
      stage('Verify') { steps { sh 'curl -f https://demo.giatbh.io.vn/api/stats' } }
    }
    post { failure { /* notify */ } }
  }
  ```

- [ ] **J-2** Jenkins webhook từ GitHub push → auto trigger deploy

---

## Files sẽ tạo/sửa

| File | Action | Lý do |
|------|--------|-------|
| `K8S2:~/cozyroom/docker-compose.override.yml` | sửa | bind mount postgres |
| `K8S2:~/cozyroom/scripts/backup.sh` | tạo | daily backup |
| `ansible/inventory.yml` | tạo | server list |
| `ansible/playbooks/provision-k8s2.yml` | tạo | setup K8S2 |
| `ansible/playbooks/deploy-cozyroom.yml` | tạo | deploy automation |
| `ansible/playbooks/backup.yml` | tạo | backup automation |
| `k8s/namespace.yml` | tạo | K8s namespace |
| `k8s/postgres/` (4 files) | tạo | postgres StatefulSet |
| `k8s/backend/` (3 files) | tạo | backend Deployment |
| `k8s/frontend/` (2 files) | tạo | frontend Deployment |
| `k8s/media-pv.yml` | tạo | media PersistentVolume |
| `k8s/backup-cronjob.yml` | tạo | automated backup |
| `Jenkinsfile` | tạo | CI/CD pipeline |

---

## Thứ tự ưu tiên

```
P0 (today)  → Fix postgres bind mount + backup cron   [30 phút, ngăn mất data ngay]
Phase 1     → Ansible playbooks                        [2-3h, IaC]
Phase 2     → k3s + K8s manifests                     [4-6h, production-grade]
Phase 3     → Jenkins CI/CD                            [2h, auto deploy]
```

## Risks

- **K8S1 là WSL2**: Không chạy k3s agent tốt. Plan: K8S2 single-node đủ dùng trước, expand ra bare-metal server sau.
- **media files rỗng**: k8s PV cho media sẽ mount dir rỗng. User cần rsync data vào `/home/rhein/media/music|films|ebooks` thủ công hoặc qua NFS từ Windows host.
- **postgres migration**: P0-1 cần pg_dump data hiện có trước khi đổi volume path. DB hiện tại `cozyroom_pgdata` có data thật không?
- **Docker socket in k8s**: Khi migrate sang k3s, devops MCP tools (`docker_build`, `docker_restart`) cần update để dùng `kubectl` thay vì `docker compose`.
- **cloudflared tunnel**: Vẫn chạy trên K8S1. Nếu K8S1 down, `demo.giatbh.io.vn` down. Long-term: chuyển cloudflared sang K8S2.

## Câu hỏi cần xác nhận

1. **Database K8S2 hiện có data gì không?** (Nếu có thì P0-1 phải pg_dump trước)
2. **Ansible repo**: tạo trong `rheinmir/cozyroom` hay separate `rheinmir/infra`?
3. **k8s manifest**: trong `rheinmir/cozyroom/k8s/` hay separate repo?
4. **Media files**: có plan copy từ local Windows (250GB music) sang K8S2 không, hay K8S2 chỉ là demo (không có media)?
5. **Cloudflare tunnel**: để trên K8S1 hay muốn move sang K8S2?

## Origin
- **Draft:** `wiki/draft/orca/060626-ansible-k8s-cozyroom-deploy.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
