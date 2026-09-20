---
name: 270526-ai-media-card-playlist-covers
description: Proposal — AI chat rich media cards with inline play buttons + playlist cover mosaic gallery
metadata:
  type: source
---

# Proposal: AI Media Cards + Playlist Cover Gallery

## Feature 1 — AI Rich Media Card

### Mô tả

Khi AI trả lời về một bài hát (action `play_track` / `play_queue`), thay vì chỉ render nút text `▶ Tiêu đề — Nghệ sĩ`, hiển thị một media card đẹp như trong ảnh:

```
┌────────────────────────────┐
│   [album cover full-width] │
├────────────────────────────┤
│ 🎵 Em Hát Ai Nghe (Lofi)  │
│ 👤 Orange                  │
│ 💿 Em Hát Ai Nghe (Lofi)  │
│ 📅 2021-08-23              │
├────────────────────────────┤
│  ⏮  ▶ Phát  ⏭            │
└────────────────────────────┘
```

### Scope thay đổi

**backend/internal/mcp/registry.go**
- `playTrackTool`: add `album_title` + `year` fields to the result map
  ```go
  var albumTitle string
  var year int
  db.QueryRow(`SELECT al.title, COALESCE(al.year,0) FROM albums al WHERE al.id = ?`, albumID).Scan(&albumTitle, &year)
  // include in result: "album_title": albumTitle, "year": year
  ```

**frontend/src/pages/AIAssistantPage.tsx**
- `Action` interface: add `album_title?: string; year?: number`
- Add `MediaCard` component (~40 lines):
  - Props: `action: Action; onPlay: () => void; onNext: () => void; onPrev: () => void`
  - Cover: `<img src={/api/covers/${action.album_id}}` style width 100%, aspect-ratio 1, borderRadius top
  - Info rows: track title (bold), artist name, album title, year
  - Bottom: `⏮` `▶ Phát` `⏭` buttons row
- Replace the `a.type === 'play_track' ? <button>` block (line ~381-385) with `<MediaCard action={a} onPlay={() => executeAction(a)} onNext={() => player.next()} onPrev={() => player.prev()} />`
- For `play_queue` action type: show a `PlaylistCard` mini variant (first cover + "▶ Phát N bài")

**frontend/src/index.css**
- Add `.ai-media-card` styles: border-radius 12px, overflow hidden, background rgba(255,255,255,0.06), max-width 260px
- `.ai-media-card-cover`: width 100%, aspect-ratio 1/1, object-fit cover
- `.ai-media-card-info`: padding 10px 12px, font-size 13px
- `.ai-media-card-info span`: opacity 0.7 for secondary rows
- `.ai-media-card-controls`: flex, gap 8px, padding 8px 12px, button styles

### Điều kiện hiển thị
- Card chỉ render khi `action.album_id` có giá trị (tránh broken cover)
- Nếu không có `album_id` → fallback về nút text cũ

---

## Feature 2 — Playlist Cover Mosaic

### Mô tả

Thay `playlist-cover-placeholder` (hiện chỉ hiện `★`) bằng mosaic 2×2 ảnh cover của 4 album đầu tiên trong playlist, giống Spotify.

```
┌──────┬──────┐
│cover1│cover2│
├──────┼──────┤
│cover3│cover4│
└──────┴──────┘
```

Nếu playlist < 4 tracks → chỉ dùng số cover thực sự có (1, 2, 3 ảnh).
Nếu playlist rỗng → vẫn giữ `★` placeholder.

### Scope thay đổi

**backend/internal/api/playlists.go** (hoặc file handler playlists)
- `listPlaylists` handler: add cover_album_ids per playlist.
  Query thêm:
  ```sql
  SELECT DISTINCT al.id
  FROM playlist_tracks pt
  JOIN tracks t ON t.id = pt.track_id
  JOIN albums al ON al.id = t.album_id
  WHERE pt.playlist_id = ?
  ORDER BY pt.position
  LIMIT 4
  ```
  Cho mỗi perm playlist, thêm `cover_ids: []string` vào response JSON.
  (N+1 OK — số playlist nhỏ, query rất nhẹ)

**frontend/src/api.ts** (Playlist type)
- Add `cover_ids?: string[]` to `Playlist` interface

**frontend/src/pages/PlaylistsPage.tsx**
- Add `PlaylistCoverMosaic` component:
  ```tsx
  function PlaylistCoverMosaic({ coverIds }: { coverIds: string[] }) {
    if (coverIds.length === 0) return <div className="playlist-cover-placeholder">★</div>
    return (
      <div className="playlist-cover-mosaic">
        {coverIds.slice(0, 4).map(aid => (
          <img key={aid} src={`/api/covers/${aid}`} alt="" />
        ))}
      </div>
    )
  }
  ```
- Replace `<div className="playlist-cover-placeholder">★</div>` (both in grid card AND detail hero) with `<PlaylistCoverMosaic coverIds={list.cover_ids ?? []} />`
- For local playlists: `cover_ids` = `allTracks` filtered by `track_ids`, first 4 unique `album_id` values
  - Compute lazily only if `allTracks` loaded: `getLocalCoverIds(list.track_ids, allTracks)`
  - Helper: `function getLocalCoverIds(trackIds: string[], all: Track[]): string[]`

**frontend/src/index.css**
- Add `.playlist-cover-mosaic`: display grid, grid-template-columns: 1fr 1fr, gap 2px, width 100%, aspect-ratio 1
- `.playlist-cover-mosaic img`: width 100%, aspect-ratio 1, object-fit cover
- Keep `.playlist-cover-placeholder` for empty state

---

## Tradeoffs / Gotchas

- **Local playlist covers**: cần `allTracks` cache. Hiện tại `allTracks` chỉ load khi `isLocalSelected`. Cần lift lên mount level hoặc add `useQuery(['all-tracks'])` unconditionally (cheap GET).
- **album_title in MCP**: cần thêm DB scan 1 row — rất nhẹ, không ảnh hưởng performance.
- **MediaCard width**: bubble của AI có max-width. Card nên max-width 260px, không stretch full bubble width.
- **play_queue action**: hiện `play_queue` có `tracks[]` array. MediaCard cho playlist: show ảnh cover bài đầu + playlist name + số bài.

---

## Origin

Request từ user 2026-05-27 với screenshot Telegram media card. Xem:
- `frontend/src/pages/AIAssistantPage.tsx` line 379-388 (current actions render)
- `frontend/src/pages/PlaylistsPage.tsx` line 164, 261 (placeholder star)
- `backend/internal/mcp/registry.go` `playTrackTool` function
- [[MCPToolsCheatsheet]] — play_track action fields
- [[FavoritePlaylistPill]] — playlist type + local/perm split
