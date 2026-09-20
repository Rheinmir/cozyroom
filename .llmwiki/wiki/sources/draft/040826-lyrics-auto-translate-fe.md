---
type: draft
title: Tu dong goi y bat dich loi bai hat khi ten bai/nghe si khong phai tieng Viet
status: done
tags: [lyrics, translate, i18n, ux, fe]
timestamp: 2026-08-04
---

# 040826-lyrics-auto-translate-fe
**Type:** draft
**Status:** done — implement + deploy K8s 2026-08-04, dùng hướng B (xem "## Đổi hướng sau khi duyệt")
**Tags:** lyrics, translate, i18n, ux, fe
**Proposed:** 2026-08-04
**Sequence diagram:** [html/040826-lyrics-auto-translate-fe-seq.html](../../../html/040826-lyrics-auto-translate-fe-seq.html)

## Đổi hướng sau khi duyệt (quan trọng — đọc trước khi tin phần "What"/"Render brief" gốc bên dưới)
Bản gốc dưới đây đề xuất heuristic Unicode thuần (0 dependency, không đổi backend). User hỏi thêm "cần dịch thêm tiếng Anh, có thư viện detect nào không" — hai hướng được so sánh: (A) thư viện client-side (`franc`) — offline nhưng kém chính xác trên văn bản ngắn như tên bài hát; (B) tái dùng chính Google Translate app đã gọi để dịch lyrics (endpoint đó vốn đã trả kèm ngôn ngữ nguồn detect được, chỉ chưa đọc ra). Test trực tiếp qua `curl` trước khi chọn: **"Yeu 5" (tiếng Việt không dấu) được Google detect đúng là `vi`** — giải quyết đúng ca khó nhất mà heuristic Unicode không làm được. User chọn hướng B. Thực tế đã build theo hướng B, KHÔNG theo Task 1 (Unicode util) của bản gốc — xem "## Thực tế đã làm (hướng B)" bên dưới.

## What (bản gốc — heuristic Unicode, ĐÃ THAY bằng Google detect ở bản build thật)
Nút dịch lời bài hát (🌐, đã có sẵn ở `LyricsView.tsx` + `PlayerBar.tsx`) hiện phải bấm tay mỗi lần. Thêm 1 biến bật/tắt "tự động dịch": khi bật, nếu app phát hiện tên bài hoặc tên nghệ sĩ **chắc chắn không phải tiếng Việt** (dựa trên bộ ký tự Unicode — Hangul/Kana/Kanji-Hán/Thai/Cyrillic...), tự động kích hoạt dịch ngay khi chuyển bài, không cần bấm tay.

**Phạm vi cố tình hẹp:** chỉ tự động bật khi CHẮC CHẮN (title/artist chứa ký tự ngoài bảng chữ Latin). Trường hợp chữ Latin thuần (tiếng Anh, hoặc tiếng Việt gõ không dấu — như chính bug "yeu 5" đã fix tuần trước) **không** tự động bật, vì không đủ tin cậy để phân biệt và dễ làm phiền người dùng với các bài tiếng Việt không dấu vốn rất phổ biến trong thư viện này.

## Thực tế đã làm (hướng B — Google Translate detect, không dùng thư viện ngoài)
- Backend: `detectLanguage(text string)` mới trong `lyrics.go` — gọi lại đúng endpoint `translate_a/single` đã dùng cho `translateLines()`, đọc `raw[2]` (ngôn ngữ detect) + `raw[6]` (confidence, best-effort). Endpoint mới `GET /api/lyrics/detect-language?text=...`, đăng ký TRƯỚC `GET /api/lyrics/{id}` trong `routes.go` (literal path thắng wildcard theo Go 1.22+ ServeMux).
- Frontend: `LyricsView.tsx` thêm prop `onReady?: (trackId) => void` + 1 effect mới `useEffect(() => { if (!loading) onReady?.(trackId) }, [loading, trackId])` — đây là cách giải quyết ĐÚNG rủi ro race đã nêu ở Task 3 gốc (chờ tín hiệu thật "lyrics đã load cho track này", không dùng `setTimeout` đoán mò).
- `PlayerBar.tsx`: state `autoTranslate` (persist `localStorage['lyrics-auto-translate']`, default **tắt**), nút ⚡ cạnh nút 🌐 (không dùng long-press — chọn phương án B của bảng Trade-off gốc vì rõ ràng/dễ phát hiện hơn), `handleLyricsReady()` gọi `detectLyricsLanguage()` rồi `toggleTranslation()` nếu `lang !== 'vi'`.
- CSS: `.npo-auto-translate-btn` — nút ⚡ ở mobile cần vị trí `absolute` riêng (offset `right: 56px`, cách nút 🌐 hiện có 40px) để không đè lên nhau, vì `.npo-translate-btn` gốc dùng `position:absolute` chỉ trong `@media (max-width:640px)`.

## Affected
| File | Thay đổi |
|---|---|
| `frontend/src/utils/language.ts` (mới) | `looksNonVietnamese(text: string): boolean` — kiểm tra Unicode script |
| `frontend/src/components/PlayerBar.tsx` | Thêm state `autoTranslateEnabled` (persist localStorage), toggle UI cạnh nút 🌐, `useEffect` tự gọi `lyricsRef.current?.toggleTranslation()` khi đổi bài + điều kiện thoả |
| `frontend/src/i18n/{vi,en}.json` | Thêm key label cho toggle mới |

**Không đổi backend** — tái dùng nguyên vẹn `GET /api/lyrics/{id}/translate` và cơ chế `toggleTranslation()` đã có trong `LyricsViewHandle`.

## Risks
- **Race điều kiện đổi bài:** `LyricsView.tsx` có `useEffect` riêng theo `[trackId]` tự reset `showTr=false` + fetch lyrics mới. Effect mới trong `PlayerBar.tsx` cũng chạy theo track đổi — nếu gọi `toggleTranslation()` QUÁ SỚM (trước khi `LyricsView` reset xong), có thể toggle nhầm trạng thái của bài cũ, hoặc gọi 2 lần dẫn tới bật rồi tắt lại. Cần đảm bảo thứ tự: chờ `LyricsView` báo đã load xong bài mới (qua `onTranslateActiveChange` hiện tại chỉ báo `showTr`, có thể cần thêm 1 tín hiệu "đã sẵn sàng" hoặc dùng `setTimeout` ngắn — quyết định kỹ thuật cụ thể để lúc code, không chốt cứng ở bước propose).
- **Heuristic Unicode không hoàn hảo** — bỏ sót trường hợp bài tiếng Anh viết bằng chữ Latin thuần (không tự động được, chấp nhận). Không cố gắng phân biệt "tiếng Anh vs tiếng Việt không dấu" ở bản này — đây là quyết định phạm vi có chủ đích, không phải thiếu sót.
- **Gọi dịch tốn phí/độ trễ mỗi lần đổi bài** nếu bật auto + nghe nhiều bài không-tiếng-Việt liên tục — đã có cache 2 lớp sẵn (sessionStorage phía FE theo track, bảng `lyrics_translations` phía DB theo `(track_id, lang)`), nên chỉ tốn phí ở lần đầu tiên mỗi bài, không lặp lại.
- **Không có trang Settings chung** trong app — toggle mới phải nhét cạnh nút 🌐 hiện có (long-press hoặc icon nhỏ), không phải vị trí lý tưởng nếu sau này có thêm nhiều toggle khác — chấp nhận được cho 1 toggle đơn lẻ, nhưng nếu tương lai cần thêm cài đặt khác, nên cân nhắc trang Settings riêng khi đó.

## Global constraints
- Không đổi endpoint `/api/lyrics/{id}/translate` hay bảng `lyrics_translations` — tái dùng nguyên vẹn.
- Không đổi hành vi nút 🌐 thủ công hiện có — auto-translate chỉ là 1 lớp kích hoạt THÊM, người dùng vẫn bấm tay được bình thường và có thể tắt lại bất cứ lúc nào.
- Không thêm dependency ngoài cho việc detect ngôn ngữ (không cần thư viện `franc`/`langdetect` — thuần regex Unicode range, 0 dependency mới).
- Default bật/tắt của toggle mới **cần user xác nhận** — xem bảng Trade-off.

## Plan
- [ ] Task 1: `frontend/src/utils/language.ts` mới — `looksNonVietnamese(text: string): boolean` dựa trên Unicode script ranges (Hangul U+AC00–D7A3, Hiragana U+3040–309F, Katakana U+30A0–30FF, CJK Unified Ideographs U+4E00–9FFF, Thai U+0E00–0E7F, Cyrillic U+0400–04FF)
- [ ] Task 2: `PlayerBar.tsx` — state `autoTranslateEnabled` persist qua localStorage key `lyrics-auto-translate`, toggle UI cạnh nút 🌐 (long-press hoặc icon nhỏ)
- [ ] Task 3: `PlayerBar.tsx` — `useEffect` theo `track?.id`: nếu `autoTranslateEnabled` VÀ `looksNonVietnamese(track.title + ' ' + artistInfo?.name)` VÀ chưa `trActive` → gọi `lyricsRef.current?.toggleTranslation()` sau khi `LyricsView` đã sẵn sàng cho bài mới (giải quyết race nêu ở Risks)
- [ ] Task 4: Verify — test tay: bật toggle, phát 1 bài có tên/nghệ sĩ chữ Hàn/Nhật/Trung nếu thư viện có (hoặc tạo track thử với title giả), xác nhận dịch tự bật; phát bài tiếng Việt không dấu (vd "Yeu 5"), xác nhận KHÔNG tự bật; tắt toggle, xác nhận không còn tự động; `tsc --noEmit` sạch

## Agent Task Assignment
| Task | Agent (CLI) | Lý do chọn | Status |
|------|------|------|------|
| Task 1: Unicode detect util | Claude Code (sonnet) | Cần chọn đúng range Unicode, sai sót làm heuristic vô nghĩa — cần judgement, không phải chép mẫu | pending |
| Task 2: Toggle state + UI | Claude Code (sonnet) | Đụng `PlayerBar.tsx` là file lõi player, cần đúng vị trí UI không phá layout hiện có | pending |
| Task 3: Auto-trigger effect | Claude Code (sonnet) | Rủi ro race điều kiện với effect có sẵn của `LyricsView` — cần cẩn trọng, không giao CLI rẻ | pending |
| Task 4: Verify | Claude Code (sonnet) | Cần verify thật bằng nghe nhạc + quan sát hành vi toggle, không giao CLI rẻ | pending |

## Success criteria
- Bật toggle auto-translate, phát bài có title/artist chứa ký tự ngoài Latin (Hàn/Nhật/Trung/Thái/Nga) → dịch tự động hiện ra, không cần bấm 🌐.
- Phát bài tiếng Việt không dấu (thuần Latin) → dịch KHÔNG tự bật, nút 🌐 vẫn bấm tay được bình thường.
- Tắt toggle → không còn hành vi tự động, mọi thứ về lại y hệt trước khi có tính năng này.
- Đổi bài liên tục nhanh (spam next) không gây lỗi/toggle nhầm giữa các bài.
- `tsc --noEmit` sạch, không regression nút dịch thủ công hiện có.

## Trade-off cần user xác nhận (không tự chọn ngầm)
| Quyết định | Phương án A | Phương án B |
|---|---|---|
| Default toggle khi chưa từng bật | **Tắt (OFF)** — an toàn, không đổi hành vi hiện tại cho tới khi user chủ động bật | **Bật (ON)** — đúng tinh thần "tự động" ngay từ đầu, nhưng đổi hành vi mặc định cho mọi người dùng app |
| Vị trí toggle UI | Long-press vào nút 🌐 hiện có (không thêm phần tử UI mới) | Thêm 1 icon nhỏ riêng cạnh nút 🌐 (rõ ràng hơn nhưng chiếm thêm không gian) |

## Render brief

### Task 1 — Unicode detect util
1. *(add)* File mới `frontend/src/utils/language.ts`, export `looksNonVietnamese(text: string): boolean`.
2. *(add)* Regex kiểm tra các Unicode range: Hangul, Hiragana, Katakana, CJK Unified Ideographs, Thai, Cyrillic — trả `true` nếu text chứa BẤT KỲ ký tự nào trong các range này.
3. *(block)* Text thuần Latin (có hoặc không dấu tiếng Việt) → luôn trả `false` — không cố phân biệt tiếng Anh với tiếng Việt không dấu.

**Prose:** Hàm này cố tình được thiết kế để chỉ tự tin trong đúng 1 trường hợp: khi văn bản chứa ký tự thuộc hệ chữ viết khác hẳn Latin, vì đó là tín hiệu không thể nhầm lẫn — không có bài hát tiếng Việt nào có tên chứa chữ Hangul hay Kanji. Ngược lại, với văn bản Latin thuần, việc phân biệt "đây là tiếng Anh" hay "đây là tiếng Việt gõ thiếu dấu" đòi hỏi một mô hình ngôn ngữ thực sự (như Google Translate's detect, tốn thêm 1 lệnh gọi mạng mỗi bài) — bài học từ chính bug "yeu 5" tuần trước cho thấy thư viện này có rất nhiều bài tiếng Việt được gõ hoặc lưu không dấu, nên một heuristic sai ở nhánh này sẽ tự động bật dịch cho hàng loạt bài tiếng Việt bình thường, gây phiền nhiều hơn lợi ích mang lại.

### Task 2 — Toggle state + UI
1. *(add)* `PlayerBar.tsx`: state `autoTranslateEnabled`, khởi tạo từ `localStorage.getItem('lyrics-auto-translate')`, persist lại mỗi khi đổi (theo đúng pattern `app-language`/`trending-view-mode` đã có trong `Sidebar.tsx`/`TrendingPage.tsx`).
2. *(add)* UI toggle cạnh nút 🌐 hiện có (dòng ~340-344) — hình thức cụ thể (long-press hay icon riêng) chốt theo Trade-off user chọn.
3. *(legacy)* Không đổi nút 🌐 thủ công hiện có — vẫn hoạt động y hệt, độc lập với toggle mới.

**Prose:** Việc chọn persist qua 1 key localStorage độc lập (thay vì nhét vào blob `hs-player` đang lưu quality/queue/progress) phản ánh đúng bản chất của cài đặt này: nó không thuộc về trạng thái của MỘT phiên nghe nhạc cụ thể (như bài đang phát, vị trí tua), mà là một tuỳ chọn lâu dài của người dùng — giống hệt lý do `app-language` hay `trending-view-mode` cũng được lưu riêng, không gộp vào state phiên phát nhạc.

### Task 3 — Auto-trigger effect
1. *(add)* `useEffect` mới trong `PlayerBar.tsx`, phụ thuộc `[track?.id, autoTranslateEnabled]`.
2. *(add)* Điều kiện: `autoTranslateEnabled && !trActive && looksNonVietnamese(track.title + ' ' + (artistInfo?.name ?? ''))` → gọi `lyricsRef.current?.toggleTranslation()`.
3. *(block)* Phải đảm bảo effect này chạy SAU khi `LyricsView` đã xử lý xong việc reset trạng thái cho track mới (effect `[trackId]` bên trong `LyricsView.tsx` dòng 91-107) — nếu không, có nguy cơ gọi toggle trong lúc `showTr`/`translations` của `LyricsView` còn đang mang dữ liệu của bài CŨ, dẫn tới hiển thị sai hoặc gọi API dịch cho track_id sai. Giải pháp kỹ thuật cụ thể (thứ tự effect, `setTimeout`, hay thêm callback "ready") để lúc code quyết, không chốt trước ở bước propose.

**Prose:** Đây là task rủi ro kỹ thuật cao nhất trong toàn bộ đề xuất — không phải vì logic điều kiện phức tạp, mà vì React chạy nhiều `useEffect` độc lập ở các component khác nhau (`PlayerBar` và `LyricsView` con của nó) theo cùng một sự kiện thay đổi (`track` đổi), và thứ tự thực thi giữa chúng không hiển nhiên nếu chỉ nhìn vào code mà không kiểm chứng runtime thật. Việc chọn "tự động gọi lại đúng hàm `toggleTranslation()` đã có" (thay vì viết lại logic fetch/hiển thị dịch riêng cho nhánh tự động) là quyết định thiết kế quan trọng nhất của cả đề xuất: nó đảm bảo hành vi tự động và hành vi bấm tay luôn nhất quán tuyệt đối, vì cả hai đi qua cùng một đường code, không có 2 phiên bản logic dịch song song dễ lệch nhau theo thời gian.

### Task 4 — Verify
1. *(add)* Bật toggle, phát bài có title/artist chứa ký tự ngoài Latin (thật nếu thư viện có, hoặc giả lập tạm) → xác nhận dịch tự bật đúng, không cần bấm tay.
2. *(add)* Phát bài tiếng Việt không dấu (vd "Yeu 5") → xác nhận dịch KHÔNG tự bật.
3. *(add)* Next/prev nhanh liên tục nhiều bài → xác nhận không có lần nào bị toggle nhầm bài hoặc dịch hiển thị sai track.
4. *(add)* Tắt toggle → xác nhận về lại hành vi thủ công hoàn toàn như trước khi có tính năng.
5. *(block)* `tsc --noEmit` sạch.

**Prose:** Phép thử quan trọng nhất ở đây là kịch bản next/prev nhanh — đây chính là nơi rủi ro race điều kiện nêu ở Task 3 sẽ lộ ra thật nếu thiết kế effect sai thứ tự, và là bằng chứng duy nhất chứng minh tính năng tự động không làm hỏng trải nghiệm nghe nhạc bình thường của người dùng.

## Notes
- Invoked via: user báo issue "phần dịch lyrical hiện tại phải bật tay thủ công" → yêu cầu thêm biến tự động bật khi phát hiện tên bài không phải tiếng Việt, kèm rõ "chưa cần thực hiện" → `/propose`
- Không dùng franc/langdetect hay gọi Google Translate detect riêng — giữ heuristic 0-dependency theo đúng "Simplicity First"; nếu sau này heuristic không đủ tốt (vd cần phân biệt tiếng Anh), có thể nâng cấp bằng cách đọc `detected_lang` từ chính response Google Translate đã gọi cho lyrics — đây là hướng mở rộng, không phải việc của bản này
- Liên quan: [[concepts/Lyrics.md]], [[concepts/LyricsReliability.md]]

## Origin
- **Draft:** `wiki/sources/draft/040826-lyrics-auto-translate-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
