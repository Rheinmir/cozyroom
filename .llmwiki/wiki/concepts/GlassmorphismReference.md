---
type: concept
title: Glassmorphism Smart-Home Demo (Reference)
tags: [design, glassmorphism, reference, conflicts-with-design-system]
---

# Glassmorphism Smart-Home Demo (Reference)

Nguồn tham khảo kỹ thuật glassmorphism (CodePen-style smart-home dashboard, TSX + SCSS) ingest vào `.llmwiki/raw/glassmorphism/`. Không phải code đang chạy trong Cozyroom — chỉ là tài liệu tham khảo kỹ thuật/thẩm mỹ để cân nhắc khi có đề xuất đổi design system.

**Công thức "kính" cốt lõi:** `backdrop-filter: blur(3px)` + nền `rgba(white, 0.1)` + hairline border `rgba(white, 0.2)` (áp cho `.clear-button`, `.day-card`). Card nội dung đè lên ảnh nền dùng `linear-gradient(to top, rgba(black,0.8), transparent)` để chữ luôn đọc được bất kể ảnh gì bên dưới. Hover feedback thống nhất: `translateY(-5px)` + tăng nét/scale ảnh nền. Có `ScrollableComponent` tự chế (kéo ngang bằng mousedown/mousemove, ẩn scrollbar) và PIN-entry 4 ô riêng biệt với keyframe blink/scale.

## Xung đột với hệ thiết kế hiện tại

Cozyroom hiện dùng hệ "Midnight Deck" trong `DESIGN.md` (root, không phải file wiki) — monochrome tuyệt đối, owner-confirmed qua `/impeccable`:
- **One Accent Rule:** chỉ một màu accent (paper-white), không có màu nền/gradient thứ hai.
- **Light-Not-Color Rule:** độ sâu (elevation) thể hiện bằng ánh sáng trắng (glow) + lift, không bằng màu hay kính mờ nhiều lớp.

Glassmorphism (kính mờ, ảnh nền full-bleed, gradient nhiều màu) đối lập trực tiếp với cả hai rule này. Trang này **chỉ ghi nhận nguồn tham khảo** — chưa có quyết định áp dụng. Muốn đổi `DESIGN.md` sang hướng này cần qua `propose` để owner duyệt tường minh trước, vì đây là đảo ngược một quyết định thiết kế đã chốt có chủ đích.

## Notes
- [[frontend-component-map]]

## Origin
- **Source:** `raw/glassmorphism/css.scss`, `raw/glassmorphism/index.tsx`
- **Date:** 2026-09-20
