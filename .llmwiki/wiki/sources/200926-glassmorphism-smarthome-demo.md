---
type: source
title: Glassmorphism Smart-Home Demo — Raw Ingest
tags: [glassmorphism, design-reference, frontend]
---

# Glassmorphism Smart-Home Demo — Raw Ingest

Demo dashboard "smart home" (PIN login → weather/restaurants/lighting/tools/movie-dashboard sections) minh hoạ phong cách glassmorphism cổ điển: ảnh nền full-bleed, card kính mờ, gradient chữ-trên-ảnh. Ingest vào `.llmwiki/raw/glassmorphism/` gồm `css.scss` (~1000 dòng SCSS) và `index.tsx` (React/TSX, ~730 dòng).

## Key Takeaways
- `backdrop-filter: blur(3px)` + `rgba(white, 0.1)` nền + `border: 1px solid rgba(white, 0.2)` = công thức kính cốt lõi, dùng cho `.clear-button` và `.day-card`.
- Card đè lên ảnh nền luôn có lớp `linear-gradient(to top, rgba(black, 0.8), transparent)` để đảm bảo chữ đọc được bất kể ảnh nền.
- Hover đồng nhất trên mọi loại card: `translateY(-5px)` cộng tăng nét/scale ảnh nền phía dưới.
- `ScrollableComponent` tự chế bằng `onMouseDown/onMouseMove/onMouseUp` thay vì overflow-x mặc định, ẩn scrollbar qua `::-webkit-scrollbar { width: 0 }`.
- PIN entry gồm 4 `.app-pin-digit` riêng biệt, keyframe `blink` cho con trỏ đang gõ, keyframe scale cho digit ẩn sau khi nhập.

## Notes
- [[GlassmorphismReference]] — phân tích kỹ hơn + ghi nhận xung đột với `DESIGN.md` (Midnight Deck monochrome) hiện tại.

## Origin
- **Source:** `raw/glassmorphism/css.scss`, `raw/glassmorphism/index.tsx`, `raw/glassmorphism/index.html`
- **Date:** 2026-09-20
