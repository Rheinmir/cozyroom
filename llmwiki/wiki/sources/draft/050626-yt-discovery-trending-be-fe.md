# 050626-yt-discovery-trending-be-fe

**Type:** draft
**Status:** proposed
**Tags:** propose, youtube, discovery, trending
**Proposed:** 2026-06-05

## Vấn đề

Smart queue chỉ mix nhạc trong thư viện local. Không có cách khám phá bài mới từ YouTube theo gu, đặc biệt mấy bài đang trending. Muốn: nghe trending YT → thích → tải → vào thư viện.

---

## Plan

- [ ] **Task 1 — BE: `GET /api/youtube/trending`**
  Fetch YouTube Music trending charts qua yt-dlp `--flat-playlist --dump-json`.
  - Params: `?country=VN|global` (default VN)
  - Dùng playlist cố định:
    - VN: `https://music.youtube.com/playlist?list=PL4fGSI1pDJn6jDKYIGFSIDcWyoZlLNNbT` (VN Hot)
    - Global: `https://music.youtube.com/playlist?list=PLFgquLnL59akA2PflFpeQG9L01VFg90wS` (Global Top)
  - Cache 1h (trending không đổi quá nhanh)
  - Return: `[]YouTubeResult` — cùng format hiện tại (id, title, uploader, thumbnail, duration)

- [ ] **Task 2 — BE: `GET /api/youtube/related?id=VIDEO_ID`**
  Fetch related/recommended videos cho bài đang phát.
  - Dùng `yt-dlp --dump-json VIDEO_URL` → extract field `related_videos` (hoặc `entries` nếu dùng `--flat-playlist` trên watch URL)
  - Fallback: search YouTube `"artist name" music` nếu yt-dlp không trả related
  - Return: `[]YouTubeResult` (top 5-8 gợi ý)
  - Cache 30min per video ID

- [ ] **Task 3 — FE: Tab "Khám phá" trong SearchPage**
  Thêm tab mới cạnh kết quả search:
  - `Trending VN` / `Trending Global` — hiện danh sách từ `/api/youtube/trending`
  - Mỗi bài: thumbnail, tên, uploader + nút ▶ Stream + nút ⬇ Tải
  - Auto-load khi vào Search page (không cần gõ gì)

- [ ] **Task 4 — FE: "Bài liên quan" trong Now Playing**
  Khi đang stream bài YouTube (không phải local), hiện panel nhỏ "Có thể thích" dưới phần lyrics/info:
  - Gọi `/api/youtube/related?id=...` 
  - Hiện 3-5 gợi ý với nút Stream / Tải
  - Click stream → phát ngay (thêm vào queue)

- [ ] **Task 5 — BE: `GET /api/youtube/discovery?seed_track_id=ID`** *(optional — có thể để sau)*
  Discovery dựa trên gu (theo track local đang phát):
  - Lấy artist/title của bài local → search YouTube → lấy top result → gọi `/related`
  - Trả về 8-10 gợi ý YouTube để stream/tải
  - MCP tool `discover_youtube(seed_track_id)` để AI agent cũng dùng được

---

## Files sẽ tạo/sửa

| File | Action | Lý do |
|------|--------|-------|
| `backend/internal/api/youtube.go` | modified | Thêm handler `trending`, `related` |
| `backend/internal/api/routes.go` | modified | Register routes mới |
| `frontend/src/pages/SearchPage.tsx` | modified | Thêm tab Trending |
| `frontend/src/api.ts` | modified | Thêm `fetchYouTubeTrending`, `fetchYouTubeRelated` |
| `frontend/src/i18n/en.json` | modified | i18n keys mới |
| `frontend/src/i18n/vi.json` | modified | i18n keys mới |

---

## Risks

- YouTube Music playlist ID thay đổi theo thời gian → cần fallback hoặc user config
- yt-dlp `related_videos` field không ổn định giữa các version → fallback về search
- Cold start: lần đầu fetch trending mất 3-5s (yt-dlp chậm) → loading state + cache

---

## Out of scope

- Không làm auto-play radio mode (chỉ gợi ý, user tự chọn stream/tải)
- Không integrate với Last.fm recommendations
- Task 5 (discovery by seed) có thể làm sau khi Tasks 1-4 ổn định

---

## Origin
- **Draft:** `wiki/sources/draft/050626-yt-discovery-trending-be-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
