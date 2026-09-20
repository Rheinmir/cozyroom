---
type: concept
title: Cozyroom is single-tenant
tags: [architecture, auth, single-tenant]
timestamp: 2026-08-03
---

# Cozyroom is single-tenant
**Type:** concept
**Tags:** architecture, auth, single-tenant

Cozyroom (app nhạc gia đình) **không có khái niệm tài khoản, đăng nhập, hay session người dùng** ở bất kỳ đâu trong codebase — xác nhận qua 1 lượt research bằng Explore agent khi scope tính năng thống kê lượt nghe (2026-08-02/03). Đây là app single-tenant: 1 Postgres DB dùng chung, không có bảng `users`, kết nối Last.fm là 1 dòng global duy nhất trong `settings` (không phải per-user).

**Vì sao quan trọng:** phát sinh khi làm `/stats/music` (dashboard lượt nghe) — user được hỏi số liệu có phải tổng hợp của tất cả người dùng app hay không, và xác nhận rõ (2026-08-03) rằng báo cáo tổng hợp là đủ, không cần theo dõi riêng từng người.

**Cách áp dụng:** bất kỳ yêu cầu tính năng nào ngụ ý "theo từng người" (favorite, lịch sử riêng, gợi ý cá nhân hoá, nhiều thành viên trong nhà) đều cần xây hệ thống auth/tài khoản thật trước — không phải chỉ thêm 1 cột nhỏ vào bảng có sẵn. Đừng giả định có thể gắn thẳng cột `user_id` vào bảng hiện tại — chưa có identity nào để khoá vào đó. Nếu sau này user muốn theo dõi riêng từng người, đó là 1 đề xuất lớn hơn nhiều so với vẻ ngoài của nó.

## Notes
- Liên quan tới [[Prod DB is Postgres, not CockroachDB]] — cùng phiên research schema thật của DB

## Origin
- **Source:** Explore agent research pass, scope tính năng play-count-stats
- **Commit:** _(concept page, không gắn 1 commit code cụ thể)_
- **Date:** 2026-08-03
