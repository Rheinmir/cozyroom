---
type: draft
title: Fix progress bar sau backgrounding, stale search-navigate, loading vi tri khong nhat quan
status: proposed
tags: [bugfix, player, navigation, loading, fe]
timestamp: 2026-09-02
---

# 020926-progress-navigate-loading-fix-fe
**Type:** draft
**Status:** proposed
**Tags:** bugfix, player, navigation, loading, fe
**Proposed:** 2026-09-02
**Sequence diagram:** [html/020926-progress-navigate-loading-fix-fe-seq.html](../../../html/020926-progress-navigate-loading-fix-fe-seq.html)

## What
3 fix độc lập từ feedback trực tiếp của user: (1) thanh tiến độ đứng im sau khi chuyển tab đi rồi quay lại dù nhạc vẫn phát — đồng bộ lại `progress`/`duration` từ audio element thật khi tab lấy lại focus; (2) bấm vào 1 mục nav đôi khi bị đá về `/search` — do timer debounce của ô search không bị huỷ khi rời khỏi ô đó; (3) vị trí loading spinner không nhất quán giữa các trang — chuẩn hoá 4 trang đang lệch khỏi pattern `.loading` (center thật) mà 6 trang khác đã dùng.

## Affected
| File / Symbol | Thay đổi |
|---|---|
| `frontend/src/PlayerContext.tsx` | Thêm `useEffect` lắng nghe `visibilitychange`, đồng bộ lại `progress`/`duration`/`isPlaying` từ `getActive()` khi tab visible trở lại |
| `frontend/src/components/Header.tsx` | Thêm `onBlur` huỷ `timerRef.current` — không đụng cơ chế debounce 300ms hiện có |
| `frontend/src/pages/RequestLogPage.tsx` | Đổi loading chính từ inline style sang `className="loading"` |
| `frontend/src/pages/AIStatsPage.tsx` | Đổi loading chính (dòng 290, không đụng loading phụ dòng 372) từ inline style sang `className="loading"` |
| `frontend/src/pages/EbooksPage.tsx` | Đổi `.ebooks-loading` sang `className="loading"` |
| `frontend/src/pages/VideosPage.tsx` | Đổi `.videos-loading` sang `className="loading"` (thống nhất 1 nguồn sự thật duy nhất) |

## Risks

- **Fix (1) không giải thích được TẠI SAO trình duyệt/OS tự phát lại từ đầu** — đó là hành vi nền tảng (giải phóng bộ nhớ audio decoder khi tab bị nền hoá lâu), không phải bug code, không có cách nào ngăn hoàn toàn từ phía web app. Fix chỉ đảm bảo UI luôn phản ánh đúng trạng thái thật của audio element sau khi tab quay lại — không "sửa" được việc trình duyệt tự restart, chỉ đảm bảo progress bar không còn đứng im lệch pha với tiếng nhạc thật.
- **Fix (2) chỉ huỷ timer khi ô search MẤT FOCUS** — nếu user bấm 1 link mà KHÔNG làm ô search mất focus trước đó (hiếm, nhưng có thể xảy ra qua bàn phím/screen reader), timer cũ vẫn có thể chạy. Chấp nhận được vì hầu hết thao tác chuột/chạm đều kích hoạt blur trước khi click hoàn tất (blur fires on mousedown, trước click).
- **Fix (3) chỉ đổi đúng loading CHÍNH (toàn trang) của 4 trang, không đụng loading PHỤ** (vd: `.ai-history-empty`, log list nội bộ trong AIStatsPage) — các loading phụ này nằm trong panel nhỏ đã render sẵn, không phải "chuyển trang" nên không thuộc phạm vi bug user báo, đổi bừa sang `.loading` (vốn giả định `height:100%` của cả trang) sẽ phá layout panel nhỏ.

## Global constraints

- Không xoá/đổi bản chất debounce 300ms trong `Header.tsx` — đã có chủ đích từ trước (tránh gọi yt-dlp tốn kém mỗi phím gõ), chỉ thêm cleanup.
- Không đụng cấu trúc dual-audio/MediaSession trong `PlayerContext.tsx` ngoài đúng 1 `useEffect` mới cho `visibilitychange`.
- Không đổi nội dung/text loading của từng trang, chỉ đổi wrapper CSS class.

## Plan
- [ ] Task 1: Đồng bộ `progress`/`duration`/`isPlaying` khi tab quay lại foreground (`visibilitychange`)
- [ ] Task 2: Huỷ debounce timer của Header search khi input mất focus
- [ ] Task 3: Chuẩn hoá loading vị trí — 4 trang (RequestLog, AIStats, Ebooks, Videos) dùng chung `.loading`
- [ ] Task 4: Verify — test cả 3 fix bằng browser thật

## Agent Task Assignment
| Task | Agent (CLI) | Lý do chọn | Status |
|------|------|------|------|
| Task 1: Resync progress sau backgrounding | Claude Code (sonnet) | Đụng `PlayerContext.tsx` — file lõi có tiền lệ sửa-một-chỗ-hỏng-chỗ-khác, cần hiểu hết phụ thuộc (gapless/MediaSession) | pending |
| Task 2: Fix stale search-navigate | Claude Code (sonnet) | Bug tinh vi (race giữa blur/click/timer) — cần đúng thứ tự sự kiện, không phải việc chép mẫu | pending |
| Task 3: Chuẩn hoá loading vị trí | OpenCode (`opencode/big-pickle`) | Mechanical — đổi wrapper className lặp lại ở 4 chỗ đã biết rõ pattern đích | pending |
| Task 4: Verify toàn diện | Claude Code (sonnet) | Cần mở browser thật test cả 3 luồng khác nhau, không phải việc CLI khác tự chạy được | pending |

## Success criteria
- Chuyển tab đi (background) lúc đang phát nhạc, quay lại sau vài chục giây → nếu trình duyệt tự phát lại, thanh tiến độ phản ánh đúng vị trí thật ngay lập tức, không đứng im
- Gõ vào ô search rồi lập tức bấm 1 mục nav khác trước 300ms → ở lại đúng trang vừa bấm, không bị đá về `/search`
- RequestLog, AI Stats, Ebooks, Videos: loading chính hiện giữa màn hình, nhất quán với Artists/Album/Playlists/Trending/Search
- Không regression: gapless, MediaSession, Last.fm, search debounce (vẫn tránh gọi yt-dlp mỗi phím gõ) hoạt động đúng như trước
- `tsc --noEmit` sạch (trừ lỗi pre-existing `TrendingChartMode.tsx`)

## Render brief

### Task 1 — Resync progress sau backgrounding
1. *(add)* Thêm `useEffect` mới trong `PlayerProvider`, đăng ký `document.addEventListener('visibilitychange', handler)`.
2. *(add)* Trong handler, nếu `document.visibilityState === 'visible'` VÀ đang có `track`: đọc `getActive().currentTime`/`.duration`/`.paused` thật, gọi `setProgress`/`setDuration`/`setPlaying` tương ứng để đồng bộ lại state React với thực tế audio element.
3. *(legacy)* Không đụng logic `onTime`/`onEnd`/`onError` hiện có — handler mới chỉ bổ sung, không thay thế cơ chế cập nhật progress bình thường qua `timeupdate`.

**Prose:** Không có cách nào từ phía web app ngăn trình duyệt/OS tự giải phóng tài nguyên audio decoder của một tab bị đưa vào nền quá lâu — đây là hành vi quản lý bộ nhớ của nền tảng, không phải lỗi có thể vá triệt để. Điều app CÓ THỂ làm là đảm bảo, mỗi khi tab quay lại foreground, state hiển thị luôn được đọc lại từ nguồn sự thật duy nhất (chính audio element), thay vì tin tưởng mù quáng rằng state cũ vẫn còn đúng. Đây là pattern phòng thủ chuẩn cho bất kỳ app nào có UI phái sinh từ một phần tử media mà nền tảng có thể tự thay đổi ngoài tầm kiểm soát của JS.

### Task 2 — Fix stale search-navigate
1. *(add)* Thêm `onBlur={() => clearTimeout(timerRef.current)}` vào `<input>` trong `Header.tsx`.
2. *(legacy)* Giữ nguyên toàn bộ `handleInput`/debounce 300ms/`navigate(...)` — không đổi logic search, chỉ thêm 1 điểm huỷ timer.

**Prose:** Bug xảy ra vì `setTimeout` được tạo trong `handleInput` không hề gắn với vòng đời của tương tác người dùng với ô input — nó cứ chạy độc lập 300ms sau lần gõ cuối, bất kể người dùng có còn quan tâm tới ô search đó hay không. Khi người dùng rời khỏi ô search để bấm vào chỗ khác, sự kiện `blur` luôn xảy ra trước khi `click` hoàn tất (đây là thứ tự sự kiện chuẩn của DOM), nên huỷ timer đúng lúc `blur` là điểm chặn tự nhiên và đáng tin cậy nhất — không cần đoán người dùng "có ý định rời đi" bằng cách nào khác.

### Task 3 — Chuẩn hoá loading vị trí
1. *(add)* `RequestLogPage.tsx:190`: `<div style={{ padding: 32, opacity: 0.5 }}>` → `<div className="loading">`.
2. *(add)* `AIStatsPage.tsx:290` (loading chính, KHÔNG đụng dòng 372 loading phụ): tương tự đổi sang `className="loading"`.
3. *(add)* `EbooksPage.tsx:162`: `className="ebooks-loading"` → `className="loading"`.
4. *(add)* `VideosPage.tsx:44`: `className="videos-loading"` → `className="loading"`.
5. *(legacy)* Không đổi `Spinner` bên trong (giữ nguyên `size`/`label` từng chỗ), không đụng CSS class `.videos-loading`/`.ebooks-loading` cũ trong `index.css` (có thể còn dùng ở chỗ khác — không xoá, chỉ ngừng dùng ở 2 chỗ này).

**Prose:** 4 trang này lệch khỏi pattern chung không phải vì thiết kế có chủ đích khác nhau, mà vì mỗi lần thêm `Spinner` (trong đợt sweep loading trước) đã tái sử dụng đúng wrapper cũ đang có sẵn (padding/className riêng của từng trang) thay vì đổi sang class chung `.loading` — hợp lý tại thời điểm đó (surgical, không đụng CSS ngoài phạm vi) nhưng để lại đúng sự không nhất quán mà user giờ phát hiện khi chuyển trang liên tục. Fix lần này chỉ đổi phần wrapper, không đụng nội dung Spinner, giữ đúng tinh thần surgical tương tự.

### Task 4 — Verify toàn diện
1. *(block)* Test progress resync: giả lập chuyển `document.visibilityState` (qua CDP hoặc `Object.defineProperty` tạm) trong lúc audio đang phát, xác nhận `progress` cập nhật đúng khi quay lại `visible`.
2. *(block)* Test stale navigate: gõ vào search rồi bấm nav khác trong <300ms, xác nhận ở lại đúng trang, không bị đá về `/search`.
3. *(block)* Test loading position: chụp cả 4 trang ở trạng thái loading, xác nhận center giữa màn hình giống 6 trang còn lại.
4. *(legacy)* Xác nhận search debounce vẫn hoạt động bình thường khi gõ liên tục và KHÔNG rời khỏi ô search (không regression tính năng gốc).

**Prose:** Cả 3 fix đều thuộc dạng "chỉ lộ ra khi tương tác đúng trình tự thời gian" (chuyển tab, gõ-rồi-bấm-nhanh, chuyển trang liên tục) — verify tĩnh (đọc code) không đủ để xác nhận, bắt buộc phải thao tác tay hoặc giả lập đúng trình tự sự kiện trong browser thật.

## Notes
- Yêu cầu gốc từ user (repro cụ thể cho lỗi progress bar): "trường hợp xảy ra khi tui bật bài mood lofi nhưng bật lại tab thì nó tự start lại bài nhưng thanh tiến độ không chạy"
- Yêu cầu gốc cho lỗi navigate: "ấn vào debug thì lần đầu tiên nó lại navigate về search trong khi rõ là nó phải vào debug"
- Yêu cầu gốc cho lỗi loading: "thanh loading nó không đặt ở vị trí giống nhau ở mọi trang cái thì đặt ở centre rất đẹp cái đặt ở trên top lạc quẻ"
- Chạy qua `/orca-workflow` → `/query` → `/propose`
- Liên quan: [[020926-fix-playback-double-audio-mediasession-fe]] (fix trước đó cùng file `PlayerContext.tsx`)

## Origin
- **Draft:** `wiki/sources/draft/020926-progress-navigate-loading-fix-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
