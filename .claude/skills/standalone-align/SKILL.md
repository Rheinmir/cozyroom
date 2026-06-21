# Skill: standalone-align

Align live app UI với `Cozyroom (standalone).html` reference design.

## Trigger

Invoke khi: user nói page trông khác reference, "nhìn không giống mẫu", "align với standalone", hoặc `/standalone-align`

## Nguồn sự thật

Reference: `C:\Users\olive\orca\cozyroom\Cozyroom (standalone).html`  
Live: `https://music.giatbh.io.vn`

## Per-page spec (đã extract — dùng lại, đừng re-parse)

| Page | Route | Chip label | Page title | Layout |
|------|-------|------------|------------|--------|
| Nghệ sĩ | `/` | `Thư viện` | `Nghệ sĩ` | artist-grid |
| Phim | `/videos` | `Bộ sưu tập` | `Phim` | video-poster-grid (portrait 2/3) |
| Sách điện tử | `/ebooks` | `Kệ sách` | `Your Bookshelf` | ebooks-grid |
| Truyện tranh | `/comics` | `Tủ truyện` | (multi-tab) | download-card tabs |
| Xu hướng | `/trending` | `Bảng xếp hạng` | `Xu hướng trên GitHub` | chart + grid toggle |
| Playlists | `/playlists` | `Bộ sưu tập` | (i18n: nav.playlists) | playlist grid |
| Trợ lý AI | `/ai` | `TRỢ LÝ` | `Trợ lý AI` | ai-page (row avatar layout) |

**Chip files:**
- `frontend/src/pages/ArtistsPage.tsx:29`
- `frontend/src/pages/VideosPage.tsx:68,85`
- `frontend/src/pages/EbooksPage.tsx:199`
- `frontend/src/pages/ComicsPage.tsx:391`
- `frontend/src/pages/TrendingPage.tsx:129`
- `frontend/src/pages/PlaylistsPage.tsx:307`
- AIAssistantPage: `<div className="ai-page">` → chip "TRỢ LÝ" + h1 "Trợ lý AI" + blue avatar (✦) per assistant bubble

## 5-bước workflow (khi có trang bị sai)

### T1 — Extract từ standalone.html

Đọc file standalone.html, grep các object config:
```bash
grep -o '"kicker":"[^"]*"' "Cozyroom (standalone).html"
grep -o '"title":"[^"]*"' "Cozyroom (standalone).html"
grep -o 'posterMeta[^;]*' "Cozyroom (standalone).html"
```

Key patterns cần tìm:
- `kicker:` → chip label
- `title:` → page title  
- `ph:` → placeholder text
- `note:` → empty state text
- CSS vars: `--bg`, `--green`, `--radius` etc.

### T2 — Screenshot đúng cách

**⚠️ KHÔNG dùng `waitUntil: 'networkidle'`** — API chậm (ebooks, videos) sẽ luôn ở loading state.

Dùng `waitForSelector` với element chứa **real data**:

```javascript
// Trending — đợi repo cards
await page.waitForSelector('.repo-card', { timeout: 15000 })

// Ebooks — đợi ebook cards  
await page.waitForSelector('.ebook-card', { timeout: 15000 })

// Videos — đợi poster grid
await page.waitForSelector('.video-poster-card', { timeout: 15000 })

// Artists — đợi artist grid
await page.waitForSelector('.artist-card', { timeout: 10000 })

// AI Chat — đợi messages
await page.waitForSelector('.ai-messages', { timeout: 8000 })
```

Nếu timeout → ghi nhận "API slow" và screenshot state hiện tại.

### T3 — Diff

So sánh screenshot với spec. Format report:

```markdown
| Page | File | Line | Current | Expected |
|------|------|------|---------|----------|
| Sách điện tử | EbooksPage.tsx | 199 | "Thư viện" | "Kệ sách" |
```

**Hay gặp nhất:**
- Chip label sai → đổi string trong `<div className="library-tag">...</div>`
- Page title sai → đổi string trong `<h1 className="page-title">...</h1>`
- AIAssistantPage có chip → XÓA (spec: no chip, no h1)
- Layout sai (Netflix rows vs poster grid) → xem VideosPage.tsx như mẫu

### T4 — Apply

Surgical edits — chỉ sửa đúng dòng trong diff report. Không refactor xung quanh.

Sau khi sửa TSX: `tsc --noEmit` để bắt type error.

CSS changes serialize (không parallel) vì cùng edit `index.css`.

### T5 — Verify

```bash
# Deploy frontend
wsl -d Ubuntu-22.04 -- bash -c "
  cd /mnt/c/Users/olive/orca/cozyroom &&
  docker build -t 100.88.197.64:5000/cozyroom-frontend:k8s -f Dockerfile.frontend . 2>&1 | tail -3 &&
  docker push 100.88.197.64:5000/cozyroom-frontend:k8s 2>&1 | tail -2 &&
  kubectl rollout restart deployment/frontend -n cozyroom-k8s &&
  kubectl rollout status deployment/frontend -n cozyroom-k8s --timeout=90s
"
```

Re-screenshot với `waitForSelector` → compare vs spec → ✓ hoặc loop T4.

## CSS Key Values (standalone reference)

```css
:root {
  --bg: #050505;
  --surface: #0e0e13;
  --elevated: #111118;
  --green: #a855f7;      /* primary purple */
  --green-hover: #c084fc;
  --purple: #a855f7;
  --text: rgba(255,255,255,.92);
  --text-muted: rgba(255,255,255,.55);
  --text-faint: rgba(255,255,255,.32);
  --radius: 13px;
}

/* Card glassmorphism */
.card {
  background: rgba(255,255,255,.035);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.06);
  border-radius: 13px;
}
.card:hover {
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.13),
              0 28px 56px -26px rgba(0,0,0,.95),
              0 0 50px -14px rgba(168,85,247,.32);
  transform: translateY(-5px);
}
```

## Lịch sử áp dụng

| Date | Scope | Commit |
|------|-------|--------|
| 2026-06-21 | Chip labels 5 pages + Phim poster grid | e21e5a4 |
| 2026-06-21 | AI chat — xác nhận không cần chip (spec: custom layout) | — |
| 2026-06-21 | Workflow distilled thành skill này | cb47934 |
| 2026-06-21 | AI chat — chip + h1 + avatar applied | a3c1af2 |

## Bài học từ run đầu tiên

1. **waitForSelector vs networkidle**: `networkidle` timeout trước khi ebooks/videos load. Phải dùng `waitForSelector('.ebook-card')`.

2. **CSS không parse được từ minified HTML bằng grep đơn giản** — phải đọc trực tiếp bằng Read tool và tìm bằng pattern matching.

3. **AI chat page CÓ chip+heading** — đã implement 2026-06-21 (commit a3c1af2). Chip "TRỢ LÝ", h1 "Trợ lý AI", avatar ✦ mỗi assistant bubble.
