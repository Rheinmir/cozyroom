---
type: draft
title: ArgoCD GitOps cho K3s cluster — sync k8s/ từ GitHub, thay thế kubectl apply thủ công
status: proposed
tags: [argocd, gitops, k8s, ci-cd]
timestamp: 2026-07-10
---

# 100726-argocd-gitops-k8s
**Type:** draft
**Status:** proposed → implementing (user đã duyệt "làm luôn")
**Tags:** argocd, gitops, k8s, ci-cd
**Proposed:** 2026-07-10
**Sequence diagram:** [html/100726-argocd-gitops-seq.html](../../../html/100726-argocd-gitops-seq.html)

## What
Cài ArgoCD vào cluster K3s, đăng ký Application trỏ vào `k8s/` trên GitHub (`Rheinmir/cozyroom`), để cluster tự đồng bộ theo git thay vì user gõ `kubectl apply`/`deploy-k8s-frontend` tay. Hợp với nhịp "máy restart hàng tuần" — ArgoCD tự self-heal khi node dậy lại mà không cần nhớ chạy lại lệnh.

## Phát hiện khi audit trước khi implement (quan trọng)

`kubectl diff` giữa git và live cluster lộ ra **git đang lệch thật** — nếu bật GitOps ngay sẽ đẩy production về cấu hình cũ:

| Resource | Live (đúng, đang chạy) | Git (trước khi sửa) | Xử lý |
|----------|------------------------|----------------------|-------|
| `db-adapter` DATABASES_HOST | `postgres.cozyroom-k8s.svc.cluster.local` (FQDN — có thể là fix DNS resilience thủ công, xem [[230626-k8s-dns-resilience]]) | `postgres` (tên ngắn) | ✅ **Đã sửa** git khớp live |
| `postgres-standby` init-replica | `pg_isready -h postgres` (DNS, đã chạy — nhưng **là bản CŨ**, chưa rebuild lại) | `-h postgres` (git đã có bản sửa đúng, nhưng LIVE pod chưa áp) | ⚠️ **CHƯA áp** — áp file này sẽ trigger StatefulSet rolling update → pod recreate → init container chạy `rm -rf /var/lib/postgresql/data/*` + `pg_basebackup` rebuild từ đầu. Đây là recreate container đụng DB data — theo CLAUDE.md phải xác nhận với user trước khi làm, KHÔNG tự ý áp |

## Affected

| File / Symbol | How it changes |
|---------------|---------------|
| `.gitignore` | ✅ Thêm `k8s/secret.yaml` — secret không còn track trong git (repo public, từng lộ `POSTGRES_PASSWORD` plaintext) |
| `k8s/secret.yaml` | ✅ `git rm --cached` — untrack, giữ file trên disk cho lần deploy hiện tại |
| `k8s/secret.yaml.example` | ✅ MỚI — template không giá trị thật, để người sau biết cấu trúc |
| `k8s/db-adapter.yaml` | ✅ Reconcile `DATABASES_HOST` khớp live (FQDN) |
| `k8s/postgres-standby.yaml` | ⚠️ Đã có bản đúng trong git, nhưng **chưa áp lên live** — chờ user quyết định thời điểm rebuild standby |
| `k8s/argocd-namespace.yaml` (không cần — dùng namespace chính thức ArgoCD) | Cài qua manifest chính thức `argoproj/argo-cd` |
| `k8s/argocd-application.yaml` (MỚI) | Application CR: repo=`https://github.com/Rheinmir/cozyroom.git`, path=`k8s`, namespace=`cozyroom-k8s`, **syncPolicy: manual (KHÔNG automated)** ở giai đoạn đầu |

## Risks

- **Secret vẫn lộ trong lịch sử git** (commit `42b1a25`) dù đã gitignore — gitignore chỉ chặn tương lai. Xoá khỏi history cần `git filter-repo` + force-push, một hành động phá huỷ lịch sử trên repo public — **KHÔNG tự làm**, cần user xác nhận riêng. Khuyến nghị độc lập: đổi `POSTGRES_PASSWORD`.
- **postgres-standby drift**: nếu bật `syncPolicy.automated.selfHeal: true`, ArgoCD sẽ tự áp lại spec khớp git — bao gồm cả StatefulSet này — trigger rebuild standby ngoài ý muốn. **Do đó KHÔNG bật automated sync ở bản đầu**, chỉ sync thủ công (`argocd app sync`) để user kiểm soát đúng thời điểm.
- **ArgoCD tự thêm annotation `last-applied-configuration` khác `kubectl apply`** — lần sync đầu có thể hiện diff giả (do cách ArgoCD track state khác kubectl) dù nội dung thực tế giống nhau — không phải lỗi.
- **Build image không nằm trong scope ArgoCD** — ArgoCD chỉ sync manifest, không build Docker. Skill `deploy-k8s-frontend`/`build backend` vẫn cần chạy tay hoặc qua CI riêng để đẩy image mới; ArgoCD chỉ đảm bảo *manifest* (replicas, env, resource) khớp git, không tự rebuild image khi source code đổi.
- Namespace `argocd` mới thêm tốn tài nguyên nhỏ (controller + repo-server + app-controller + Redis) trên node control-plane vốn đã tải nặng nhất.

## Plan

- [x] **Task 1 — Xử lý secret lộ:** `.gitignore` + `git rm --cached` + `secret.yaml.example`. ✅ Done.
- [x] **Task 2 — Reconcile drift an toàn:** sửa `db-adapter.yaml` khớp live. ✅ Done. `postgres-standby` để nguyên, KHÔNG áp — chờ user.
- [ ] **Task 3 — Cài ArgoCD:** `kubectl create ns argocd` + apply manifest chính thức stable.
- [ ] **Task 4 — Đăng ký Application:** repo GitHub, path `k8s`, syncPolicy **manual** (không automated/prune) ở bản đầu.
- [ ] **Task 5 — Verify:** ArgoCD thấy đúng trạng thái Synced/OutOfSync (OutOfSync đúng dự kiến ở `postgres-standby`); không có sync nào tự động chạy; site vẫn sống bình thường trong suốt quá trình.
- [ ] **Task 6 — Commit các thay đổi git** (gitignore, secret.yaml.example, db-adapter.yaml fix, argocd-application.yaml).

## Agent Task Assignment

| Task | Agent (CLI) | Lý do chọn | Status |
|------|-------------|------------|--------|
| Xử lý secret + reconcile drift | Claude main (claude-sonnet-5) | Đụng git history/production config, cần hiểu ngữ cảnh CLAUDE.md rule bảo vệ DB | done |
| Cài ArgoCD + đăng ký Application | Claude main (claude-sonnet-5) | Đụng hạ tầng cluster thật, cần chọn syncPolicy an toàn (manual, không tự trigger rebuild DB) | in_progress |
| Verify + commit | Claude main (claude-sonnte-5) | Xác nhận không phá gì trước khi commit | pending |

Một agent xuyên suốt vì các bước phụ thuộc chặt (drift phải reconcile trước khi cài ArgoCD, không thì sync đầu tiên sẽ sai).

## Success criteria

- `k8s/secret.yaml` không còn trong `git status`/tracked; `.gitignore` chặn từ nay.
- ArgoCD Application `cozyroom` hiển thị đúng trạng thái mỗi resource — không có sync tự động nào xảy ra ngoài ý muốn.
- `postgres-standby` hiện `OutOfSync` (biết trước, chưa xử lý) — không bị ArgoCD tự áp.
- Site (`music.giatbh.io.vn`) không gián đoạn trong suốt quá trình cài đặt.
- User có thể `argocd app sync cozyroom` thủ công bất cứ lúc nào để đồng bộ theo ý muốn.

## Notes
- [[230626-k8s-dns-resilience]] — có thể là nguồn gốc fix FQDN db-adapter
- [[200626-db-antipattern]] — pattern "config mismatch giữa git và live" từng gây outage, đúng loại lỗi audit này bắt được trước khi nó tái diễn qua ArgoCD

## Origin
- **Draft:** `wiki/sources/draft/100726-argocd-gitops-k8s.md`
- **Source:** yêu cầu user 2026-07-10: "cai argo cd tren github de kiem soat k8s" + "git ignored no di va co lap /propose va lam luon"
- **Commit:** _(filled by `verify-before-commit`)_
