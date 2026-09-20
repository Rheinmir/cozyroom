---
name: APIReference
description: Toàn bộ HTTP API endpoints của Cozyroom backend — nhóm theo domain
---

# API Reference

Tất cả routes đăng ký trong `backend/internal/api/routes.go`. Backend lắng nghe `:8080`, expose qua nginx `:18080`.

## Health & Stats

| Method | Path | Mô tả |
|--------|------|--------|
| `GET` | `/api/health` | Health check → `{"status":"ok"}` |
| `GET` | `/api/stats` | Thống kê library: số artists, albums, tracks, videos, ebooks |
| `POST` | `/api/scan` | Trigger library rescan (async) |
| `GET` | `/metrics` | Prometheus metrics (HTTP count + duration) |

## Music Library

| Method | Path | Query | Mô tả |
|--------|------|-------|--------|
| `GET` | `/api/artists` | — | List tất cả artists (sorted name) |
| `GET` | `/api/artists/{id}` | — | Artist detail: name, album_count, track_count, genres[] |
| `GET` | `/api/albums` | `artist_id=` | List albums (all hoặc filter by artist) |
| `GET` | `/api/tracks` | `album_id=` | List tracks của album |
| `GET` | `/api/search` | `q=` | Full-text search artists + albums + tracks |
| `GET` | `/api/smart-queue` | `track_id=`, `limit=30` | Weighted random queue theo genre |
| `GET` | `/api/covers/{id}` | `w=` | Album cover (resize nếu có `w`) |
| `GET` | `/api/artist-images/{id}` | `w=` | Artist portrait từ Deezer |
| `GET` | `/stream/{id}` | — | Audio stream (Range headers, FLAC→MP3 transcode) |

## Lyrics

| Method | Path | Mô tả |
|--------|------|--------|
| `GET` | `/api/lyrics/{id}` | Fetch lyrics: sidecar → LRCLIB → NetEase → QQ Music (parallel) |
| `POST` | `/api/lyrics/{id}` | Lưu lyrics thủ công (`{"lrc": "..."}`) |
| `DELETE` | `/api/lyrics/{id}` | Xóa cache lyrics |
| `GET` | `/api/lyrics/{id}/translate` | Auto-translate lyrics → `lang=vi` (default) |

Response `GET`:
```json
{
  "results": [{"synced": [...], "plain": "...", "source": "lrclib"}],
  "sources": [{"source": "lrclib", "found": true, "lines": 42}],
  "cached": true
}
```

## Videos

| Method | Path | Mô tả |
|--------|------|--------|
| `GET` | `/api/videos` | List tất cả videos |
| `GET` | `/api/videos/{id}/stream` | Smart stream: direct nếu H264+AAC; HLS nếu cần transcode |
| `GET` | `/stream-video/{id}` | Raw video stream (legacy) |
| `GET` | `/api/video-posters/{id}` | Video poster/thumbnail |
| `GET` | `/api/trickplay/{id}` | Trickplay metadata (sprites grid info) |
| `GET` | `/api/trickplay/{id}/sprite` | Trickplay sprite image |
| `GET` | `/hls/{id}/{file}` | HLS segment serving (`.m3u8`, `.ts`) |

## Ebooks

| Method | Path | Mô tả |
|--------|------|--------|
| `GET` | `/api/ebooks` | List ebooks (PDF, EPUB) |
| `GET` | `/api/ebooks/{id}/content` | EPUB raw content |
| `GET` | `/api/ebooks/{id}/pages` | PDF: list pages với kích thước |
| `GET` | `/api/ebook-covers/{id}` | Ebook cover image |
| `GET` | `/api/ebooks/{id}/page/{n}` | PDF: render trang N thành PNG |
| `GET` | `/api/ebooks/{id}/asset` | EPUB asset (CSS, images) |
| `GET` | `/api/ebooks/{id}/toc` | EPUB Table of Contents |
| `POST` | `/api/ebooks/{id}/nsfw` | Toggle NSFW flag (`{"nsfw": true}`) |
| `POST` | `/api/ebooks/{id}/progress` | Lưu vị trí đọc |
| `POST` | `/api/ebooks/{id}/collection` | Gán vào collection |
| `GET` | `/api/ebook-covers/{id}` | `w=` Ebook cover (resizable) |

## Playback Resume

| Method | Path | Mô tả |
|--------|------|--------|
| `GET` | `/api/playback/progress/{type}/{id}` | Lấy vị trí dừng (`type`: `track`, `video`, `ebook`) |
| `POST` | `/api/playback/progress` | Lưu vị trí `{"type","id","position_s"}` |

## Last.fm

| Method | Path | Mô tả |
|--------|------|--------|
| `GET` | `/api/lastfm/status` | `{connected, username, configured}` |
| `POST` | `/api/lastfm/login` | Đăng nhập với session key |
| `DELETE` | `/api/lastfm/disconnect` | Ngắt kết nối |
| `POST` | `/api/lastfm/now-playing` | Gửi "Now Playing" |
| `POST` | `/api/lastfm/scrobble` | Scrobble track |

## Comics / Scraper

### MangaDex

| Method | Path | Mô tả |
|--------|------|--------|
| `GET` | `/api/scraper/md/latest` | Latest manga từ MangaDex |
| `GET` | `/api/scraper/md/search?q=` | Tìm manga |
| `GET` | `/api/scraper/md/chapters/{id}` | List chapters |
| `GET` | `/api/scraper/md/pages/{id}` | List page URLs của chapter |
| `GET` | `/api/scraper/md/img?url=` | Proxy image |

### E-Hentai

| Method | Path | Mô tả |
|--------|------|--------|
| `GET` | `/api/scraper/eh/latest` | Latest galleries (cached 6h) |
| `GET` | `/api/scraper/eh/search?q=&page=` | Tìm gallery |
| `GET` | `/api/scraper/eh/detail?url=` | Gallery detail |
| `GET` | `/api/scraper/eh/pages?url=` | Danh sách pages của gallery |
| `GET` | `/api/scraper/eh/image?url=` | Proxy image |

### Downloads (Offline Comics)

| Method | Path | Mô tả |
|--------|------|--------|
| `GET` | `/api/scraper/downloads` | List downloads đang/đã có |
| `DELETE` | `/api/scraper/downloads/{id}` | Xóa download |
| `POST` | `/api/scraper/downloads/{id}/retry` | Retry failed |
| `POST` | `/api/scraper/enqueue/eh/{gid}/{token}` | Queue tải EH gallery |
| `POST` | `/api/scraper/enqueue/md/{mangaId}` | Queue tải MD manga |
| `GET` | `/api/scraper/local/{id}/chapters` | List chapters đã tải |
| `GET` | `/api/scraper/local/{id}/{file...}` | Serve file local |

## GitHub Trending

| Method | Path | Mô tả |
|--------|------|--------|
| `GET` | `/api/trending` | `?date=YYYY-MM-DD` List trending repos với AI scoring |
| `GET` | `/api/trending/dates` | List các ngày có data |
| `GET` | `/api/trending/history?id=` | Star history snapshots của repo |
| `POST` | `/api/trending/refresh` | Trigger fetch mới từ GitHub + AI enrich |

`star_delta` trong response = `current_stars - earliest_tracked_stars` (không phải delta giữa 2 snapshot).

## YouTube

| Method | Path | Mô tả |
|--------|------|--------|
| `GET` | `/api/youtube/search?q=` | Tìm top 10 video YouTube |
| `GET` | `/api/youtube/channel?url=&offset=&q=` | Browse channel (offset paginate) hoặc search trong channel |
| `GET` | `/api/youtube/stream/{id}` | Proxy audio stream từ YouTube |
| `POST` | `/api/youtube/download` | Download audio MP3 → thư viện |
| `POST` | `/api/youtube/update-tools` | Cập nhật yt-dlp |

## Observability

Metrics middleware tự động track mọi request:
```
http_requests_total{method, path, status}
http_request_duration_seconds{method, path}
```

Paths được normalize: hex IDs (`/[0-9a-f]{16}`) → `{id}`.

## Origin

- Created: 2026-05-26
- Commit: 3ea64ba — chore(wiki): Add concept docs for new features

## Related

- [[concepts/Architecture]] — system overview
- [[concepts/YouTubeIntegration]] — YouTube chi tiết
- [[concepts/TrendingInsights]] — Trending backend
- [[concepts/Lyrics]] — Lyrics multi-source
- [[concepts/ComicsDownloader]] — offline download engine
