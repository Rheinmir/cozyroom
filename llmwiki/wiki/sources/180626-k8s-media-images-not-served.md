---
name: 180626-k8s-media-images-not-served
type: source
status: partial (covers fixed, artist-images pending DNS fix)
date: 2026-06-18
tags: bug, k8s, covers, artist-images, dns, coredns
---

# K8s không serve album covers + artist images

## Triệu chứng

- `/api/covers/{id}` → HTTP 404 cho mọi album
- `/api/artist-images/{id}` → HTTP 404
- Backend logs: `enricher: done — 0/868 images fetched`
- Frontend: tất cả ảnh album/artist hiển thị placeholder

## Bug 1 — Album covers: /data/covers không tồn tại

### Root cause

Backend serve cover art từ `COVERS_DIR` (default `/data/covers`). Thư mục này được tạo trong quá trình library scan. Sau khi migrate lên K8s + Postgres, `/data` PVC không có folder `covers/` — scan chưa được chạy lần nào trên cluster mới.

### Diagnosis

```bash
kubectl -n cozyroom-k8s exec deploy/backend -- ls /data/covers
# → No such file or directory
```

```bash
kubectl -n cozyroom-k8s exec postgres-0 -- psql -U cozyroom -d cozyroom \
  -c "SELECT COUNT(*) FROM albums WHERE cover_path IS NOT NULL AND cover_path != ''"
# → 1233 rows — DB có cover_path nhưng file không tồn tại trên disk
```

### Fix

Trigger rescan qua API:

```bash
curl -X POST https://music.giatbh.io.vn/api/scan
```

Scan extract cover art từ ID3 tags của music files → lưu vào `/data/covers/{album_id}.jpg` → `/api/covers/` bắt đầu trả 200.

**Lưu ý**: Scan bị interrupted do `driver: bad connection` (Postgres flaky) → một số albums skip. Cần trigger scan lại sau khi Postgres ổn định.

**Kết quả**: 1062+ cover files extracted, covers hoạt động cho các albums đã scan.

---

## Bug 2 — Artist images: CoreDNS không resolve external domains

### Root cause

`enricher` fetch artist images từ Deezer API (`api.deezer.com`). K8s CoreDNS forward DNS queries lên Tailscale MagicDNS của node (`/etc/resolv.conf`). Tailscale DNS không forward external queries ra internet.

```
enricher: no image for 'X': Get "https://api.deezer.com/...": 
dial tcp: lookup api.deezer.com on 10.43.0.10:53: no such host
```

### Diagnosis

```bash
kubectl -n cozyroom-k8s exec deploy/backend -- nslookup api.deezer.com
# → ** server can't find api.deezer.com: NXDOMAIN
```

CoreDNS config: `forward . /etc/resolv.conf` — dùng resolv.conf của CoreDNS pod, node resolve qua Tailscale DNS, không có fallback public DNS.

### Fix (pending)

Thêm public DNS fallback vào CoreDNS ConfigMap:

```bash
kubectl -n kube-system get configmap coredns -o yaml \
  | sed 's|forward . /etc/resolv.conf|forward . /etc/resolv.conf 8.8.8.8 1.1.1.1|' \
  | kubectl apply -f -
```

Sau khi apply, CoreDNS sẽ try Tailscale DNS trước, fallback sang 8.8.8.8/1.1.1.1. Restart CoreDNS pod để reload config:

```bash
kubectl -n kube-system rollout restart deployment/coredns
```

### Phòng tránh

- Khi deploy K8s cluster mới với Tailscale, luôn thêm `8.8.8.8 1.1.1.1` vào CoreDNS forward rule
- Verify: `kubectl -n <ns> exec <pod> -- nslookup google.com` phải resolve được từ bất kỳ pod nào

## Origin

- **Date:** 2026-06-18
- **Related:** [[sources/080626-k3s-install-best-practices]] (K3s install, Tailscale networking)
- **Related:** [[concepts/DeezerEnricher]] (artist image enricher)
- **Scanner commit:** `34d52b8` — cover image race conditions fix
