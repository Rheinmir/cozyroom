---
name: 260525-favorite-playlist-pill
description: Proposal & Implementation Plan — Favorite Playlist Pill (Star + Dropdown) with Local & Permanent Storage (owner712002)
---

# Proposal: Favorite Playlist Pill with Local & Permanent Storage

Đề xuất bổ sung tính năng quản lý playlist yêu thích trực quan dưới dạng một nút bấm đa năng dạng "viên thuốc" (Favorite Pill). Người dùng có thể nhanh chóng "thả sao" yêu thích một bài hát, hoặc mở menu dropdown bên cạnh để phân loại bài hát vào các playlist khác nhau. Hệ thống hỗ trợ cả chế độ lưu trữ cục bộ (Local Playlists) và chế độ lưu trữ vĩnh viễn trên máy chủ (Permanent Playlists) được bảo mật bằng mật khẩu chủ sở hữu.

---

## 1. Restated Request
- **Thành phần giao diện (UI Pill Component)**: Một nút bấm dạng viên thuốc (pill) xuất hiện bên cạnh mỗi bài hát, gồm hai khu vực:
  1. **Nút Star (Hình ngôi sao)**: Bấm nhanh để bật/tắt (toggle) trạng thái yêu thích của bài hát trong playlist mặc định.
  2. **Nút Dropdown (Mũi tên chỉ xuống)**: Bấm vào sẽ mở menu hiển thị danh sách các playlist để chọn thêm bài hát vào (hoặc gỡ ra).
- **Chế độ lưu trữ Playlist (Storage Modes)**:
  1. **Local Playlists (Cục bộ)**: Lưu trữ tạm thời trên trình duyệt của người dùng (sử dụng `localStorage` hoặc `IndexedDB`). Không yêu cầu mật khẩu.
  2. **Permanent Playlists (Vĩnh viễn)**: Lưu trữ lâu dài trong cơ sở dữ liệu SQLite của máy chủ. Để tạo hoặc thêm bài hát vào chế độ này, người dùng phải nhập đúng mật khẩu chủ sở hữu: `owner712002`.

---

## 2. Affected Components & Files
- **Database Schema (`backend/internal/db/db.go`)**:
  - Tạo bảng `playlists` và `playlist_tracks` để lưu trữ thông tin playlist vĩnh viễn trên máy chủ.
- **Backend API (`backend/internal/api/` & `routes.go`)**:
  - Viết các API handler để tạo/xóa playlist vĩnh viễn và thêm/xóa bài hát khỏi playlist.
  - Xác thực mật khẩu `owner712002` khi thực hiện các thao tác chỉnh sửa playlist vĩnh viễn.
- **Frontend Components (`frontend/src/components/` & `pages/`)**:
  - Viết component `FavoritePill.tsx` (Star + Dropdown).
  - Tích hợp logic lưu trữ `localStorage` cho Local Playlists.
  - Tích hợp modal nhập mật khẩu chủ sở hữu cho Permanent Playlists.
  - Cập nhật trang quản lý danh sách phát (Playlists Page).

---

## 3. Potential Side Effects & Breakage
- **No breaking changes**: Cơ chế cơ sở dữ liệu cũ và luồng phát nhạc không bị ảnh hưởng.
- **Security Check**: Mật khẩu được mã hóa hoặc kiểm tra trực tiếp ở mức độ đơn giản trên máy chủ; không lưu mật khẩu dạng raw plain text trên client lâu dài.

---

## 4. Proposed Implementation Plan

### A. Database Schema
Thêm hai bảng mới vào SQLite thông qua hàm `migrate` trong [db.go](file:///C:/Users/olive/orca/workspaces/home-spotify/m/backend/internal/db/db.go):
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

### B. Backend API Routes
Thêm các endpoint mới trong [routes.go](file:///C:/Users/olive/orca/workspaces/home-spotify/m/backend/internal/api/routes.go):
- `GET /api/playlists` -> Lấy danh sách playlist vĩnh viễn.
- `POST /api/playlists` -> Tạo mới playlist vĩnh viễn (Body chứa `name` và `password`).
- `DELETE /api/playlists/{id}` -> Xóa playlist vĩnh viễn (Yêu cầu `password`).
- `POST /api/playlists/{id}/tracks` -> Thêm track vào playlist vĩnh viễn (Yêu cầu `password`).
- `DELETE /api/playlists/{id}/tracks/{track_id}` -> Xóa track khỏi playlist vĩnh viễn (Yêu cầu `password`).

Xác thực mật khẩu đơn giản trên Go backend:
```go
const OwnerPassword = "owner712002"
// Kiểm tra password == OwnerPassword trước khi thay đổi dữ liệu vĩnh viễn.
```

### C. Frontend logic
1. **FavoritePill Component**:
   - Nút ngôi sao toggle bài hát vào playlist mặc định `"Favorites"`.
   - Nút mũi tên dropdown mở menu hiển thị danh sách các playlist cục bộ và vĩnh viễn.
2. **Local vs Permanent Storage**:
   - Đối với **Local Playlists**, lưu danh sách vào `localStorage` dưới dạng JSON (ví dụ: `cozyroom_local_playlists`).
   - Đối với **Permanent Playlists**, gửi API request lên backend. Nếu chưa có mật khẩu lưu trong phiên làm việc (Session/State), hiển thị một Modal yêu cầu nhập mật khẩu. Nếu nhập đúng `owner712002`, thực hiện lưu và ghi nhớ token/password trong memory cho các lần thao tác tiếp theo.
3. **Playlists View**:
   - Thêm tab hoặc trang "Playlists" trên thanh điều hướng bên trái (Sidebar) để hiển thị danh sách các playlist cục bộ lẫn vĩnh viễn và cho phép phát nhạc từ các danh sách phát này.

---

## 5. Success Criteria
- Người dùng có thể đánh dấu sao nhanh bài hát từ mọi danh sách bài hát (Search, Album, Artist).
- Menu thả xuống (dropdown) hoạt động mượt mà, cho phép tích chọn nhiều playlist để thêm bài hát vào.
- Tự động hiển thị và phân biệt giữa Playlist Cục bộ (Local) và Playlist Vĩnh viễn (Permanent).
- Nhập đúng mật khẩu `owner712002` thì mới ghi nhận playlist vĩnh viễn lên cơ sở dữ liệu máy chủ thành công. Nhập sai sẽ hiển thị thông báo lỗi.
- Xóa cache trình duyệt thì Playlist Cục bộ bị mất, nhưng Playlist Vĩnh viễn vẫn còn nguyên vẹn.

## Origin
- legacy backfill (harness-update) — commit gần nhất: 7c8f2f4 2026-05-28
