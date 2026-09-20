# Proposal: Remove Tab Toast — Left-Zone Tap Returns to Now Playing

**Module:** Frontend — `PlayerBar.tsx`
**Date:** 2026-05-19

---

## 1. Restated Request

Xoá cơ chế toast hiện/ẩn tab (click vào `npo-body` → tabs hiện 3 giây rồi mất), và thay bằng: khi đang ở tab [[concepts/Lyrics|Lyrics]], click vào vùng trống bên trái (nơi `npo-info` bị ẩn) sẽ chuyển về Now Playing. Không đụng vào component hay nút hiện có.

---

## 2. Files / Functions Affected

| File | Element | Thay đổi |
|------|---------|----------|
| `frontend/src/components/PlayerBar.tsx` | `state showTabs` | Xoá |
| | `ref tabsTimeoutRef` | Xoá |
| | `fn handleNpoClick` | Xoá |
| | `npo-body onClick={handleNpoClick}` | Xoá attribute |
| | `npo-tabs` class binding | Bỏ `showTabs ?` — giữ class tĩnh |
| | `npo-info` (khi bị ẩn, tab lyrics) | Thêm transparent click overlay |

**Không đụng:**
- `LyricsView.tsx` — không thay đổi
- `index.css` — không thay đổi (npo-info đã có `npo-panel--hidden` class)
- Mọi nút playback, back, close, lyrics tools

---

## 3. Potential Breakage

| Risk | Severity | Mitigation |
|------|----------|------------|
| `npo-tabs` hiện tại chỉ visible khi `showTabs=true` (opacity CSS) | Medium | Sau khi xoá, tabs luôn visible trên mobile — cần verify CSS `.npo-tabs` không có `opacity:0` by default làm tabs biến mất hẳn |
| Overlay click vùng trái đè lên nút nào đó ẩn | Low | Overlay chỉ render khi `mobileTab === 'lyrics'` và chỉ cover phần `npo-info` (left half); `npo-tabs` và `npo-controls` nằm bên dưới (z-index thấp hơn) |

---

## 4. Implementation Plan

### Step 1 — Xoá toast logic
Trong `PlayerBar.tsx`:
- Xoá `const [showTabs, setShowTabs] = useState(false)`
- Xoá `const tabsTimeoutRef = useRef<number | null>(null)`
- Xoá hàm `handleNpoClick`
- Xoá `onClick={handleNpoClick}` khỏi `<div className="npo-body">`
- Đổi class `npo-tabs`: `{'npo-tabs' + (showTabs ? ' npo-tabs--visible' : '')}` → `'npo-tabs'`

### Step 2 — Kiểm tra CSS `.npo-tabs`
Trong `index.css` tìm `.npo-tabs--visible` và `.npo-tabs`:
- Nếu `.npo-tabs` có `opacity: 0` hoặc `visibility: hidden` by default → phải đảm bảo tabs vẫn hiển thị trên mobile sau khi bỏ class `--visible`
- Chỉ cần giữ nguyên opacity mặc định = 1 trên mobile (hoặc xoá class `--visible` luôn nếu CSS dùng đó)

### Step 3 — Thêm left-zone overlay
Trong `npo-body`, ngay trước `npo-info`:
```tsx
{mobileTab === 'lyrics' && (
  <div
    className="npo-back-zone"
    onClick={() => setMobileTab('player')}
    aria-label="Back to Now Playing"
  />
)}
```

Thêm CSS inline hoặc class (không sửa `index.css` nếu có thể):
```css
.npo-back-zone {
  position: absolute;
  left: 0; top: 0;
  width: 50%; height: 100%;
  z-index: 1;          /* thấp hơn npo-tabs (z-index mặc định cao hơn) */
  cursor: pointer;đáy
}
```
> Vùng này chỉ tồn tại khi tab lyrics, tự động biến mất khi tab player.

---

## 5. Success Criteria

- [ ] Khi đang ở [[concepts/Lyrics|Lyrics]] tab trên mobile, tap vào vùng trống bên trái → chuyển về Now Playing
- [ ] Không còn toast tabs xuất hiện/mờ dần sau 3 giây
- [ ] Tab bar (Now Playing / [[concepts/Lyrics|Lyrics]]) vẫn hiển thị bình thường ở phía dưới nội dung
- [ ] Mọi nút back, close, lyrics tools, controls vẫn hoạt động đúng
- [ ] Không có TypeScript errors sau thay đổi

## Origin
- legacy backfill (harness-update) — commit gần nhất: 7c8f2f4 2026-05-28
