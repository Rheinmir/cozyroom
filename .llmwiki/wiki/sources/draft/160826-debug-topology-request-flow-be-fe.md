---
type: draft
title: /debug — bẻ node Client thành màn hình cụ thể, node cloudflared riêng, click request log vẽ luồng request/response chỉ khi data thực sự được dùng
status: proposed
tags: [debug, observability, topology, fe, be]
timestamp: 2026-08-16
---

# 160826-debug-topology-request-flow-be-fe
**Type:** draft
**Status:** proposed
**Tags:** debug, observability, topology, fe, be
**Proposed:** 2026-08-16
**Sequence diagram:** [html/160826-debug-topology-request-flow-be-fe-seq.html](../../../html/160826-debug-topology-request-flow-be-fe-seq.html)

## What
Redesign panel "Sơ đồ topology (số liệu live)" trong `RequestLogPage.tsx` (trang `/debug`):
1. Bẻ node "Client (bạn)" hiện đang là 1 box chung chung thành các màn hình frontend cụ thể.
2. Thêm 1 node riêng biệt "cloudflared" (hộp, cùng style với các node khác) giữa màn hình và Backend pod — **không phải chỉ đổi nhãn text trên mũi tên** như bản nháp đầu đã hiểu sai. Traffic thực sự đi qua tunnel do pod `cloudflared` (chạy trong chính cluster của user) duy trì kết nối outbound tới Cloudflare edge — đây là 1 hop hạ tầng thật, xứng đáng có node riêng.
3. Click vào 1 dòng Request Log sẽ vẽ mũi tên nối đúng màn hình đã gọi request đó → cloudflared → Backend pod, và **chỉ vẽ khi màn hình đó THỰC SỰ đã setState/render xong data** (Phương án B đúng nghĩa, đã chốt — xem mục quyết định bên dưới), không phải chỉ "trang đang mở lúc gọi request".

Đây là gộp 4 feedback thu thập qua design-feedback tool trên chính trang `/debug` production thành 1 cụm thay đổi liên quan nhau.

## Quyết định đã chốt qua trao đổi với user (không tự chọn ngầm)

**1. Cơ chế xác định "đã dùng data" — chốt Phương án B đúng nghĩa**, không phải phương án rút gọn (theo dõi mount ở 1 chỗ):
mỗi nơi trong frontend sau khi `setState` xong với data lấy về, tự gọi thêm `reportDataUsed(requestId, page)`. Chỉ khi có lệnh gọi này, backend mới gắn `page` vào đúng entry trong request log. Đánh đổi: đúng 100% ngữ nghĩa gốc của feedback, nhưng bán kính sửa lớn — xem "Nghiên cứu" bên dưới, con số CHÍNH XÁC (không phải ước lượng) là **~19 file** bị ảnh hưởng.

**2. Feedback #3 (node Cloudflare) — sửa lại hiểu nhầm ban đầu:** user xác nhận cần **1 node hộp riêng tên "cloudflared"**, không phải chỉ đổi chữ trên mũi tên nối. Node này đại diện cho pod `cloudflared` chạy trong cluster của chính user (đã có sẵn trong hạ tầng thật — xem [[K3s infra topology]], log log.md có nhắc "2 cloudflared pods"), không phải Cloudflare edge network chung chung.

**3. Thêm node "frontend (nginx proxy)" — phát sinh từ 1 câu hỏi thực tế của user khi đọc dữ liệu live trên trang** ("RemoteAddr chung mạng local mà sao vẫn nhằm vào be pod?"). Đã verify bằng `kubectl get pods -A -o wide` (tra ra `10.42.0.33` = pod `frontend-9dd47b59b-w5sws`, không phải `cloudflared` và không phải máy client) + `nginx.conf:68-69` (`location /api/ { proxy_pass $backend; }`) — đường đi thật có **4 hop**, không phải 3: `Client → Cloudflare edge → cloudflared → frontend (nginx proxy) → Backend pod`. `RemoteAddr` mà backend thấy luôn là IP pod `frontend` (TCP peer trực tiếp), không bao giờ là client thật. User chọn thêm node này vào cùng Task 9, không tạo task riêng.

## Nghiên cứu chính xác trước khi viết plan (grep thật, không ước lượng)
Đã cho 2 Explore agent đọc trực tiếp toàn bộ `api.ts`, `RequestLogPage.tsx`, `reqlog.go`, `routes.go`, `debug.go`, `AppRoutes.tsx`, và **grep toàn bộ `frontend/src/pages/*.tsx` + `PlayerContext.tsx` + `BgSoundsContext.tsx`** tìm mọi call site "fetch rồi setState". Kết quả quan trọng làm thay đổi thiết kế:

- **`api.ts` KHÔNG có 1 lớp fetch chung duy nhất** — có 3 wrapper khác nhau: `get<T>()` (dòng 9-13, dùng cho phần lớn GET), `kanbanFetch<T>()` (dòng 329, riêng cho Kanban/Notes), `ownerFetch<T>()` (dòng 511, riêng cho 3 endpoint debug). Ngoài ra nhiều hàm POST/DELETE gọi `fetch()` trực tiếp không qua wrapper nào — nhóm này không liên quan (không setState hiển thị data).
- **5 file gọi `fetch()` trần trụi, không qua `api.ts`**: `VideosPage.tsx`, `AIStatsPage.tsx`, `AIAssistantPage.tsx`, `EbookReaderPage.tsx`, `BgSoundsContext.tsx`.
- **10 file dùng 1 trong 3 wrapper của `api.ts`**: `ComicsPage.tsx`, `ComicsPageMobile.tsx`, `PlaylistsPage.tsx`, `SearchPage.tsx`, `MusicStatsPage.tsx`, `TrendingPage.tsx`, `TrendingChartMode.tsx`, `RequestLogPage.tsx`, `NotesPage.tsx`, `PlayerContext.tsx`.
- **4 file dùng React Query** (`AlbumPage.tsx`, `ArtistPage.tsx`, `ArtistsPage.tsx`, `EbooksPage.tsx`) — kiến trúc khác hẳn: `data` là state nội bộ của `useQuery({queryFn: fetchXxx})`, **không có `setState` tường minh** để chèn `reportDataUsed` theo sau. Phải móc vào `onSuccess`/`select`/`useEffect(data)` tuỳ version React Query — xác nhận version lúc code, không khoá cứng trong plan này.
- **CORS: không có whitelist header nào chặn** — grep `Access-Control-Allow-Headers` toàn backend chỉ ra đúng 1 chỗ ở `mcp/server.go` (CORS riêng cho MCP server, không áp dụng cho `/api/*`). Route `/api/*` chính không có middleware CORS riêng (same-origin) → thêm header mới không cần whitelist gì thêm.

**Quyết định thiết kế để giảm độ phức tạp phía frontend:** thay vì để MỖI file tự sinh `requestId` rồi gắn header đi (3 cách sinh khác nhau tương ứng 3 wrapper + 5 raw fetch), **backend tự sinh `requestId` cho MỌI request** ngay trong `metricsMiddleware` (đã bọc toàn bộ route sẵn), trả về qua response header `X-Debug-Request-Id`. Mỗi nơi gọi API ở frontend chỉ cần **đọc lại header response đó**, không cần tự sinh UUID — thống nhất 1 cách làm cho cả 3 wrapper lẫn 5 raw-fetch, đơn giản hơn so với để frontend tự sinh ID.

## Affected
| File / Symbol | Thay đổi |
|---|---|
| `backend/internal/api/reqlog.go` | `RequestEntry` thêm `RequestID string` (server sinh), `Page string` (rỗng ban đầu); thêm hàm `MarkUsed(id, page string) bool` mutex-protected, tìm entry theo `RequestID` trong ring buffer và set `Page` |
| `backend/internal/api/routes.go` | `metricsMiddleware` sinh `requestId` (uuid) cho MỌI request, set response header `X-Debug-Request-Id` trước khi gọi `next.ServeHTTP`, truyền id khi push entry; đăng ký route mới `POST /api/debug/mark-used` (KHÔNG gate `verifyOwnerPassword` — xem Risk) |
| `frontend/src/api.ts` | 3 wrapper `get/kanbanFetch/ownerFetch` đọc header `X-Debug-Request-Id` từ response, đổi return type thành `{data: T, requestId: string}`; export `reportDataUsed(requestId, page)` — fire-and-forget, nuốt lỗi im lặng |
| 5 file raw-fetch: `VideosPage.tsx`, `AIStatsPage.tsx`, `AIAssistantPage.tsx`, `EbookReaderPage.tsx`, `BgSoundsContext.tsx` | Tự đọc header response tương tự, gọi `reportDataUsed` sau setState |
| 10 file dùng wrapper `api.ts`: `ComicsPage.tsx`, `ComicsPageMobile.tsx`, `PlaylistsPage.tsx`, `SearchPage.tsx`, `MusicStatsPage.tsx`, `TrendingPage.tsx`, `TrendingChartMode.tsx`, `RequestLogPage.tsx`, `NotesPage.tsx`, `PlayerContext.tsx` | Đổi destructure `{data, requestId}` tại từng call site đã liệt kê, gọi `reportDataUsed(requestId, location.pathname)` ngay sau setState |
| 4 file React Query: `AlbumPage.tsx`, `ArtistPage.tsx`, `ArtistsPage.tsx`, `EbooksPage.tsx` | Móc `reportDataUsed` vào `onSuccess`/`useEffect(data)` tuỳ version React Query đang dùng (xác nhận lúc code) |
| `frontend/src/pages/RequestLogPage.tsx` (bổ sung, cùng file ở trên) | (a) danh sách màn hình tĩnh thay "Client", (b) **node hộp riêng "cloudflared"** giữa màn hình và Backend, (c) request log row clickable, vẽ path [màn hình]→[cloudflared]→[Backend] chỉ khi `entry.page` không rỗng |

**Không đổi** cấu trúc gate `verifyOwnerPassword` hiện có của trang `/debug`, không đổi 3 endpoint `/api/debug/instance|services|traceroute` hiện có.

## Risks
- **Bán kính thay đổi ~19 file, trải khắp mọi domain persona** — đây không còn là 1 thay đổi nhỏ cục bộ. Cần fan-out đúng người: `music-engineer` (SearchPage, MusicStatsPage, ArtistsPage, ArtistPage, AlbumPage, PlayerContext), `video-engineer` (VideosPage), `reader-engineer` (EbooksPage, EbookReaderPage, ComicsPage, ComicsPageMobile), `social-engineer` (PlaylistsPage, NotesPage, TrendingPage, TrendingChartMode), `ai-engineer` (AIStatsPage, AIAssistantPage), `infra-engineer` (backend + `api.ts` + `RequestLogPage.tsx` + `BgSoundsContext.tsx` — file mồ côi không thuộc persona nào rõ ràng). Rủi ro va chạm nếu nhiều agent sửa cùng lúc — nhưng ở đây mỗi agent chỉ đụng file domain riêng của mình, không trùng file giữa các agent (chỉ `api.ts`/`routes.go`/`reqlog.go` là dùng chung, giao hết cho 1 agent infra-engineer làm trước).
- **`api.ts` đổi return type của 3 wrapper là breaking change** cho toàn bộ 10 file gọi qua nó — bắt buộc `impact-check` + `safe-change` trước khi sửa theo đúng rule `CLAUDE.md`, và phải sửa ĐỒNG THỜI với 10 call site (không thể tách làm 2 đợt vì sẽ vỡ build ngay).
- **Endpoint `POST /api/debug/mark-used` KHÔNG thể gate bằng `verifyOwnerPassword`** — vì nó phải chạy ngầm cho MỌI user, MỌI lúc (không chỉ khi ai đó đã mở `/debug` và nhập mật khẩu), giống hệt cách `metricsMiddleware` hiện tại quan sát mọi request mà không cần gate. Dữ liệu ghi vào (route path + 1 UUID) không nhạy cảm hơn dữ liệu request log đã public từ trước, nhưng cần xác nhận đây là chấp nhận được (không gate) trước khi code, không tự quyết ngầm.
- **4 file React Query cần cơ chế khác hẳn 15 file còn lại** — rủi ro kỹ thuật: nếu version React Query đang dùng đã bỏ `onSuccess` (v5), phải chuyển sang `useEffect` theo dõi `data` đổi giá trị, phức tạp hơn 1 chút và có thể fire nhiều lần nếu không cẩn thận (cần so sánh giá trị cũ/mới, không phải chỉ "data tồn tại").
- **500-entry ring buffer in-memory** — không đổi so với đề xuất trước, nhưng giờ `MarkUsed` phải tìm đúng entry theo `RequestID` giữa lúc ring buffer có thể đã bị entry mới ghi đè (buffer đầy, entry cũ bị overwrite trước khi kịp mark-used) — trường hợp hiếm (chỉ xảy ra khi có >500 request xen giữa lúc fetch xong và lúc setState) nhưng cần xử lý êm: `MarkUsed` trả `false` nếu không tìm thấy, không lỗi.

## Global constraints
- Không đổi gate `verifyOwnerPassword` hiện có của trang `/debug` — trang vẫn phải nhập owner password mới xem được.
- Không đổi 3 endpoint `/api/debug/instance|services|traceroute` đã có từ đề xuất trước ([[160826-debug-network-page-be-fe]]).
- `reportDataUsed()` phải fire-and-forget, không được `await` chặn UI chính và không được throw ra ngoài nếu request thất bại — đây là instrumentation phụ, không phải luồng nghiệp vụ chính.
- Mỗi agent chỉ sửa đúng file trong domain của mình (xem bảng phân công); `api.ts`/`routes.go`/`reqlog.go` do đúng 1 agent (`infra-engineer`) làm để tránh 2 agent cùng sửa file chung.
- Không tự ý gate `POST /api/debug/mark-used` bằng owner-password nếu chưa xác nhận với user (xem Risk) — mặc định để mở như `metricsMiddleware`.

## Plan
- [ ] Task 1 (infra-engineer): `reqlog.go` — thêm `RequestID`/`Page` vào `RequestEntry`, thêm `MarkUsed(id, page string) bool` mutex-protected
- [ ] Task 2 (infra-engineer): `routes.go` — `metricsMiddleware` sinh `requestId`, set response header `X-Debug-Request-Id`, đăng ký `POST /api/debug/mark-used` (không gate)
- [ ] Task 3 (infra-engineer, invoke `impact-check`+`safe-change` trước — breaking change shared file): `api.ts` — đổi return type 3 wrapper thành `{data, requestId}`, export `reportDataUsed()`; đồng thời sửa 10 call site trong chính các file dùng wrapper để không vỡ build (một phần công việc này giao chéo sang Task 4-7 theo domain, infra-engineer chỉ đảm bảo `api.ts` compile đúng type)
- [ ] Task 4 (music-engineer): `SearchPage.tsx`, `MusicStatsPage.tsx`, `ArtistsPage.tsx`, `ArtistPage.tsx`, `AlbumPage.tsx`, `PlayerContext.tsx` — cập nhật theo đúng cơ chế tương ứng (wrapper destructure hoặc React Query hook)
- [ ] Task 5 (video-engineer): `VideosPage.tsx` — raw fetch, đọc header + gọi `reportDataUsed`
- [ ] Task 6 (reader-engineer): `EbooksPage.tsx` (React Query), `EbookReaderPage.tsx` (raw fetch), `ComicsPage.tsx`, `ComicsPageMobile.tsx` (wrapper)
- [ ] Task 7 (social-engineer): `PlaylistsPage.tsx`, `NotesPage.tsx`, `TrendingPage.tsx`, `TrendingChartMode.tsx` (wrapper)
- [ ] Task 8 (ai-engineer): `AIStatsPage.tsx`, `AIAssistantPage.tsx` (raw fetch)
- [ ] Task 9 (infra-engineer): `BgSoundsContext.tsx` (raw fetch, file mồ côi không thuộc persona nào) + `RequestLogPage.tsx` — node "cloudflared" riêng, bẻ Client thành list màn hình, click-to-trace chỉ vẽ khi `entry.page` không rỗng
- [ ] Task 10 (infra-engineer): Verify toàn diện — xem Success criteria

## Agent Task Assignment
| Task | Agent (CLI) | Lý do chọn | Status |
|------|------|------|------|
| Task 1: reqlog.go | infra-engineer | Cùng domain `/debug` đã sở hữu từ đề xuất trước | pending |
| Task 2: routes.go + mark-used | infra-engineer | `routes.go` là điểm nghẽn chung, cần agent quen convention route ở đây | pending |
| Task 3: api.ts (breaking, shared) | infra-engineer | File dùng chung toàn app, đổi return type ảnh hưởng 10 file khác — bắt buộc `impact-check`+`safe-change`, cần 1 agent duy nhất kiểm soát toàn bộ thay đổi type | pending |
| Task 4: music-engineer files | music-engineer | SearchPage/MusicStatsPage/ArtistsPage/ArtistPage/AlbumPage/PlayerContext đúng domain track/album/artist/search/playback theo bảng persona | pending |
| Task 5: VideosPage.tsx | video-engineer | Đúng domain streaming/video | pending |
| Task 6: Ebooks/Ebook Reader/Comics | reader-engineer | Đúng domain ebook/comics | pending |
| Task 7: Playlists/Notes/Trending | social-engineer | Đúng domain playlists/notes/trending | pending |
| Task 8: AIStats/AIAssistant | ai-engineer | Đúng domain AI chat/analytics | pending |
| Task 9: BgSoundsContext + RequestLogPage | infra-engineer | BgSoundsContext không thuộc persona nào (ambient sounds là tiện ích nền, không phải domain riêng); RequestLogPage cùng file agent này đã sở hữu | pending |
| Task 10: Verify | infra-engineer | Cần verify cross-domain toàn bộ 19 file cùng lúc, không giao CLI rẻ | pending |

## Success criteria
- `POST /api/debug/mark-used` nhận `{request_id, page}` hợp lệ → entry tương ứng trong ring buffer có `page` đúng giá trị; `request_id` không tồn tại (đã bị overwrite) → trả về êm, không lỗi 500.
- Mở `/artist/1`, đợi trang render xong nghệ sĩ → dòng log entry của request đó có `page` = `/artist/1` trong response `/api/debug/requests`.
- **Test nhánh "fetch nhưng không dùng"**: trong `PlayerContext.tsx` hoặc trang có race-guard (đổi nhanh 2 lần liên tiếp trước khi response đầu về), xác nhận request bị discard đó **không** có `reportDataUsed` được gọi → entry `page` vẫn rỗng — đây là phép thử quan trọng nhất để chứng minh Phương án B đúng nghĩa hoạt động đúng khác biệt so với Phương án A.
- Click log entry có `page` không rỗng → đúng màn hình sáng lên, có mũi tên qua **node hộp "cloudflared"** (không phải label trên line) → Backend pod.
- Click log entry có `page` rỗng → không có mũi tên, không hiệu ứng gì.
- `tsc --noEmit` (toàn bộ 15 file frontend không phải React Query) và `go build ./...` sạch; 4 file React Query build sạch với cơ chế `onSuccess`/`useEffect` đã chọn.
- Không route/page nào khác lỗi mạng do thay đổi return type của `api.ts` wrapper (đây là breaking change lớn nhất, cần build sạch toàn bộ trước khi coi Task 3 hoàn thành).

## Notes
- Phát sinh từ 4 feedback thu thập qua design-feedback tool trên `/debug` production trong 1 lượt gửi.
- Liên quan trực tiếp tới [[160826-debug-network-page-be-fe]] (cùng trang, cùng agent `infra-engineer` sở hữu phần backend/khung trang) — không đổi lại 3 endpoint đã có.
- **Lịch sử quyết định trong phiên này**: bản nháp đầu tiên đề xuất Phương án A (rẻ, ~1-2 file) làm mặc định và hỏi user xác nhận; user hỏi lại chi tiết, được cho xem preview cả 2 phương án (A và B), chọn "B rút gọn" bị từ chối, cuối cùng chốt "B đúng nghĩa" sau khi thấy rõ cả 2 preview code mẫu. Feedback #3 ban đầu bị hiểu sai thành "chỉ đổi nhãn text" — user sửa lại thành "cần 1 node hộp riêng". Grep thật sau đó xác nhận con số ~19 file, lớn hơn ước lượng ban đầu "~15-17" nêu trong lúc hỏi — đúng thực tế trước khi code, không phải sau khi code mới phát hiện (khác với vài lần trước trong project này, xem [[Reuse existing AI provider]] style bài học).

## Origin
- **Draft:** `wiki/sources/draft/160826-debug-topology-request-flow-be-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
