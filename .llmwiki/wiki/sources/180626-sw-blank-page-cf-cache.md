---
name: 180626-sw-blank-page-cf-cache
type: source
status: resolved
date: 2026-06-18
tags: bug, pwa, service-worker, cloudflare, k8s
---

# Blank white page — CF caching sw.js với max-age=14400

## Triệu chứng

- Site load ra trang trắng hoàn toàn
- Console: `Failed to load resource: 404` cho `index-BkSi1gma.js`, `index-NQgkUrZi.css`
- Network tab: requests hiển thị `200 OK (from service worker)`
- Mọi biện pháp clear browser (Clear site data, Unregister SW, JS snippet) đều không fix vĩnh viễn — sau reload lại trắng

## Root cause chain

1. **Old SW active**: SW cũ (build với `registerType: 'prompt'`) đang serve `index.html` từ Workbox precache, file này reference asset hash cũ (`BkSi1gma`) không còn tồn tại trên server.
2. **CF override nginx no-cache**: `nginx.conf` đã có `Cache-Control: no-cache, no-store, must-revalidate` cho `sw.js`, nhưng CF **override** header này và cache `sw.js` với `max-age=14400` (4h). CF bỏ qua `no-store` từ origin.
3. **Purge CF không giải quyết**: Sau mỗi purge, CF re-fetch `sw.js` từ origin pod → pod lúc đó chạy image cũ chưa có nginx fix → CF lại cache bản cũ thêm 4 tiếng.
4. **Vòng lặp**: Mỗi lần browser clear SW → reload → app boot → đăng ký `sw.js` → CF trả bản cũ → SW install với precache sai → cycle lại.

## Diagnosis

```bash
curl -sv https://music.giatbh.io.vn/sw.js 2>&1 | grep "Cache|Age"
# → Age: 472, Cache-Control: max-age=14400  ← CF đang cache
```

```bash
curl -s https://music.giatbh.io.vn/sw.js | grep -oE 'assets/index-[^"]+\.(js|css)'
# → assets/index-DJdwMFI7.js  ← precache hash cũ, 404 trên server
```

## Fix (commit df3f6b6)

**Rename sw.js → sw2.js** trong `vite.config.ts`:

```typescript
VitePWA({
  registerType: 'autoUpdate',
  filename: 'sw2.js',   // ← thêm dòng này
  ...
})
```

**Update nginx regex** để match cả sw2.js:

```nginx
location ~* ^/(sw[0-9]*\.js|manifest\.webmanifest|workbox-.*)$ {
```

**Kết quả**: URL `sw2.js` chưa có trong CF cache → CF fetch fresh → nhận `no-store` từ nginx → không cache. Old `sw.js` requests trả về `index.html` (type mismatch) → browser tự unregister SW cũ.

## Phòng tránh

- CF có thể override `Cache-Control: no-store` nếu có Page Rule hoặc Edge Cache TTL setting
- Khi deploy, verify: `curl -sv https://domain/sw*.js | grep "Cache-Control"` phải là `no-store`
- Nếu CF lại cache: increment số trong tên (`sw3.js`, `sw4.js`) để bust cache
- Không dựa vào CF purge để fix SW issues — purge chỉ clear hiện tại, nếu origin serve sai content thì CF sẽ cache lại ngay

## Origin

- **Commit:** `df3f6b6` — fix: rename sw.js → sw2.js to force SW re-registration + fix nginx pattern
- **Date:** 2026-06-18
- **Related:** [[concepts/Architecture]] (K8s + Cloudflare tunnel setup)
