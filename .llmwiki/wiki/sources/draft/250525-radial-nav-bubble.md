# Proposal: Radial Navigation Bubble

**Date:** 2026-05-25
**Origin:** User request — navigation items quá nhiều, thay thế bằng radial menu dạng bong bóng kéo thả

---

## Mục tiêu

Thay thế `Sidebar` (desktop) và `MobileNav` (mobile) bằng một **nút bong bóng nổi duy nhất**, kéo thả tự do, khi nhấn xoè ra các mục điều hướng theo dạng cánh hoa (flower petal radial menu).

---

## Yêu cầu chức năng

### Bubble trigger

- Hình tròn, nổi trên tất cả nội dung (`position: fixed`, `z-index` cao)
- **Kéo thả** tự do bằng pointer/touch drag (`pointerdown` → `pointermove` → `pointerup`)
- Vị trí lưu vào `localStorage('radial-nav-pos')` để nhớ giữa các session
- Vị trí mặc định: bottom-right, cách mép `20px`
- **Clamp tới góc**: khi kéo vào góc màn hình, nút chỉ bị che tối đa 50% đường kính (tức là tâm nút không vượt ra ngoài mép màn hình) → `clamp(−r, pos, screenEdge − r)` với `r = bán kính nút`
- Phân biệt click vs drag: nếu di chuyển < 5px thì tính là click (mở menu), ngược lại là drag

### Radial menu

- Khi click bubble → **hoạt ảnh xoè cánh hoa**: 8 nút nav fan ra đều theo góc phần tư không bị che bởi màn hình
- Số lượng cánh: **8 item** (xem danh sách bên dưới)
- Mỗi cánh là hình tròn nhỏ (~44px) với icon + label nhỏ bên dưới
- Animation: `scale(0) → scale(1)` + `translateX/Y` trượt ra theo hướng góc, stagger 30ms giữa mỗi cánh
- **Smart angle**: tính góc xoè dựa trên vị trí bubble trên màn hình — nếu bubble ở góc trên-phải thì cánh xoè về phía dưới-trái (90° arc thay vì 360°), tránh cánh bị cắt ra ngoài màn hình
- Nhấn vào cánh → navigate + đóng menu
- Nhấn ra ngoài menu → đóng
- Nhấn bubble lần 2 → đóng (toggle)

### 8 Nav items

| Icon | Route | Label (VI) | Label (EN) |
|------|-------|-----------|------------|
| 🏠 Home | `/` | Nhạc | Artists |
| 🔍 Search | `/search` | Tìm kiếm | Search |
| 🎬 Video | `/videos` | Phim | Films |
| 📚 Ebook | `/ebooks` | Sách | Books |
| 📖 Comics | `/comics` | Truyện | Comics |
| 📈 Trending | `/trending` | Xu hướng | Trending |
| 🎵 Playlists | `/playlists` | Playlist | Playlists |
| 🌐 Lang toggle | — | VI · EN | VI · EN |

### Scope thay thế

- **Xoá** `<Sidebar />` khỏi `App.tsx` / `AppRoutes.tsx`
- **Xoá** `<MobileNav />` khỏi `App.tsx` / `AppRoutes.tsx`
- **Thêm** `<RadialNav />` vào `App.tsx` (render duy nhất, luôn visible)
- **Xoá** CSS `.sidebar`, `.mobile-nav` khỏi `index.css`
- **Thêm** CSS `.radial-nav-*` mới
- **Xoá** padding/margin layout dành cho sidebar trong CSS

---

## Thiết kế kỹ thuật

### Component: `RadialNav.tsx`

```tsx
// State
const [open, setOpen] = useState(false)
const [pos, setPos] = useState<{x: number, y: number}>( // loaded from localStorage )
const isDragging = useRef(false)
const dragStart = useRef<{x: number, y: number}>({x:0, y:0})

// Pointer events for drag
onPointerDown → record dragStart, setPointerCapture
onPointerMove → update pos (clamped to -r..screenW-r, -r..screenH-r)
onPointerUp → if moved < 5px: toggle open, else: save pos to localStorage

// Smart angle calculation
function calcArc(pos, screenW, screenH): { startAngle, arcSpan }
// Nếu bubble ở góc: arc = 90°, ở cạnh: arc = 180°, ở giữa: arc = 270°

// Each petal
items.map((item, i) => {
  const angle = startAngle + (i / (items.length - 1)) * arcSpan
  const dist = 80 // px từ tâm bubble ra
  const x = Math.cos(angle) * dist
  const y = Math.sin(angle) * dist
  // CSS: transform: translate(x, y) scale(open ? 1 : 0)
  //      transition-delay: i * 30ms
})
```

### File changes

| Action | File |
|--------|------|
| NEW | `frontend/src/components/RadialNav.tsx` |
| MODIFY | `frontend/src/App.tsx` hoặc `AppRoutes.tsx` — thay Sidebar+MobileNav bằng RadialNav |
| MODIFY | `frontend/src/index.css` — thêm `.radial-nav-*`, xoá `.sidebar`, `.mobile-nav` |
| DELETE | `frontend/src/components/Sidebar.tsx` *(giữ lại nếu user muốn rollback)* |
| DELETE | `frontend/src/components/MobileNav.tsx` *(idem)* |

### CSS animations

```css
.radial-petal {
  position: absolute;
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1),
              opacity 150ms ease;
  transform-origin: center center;
}
.radial-petal--closed {
  transform: translate(0, 0) scale(0);
  opacity: 0;
  pointer-events: none;
}
.radial-petal--open {
  transform: translate(var(--tx), var(--ty)) scale(1);
  opacity: 1;
}
```

---

## Câu hỏi mở cần xác nhận

> [!IMPORTANT]
> 1. **Sidebar có hoàn toàn biến mất không?** Hay giữ sidebar cho desktop, chỉ dùng radial cho mobile?
> 2. **Nút bubble trông như thế nào?** Logo Cozyroom, hamburger icon, hay ký tự đặc biệt?
> 3. **Kích thước bubble**: 52px hay 44px?
> 4. **Màu bubble**: theo accent color (tím `#8B5CF6`) hay glassmorphism?
> 5. **LastFM widget** hiện đang trong Sidebar — chuyển đi đâu? (Settings page riêng? Petal thứ 9?)
> 6. **Lang toggle** có nên là petal riêng, hay nằm trong Settings petal?

---

## Origin

- Yêu cầu: user session 2026-05-25, conversation `d3f8fa42`
- Invoke: `/orca-workflow`
