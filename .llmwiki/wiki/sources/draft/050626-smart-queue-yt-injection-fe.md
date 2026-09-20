# 050626-smart-queue-yt-injection-fe

**Type:** draft
**Status:** proposed
**Tags:** propose, youtube, smart-queue, discovery
**Proposed:** 2026-06-05

## Vấn đề

Smart queue (shuffle "smart") chỉ dùng local library. User không thể tình cờ phát hiện bài YouTube mới trong khi nghe nhạc bình thường.

## Mục tiêu

Khi bật smart shuffle, queue tự động trộn thêm YouTube tracks chưa có trong thư viện. User nghe nhạc bình thường → vô tình gặp bài hay → tải về nếu thích.

---

## Plan

- [ ] **Task 1 — FE: `fillSmartQueue` inject YouTube**

  File: `frontend/src/PlayerContext.tsx`  
  Hàm: `fillSmartQueue()` (line ~195)

  Thêm logic:
  ```
  [song song]
  A) fetch /api/smart-queue?seed=... → local tracks (giữ nguyên)
  B) fetch YouTube:
     - nếu current track là yt:ID → /api/youtube/related?id=ID
     - nếu current track là local  → /api/youtube/search?q=ARTIST+TITLE (top 5)
  
  [mix]
  - Gộp A (7 bài) + B (2-3 bài) → shuffle → push vào queue
  - Chỉ inject YouTube nếu có kết quả (không break nếu YouTube timeout)
  - YouTube tracks sẽ có id: "yt:VIDEO_ID" — PlayerContext đã xử lý được
  ```

- [ ] **Task 2 — FE: Add `?seed=` param to smart-queue fetch**

  Gửi `seed_track_id` = current track ID (bỏ prefix `yt:`) lên BE để BE có thể scoring tốt hơn (optional, BE hiện ignore unknown params).

- [ ] **Task 3 — FE: YouTube track trong queue cần show đúng UI**

  Khi track trong queue có `yt:` prefix:
  - Show thumbnail từ `https://i.ytimg.com/vi/VIDEO_ID/mqdefault.jpg`
  - Show badge nhỏ "YT" bên cạnh tên bài
  - Click "tải về" → gọi `/api/youtube/download`

---

## Files sẽ sửa

| File | Action | Lý do |
|------|--------|-------|
| `frontend/src/PlayerContext.tsx` | modified | inject YouTube vào fillSmartQueue |
| `frontend/src/components/PlayerBar.tsx` | modified | show YT badge + thumbnail trong queue/mini-player |
| `frontend/src/api.ts` | check only | fetchYouTubeRelated đã có, fetchSmartQueue đã có |

---

## Risks

- YouTube search/related có thể chậm (~2-5s) → phải không block queue (Promise.allSettled, timeout)
- Bài YouTube trong queue chưa bao giờ được tải → stream live (tốn bandwidth, cần net)
- Cùng bài xuất hiện nhiều lần → dedup bằng id trước khi push queue

---

## Out of scope

- Không đổi backend smart-queue algorithm
- Không persist YouTube track vào DB khi chỉ play (chỉ khi user bấm Tải)

---

## Origin
- **Draft:** `wiki/sources/draft/050626-smart-queue-yt-injection-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
