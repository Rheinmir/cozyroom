---
type: draft
title: Trang /debug hien pod/node dang serve + bang service + evidence mang that tu phien client
status: proposed
tags: [debug, observability, network, k8s, be, fe]
timestamp: 2026-08-16
---

# 160826-debug-network-page-be-fe
**Type:** draft
**Status:** implemented — chưa verify runtime qua browser thật với backend live (xem "## Thực tế đã làm")
**Tags:** debug, observability, network, k8s, be, fe
**Proposed:** 2026-08-16
**Sequence diagram:** [html/160826-debug-network-page-be-fe-seq.html](../../../html/160826-debug-network-page-be-fe-seq.html)

## Thực tế đã làm (2026-08-16) — 1 đổi hướng quan trọng so với plan gốc
**`/debug` KHÔNG phải route trống** như plan gốc giả định — route này đã tồn tại, trỏ vào `RequestLogPage.tsx` (bảng request log, endpoint `GET /api/debug/requests` từng KHÔNG có gate nào). Phát hiện này chỉ lộ ra lúc bắt đầu code phần frontend (lẽ ra phải grep `AppRoutes.tsx` trước khi propose). Đã dừng lại hỏi user: quyết định là **gộp 3 panel mới vào ngay dưới nội dung `RequestLogPage.tsx` hiện có**, và **gate cả trang** (kể cả bảng request log cũ vốn public) bằng owner-password — không tạo route/trang riêng như plan gốc viết.

Còn lại đúng theo Phương án A đã duyệt (TCP dial thuần, không thêm `client-go`/RBAC).

Đã tạo/sửa:
- `backend/internal/api/debug.go` (mới) — `debugInstance`, `debugServices`, `debugTraceroute`, cả 3 đều gate bằng `verifyOwnerPassword` có sẵn
- `backend/internal/api/routes.go` — đăng ký 3 route `/api/debug/{instance,services,traceroute}`
- `k8s/backend.yaml` — thêm Downward API env `POD_NAME`/`NODE_NAME`/`POD_IP`
- `frontend/src/pages/RequestLogPage.tsx` — thêm gate owner-password cho TOÀN trang (tái dùng key `cozyroom_owner_password` đã dùng ở Playlists/Notes/FavoritePill) + 3 panel mới bên dưới bảng request log cũ
- `frontend/src/api.ts` — `fetchDebugInstance/Services/Traceroute` + type tương ứng

Verify đã làm: `go build ./...` + `go vet ./...` sạch, `tsc --noEmit` sạch (chỉ lỗi pre-existing). Playwright thật (Chromium, không backend) xác nhận: modal gate hiện đúng, submit sai/không kết nối được backend → hiện đúng thông báo phân biệt ("Mật khẩu sai" vs "Không kết nối được tới server" — phát hiện và sửa 1 bug nhỏ lúc test: ban đầu cả 2 trường hợp đều hiện nhầm thành "Mật khẩu sai"), 0 `pageErrors`.

## Deploy + verify runtime thật (2026-08-16, sau khi merge với đề xuất offline-music-download-fe cùng đợt deploy)
- Phát hiện lúc build: `Dockerfile` backend (`alpine:3.19`) KHÔNG có `traceroute` — đã thêm vào dòng `apk add` hiện có (1 dòng, cùng chỗ với ffmpeg/poppler-utils...) để tính năng đã duyệt thực sự chạy được, không phải feature mới.
- Build + push `cozyroom-backend:k8s` (sha256:89942b8c...) và `cozyroom-frontend:k8s` (sha256:29545f3b...), `kubectl apply -f k8s/backend.yaml` (Downward API), `kubectl rollout restart` cả 2 deployment → cả 2 rollout thành công, pod Running 0 restart.
- **Cả 2 điểm BLOCK đã giải quyết bằng bằng chứng thật qua domain `music.giatbh.io.vn`:**
  - `CF-Ray`/`CF-Connecting-IP`/`CF-IPCountry` tới backend đúng thật: `cf_ray: "a2c05fff8b55cf92-HKG"` (colo Hong Kong), `cf_connecting_ip`, `cf_ip_country: "VN"` — không còn là PRIOR nữa.
  - `pod_name`/`node_name`/`pod_ip` khớp chính xác với `kubectl get pods -o wide` (backend-588d9d8cf9-bxtrc, rhein-13700hxes-4070-64-4t, 10.42.0.101).
  - Không có header → 401 đúng.
  - Traceroute chạy được sau khi thêm package — trả 3 hop hợp lệ (test từ cùng mạng với cluster nên hop ngắn, không phải giới hạn tính năng).
- **Phát hiện phụ ngoài phạm vi task này**: `debugServices` cho thấy `cloak-proxy` KHÔNG reachable (`i/o timeout` khi TCP dial `cloak-proxy:8765`) — đúng giá trị thực dụng của tool này, nhưng là vấn đề hạ tầng riêng, chưa điều tra/sửa (ngoài phạm vi được yêu cầu).
- Trạng thái: **implemented + full runtime-verified qua production thật**

## What
Trang `/debug` (frontend, gate bằng `verifyOwnerPassword` có sẵn trong `playlists.go`) hiển thị 3 nhóm thông tin: (1) pod/node nào đang thực sự xử lý request hiện tại, (2) bảng trạng thái các service trong app, (3) evidence mạng **thật lấy từ chính phiên kết nối của client đang gọi** — không phải sơ đồ minh hoạ chung chung — gồm CF-Ray (giải mã ra Cloudflare colo xử lý request), CF-Connecting-IP, CF-IPCountry, và traceroute chạy **từ server ra ngoài** (góc nhìn server — vì server không thể thấy router/ISP của client, đã xác nhận với user qua câu hỏi trước khi propose).

## Affected
| File / Symbol | Thay đổi |
|---|---|
| `backend/internal/api/debug.go` (mới) | 3 handler: `debugInstance`, `debugServices`, `debugTraceroute` |
| `backend/internal/api/routes.go` | Đăng ký 3 route mới dưới `/api/debug/*`, mỗi route tự gọi `verifyOwnerPassword(r)` |
| `k8s/backend.yaml` | Thêm 3 env Downward API: `POD_NAME` (`metadata.name`), `NODE_NAME` (`spec.nodeName`), `POD_IP` (`status.podIP`) |
| `frontend/src/pages/DebugPage.tsx` (mới) | UI: ô nhập owner password (tái dùng pattern modal có sẵn ở `PlaylistsPage.tsx`), 3 panel hiển thị |
| `frontend/src/AppRoutes.tsx` | Thêm route `/debug` — **không** thêm link vào Sidebar (giảm bề mặt lộ thông tin, chỉ truy cập trực tiếp qua URL) |
| `frontend/src/api.ts` | 3 hàm fetch tương ứng, luôn kèm header `X-Owner-Password` |

**Không đổi** `verifyOwnerPassword`/`OwnerPassword` hiện có trong `playlists.go` — tái dùng nguyên vẹn.

## Risks
- **CF-Ray/CF-Connecting-IP là PRIOR, chưa verify thực nghiệm trên đúng setup này.** Cloudflare luôn thêm các header này khi zone được proxy hoặc qua Tunnel (hành vi chuẩn của sản phẩm) — nhưng codebase hiện tại chưa từng đọc các header này ở đâu cả (grep xác nhận 0 kết quả), nên đây là suy đoán dựa trên hiểu biết chung về Cloudflare, **cần xác nhận bằng cách log thử 1 request thật khi code** trước khi tin chắc là dữ liệu này thực sự tới được backend.
- **Chưa biết traceroute/mtr binary có sẵn trong image backend không.** Không tìm thấy Dockerfile nào trong repo (grep + glob toàn project đều không ra) nên không xác nhận được base image. Ngay cả nếu có binary, container có thể không được cấp `NET_RAW` capability (nhiều pod hardened sẽ drop cap này) khiến traceroute kiểu ICMP thất bại. **Phải kiểm tra bằng `exec.LookPath("traceroute")` lúc runtime và trả lỗi rõ ràng thay vì giả vờ chạy được** — nếu thiếu, cần fallback (TCP traceroute không cần raw socket, hoặc bỏ hẳn phần hop-by-hop, chỉ giữ CF-Ray decode).
- **Endpoint mới lộ thông tin hạ tầng thật** (tên pod, tên node, IP nội bộ cluster) — đã gate bằng owner-password theo yêu cầu user, nhưng phải đảm bảo cả 3 route mới đều check gate, không sót route nào.
- **Traceroute có thể chạy vài giây** — cần timeout cứng (đề xuất 10s) để không treo request hoặc bị lạm dụng làm DoS nhẹ lên chính server.

## Global constraints
- Không đổi `verifyOwnerPassword`/`OwnerPassword` trong `playlists.go` — tái dùng nguyên vẹn, không viết cơ chế auth mới.
- Không thêm link `/debug` vào Sidebar/nav chính — chỉ truy cập qua URL trực tiếp, giảm bề mặt lộ ra cho người dùng thường.
- Không claim traceroute là "đường đi từ bạn tới server" — UI phải ghi rõ đây là góc nhìn từ server ra ngoài, tránh gây hiểu lầm đã giải thích với user.
- Không thêm dependency `client-go`/k8s API trong bản này (xem Trade-off) — giữ đơn giản, không cần RBAC ServiceAccount mới.

## Plan
- [ ] Task 1: `backend/internal/api/debug.go` mới — `debugInstance(w,r)`: trả JSON `{pod_name, node_name, pod_ip}` (đọc từ `os.Getenv`, rỗng → `"unknown"` khi chạy ngoài k8s) + evidence mạng của request hiện tại: `CF-Ray`, `CF-Connecting-IP`, `CF-IPCountry`, `X-Real-IP`, `r.RemoteAddr` — tất cả lấy trực tiếp từ chính request đang xử lý
- [ ] Task 2: `debug.go` — `debugServices(w,r)`: thử `net.DialTimeout` (1-2s) tới danh sách service DNS cứng đã biết (`postgres`, `db-adapter`, `cloak-proxy`, `frontend` — cổng thật của từng service), trả `[{name, reachable, latency_ms}]`
- [ ] Task 3: `debug.go` — `debugTraceroute(w,r)`: check `exec.LookPath("traceroute")` trước, nếu không có trả lỗi rõ ràng; nếu có, chạy với timeout 10s (`context.WithTimeout`) tới target = `CF-Connecting-IP` của chính request (hoặc query param nếu muốn tuỳ chỉnh), trả từng hop dạng mảng
- [ ] Task 4: `routes.go` đăng ký 3 route dưới `/api/debug/*` (mỗi handler tự check `verifyOwnerPassword(r)` đầu hàm, 401 nếu sai); `k8s/backend.yaml` thêm 3 env Downward API
- [ ] Task 5: `frontend/src/pages/DebugPage.tsx` mới — modal nhập owner password (theo pattern có sẵn), 3 panel: card pod/node hiện tại, bảng service reachable, panel traceroute (ghi rõ "góc nhìn từ server" ngay trên UI); route `/debug` trong `AppRoutes.tsx`, không thêm vào Sidebar
- [ ] Task 6: Verify — curl thật 3 endpoint với `X-Owner-Password` đúng/sai (xác nhận 401 đúng nhánh sai); xác nhận thực nghiệm CF-Ray/CF-Connecting-IP có tới được backend không; xác nhận traceroute binary có tồn tại trong container thật không — nếu không, cập nhật lại Risk đã nêu; `tsc --noEmit`/`go build` sạch

## Agent Task Assignment
| Task | Agent (CLI) | Lý do chọn | Status |
|------|------|------|------|
| Task 1: debugInstance | infra-engineer | Đụng Downward API/k8s env + network header — đúng domain infra | pending |
| Task 2: debugServices | infra-engineer | Cần biết đúng port/DNS name thật của từng service trong k8s | pending |
| Task 3: debugTraceroute | infra-engineer | Rủi ro cao nhất (binary/capability chưa xác nhận) — cần domain owner quyết định fallback | pending |
| Task 4: routes.go + backend.yaml | infra-engineer | `routes.go`/k8s yaml là điểm nghẽn chung, cần cẩn trọng không đụng route khác | pending |
| Task 5: DebugPage.tsx | infra-engineer | Cùng phiên với backend để khớp đúng contract API, tránh 1 agent khác đoán sai response shape | pending |
| Task 6: Verify | infra-engineer | Cần verify curl thật + xác nhận runtime thật (binary/header) — không giao CLI rẻ | pending |

## Success criteria
- `GET /api/debug/instance` không có header `X-Owner-Password` đúng → 401; có đúng password → trả JSON có `pod_name`/`node_name`/`pod_ip` khớp với `kubectl get pod -o wide` thật.
- `GET /api/debug/services` trả đúng trạng thái reachable/không cho từng service — verify bằng cách cố tình scale 1 service về 0 rồi gọi lại, xác nhận đổi thành `false`.
- `GET /api/debug/traceroute` — nếu binary có sẵn: trả danh sách hop hợp lệ; nếu không có: trả lỗi rõ ràng, không crash, không giả vờ thành công.
- UI `/debug` hiển thị rõ ràng "đây là góc nhìn từ server", không gây hiểu lầm là đường đi thật từ client.
- Route `/debug` không xuất hiện trong Sidebar; `tsc --noEmit`/`go build ./...` sạch.

## Trade-off cần user xác nhận (không tự chọn ngầm)
| Quyết định | Phương án A (mặc định trong Plan) | Phương án B |
|---|---|---|
| Độ sâu bảng service | **Backend tự thử TCP dial tới từng service DNS đã biết cứng trong code** — chỉ báo "reachable: true/false + latency", không có tên pod/node của các service KHÁC (chỉ chính backend biết pod/node của mình qua Downward API). Không cần dependency mới. | **Thêm `client-go`** (k8s API client) + RBAC ServiceAccount đọc pods/services trong namespace `cozyroom-k8s` → liệt kê đúng tên pod/node/status thật của MỌI service. Đầy đủ hơn nhưng thêm dependency mới + rủi ro bảo mật nếu ServiceAccount token bị lộ (dù chỉ read-only 1 namespace). |

## Render brief

### Task 1 — debugInstance
1. *(add)* Handler mới đọc `os.Getenv("POD_NAME")`/`"NODE_NAME"`/`"POD_IP"`, fallback `"unknown"` nếu rỗng (chạy ngoài k8s, vd local dev).
2. *(add)* Đọc `r.Header.Get("CF-Ray")`, `"CF-Connecting-IP"`, `"CF-IPCountry"`, `"X-Real-IP"`, `r.RemoteAddr` — tất cả từ request thật đang xử lý.
3. *(block)* Không tự tin CF-Ray/CF-Connecting-IP chắc chắn có mặt — nếu rỗng, trả `"unknown"` thay vì giả định giá trị.

**Prose:** Điểm mấu chốt của task này là mọi giá trị trả về đều phải là bằng chứng thật của đúng request đang được xử lý, không phải cấu hình tĩnh đọc từ đâu đó — đây chính là yêu cầu "evidence chứng minh từ data phiên kết nối thật" mà user đã nhấn mạnh, khác hẳn với việc vẽ một sơ đồ minh hoạ kiến trúc Cloudflare Tunnel chung chung. Vì CF-Ray/CF-Connecting-IP chưa từng được đọc ở đâu trong codebase này, độ tin cậy của chúng chỉ ở mức "theo hiểu biết chung về Cloudflare" cho tới khi task này thực sự chạy và quan sát được giá trị thật trả về từ một request qua domain thật.

### Task 2 — debugServices
1. *(add)* Danh sách service DNS cứng: `postgres.cozyroom-k8s.svc.cluster.local:5432`, `db-adapter...`, `cloak-proxy...`, `frontend...` (đúng port thật của từng service, tra từ k8s yaml tương ứng lúc code).
2. *(add)* `net.DialTimeout("tcp", addr, 1500*time.Millisecond)` cho từng service, đo latency, trả `{name, reachable, latency_ms}`.
3. *(legacy)* Không cần k8s API — chỉ TCP dial thuần, không phụ thuộc RBAC mới (theo Phương án A).

**Prose:** Việc chọn TCP dial thuần thay vì hỏi k8s API là quyết định ưu tiên đơn giản và an toàn hơn: nó trả lời đúng câu hỏi thực dụng nhất ("service này có gọi được từ backend không") mà không cần cấp thêm quyền đọc API server cho pod — một ServiceAccount có quyền đọc dù chỉ read-only vẫn là bề mặt tấn công thêm nếu token bị lộ, trong khi TCP dial không cần bất kỳ quyền đặc biệt nào ngoài network policy hiện có.

### Task 3 — debugTraceroute
1. *(add)* `exec.LookPath("traceroute")` — nếu lỗi (không tìm thấy binary), trả JSON lỗi rõ ràng `{"error": "traceroute binary not available in this container"}`.
2. *(add)* Nếu có, chạy `exec.CommandContext` với `context.WithTimeout(10*time.Second)`, target mặc định = `CF-Connecting-IP` của chính request.
3. *(block)* Không được để traceroute chạy vô thời hạn hoặc không có gate — bắt buộc cả timeout VÀ `verifyOwnerPassword`.

**Prose:** Đây là task rủi ro kỹ thuật cao nhất của cả đề xuất vì có 2 lớp chưa biết chồng lên nhau: không rõ binary có được cài trong image hay không (không tìm thấy Dockerfile để kiểm tra trước), và ngay cả khi có, container có thể bị tước `NET_RAW` capability theo policy bảo mật chuẩn của cluster, khiến traceroute kiểu ICMP báo lỗi permission dù binary tồn tại. Thiết kế phải coi cả hai khả năng thất bại này là bình thường, không phải trường hợp ngoại lệ — trả lỗi rõ ràng cho người dùng biết chính xác vì sao thay vì một trang debug lại tự nó cần debug.

### Task 4 — routes.go + backend.yaml
1. *(add)* 3 route mới dưới `/api/debug/*`, mỗi handler gọi `verifyOwnerPassword(r)` làm dòng đầu tiên, trả 401 nếu sai — đúng pattern gate đã có ở các endpoint owner-only khác.
2. *(add)* `k8s/backend.yaml`: thêm `env` với 3 `valueFrom.fieldRef` (Downward API) cho `POD_NAME`/`NODE_NAME`/`POD_IP`.
3. *(legacy)* Không đổi bất kỳ route hiện có nào khác trong `routes.go`.

**Prose:** Downward API là cách chuẩn và duy nhất để một pod tự biết tên/IP của chính nó và node nó đang chạy — Kubernetes không cấp quyền này qua bất kỳ biến môi trường mặc định nào, phải khai báo tường minh trong manifest. Việc đặt gate `verifyOwnerPassword` ngay dòng đầu mỗi handler (thay vì một middleware chung áp cho cả nhóm route) giữ nhất quán với cách các endpoint owner-only khác trong codebase này đã làm, tránh phải giới thiệu một khái niệm middleware mới cho một tính năng nhỏ.

### Task 5 — DebugPage.tsx
1. *(add)* Modal nhập owner password khi vào trang, dùng lại đúng pattern UI đã có ở `PlaylistsPage.tsx` (password modal khi xoá playlist).
2. *(add)* 3 panel: card hiển thị pod/node/IP hiện tại, bảng service với cột reachable (icon xanh/đỏ) + latency, panel traceroute có nút "Chạy traceroute" (không tự động chạy, vì tốn vài giây) và dòng chú thích cố định "Góc nhìn từ server ra ngoài — không phải đường đi từ thiết bị của bạn".
3. *(add)* Route `/debug` trong `AppRoutes.tsx`, KHÔNG thêm vào Sidebar.

**Prose:** Dòng chú thích cố định về góc nhìn traceroute không phải chi tiết trang trí — đây là điểm user đã chủ động hỏi rõ trong lúc thảo luận trước khi propose, và một debug tool nói sai bản chất dữ liệu nó hiển thị thì tệ hơn việc không hiển thị gì cả, vì nó âm thầm dẫn người xem tới kết luận sai về nơi xảy ra sự cố mạng thật.

### Task 6 — Verify
1. *(add)* Curl `/api/debug/instance` không có header → xác nhận 401; có header đúng → so khớp `pod_name`/`node_name` với `kubectl get pod -o wide` thật tại đúng thời điểm gọi.
2. *(add)* Curl `/api/debug/services`, đối chiếu với `kubectl get pods -A` thật xem service nào đang down có được báo `reachable:false` đúng không.
3. *(block)* Xác nhận thực nghiệm CF-Ray/CF-Connecting-IP có thật sự tới được backend qua domain thật `music.giatbh.io.vn` hay không — nếu không, phải cập nhật lại thiết kế Task 1 (có thể cloudflared/nginx cần thêm cấu hình để không bị lớp nào strip mất).
4. *(block)* Xác nhận traceroute binary có tồn tại trong container thật hay không — ghi kết quả thật vào draft này (không phải giả định lúc propose).
5. *(add)* `go build ./...`/`tsc --noEmit` sạch.

**Prose:** Hai điểm *(block)* ở đây không phải thủ tục hình thức — chúng là những giả định chưa được xác minh lúc viết đề xuất này (CF-Ray có tới nơi không, traceroute có chạy được không), và cả kế hoạch có thể phải điều chỉnh tuỳ theo kết quả thật của chúng, nên bắt buộc phải chạy trước khi coi Task 1 và Task 3 là hoàn thành đúng nghĩa.

## Notes
- Phát sinh từ cuộc điều tra sự cố cross-node network (postgres-standby-0 không gọi được primary) trong cùng phiên — user muốn có công cụ tự chẩn đoán lâu dài thay vì mỗi lần phải nhờ debug thủ công qua `kubectl`.
- Đã hỏi rõ 2 điểm trước khi propose (qua `AskUserQuestion`): (1) network path chỉ khả thi ở mức evidence từ phiên thật + góc nhìn server, không thể vẽ được router/ISP của client; (2) gate bằng owner-password có sẵn, không làm public.
- Liên quan: [[K3s infra topology]], [[Stream observability findings]]

## Origin
- **Draft:** `wiki/sources/draft/160826-debug-network-page-be-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
