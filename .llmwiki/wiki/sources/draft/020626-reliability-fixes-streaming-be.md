# 020626-reliability-fixes-streaming-be
**Type:** draft
**Status:** done
**Tags:** backend, streaming, reliability, youtube, hls, ffmpeg, observability, metadata, thumbnail
**Proposed:** 2026-06-02

## What
Điều tra và fix 4 lỗi reliability gây loading kẹt, thumbnail không load, và container reset; thêm watcher để detect lỗi tự động.

## Root causes tìm được

| Triệu chứng | Root cause |
|-------------|-----------|
| YouTube không play ngay khi ấn | `yt-dlp -g` blocking mỗi request, không cache signed URL |
| YouTube stream mất tiếng / 403 | YouTube signed URLs bound vào server IP; http.Redirect bắt trình duyệt load từ client IP gây 403 Forbidden |
| Thumbnail YouTube không load | Fetch thẳng internet từ container, không qua cloak-proxy; 404 thay vì placeholder khi fail |
| Music kẹt giữa chừng trên 5G | Không có `WriteTimeout` trên HTTP server — goroutine bị hold vô hạn khi client drop |
| Container reset không rõ nguyên nhân | Không có `recover()` — Go panic trong một handler kill cả server; ffmpeg không có timeout |

## Affected

| File | Thay đổi |
|------|---------|
| `backend/internal/api/routes.go` | Thêm `panicRecovery` middleware + `runtime` import; wire vào chain |
| `backend/cmd/server/main.go` | `http.ListenAndServe` → `http.Server` với `WriteTimeout=5m`, `IdleTimeout=2m`, `ReadHeaderTimeout=10s`; start `hlsMgr.Watch(ctx)` |
| `backend/internal/api/youtube.go` | In-memory stream URL cache TTL 4h; `cloakProxyURL` field; download thêm `--embed-metadata --write-thumbnail --convert-thumbnails jpg`; copy thumbnail → coversDir đồng bộ; `id8hex()` SHA-256 match scanner; stream handler reverse proxy + HTTP Range + retry |
| `backend/internal/api/handler.go` | Thumbnail cover: ưu tiên `maxresdefault` → `sddefault` → `hqdefault` → `mqdefault`; fetch qua cloak-proxy; fallback placeholder JPEG thay vì 404; log khi fail |
| `backend/internal/api/routes.go` | Wire `cloakProxyURL` vào `handlers` and `YouTubeHandlers` |
| `backend/internal/hls/manager.go` | `Watch(ctx)` goroutine poll 30s — detect + kill ffmpeg stuck > 3h; `exec.CommandContext` với 2h timeout; log transcode lifecycle |
| `nginx.conf` | Tắt proxy buffering cho `/api/youtube/stream/` để đảm bảo stream real-time mượt mà |

## Risks
- `WriteTimeout=5m` sẽ cut off stream nếu user nghe nhạc > 5 phút qua một request duy nhất — thực tế `http.ServeFile` dùng range request nên browser tự re-request từng chunk, không bị ảnh hưởng
- Thumbnail cloak-proxy: nếu cloak-proxy API `/fetch` trả body là raw bytes hay JSON tùy version — cần verify format response của cloak-proxy

## Plan (đã thực hiện)
1. ✅ Thêm `panicRecovery` middleware với 64KB stack buffer
2. ✅ Replace `http.ListenAndServe` → `http.Server` với timeouts
3. ✅ Thêm stream URL cache (TTL 4h) trong `youtube.go`
4. ✅ Route thumbnail qua cloak-proxy, fallback placeholder JPEG
5. ✅ `Watch(ctx)` goroutine trong `hls/manager.go`
6. ✅ `exec.CommandContext` 2h timeout cho ffmpeg
7. ✅ Thumbnail cover ưu tiên `maxresdefault` (1280×720) thay vì `mqdefault`
8. ✅ Download YouTube: `--embed-metadata` (embed title/artist vào file tag) + `--write-thumbnail` + `--convert-thumbnails jpg` → copy cover vào coversDir đồng bộ, clean up music dir
9. ✅ Reverse Proxy cho YouTube stream handler (`api/youtube.go`) hỗ trợ HTTP Range `206 Partial Content` để tua mượt mà
10. ✅ Cấu hình Nginx (`nginx.conf`) tắt proxy buffering cho YouTube stream endpoint

## Success criteria
- `[PANIC]` log xuất hiện khi có panic thay vì container restart
- `[yt-dlp] stream <id>` chỉ log lần đầu; lần 2 trong 4h không log → cache hit
- `[cover] yt thumbnail` log khi thumbnail fail, UI vẫn show placeholder thay vì broken icon
- `[hls] watcher:` log sau 30s nếu có active transcode job
- `[hls] ffmpeg done <id>: context deadline exceeded` nếu ffmpeg hang quá 2h

## Notes
- `WriteTimeout` không ảnh hưởng SSE `/api/ai/chat/stream` vì SSE dùng long-polling riêng — cần verify nếu SSE bị cut ở 5 phút
- Cloak-proxy `/fetch` POST format cần kiểm tra: nếu trả JSON wrapping thì body parse sẽ sai, cần adjust handler
- Stream URL cache chỉ in-memory — restart server là mất cache, acceptable vì TTL ngắn
- `--embed-metadata` không cần tool phụ; `--convert-thumbnails jpg` cần ffmpeg (đã có trong container)
- `id8hex()` trong `youtube.go` phải sync với `id8()` trong `scanner.go` (SHA-256, lowercase, trim, 8 bytes) — nếu scanner thay đổi thì phải update theo
- Thumbnail cũ đã cache ở `mqdefault` vẫn là 320×180; chỉ thumbnail chưa cache mới lấy `maxresdefault`

## Origin
- **Draft:** `wiki/sources/draft/020626-reliability-fixes-streaming-be.md`
- **Commit:** _(filled by `verify-before-commit`)_
- **Date promoted:** _(filled by `verify-before-commit`)_
