---
name: TrendingRadialMenuControls
description: Nightingale Rose Radial Menu Layer 3 - Contextual controls for the Trending page
---

# TrendingRadialMenuControls

Quy hoạch lại các nút điều hướng Thịnh hành (chế độ xem Grid/Chart và nút Refresh) trên trang `TrendingPage.tsx` thành một **Lớp đồng tâm thứ 3 (Layer 3)** nằm ngoài cùng trên giao diện Nightingale Rose của Radial Menu (`RadialNav.tsx`).

Các cánh hoa Layer 3 này đóng vai trò là các điều khiển theo ngữ cảnh (contextual controls), chỉ hiển## Concentric Layout & SVG Coordinate Space

Để tích hợp hệ thống Lịch Tròn Đồng Tâm và bộ điều khiển Thịnh hành đa lớp mà không gây cắt lấn (clipping) hay chồng chéo hình ảnh, không gian vector SVG của Radial Menu được quy hoạch như sau:
- **Hệ tọa độ SVG trung tâm (520 × 520px)**: Tâm hình tròn được dịch chuyển chính xác về tọa độ `CX = 260, CY = 260`.
- **Dynamic Fixed Positioning Wrapper**: Tất cả các phần tử (aura glow, petals SVG, vinyl button, year editor) được bọc trong một container `div` có thuộc tính `position: fixed` với kích thước `0 × 0` đặt tại `activeX` và `activeY` đóng vai trò là điểm neo hệ tọa độ gốc.
- **Radial Bounds (Quy hoạch bán kính đồng tâm)**:
  - **Lớp 1 (Inner)**: `rInner = 34`, `rOuter` dao động từ `80` đến `92`.
  - **Lớp 2 (Outer)**: `rInner = 98`, `rOuter` dao động từ `132` đến `146`.
  - **Lớp 3 (Contextual)**: `rInner = 152`, `rOuter` dao động từ `170` đến `185` (tối đa).
  - **Lớp 4 (Contextual 2 - Tiers)**: `rInner = 191`, `rOuter` dao động từ `208` đến `220` (tối đa).
  - **Lớp 5 (Contextual 3 - Dates)**: `rInner = 226`, `rOuter` dao động từ `238` đến `244` (tối đa).

---

## Interactive Petals & 5-Layer Concentric Nightingale Rose

Để dọn dẹp triệt để giao diện, cả bộ chọn ngày (Date Selector) và 4 nhóm phân loại repo (Tiers) đều được tích hợp **trực tiếp dưới dạng các cánh hoa SVG** cực kỳ thoáng đãng:

### 1. Chế Độ Thường (Normal Mode)
- **Lớp thứ 4 (Layer 4 - Tiers)**: Chứa đúng 4 cánh hoa đại diện cho 4 nhóm Tiers: transformative (🔥), significant (⚡), incremental (📈), niche (🔬). Do chỉ chia 4 cánh hoa nên góc quạt của từng cánh cực rộng, hiển thị thông tin vô cùng thoáng đãng.
- **Lớp thứ 5 (Layer 5 - Dates)**: Chứa 7 cánh hoa đại diện cho bộ điều khiển ngày thông minh:
  * **5 cánh hoa ngày snapshot khả dụng** ở giữa, hiển thị dưới dạng ngày rút gọn (ví dụ: `25/05`, `24/05`).
  * **1 cánh hoa Chọn Năm (phía bên trái)**: hiển thị trực tiếp Năm hoạt động hiện tại (ví dụ: `2026`). Click vào cánh hoa này lập tức chuyển toàn bộ SVG sang chế độ Lịch Tròn, double-click để mở nhanh trình sửa năm.
  * **1 cánh hoa Chọn Lịch (phía bên phải)**: hiển thị biểu tượng lịch **`📅`**. Click vào cánh hoa này lập tức kích hoạt chế độ Lịch Tròn Đồng Tâm.
  * **Tự động đồng bộ cửa sổ**: Danh sách 5 ngày ở giữa tự động cập nhật sao cho ngày đang chọn luôn ở vị trí trung tâm thoáng mát.

### 2. Chế Độ Lịch Tròn Đồng Tâm (Radial Calendar Picker Mode)
Kích hoạt bằng cách **Click đơn (Single-click)** vào cánh hoa ngày đang chọn (có biểu tượng `📅`) hoặc cánh hoa Chọn Năm. Toàn bộ giao diện chuyển sang bố cục Lịch Tròn 6 lớp đồng tâm cực kỳ rộng rãi:

- **Vòng 1 (Months 1–5 - Trong cùng)**: Gồm 5 tháng đầu năm (`T1` đến `T5`) được vẽ tại `rInner = 34`, `rOuter = 62–68`. Với chỉ 5 cánh hoa phân chia trên cung tròn, nhãn chữ được hiển thị cực kỳ thoáng đãng, loại bỏ chen chúc hoàn toàn.
- **Vòng 2 (Months 6–12)**: Gồm 7 tháng cuối năm (`T6` đến `T12`) được vẽ tại `rInner = 74`, `rOuter = 98–104` (có khoảng hở 6px từ Vòng 1).
- **Vòng 3 (Days 1–10)**: Chứa các ngày từ 1 đến 10 tại `rInner = 110`, `rOuter = 144–150`. Sử dụng lớp phủ kính mờ tối màu `.radial-sector--optional` để có chung nhận diện visual với các vòng ngày 4 & 5, đồng thời tạo tương phản rõ rệt với 2 vòng tháng sáng màu bên trong.
- **Vòng 4 (Days 11–20)**: Chứa các ngày từ 11 đến 20 tại `rInner = 156`, `rOuter = 186–192`.
- **Vòng 5 (Days 21–31)**: Chứa phần ngày còn lại của tháng (từ 21 đến 28/29/30/31 tùy thuộc vào tháng và năm được chọn) tại `rInner = 198`, `rOuter = 222–228`. Số lượng cánh hoa được tính toán động để khớp chính xác theo năm nhuận.
- **Vòng 6 (Outermost - Ngoài cùng)**: Gồm 2 cánh điều khiển tại `rInner = 234`, `rOuter = 244–248`:
  * Cánh hoa **↩ Quay lại** (quay lại chế độ thường).
  * Cánh hoa hiển thị **Trạng thái** (`Tháng/Năm` đang chọn).

---

## Expand-At-Its-Spot & Edge-Tucking (AssistiveTouch-style)

Để giữ nguyên vẹn triết lý tương tác cục bộ cực kỳ tự nhiên, menu tích hợp hai cơ chế nâng cao:
1. **Bung Ra Tại Chỗ (Expand-At-Its-Spot)**:
   - Các tọa độ hiển thị của container wrapper luôn được gán trực tiếp bằng `activeX = pos.x` và `activeY = pos.y` trong mọi trạng thái (cả khi mở và đóng), loại bỏ hoàn toàn việc tự động trượt về tâm màn hình.
   - Nhờ thuật toán arc `calcArc(activeX, activeY)` tự động dịch chuyển góc quạt của cánh hoa theo vị trí tương đối trên màn hình (ví dụ: góc quạt `90` độ ở góc phải dưới hướng lên trên và sang trái), các cánh hoa luôn được chiếu trọn vẹn vào bên trong màn hình, không bao giờ bị tràn cạnh.
2. **Khả năng Giấu 50% Nút (Edge-Tucking)**:
   - Nới lỏng phạm vi kẹp tọa độ của sự kiện drag và resize về khoảng tối đa `[0, innerWidth]` và `[0, innerHeight]`.
   - Cho phép người dùng kéo đĩa than bubble ra sát mép màn hình, giấu đi 50% diện tích nút (tựa như phím Home ảo AssistiveTouch của iOS) để tối ưu hóa tầm nhìn của giao diện bên dưới. Khi click vào nút đang giấu, menu sẽ bung tỏa tuyệt đẹp tại chỗ.

---

## Responsive Auto-Scaling & Dynamic Styling

1. **Auto-Scaling Responsive Wrapper**:
   - Khi ở trạng thái mở trên các viewport nhỏ hơn 520px (như mobile width 421px), wrapper tự động tính toán scale factor: `const scale = open ? Math.min(1, (window.innerWidth - 24) / 520) : 1`
   - Wrapper tự động thu nhỏ (ví dụ: tỉ lệ `0.77` trên màn hình 421px) đồng bộ cả đĩa than và các cánh hoa SVG lan tỏa từ tâm (`transform-origin: 0 0`), chừa lại biên trống 12px mỗi bên, loại bỏ hoàn toàn khả năng tràn màn hình trên di động.
   - Áp dụng các transition mượt mà (`left 0.3s`, `top 0.3s`, `transform 0.3s`) sử dụng hàm số Bezier mang lại trải nghiệm mở/tắt cực kỳ cao cấp.
2. **Hạn Chế Hiệu Ứng Đĩa Than (Conditional Vinyl Effect)**:
   - Tách biệt hiệu ứng vòng đĩa than (`::before`) và lỗ trục đĩa than (`::after`) thành một class riêng biệt là `.radial-bubble--vinyl`.
   - Class này chỉ được gán động khi đang phát nhạc và có ảnh bìa album (`track && !calendarMode`).
   - Khi hiển thị logo mặc định của menu (`/favicon.png`) hoặc hiển thị Năm trong Calendar Mode, nút tròn hiển thị dạng phẳng (flat) sạch sẽ, sang trọng, không có các chi tiết cơ học đè lên logo hay nhãn số.
3. **Trình sửa năm Numeric Glassmorphic**:
   - Ẩn hoàn toàn nút mũi tên mặc định (up/down spin buttons) của ô nhập liệu bằng cách gán `-moz-appearance: textfield` và các thuộc tính `::-webkit-outer-spin-button`, `::-webkit-inner-spin-button` trong CSS.

---

## Zero-Coupling State Synchronization

Hệ thống đồng bộ hai chiều giữa component toàn cục `RadialNav.tsx` và component trang `TrendingPage.tsx` sử dụng cơ chế `CustomEvent` tiêu chuẩn của trình duyệt. Thiết kế này giúp hai component hoàn toàn độc lập về cấu trúc (zero-coupling), không cần truyền props phức tạp hay phụ thuộc vào context dùng chung:

### 1. RadialNav → TrendingPage (Điều khiển)
- `'trending-set-mode'` (detail: `'chart'` | `'grid'`): Gửi từ RadialNav khi click cánh hoa chế độ xem, yêu cầu trang thay đổi giao diện.
- `'trending-refresh-trigger'`: Gửi từ RadialNav khi click cánh hoa Refresh, kích hoạt luồng tải lại.
- `'trending-set-date'` (detail: `string`): Gửi từ cánh hoa chọn ngày của Layer 5 để thay đổi ngày snapshot của trang.
- `'trending-click-chip'` (detail: `string`): Gửi từ cánh hoa nhóm tương ứng của Layer 4 để mở drawer chi tiết của nhóm đó.

### 2. TrendingPage → RadialNav (Đồng bộ giao diện)
- `'trending-mode-changed'` (detail: `'chart'` | `'grid'`): Gửi từ TrendingPage khi chế độ xem thực tế thay đổi, cập nhật trạng thái hoạt động (`active`) cho cánh hoa tương ứng.
- `'trending-refresh-status'` (detail: `boolean`): Gửi từ TrendingPage phản ánh trạng thái nạp dữ liệu thực tế, kích hoạt hiệu ứng xoay icon Refresh.
- `'trending-data-loaded'` (detail: `{ dates, selectedDate, tierCounts }`): Gửi từ TrendingPage khi nạp dữ liệu thành công, đồng bộ danh sách ngày, ngày đang chọn và số lượng repo của từng nhóm sang các cánh hoa Layer 4 & Layer 5 tương ứng.

---

## Files

| Đường dẫn file | Vai trò thay đổi |
|----------------|------------------|
| [frontend/src/components/RadialNav.tsx](file:///C:/Users/olive/orca/workspaces/home-spotify/m/frontend/src/components/RadialNav.tsx) | Tạo container wrapper định vị cố định, thực hiện auto-scaling trên mobile, thiết lập Lịch Tròn 5/7 và edge-tucking |
| [frontend/src/index.css](file:///C:/Users/olive/orca/workspaces/home-spotify/m/frontend/src/index.css) | Định dạng class `.radial-bubble--vinyl`, ẩn spin buttons cho year editor, loại bỏ các vinyl overlay đè lên logo |

---

## Related

- [[TrendingChartMode]] — Biểu đồ phân tích thịnh hành trong Cozyroom
- [[MobileUI]] — Kiến trúc giao diện trên thiết bị di động
- [[CleanArchitecture]] — Nguyên lý phân rã lớp và giảm kết nối (coupling)

---

## Origin

- Draft: `llmwiki/wiki/sources/draft/260525-trending-radial-menu-controls-fe.md`
- AGY implementation: Tích hợp 6-ring concentric layout, phục hồi Expand-At-Its-Spot, edge-tucking, PWA auto-scaling wrapper, conditional vinyl effect và numeric glassmorphic (commit `latest`)
