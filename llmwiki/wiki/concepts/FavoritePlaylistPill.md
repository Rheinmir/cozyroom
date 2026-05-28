---
name: FavoritePlaylistPill
description: Playlists Management via FavoritePill - local storage (localStorage) and permanent storage (SQLite + owner712002 password verification)
---

# FavoritePlaylistPill

Tính năng quản lý danh sách phát (playlist) thông minh tích hợp trực tiếp bên cạnh mỗi bài hát dưới dạng một cụm nút bấm Capsule/Pill đa năng `[ ★ | ▾ ]`. Hệ thống cung cấp cơ chế lưu trữ kép linh hoạt: lưu trữ cục bộ (Local Playlists) và lưu trữ đồng bộ trên máy chủ (Permanent Playlists) được bảo mật bằng mật khẩu của chủ sở hữu.

---

## Component Giao diện (FavoritePill UI)

Cụm nút `FavoritePill.tsx` hiển thị bên phải của mỗi dòng bài hát trong các bảng danh sách (Trang Album, Nghệ sĩ, Tìm kiếm, Playlists):
1. **Nút Star (★)**: 
   - Đánh dấu nhanh bài hát có thuộc playlist yêu thích mặc định hay không.
   - Nhấp chuột để bật/tắt (toggle) trạng thái yêu thích ngay lập tức.
2. **Nút Dropdown (▾)**:
   - Nhấp chuột để mở rộng menu danh sách các playlist hiện có.
   - Cho phép tích chọn hoặc bỏ chọn nhiều playlist để thêm/xóa bài hát cùng một lúc.
   - Hiển thị rạch ròi giữa 2 vùng: **Local Playlists** và **Permanent Playlists**.

---

## Chế độ lưu trữ kép (Storage Modes)

| Đặc tính | Local Playlists (Cục bộ) | Permanent Playlists (Vĩnh viễn) |
|----------|--------------------------|--------------------------------|
| **Vị trí lưu** | Trình duyệt (`localStorage`) | Máy chủ (Cơ sở dữ liệu SQLite) |
| **Xác thực** | Không yêu cầu mật khẩu | Yêu cầu mật khẩu chủ: `owner712002` |
| **Độ bền vững** | Bị xóa nếu xóa cache/cookie | Lưu vĩnh viễn, đồng bộ trên các thiết bị |
| **Giới hạn** | Chỉ hoạt động trên trình duyệt hiện tại | Hoạt động mọi lúc mọi nơi |

### Cơ chế Gate Mật khẩu
Đối với các thao tác ghi dữ liệu vĩnh viễn (Permanent):
- Khi người dùng tạo hoặc thêm bài hát vào playlist vĩnh viễn lần đầu, giao diện sẽ kích hoạt một Popup/Modal yêu cầu nhập mật khẩu.
- Nếu nhập đúng mật khẩu `owner712002`, thông tin sẽ được lưu trữ và ghi nhớ trong phiên làm việc để tránh việc phải nhập lại nhiều lần. Nhập sai sẽ hiển thị thông báo lỗi và từ chối ghi dữ liệu.

---

## Database Schema (Bảng SQLite trên Server)

Hệ thống bổ sung 2 bảng mới trong file `db.go` phục vụ lưu trữ Permanent Playlists:

```sql
CREATE TABLE IF NOT EXISTS playlists (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id  TEXT NOT NULL,
    track_id     TEXT NOT NULL,
    position     INTEGER NOT NULL,
    added_at     INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (playlist_id, track_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);
```

---

## Backend API Endpoints (`backend/internal/api/routes.go`)

Để thực thi ghi dữ liệu Permanent lên máy chủ, các endpoint sau đã được cấu trúc và xác thực nghiêm ngặt bằng mật khẩu chủ sở hữu gửi kèm qua request body:

- `GET /api/playlists` -> Lấy danh sách playlist vĩnh viễn.
- `POST /api/playlists` -> Tạo mới một playlist vĩnh viễn (Body: `{ name, password }`).
- `DELETE /api/playlists/{id}` -> Xóa playlist vĩnh viễn (Yêu cầu gửi kèm `password`).
- `POST /api/playlists/{id}/tracks` -> Thêm track vào playlist vĩnh viễn (Body: `{ track_id, password }`).
- `DELETE /api/playlists/{id}/tracks/{track_id}` -> Xóa track khỏi playlist vĩnh viễn (Yêu cầu gửi kèm `password`).

---

## Files

| Đường dẫn file | Vai trò thay đổi |
|----------------|------------------|
| [backend/internal/db/db.go](file:///C:/Users/olive/orca/workspaces/home-spotify/m/backend/internal/db/db.go) | Thực hiện migration tạo bảng `playlists` và `playlist_tracks` |
| [backend/internal/api/routes.go](file:///C:/Users/olive/orca/workspaces/home-spotify/m/backend/internal/api/routes.go) | Định nghĩa các routes quản lý playlist và check password `owner712002` |
| [frontend/src/components/FavoritePill.tsx](file:///C:/Users/olive/orca/workspaces/home-spotify/m/frontend/src/components/FavoritePill.tsx) | Thành phần UI Capsule `[★ ▾]` và logic xử lý localStorage + API client |
| [frontend/src/pages/PlaylistsPage.tsx](file:///C:/Users/olive/orca/workspaces/home-spotify/m/frontend/src/pages/PlaylistsPage.tsx) | Trang quản lý danh sách phát: Hiển thị, phát nhạc, tạo và dọn dẹp playlist |

---

## Related

- [[concepts/Scanner]] — Tương tác ID bài hát trong danh sách quét
- [[concepts/Architecture]] — Routing và thiết kế Go handlers
- [[concepts/CleanArchitecture]] — Tính độc lập của dữ liệu cục bộ và server

---

## Origin

- Draft: `llmwiki/wiki/sources/draft/260525-favorite-playlist-pill.md`
- Implemented: 2026-05-25 (Hoàn thiện cụm Capsule Pill, local cache và backend permanent SQLite)
