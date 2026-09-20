# 230626-k8s-dns-resilience

**Status:** done
**Sequence diagram:** [html/230626-k8s-dns-resilience-seq.html](../../../html/230626-k8s-dns-resilience-seq.html)

## Context

k8s cluster restart → CoreDNS cache clear → DNS timeout chain:
- Frontend nginx pods crash at startup (host not found: `backend`)
- Cloudflared pods can't reconnect tunnel (`argotunnel.com` DNS timeout)
- Result: 502 Bad Gateway on `music.giatbh.io.vn`

Tạm thời đã rollback về pod cũ, site đang up. Root cause chưa fix.

## Plan

- [ ] Task 1: Fix nginx.conf — thêm `resolver` + biến `$backend` để DNS resolve at request time, không crash khi startup
- [ ] Task 2: Fix CoreDNS upstream — patch ConfigMap thêm `8.8.8.8 1.1.1.1` forwarders để external DNS hoạt động
- [ ] Task 3: Clean cloudflared stuck pods — xóa `kzb7j` CrashLoopBackOff, rebuild image nếu cần

## Agent Task Assignment

| Task | Agent | Model | Status |
|------|-------|-------|--------|
| Fix nginx.conf + rebuild frontend image + rolling deploy | Claude main | claude-sonnet-4-6 | done |
| Patch CoreDNS ConfigMap upstream forwarders | Claude main | claude-sonnet-4-6 | done |
| Clean stuck cloudflared pods | Claude main | claude-sonnet-4-6 | done |

## Files sẽ tạo/sửa

| File | Action | Lý do |
|------|--------|-------|
| `nginx.conf` | modify | Thêm resolver + variable upstream |
| CoreDNS ConfigMap (cluster) | kubectl patch | Thêm forwarders 8.8.8.8/1.1.1.1 |
| cloudflared deployment (cluster) | kubectl delete pod | Remove stuck pods |
| frontend Docker image | rebuild + push | Deploy nginx.conf mới |

## Risks

- Rebuild frontend image yêu cầu Docker build thành công — nếu fail thì site vẫn ở pod cũ
- CoreDNS patch restart coredns pod — DNS downtime ~5s trong cluster
- Nếu xóa `kzb7j` mà node vẫn unhealthy, pod mới vẫn sẽ CrashLoopBackOff

## Origin

- **Draft:** `wiki/draft/orca/230626-k8s-dns-resilience.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
