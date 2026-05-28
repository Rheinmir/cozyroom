---
name: YouTubeIntegration
description: YouTube Search, Stream, Download và Channel Browse trong Search page — via yt-dlp backend
---

# YouTube Integration

Tích hợp YouTube trực tiếp vào Search page: tìm kiếm, stream nhạc không tải về, tải về thư viện, duyệt kênh, và search trong kênh.

## Architecture

```
[Frontend SearchPage]
    ↓ /api/youtube/search?q=
    ↓ /api/youtube/channel?url=&offset=&q=
    ↓ /api/youtube/stream/{id}          → proxy audio stream
    ↓ /api/youtube/download             → tải về /music + scan
[Backend YouTubeHandlers]
    ↓ exec yt-dlp
[YouTube CDN / servers]
```

## Backend: `YouTubeHandlers` (`api/youtube.go`)

### Cấu trúc

```go
type YouTubeHandlers struct {
    db        *sql.DB
    musicPath string   // /music — nơi lưu file download
    coversDir string   // /data/covers
}
```

### Endpoints

| Method | Path | Mô tả |
|--------|------|--------|
| `GET` | `/api/youtube/search?q=` | Tìm top 10 video trên YouTube |
| `GET` | `/api/youtube/channel?url=&offset=&q=` | Duyệt /videos (20/trang) hoặc tìm trong kênh |
| `GET` | `/api/youtube/stream/{id}` | Proxy audio stream trực tiếp từ YouTube |
| `POST` | `/api/youtube/download` | Tải audio về `/music`, quét vào library |
| `POST` | `/api/youtube/update-tools` | Cập nhật yt-dlp lên latest |

### Search (`yh.search`)

```
yt-dlp --flat-playlist --dump-single-json "ytsearch10:{q}"
```

- Trả về `[]youtubeSearchResult` (JSON)
- Fields: `id`, `title`, `duration` (int), `thumbnail`, `uploader`, `channel_url`
- `duration` unmarshalled từ float64 của yt-dlp

### Channel Browse & Search (`yh.channel`)

**Browse mode** (không có `q`):
```
yt-dlp --flat-playlist --dump-single-json \
  --playlist-start {offset+1} --playlist-end {offset+20} \
  {channelURL}/videos
```

**Search mode** (có `q`):
```
yt-dlp --flat-playlist --dump-single-json \
  --playlist-end 20 \
  {channelURL}/search?query={q}
```

- `offset` mặc định 0, mỗi page = 20 videos
- URL tự động strip `/videos` hay `/search` suffix để lấy base URL
- Khi `uploader` rỗng → derive từ channel URL

### Stream (`yh.stream`)

```
yt-dlp -f bestaudio -g "https://youtube.com/watch?v={id}"
```

- Lấy direct audio URL (thường là `.webm`/`.opus`)
- Proxy HTTP với `io.Copy` — client nhận byte stream
- Hỗ trợ Range header nếu upstream support

### Download (`yh.download`)

```json
POST /api/youtube/download
{"id": "videoId", "title": "optional", "artist": "optional"}
```

1. `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "/music/%(title)s.%(ext)s"` 
2. Download cover từ YouTube thumbnail → `/data/covers/yt_{id}.jpg`
3. Tag MP3 với title + artist (nếu có)
4. Gọi `library.Scan()` → track xuất hiện ngay trong library

## Frontend

### `SearchPage.tsx`

Khi có query, hiển thị 2 section:
1. **Local results** (artists, albums, tracks)  
2. **YouTube results** — luôn hiển thị nếu có kết quả

#### `YouTubeRow` component

```
[thumbnail] Title                    [duration] [Stream] [Download]
            channel_name (clickable)
```

- Ấn tên kênh → chuyển sang **Channel View** (`selectedChannel` state)
- Nút **Stream** → play ngay qua PlayerContext (track ảo `id: "yt:{id}"`)
- Nút **Download** → POST `/api/youtube/download` → trạng thái loading/done/failed

#### `ChannelView` component

- Header: avatar (chữ cái đầu) + tên kênh + đếm video đã load
- **Search bar**: `[ 🔍 Search in {name}… ] [Search]`
  - Enter hoặc click Search → `doSearch()` → `fetchYouTubeChannel(url, 0, q)`
  - ✕ → `clearSearch()` → quay về browse mode
- Browse mode: load 20 video đầu, nút **Load 20 more** (paginated)
- Search mode: 20 kết quả, không paginate
- Nút **← Search** quay về kết quả search gốc

### `api.ts` — Functions

```typescript
searchYoutube(q: string): Promise<YouTubeResult[]>
fetchYouTubeChannel(url: string, offset = 0, q = ''): Promise<YouTubeResult[]>
downloadYoutube(id, title?, artist?): Promise<{ status, tracks_scanned }>
```

### Type `YouTubeResult`

```typescript
type YouTubeResult = {
  id: string
  title: string
  duration: number      // seconds
  thumbnail: string     // https://i.ytimg.com/vi/{id}/mqdefault.jpg
  uploader: string
  channel_url: string   // https://www.youtube.com/@channelName
}
```

## Star Delta Fix

`star_delta` trong `trending_daily` là delta giữa 2 snapshot liên tiếp (thường vài giờ, rất nhỏ). API trending giờ tính lại:

```sql
d.stars - COALESCE((
  SELECT stars FROM trending_star_history
  WHERE repo_id = r.id ORDER BY sampled_at ASC LIMIT 1
), d.stars) AS star_delta
```

→ Star gain thực tế kể từ lần đầu tracking (hàng trăm đến hàng nghìn).

## YouTube Downloads Consolidation & Scanner Protection

Để quản lý thư viện khoa học và bảo vệ thông tin các bản nhạc tải về từ YouTube:
1. **Quản lý Album riêng biệt**: Mỗi track tải về từ YouTube được tổ chức thành một album riêng độc lập (tên album trùng với tên track) dưới tên của Uploader/Kênh đăng tải (Artist name). Nhờ vậy, mỗi video nhạc xuất hiện như một "Single Album" chuyên nghiệp trong giao diện.
2. **Bảo vệ siêu dữ liệu khỏi Scanner**:
   - Ở đầu tiến trình quét thư viện (`library.Scan` trong `scanner.go`), trình quét kiểm tra tên tệp xem có khớp với định dạng 11 ký tự của YouTube Video ID hay không.
   - Nếu khớp và bản ghi bài hát đã tồn tại trong database SQLite, trình quét sẽ **bỏ qua ngay lập tức** tệp này. Cách này ngăn chặn Scanner tự động ghi đè thông tin bài hát thành `"Unknown Artist"/"Unknown Album"` khi tệp MP3 lưu trên đĩa bị thiếu thẻ tag ID3 chuẩn.
3. **Migration dữ liệu tự động**:
   - Một tiến trình tự động khởi chạy lúc backend startup (`migrateYouTubeTracks` trong `db.go`) để quét toàn bộ bài hát YouTube cũ.
   - Tiến trình tự động tách album riêng, cập nhật khóa ngoại `album_id`, tải về ảnh bìa (thumbnail) từ YouTube về `/data/covers/yt_{id}.jpg` và dọn dẹp các album rỗng.

## Download Flow chi tiết

```
POST /api/youtube/download {id, title, artist}
  │
  ├─ exec: yt-dlp -x --audio-format mp3 -o "/music/%(title)s.mp3"
  ├─ fetch thumbnail: https://i.ytimg.com/vi/{id}/mqdefault.jpg
  │    → save /data/covers/yt_{id}.jpg
  ├─ tag MP3: ID3 TIT2=title, TPE1=artist
  ├─ library.IndexFileWithMetadata(...) -> Tạo track ảo, gán album trùng title uploader
  └─ library.Scan() → (Trình quét tự động skip file ID YouTube để bảo vệ metadata)
       → return { status: "ok", tracks_scanned: N }
```

## yt-dlp dependency

- Installed in backend Docker image: `wget .../yt-dlp -O /usr/local/bin/yt-dlp`
- Update: `POST /api/youtube/update-tools` → `yt-dlp -U`
- Format selection: `bestaudio` cho stream; `-x --audio-format mp3 --audio-quality 0` cho download

## Related

- [[concepts/Scanner]] — library.Scan() được gọi sau download
- [[concepts/Architecture]] — routing overview
- `backend/internal/api/youtube.go`
- `frontend/src/pages/SearchPage.tsx`

## Origin

- Drafts: 
  - `llmwiki/wiki/sources/draft/240526-youtube-search-stream-download.md`
  - `llmwiki/wiki/sources/draft/240526-youtube-downloads-consolidation.md`
- Implemented: 2026-05-24
- Channel browse: 2026-05-24
- Channel search: 2026-05-24
- Downloads Consolidation: 2026-05-25 (Tách album riêng biệt, chặn Scanner overwrite, startup migrator)

