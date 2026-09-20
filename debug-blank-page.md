# Debug: Blank white page — music.giatbh.io.vn

Đánh dấu [x] = đã xác nhận KHÔNG phải nguyên nhân này.

---

## Server-side

- [x] Pod chạy image cũ — tất cả 3 pod đều digest `sha256:2bfd88da`
- [x] Service selector sai — endpoints khớp pod IPs (10.42.0.20, .21, 10.42.2.84)
- [x] Nginx serve sai file — pod trả đúng `index-KKUmUW0c.js` + `index-TpBfD2P6.css`
- [x] CF cache HTML — đã purge 2 lần
- [x] CF vẫn cache `sw.js` — đã xác nhận KHÔNG phải CF

---

## Client-side

- [x] Browser HTTP cache — hard refresh nhiều lần
- [x] Browser "Clear site data" — đã làm
- [x] DevTools Application → Unregister SW — đã làm
- [ ] **Incognito window** — chưa thử (không có SW cũ)
- [ ] Console errors — chưa check tab Console trong DevTools
- [ ] Network tab — chưa check file nào đang 404

---

## Code

- [ ] JS runtime crash sau deploy mới — chưa xác nhận
- [ ] CSS compile error — chưa xác nhận
- [ ] React render error từ thay đổi `toggle() + initAudioCtx()` — chưa xác nhận

---

## Bước tiếp theo (theo thứ tự)

1. Mở Incognito → vào site → nếu OK = SW issue; nếu trắng = code crash
2. Nếu trắng cả incognito: F12 → Console → chụp screenshot lỗi
3. F12 → Network → reload → tìm request 404 đỏ
