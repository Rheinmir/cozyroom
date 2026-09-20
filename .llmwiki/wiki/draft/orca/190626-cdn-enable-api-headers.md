# 190626-cdn-enable-api-headers

**Status:** implemented
**Sequence diagram (hoạt họa):** [html/190626-cdn-enable-api-headers-seq.html](../../../html/190626-cdn-enable-api-headers-seq.html)

## Plan

- [x] Task 1: Add `Cache-Control: public` to 7 GET library endpoints in `backend/internal/api/handler.go` — `listArtists`, `artistDetail`, `listAlbums`, `getAlbum`, `listTracks`, `stats`, `search`

## Agent Task Assignment (BẮT BUỘC với MỌI proposal — R7 chặn nếu thiếu/ô Agent trống)

| Task | Agent | Model | Status |
|------|-------|-------|--------|
| Add Cache-Control headers to backend handler.go | Claude main | claude-sonnet-4-6 | done |

## Files sẽ tạo/sửa

| File | Action | Lý do |
|------|--------|-------|
| `backend/internal/api/handler.go` | modify | Add Cache-Control: public headers to 7 GET handlers |

## Context hiện tại

Cloudflare Tunnel đã route `music.giatbh.io.vn → frontend nginx` ✅  
nginx đã có `Cache-Control: public, max-age=31536000, immutable` cho `/assets/*` ✅  
Backend đã có `public, max-age=604800` cho covers + artist-images ✅  
Backend đã có `public, max-age=3600` cho lossless stream ✅  

**Thiếu:** 7 library API endpoints không có Cache-Control → CF không cache JSON → mỗi request đều tunnel về homelab.

## TTL plan

| Endpoint | TTL | Lý do |
|----------|-----|-------|
| `/api/artists`, `/api/artists/{id}`, `/api/albums`, `/api/albums/{id}`, `/api/tracks` | 300s | Library thay đổi chỉ sau scan; 5 phút stale là OK |
| `/api/stats` | 60s | Counter thay đổi thường xuyên hơn |
| `/api/search?q=...` | 30s | Query-specific; CF cache theo full URL (kể cả `?q=`) nên safe |

## Risks

- Sau `POST /api/scan`, cached responses stale tối đa 300s — acceptable với homelab
- CF zone cần ở chế độ "Proxied" (orange cloud) để CDN hoạt động — cần user verify trên CF dashboard
- Nếu CF zone có "Bypass Cache" Page Rule thì headers không có tác dụng — cần user check

## Origin

- **Draft:** `wiki/draft/orca/190626-cdn-enable-api-headers.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
