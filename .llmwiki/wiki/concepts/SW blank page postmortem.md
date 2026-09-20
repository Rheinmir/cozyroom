---
type: concept
title: SW blank page postmortem
tags: [postmortem, service-worker, cloudflare, frontend]
timestamp: 2026-06-18
---

# SW blank page postmortem
**Type:** concept
**Tags:** postmortem, service-worker, cloudflare, frontend

**Sự cố:** trang trắng tinh tại music.giatbh.io.vn sau khi deploy build mới.

**Chuỗi nguyên nhân gốc:**
1. Service Worker cũ (build với `registerType: 'prompt'`) vẫn active trong trình duyệt, phục vụ `index.html` cũ từ Workbox precache — trỏ tới asset hash đã chết.
2. SW mới deploy có `skipWaiting: true`, nhưng Cloudflare **đè lên header `no-cache` của nginx** cho `sw.js`, cache nó với `max-age=14400` (4 giờ). CF bỏ qua `no-store` từ origin.
3. Sau khi trình duyệt xoá SW cũ, tải lại trang → CF vẫn trả `sw.js` cũ đã cache → SW cố precache file đã chết → cài đặt fail hoặc phục vụ nội dung cũ.
4. Nhiều lần purge CF không giúp được gì vì pod vẫn chạy image cũ, và CF cache lại đúng `sw.js` đó mỗi lần purge.

**Vì sao:** cấu hình Cache của CF đè lên `Cache-Control: no-store` từ origin cho riêng file `sw.js`.

**Fix đã áp dụng (2026-06-18):**
- Đổi tên file SW: `sw.js` → `sw2.js` trong `vite.config.ts` (`filename: 'sw2.js'`)
- Cập nhật regex nginx: `sw\.js` → `sw[0-9]*\.js` để phủ luôn các lần đổi tên sau này
- Build + push lại image mới → `sw2.js` mới được phục vụ với `no-cache` (CF tôn trọng vì URL mới chưa có cache cũ)
- `sw.js` cũ không còn tồn tại → trình duyệt cố update SW cũ nhận về `index.html` → type mismatch → SW tự unregister

**Cách áp dụng khi tái diễn:**
1. `curl -sv https://domain/sw*.js | grep "Cache-Control"` — phải ra `no-store`
2. Nếu CF đang cache SW: đổi tên `swN.js` (tăng N) để phá cache CF
3. Không bao giờ chỉ dựa vào CF purge khi CF có thể đang đè header cache của origin

## Notes
- Liên quan tới [[K3s infra topology]] — cùng hạ tầng Cloudflare/k3s

## Origin
- **Source:** debug trực tiếp production, sự cố + fix ngày 2026-06-18
- **Commit:** _(xem git log frontend/vite.config.ts và nginx config quanh 2026-06-18)_
- **Date:** 2026-06-18
