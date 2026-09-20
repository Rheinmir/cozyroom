# Đánh giá UI/UX — music.giatbh.io.vn
**Type:** source
**Tags:** ui-ux, evaluation, frontend, pwa, search, lastfm
**Origin:** https://music.giatbh.io.vn

Báo cáo đánh giá thực tế giao diện trang `music.giatbh.io.vn` (production build của [[concepts/Architecture]]) bằng cách tương tác thủ công với toàn bộ nút bấm và luồng điều hướng. Ghi nhận 5 nhóm vấn đề UI/UX.

## Key Takeaways
- Tính năng cốt lõi phát nhạc hoạt động tốt; giao diện dark-mode bám sát Spotify
- Logo và sidebar không có tính năng điều hướng — vi phạm tiêu chuẩn web cơ bản
- Nút "Cài ngay" (PWA install) không phản hồi — `beforeinstallprompt` có thể không trigger được trên môi trường này
- Cột Duration trong tracklist trả về `--:--` — metadata thời lượng chưa được populate đúng
- Bài hát đầu tiên trong album được đánh số "2" — lỗi off-by-one trong track index
- Artist card placeholder hiển thị số thay vì fallback image — Deezer enricher chưa chạy hoặc image path bị null
- Search chỉ trả kết quả Artists, bỏ qua Albums và Tracks dù placeholder hứa hẹn cả ba
- Search không nhận query 1 ký tự — có thể có `minLength` guard ở frontend
- `/api/lastfm/now-playing` trả `401 Unauthorized` liên tục — Last.fm API key chưa cấu hình hoặc sai

## Notes
- Liên quan trực tiếp: [[concepts/Architecture]], [[concepts/MobileUI]], [[concepts/DeezerEnricher]]
- Các lỗi có thể fix: track index off-by-one, search scope, duration display
- Lỗi PWA install: xem thêm [[concepts/MobileUI|MobileUI]] phần InstallBanner

## Origin
- **Source:** https://music.giatbh.io.vn (live site, quan sát thủ công)
- **Date:** 2026-05-08
