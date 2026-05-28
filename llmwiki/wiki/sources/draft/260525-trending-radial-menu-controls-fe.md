---
name: 260525-trending-radial-menu-controls-fe
description: Proposal & Implementation Plan — Moving Trending Page Controls to Nightingale Rose Radial Menu (Layer 3)
---

# Proposal: Tích hợp bộ nút điều hướng Trending vào Lớp thứ 3 của Radial Menu (Nightingale Rose)

Đề xuất loại bỏ các nút điều khiển trên header của trang Thịnh hành (`TrendingPage.tsx`) bao gồm các nút chuyển đổi chế độ xem (Biểu đồ / Lưới) và nút Làm mới (Refresh), chuyển chúng thành một vòng đồng tâm thứ 3 (Lớp thứ 3) nằm ngoài cùng của menu tròn Nightingale Rose. Các cánh hoa bổ sung này sẽ là các cánh hoa tùy chọn (optional), nhạt màu hơn và chỉ xuất hiện khi người dùng đang truy cập đúng trang `/trending`.

---

## 1. Restated Request
- **Loại bỏ UI cũ**: Xóa bỏ cụm toggle `Chart / Grid` và nút `Refresh` khỏi header của `TrendingPage.tsx`.
- **Thêm vòng tròn đồng tâm thứ 3 (Layer 3) vào Radial Nav**:
  - Khi ở trang `/trending`, Radial Menu hiển thị thêm 3 cánh hoa ở vòng ngoài cùng:
    1. **Nút Chart Mode**: Chuyển chế độ xem sang dạng Biểu đồ (Chart).
    2. **Nút Grid Mode**: Chuyển chế độ xem sang dạng Lưới (Grid).
    3. **Nút Refresh**: Kích hoạt hành động làm mới dữ liệu Trending.
  - Các cánh hoa này có thiết kế nhạt màu hơn (nền trong suốt hơn - dimmer) để biểu thị tính chất ngữ cảnh/tùy chọn (optional).
  - Khi nhấn vào các cánh hoa Layer 3 này, menu điều hướng **không tự động đóng lại** để cho phép người dùng tiếp tục tương tác.
  - Khi trạng thái làm mới (refreshing) đang chạy, icon Refresh trong cánh hoa sẽ xoay tròn mượt mà để báo hiệu tiến trình.

---

## 2. Affected Components & Files

- **`frontend/src/index.css`**:
  - Nâng cấp kích thước SVG `.radial-petals-svg` từ `300px` lên `400px` để chứa thêm lớp thứ 3.
  - Cập nhật tâm xoay `transform-origin` của các cánh hoa `.radial-petal-group` thành `200px 200px`.
  - Tạo các class `.radial-sector--optional` với nền mờ hơn (`rgba(24, 24, 24, 0.45)`) và hiệu ứng hover/active tinh tế.
  - Thêm hiệu ứng xoay `@keyframes radial-icon-spin` cho icon Refresh.

- **`frontend/src/components/RadialNav.tsx`**:
  - Định nghĩa tọa độ vẽ SVG Nightingale Rose quanh tâm mới `(200, 200)`.
  - Điều chỉnh bán kính vẽ Layer 3: từ `rInner = 152` đến `rOuter = 185` (tối đa), đảm bảo khoảng cách concentric 6px từ Layer 2.
  - Sử dụng `location.pathname.startsWith('/trending')` để xác định trạng thái hiển thị của Layer 3.
  - Lắng nghe và đồng bộ trạng thái `trendingMode` ('chart' | 'grid') và `trendingRefreshing` (boolean) thông qua hệ thống `CustomEvent` của trình duyệt.
  - Dispatch event `'trending-set-mode'` và `'trending-refresh-trigger'` khi người dùng click vào các cánh hoa Layer 3 tương ứng.

- **`frontend/src/pages/TrendingPage.tsx`**:
  - Ẩn/xóa cụm header controls cũ.
  - Tích hợp một nút ẩn `#trending-page-refresh-action` để xử lý logic refresh gốc (gọi API, khôi phục state sau 8s).
  - Đăng ký lắng nghe các sự kiện `'trending-set-mode'` và `'trending-refresh-trigger'` từ `RadialNav` để thực thi hành động tương ứng.
  - Tự động phát đi các sự kiện `'trending-mode-changed'` và `'trending-refresh-status'` để đồng bộ giao diện hiển thị trên cánh hoa.

---

## 3. Potential Side Effects & Breakage
- **Overlap/Clipping**: Việc tăng kích thước SVG từ `300px` lên `400px` có thể làm lấn chiếm diện tích click chuột nếu không tắt pointer-events đúng cách. Đã giải quyết bằng `pointer-events: none` cho SVG container và chỉ bật `pointer-events: auto` trên từng cánh hoa khi menu được mở rộng (`open`).
- **Memory Leaks**: Đăng ký sự kiện `window.addEventListener` mà quên gỡ bỏ trong `cleanup` của `useEffect` trên `TrendingPage.tsx` và `RadialNav.tsx`. Giải pháp: luôn return hàm remove listener trong `useEffect`.

---

## 4. Proposed Implementation Plan

### A. CSS Styling (`frontend/src/index.css`)
Cập nhật kích thước container và tâm quay đồng thời thêm các style cho lớp cánh hoa mờ (Layer 3):
```css
/* Tăng kích thước SVG chứa cánh hoa */
.radial-petals-svg {
  width: 400px;
  height: 400px;
}
.radial-petal-group {
  transform-origin: 200px 200px;
}

/* Định nghĩa màu sắc nhạt/dimmer cho các cánh hoa tùy chọn */
.radial-sector--optional {
  fill: rgba(24, 24, 24, 0.45);
  stroke: rgba(255, 255, 255, 0.04);
}
.radial-petals-svg--open .radial-petal-group:hover .radial-sector--optional {
  fill: rgba(168, 85, 247, 0.12);
  stroke: rgba(168, 85, 247, 0.28);
}
.radial-petal-group--active .radial-sector--optional {
  fill: rgba(168, 85, 247, 0.18);
  stroke: rgba(168, 85, 247, 0.4);
}
.radial-petal-group--active:hover .radial-sector--optional {
  fill: rgba(168, 85, 247, 0.25);
  stroke: rgba(168, 85, 247, 0.5);
}

/* Hiệu ứng xoay của icon refresh */
@keyframes radial-icon-spin {
  to { transform: rotate(360deg); }
}
.radial-petal-fo-spin svg {
  animation: radial-icon-spin 1.5s linear infinite;
}
```

### B. Mở rộng toạ độ vẽ và xử lý Sync State (`frontend/src/components/RadialNav.tsx`)
1. Cập nhật toạ độ vẽ từ center `(150,150)` sang `(200,200)`.
2. Tạo các helper state `trendingMode` và `trendingRefreshing` lắng nghe từ window event.
3. Khi người dùng click cánh hoa lớp 3:
   - Đối với mode `chart` / `grid`: Gửi `trending-set-mode` detail tương ứng.
   - Đối với `refresh`: Gửi `trending-refresh-trigger`.
   - **Lưu ý**: Không gọi `setOpen(false)` để menu vẫn mở.
4. Render 3 cánh hoa Layer 3 nếu `isTrending` hoạt động, tính toán toạ độ quanh tâm `200, 200`, `rInner = 152`, `r` là biến bán kính biểu diễn dạng Nightingale Rose.

### C. Tích hợp CustomEvent và ẩn Controls gốc (`frontend/src/pages/TrendingPage.tsx`)
1. Loại bỏ các phần tử điều khiển trực quan khỏi header.
2. Thêm button ẩn:
   ```tsx
   <button
     id="trending-page-refresh-action"
     style={{ display: 'none' }}
     onClick={handleRefreshLogic}
   />
   ```
3. Đăng ký `useEffect` để nhận diện event `'trending-set-mode'` (gọi `switchMode`) và `'trending-refresh-trigger'` (gọi click button ẩn).
4. Đăng ký `useEffect` theo dõi thay đổi của `mode` và `refreshing` để dispatch ngược `'trending-mode-changed'` và `'trending-refresh-status'` cho `RadialNav` cập nhật giao diện.

---

## 5. Success Criteria
- Khi ở các trang khác (Home, Search, ...), Radial Menu chỉ xoè 2 lớp cánh hoa như bình thường.
- Khi chuyển sang trang `/trending` và mở Radial Menu, một vòng đồng tâm thứ 3 (Layer 3) bao gồm Chart, Grid và Refresh sẽ xuất hiện rõ ràng.
- Các cánh hoa Layer 3 có nền mờ hơn, tạo điểm nhấn phụ so với các cánh hoa chính ở Layer 1 & 2.
- Nhấp chọn "Grid" hay "Chart" trên cánh hoa lập tức chuyển chế độ hiển thị dữ liệu của trang Trending. Menu không bị đóng lại.
- Nhấp chọn "Refresh" bắt đầu xoay icon refresh liên tục trong menu, đồng thời thực hiện tải lại dữ liệu từ server. Sau khi hoàn tất (hoặc hết thời gian chờ 8s), icon dừng xoay.
