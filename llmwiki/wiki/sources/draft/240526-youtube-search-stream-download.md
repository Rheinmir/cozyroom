---
name: 240526-youtube-search-stream-download
description: Proposal & Implementation Plan — YouTube Search, Direct Stream, and High-Quality Download using yt-dlp (OpenCode executor, Antigravity planner/reviewer)
---

# Proposal: YouTube Search, Direct Stream, and High-Quality Download

Đề xuất bổ sung tính năng tìm kiếm nhạc trực tiếp từ YouTube trên giao diện ứng dụng Cozyroom, hỗ trợ nghe stream trực tiếp (qua proxy phát nhạc) và tải về lưu trữ vào thư viện nhạc cục bộ với chất lượng âm thanh gốc cao nhất bằng `yt-dlp`.

---

## 1. Phân vai thực hiện (Orca Workflow Roles)
* **Planner & Reviewer:** Antigravity (agy) — Lập kế hoạch chi tiết, hướng dẫn kỹ thuật, duyệt mã nguồn.
* **Executor:** OpenCode (opencode) — Viết code, tích hợp API backend Go và giao diện frontend React.
* **Claude Code:** Không tham gia trong workflow này.

---

## 2. Thiết kế Kiến trúc & Các thay đổi đề xuất

### A. Tích hợp Công cụ `yt-dlp` trên Backend
Vì máy chủ chạy Windows, backend Go sẽ gọi trực tiếp binary `yt-dlp` để lấy kết quả tìm kiếm, sinh URL stream và tải nhạc.
* **Tải binary yt-dlp:** Executor sẽ tải `yt-dlp.exe` đặt vào thư mục `backend/bin/` hoặc sử dụng yt-dlp có sẵn/tự động tải nếu chưa có.
* **Trích xuất âm thanh chất lượng tốt nhất gốc:**
  Sử dụng lệnh:
  ```bash
  yt-dlp -f bestaudio -x --audio-format best --paths <MUSIC_PATH> <YOUTUBE_URL>
  ```
  Lệnh này sẽ tải luồng âm thanh gốc (Opus/AAC) trực tiếp mà không nén lại để đảm bảo chất lượng 1:1.

---

### B. Các API Endpoint mới trên Backend (Go)

1. **`GET /api/youtube/search?q=<query>`**
   * **Chức năng:** Tìm kiếm video trên YouTube bằng `yt-dlp` (hoặc thông qua scraping/YouTube API không cần key).
   * **Cách thực hiện bằng yt-dlp:**
     ```bash
     yt-dlp "ytsearch10:<query>" --flat-playlist --dump-single-json
     ```
   * **Kết quả trả về:** Danh sách gồm `id`, `title`, `duration`, `thumbnail`, `uploader` (tương tự như cấu trúc hiển thị nhạc hiện tại).

2. **`GET /api/youtube/stream/{id}`**
   * **Chức năng:** Trích xuất và chuyển hướng (redirect) hoặc proxy luồng phát nhạc trực tiếp từ YouTube.
   * **Cách lấy URL stream gốc:**
     ```bash
     yt-dlp -g -f bestaudio "https://www.youtube.com/watch?v={id}"
     ```
   * **Kết quả trả về:** Chuyển hướng `302 Redirect` trình phát nhạc HTML5 của frontend đến URL stream trực tiếp của YouTube.

3. **`POST /api/youtube/download`**
   * **Chức năng:** 
     1. Tải file âm thanh gốc chất lượng cao nhất về thư mục nhạc (`MUSIC_PATH`) dưới dạng file âm thanh chuẩn (AAC/Opus trong container `.m4a` hoặc `.webm`).
     2. **Tự động làm sạch & Điền Metadata:** Sử dụng tiêu đề YouTube phối hợp với Deezer API hoặc Gemini AI (`GEMINI_API_KEY` đã có sẵn trong Go backend) để tự động nhận diện và ghi thẻ tags ID3/metadata chuẩn (Tên bài hát, Nghệ sĩ, Album, Thể loại) vào file âm thanh. Điều này đảm bảo bài hát được phân loại đúng vào trang của Nghệ sĩ đó.
     3. **Tự động quét (Auto-Scan):** Sau khi ghi file, backend tự động gọi tiến trình quét nhanh (`library.Scan`) để cập nhật tức thì vào SQLite database. Nhờ đó, bài hát sẽ xuất hiện ngay lập tức trong **Tab Nghệ sĩ (Artist Page)**, cho phép người dùng nghe, tìm kiếm, và **mix chung vào playlist** với các bài hát offline có sẵn mà không có sự phân biệt nào.
   * **Body request:** `{"id": "YOUTUBE_VIDEO_ID", "title": "Song Title", "artist": "Artist Name"}`

4. **`POST /api/youtube/update-tools` (Cơ chế chống lỗi thời - Outdate)**
   * **Vấn đề:** YouTube thay đổi thuật toán liên tục khiến các công cụ tải nhạc dễ bị lỗi thời.
   * **Giải pháp:** Backend tích hợp cơ chế tự động chạy định kỳ lệnh cập nhật `yt-dlp -U` (hoặc chạy qua API) để đảm bảo trình tải luôn ở phiên bản mới nhất, không bao giờ bị lỗi thời. Đồng thời, backend duy trì một Ticker quét định kỳ thư mục nhạc mỗi 12h để đồng bộ hóa và dọn dẹp thư viện tự động.

---

### C. Giao diện Frontend (React + TypeScript)

1. **Giao diện Tìm kiếm (`SearchPage.tsx`):**
   * Bổ sung thêm một tab/phần mới tên là **"YouTube"** bên cạnh các kết quả tìm kiếm cục bộ (Artists, Albums, Tracks).
   * Kết quả tìm kiếm YouTube hiển thị dưới dạng hàng danh sách (row) hoặc card giống hệt giao diện tìm kiếm nghệ sĩ hiện tại, gồm hình ảnh thu nhỏ (thumbnail), tiêu đề và tên kênh.

2. **Tương tác trên mỗi kết quả YouTube:**
   * **Nút Stream (Nghe trực tiếp):** Khi click, gọi hàm `play` của `usePlayer()` và truyền thông tin track ảo với URL nguồn phát trỏ đến `/api/youtube/stream/{id}`. Trình phát nhạc toàn cục của app sẽ phát trực tiếp luồng âm thanh này.
   * **Nút Download (Tải chất lượng cao):**
     * Khi click, hiển thị trạng thái đang tải (loading spinner).
     * Gửi request đến `POST /api/youtube/download`.
     * Sau khi hoàn tất, hiển thị thông báo thành công và cập nhật thư viện nhạc cục bộ để bài hát xuất hiện ngay trong app.

---

## 3. Kế hoạch triển khai (Task Breakdown cho OpenCode)

* [ ] **Task 1: Cài đặt yt-dlp và FFmpeg trên máy chủ**
  * Tải và cấu hình `yt-dlp.exe` cùng `ffmpeg.exe` vào thư mục chạy để backend có thể gọi trực tiếp.
* [ ] **Task 2: Triển khai các API Endpoint trong Backend Go**
  * Viết handler tìm kiếm bằng `yt-dlp` trong `backend/internal/api/youtube.go`.
  * Viết handler lấy link stream và download âm thanh gốc.
  * Đăng ký các route mới trong `backend/internal/api/routes.go`.
* [ ] **Task 3: Triển khai Giao diện Search YouTube trên Frontend**
  * Sửa đổi `frontend/src/pages/SearchPage.tsx` để tích hợp kết quả YouTube.
  * Tích hợp với trình phát nhạc `PlayerContext.tsx` để phát trực tiếp từ link `/api/youtube/stream/{id}`.
  * Viết UI nút tải nhạc và kết nối API `POST /api/youtube/download`.
* [ ] **Task 4: Kiểm thử và Hoàn thiện**
  * Chạy thử luồng tìm kiếm → nghe stream trực tiếp.
  * Chạy thử luồng tải nhạc chất lượng cao nhất → quét thư viện → bài hát mới xuất hiện cục bộ.

---

## 4. Kiểm tra độ an toàn (Safety Check)
* Đảm bảo các tham số đầu vào (`id`, `q`) được sanitize kỹ để tránh Command Injection khi gọi lệnh hệ thống với `yt-dlp`.
* Thư mục tải về nằm đúng trong phân vùng lưu trữ cấu hình `MUSIC_PATH`.

## Origin
* Đề xuất trực tiếp từ yêu cầu tính năng của User thông qua Orca Workflow, thiết lập Antigravity làm Planner/Reviewer và OpenCode làm Executor.
