---
type: draft
title: WebSocket đẩy trạng thái DB cluster xuống frontend — node down thì các bài hát shard trên node đó hiện "unavailable" realtime
status: proposed
tags: [websocket, cluster-health, sharding, realtime, cockroachdb, be, fe]
timestamp: 2026-07-10
---

# 100726-db-health-websocket-be-fe
**Type:** draft
**Status:** proposed
**Tags:** websocket, cluster-health, sharding, realtime, be, fe
**Proposed:** 2026-07-10
**Sequence diagram:** [html/100726-db-health-websocket-seq.html](../../../html/100726-db-health-websocket-seq.html)

## What
Backend theo dõi liveness của từng DB node và đẩy trạng thái qua **WebSocket** xuống frontend realtime; khi một node down, toàn bộ bài hát shard trên node đó **bị ẨN hoàn toàn khỏi UI** (không hiển thị trong list/search/album — vì bấm vào cũng không phát được gì), kèm banner đếm số bài đang ẩn — và tự hiện lại khi node sống. Dữ liệu **vẫn giữ nguyên** trong DB (metadata không mất). Phụ thuộc: [[100726-cockroachdb-migration-db]] (nhưng cơ chế chạy được cả với Postgres hiện tại).

## ⚠️ Điểm phải nói thẳng trước — "node down" làm mất gì?

Với CockroachDB **replication factor 3 mặc định** (draft CRDB), mất 1 node thì **metadata KHÔNG mất bài nào** — Raft giữ mọi range sống. Câu "DB down → sharding bài hát trên DB đó down" chỉ đúng theo một trong hai cách hiểu:

**Quyết định 3 — ✅ ĐÃ CHỐT (user, 2026-07-10): I2 + ẨN.** "Vẫn giữ [dữ liệu] nhưng FE không hiển thị, vì thực tế ấn vào thì không có gì được phát ra." → Metadata giữ nguyên (RF=3), track thuộc host down bị **ẩn hẳn** khỏi list/search/album thay vì gray-out. Hai phương án gốc giữ lại để tham khảo:
- **(I1) Metadata sharding thật — RF=1 per-node:** mỗi bài thuộc đúng 1 node CRDB (zone config `num_replicas=1`). Node down → metadata các bài đó biến khỏi query thật. **Đánh đổi: vứt bỏ chính lợi ích HA vừa mua bằng CRDB** — mâu thuẫn với lý do migrate. Chỉ hợp lý nếu mục tiêu là dung lượng (data lớn hơn 1 node chứa nổi), không phải HA.
- **(I2) Media locality — metadata sống, file nhạc chết theo host** ✅ khuyến nghị: CRDB RF=3 giữ metadata luôn sống; cái thực sự down theo node là **file nhạc trên host đó** (stream 404). WebSocket phản ánh: "host X down → N bài có file trên X không phát được". Khớp thực tế hiện tại: media bind vào host vật lý (hostPath), và khớp hướng tương lai "partial library per node" đã ghi trong [[160626-db-architecture-review]].
- Lưu ý hiện trạng: media đang nằm **toàn bộ trên 1 host** (`rhein-13700hxes:/mnt/f/music`) — với I2, hôm nay chỉ có 1 shard duy nhất; bảng mapping thiết kế sẵn cho ngày media rải ra nhiều host.
- **Kịch bản user xác nhận (2026-07-10):** "tải nhạc từ nguồn khác như YouTube thì đặt vào 1 folder ở node khác" — tức media multi-node là mục tiêu thật, không phải giả định. Ví dụ cụ thể: thư viện chính trên node 1 (`/mnt/f/music`), YT downloads trên node 2 (`/mnt/x/youtube`) → node 2 down → toàn bộ bài YT ẩn khỏi UI, thư viện chính vẫn phát bình thường.

**Quyết định 5 — ✅ ĐÃ CHỐT (user, 2026-07-10): 5A — NFS soft-mount chéo** (xem pros/cons tại [[100726-ha-decisions-proscons]]).

Node nào giữ media thì export folder đó qua NFS; mọi backend pod mount tất cả (**soft mount + timeout** để node nghỉ không treo pod). Tiền lệ sẵn: `/music` đã là read-only NFS mount. Code backend không đổi — chỉ thêm mount + row `media_hosts`. Node down → NFS timeout → health báo down → bài ẩn (đúng cơ chế draft này).

**Hệ quả quan trọng nhất của 5A:** mở khoá gỡ `nodeSelector` của backend → `replicas ≥ 2` rải node → **fix SPOF số 1** (backend hiện replicas:1 khoá node 1). Hạng mục đi kèm: NFS server vào boot script WSL2 từng host media; sửa `k8s/backend.yaml` (bỏ nodeSelector, tăng replicas, thêm NFS volumes). Phương án (B) backend-per-node + shard routing ghi nhận là bước tiến hoá sau khi 5A chạy ổn (hybrid: đọc local nếu có, NFS fallback).

**Quyết định 4 — ✅ ĐÃ CHỐT (user, 2026-07-10): WebSocket** (xem pros/cons tại [[100726-ha-decisions-proscons]]). User chọn WS dù SSE ít rủi ro hơn — kênh 2 chiều để sẵn cho tương lai (AI push lệnh xuống player). Hệ quả scope T2: config Upgrade/Connection headers ở **cả 2 lớp nginx** là hạng mục bắt buộc + test kỹ (sai là fail âm thầm), heartbeat/reconnect tự viết cả 2 đầu (đã có trong T2/T4).

## Affected

| File / Symbol | How it changes |
|---------------|---------------|
| `backend/internal/health/` (MỚI) | Watcher poll liveness mỗi 5s: CRDB → `crdb_internal.gossip_liveness`; Postgres hiện tại → ping từng node; diff trạng thái → phát event |
| `backend/internal/api/ws.go` (MỚI) | WebSocket hub `/api/ws/cluster-health` (gorilla/websocket — **đã có trong go.mod**, nâng indirect → direct); broadcast khi đổi trạng thái + heartbeat 30s |
| `backend/internal/api/routes.go` | Đăng ký route WS |
| `backend/internal/db/db.go` | Bảng `media_hosts(host, path_prefix, node_name)` nếu chọn I2 — map `tracks.file_path` → host |
| `k8s/cloudflared.yaml` (nginx sidecar configmap) | Thêm `proxy_set_header Upgrade/Connection` cho `/api/ws/` |
| `frontend/nginx` config | Tương tự — Upgrade headers cho `/api/ws/` |
| `frontend/src/hooks/useClusterHealth.ts` (MỚI) | WS client, reconnect backoff + jitter, expose `{nodes, unavailableTrackIds}` |
| `frontend/src/App.tsx` hoặc context (MỚI nhỏ) | Provider trạng thái cluster |
| `frontend/src/components/` (TrackList, AlbumCard, PlayerBar) | Gray-out + disable play track unavailable; banner "Node X down — N bài tạm không phát được" |
| `frontend/src/PlayerContext.tsx` ⚠️ shared | Queue/smart-radio **skip** track unavailable — sửa theo `impact-check` + `safe-change`, chạy `frontend-index` trước |

## Risks

- **PlayerContext là shared core** (toàn bộ player phụ thuộc) — thay đổi skip-logic phải qua `impact-check`/`safe-change`, và theo rule CLAUDE.md phải chạy `frontend-index` trước khi sửa `frontend/src/`.
- **Reconnect storm:** backend rollout ×3 pod → mọi client reconnect cùng lúc; bắt buộc backoff + jitter, và WS hub phải stateless (client nối pod nào cũng nhận cùng trạng thái — watcher chạy trong mỗi pod, đọc cùng nguồn liveness).
- **CF Tunnel + 2 lớp nginx:** WebSocket qua chain này cần Upgrade headers đúng ở **cả hai** nginx; sai một lớp là handshake fail âm thầm. (SSE né được toàn bộ rủi ro này — Quyết định 4.)
- **False positive:** watcher poll 5s có thể báo down do network blip → cần ngưỡng (2 lần poll fail liên tiếp mới báo down) để UI không nhấp nháy.
- **Ẩn đột ngột gây bối rối:** thư viện tự vơi đi giữa chừng ("bài đâu mất rồi?") → banner đếm số bài đang ẩn là bắt buộc, không phải trang trí; playlist có bài bị ẩn hiển thị số lượng lệch — chấp nhận, kèm chú thích trong banner.
- **Cascade ẩn:** album/artist mà toàn bộ track bị ẩn phải ẩn theo, nếu không sẽ ra album rỗng bấm vào trống trơn — filter backend xử lý cascade này dễ hơn filter rải rác ở FE.
- **SW cache:** list đã cache StaleWhileRevalidate có thể còn chứa bài vừa ẩn trong vài giây đầu — chấp nhận được, PlayerContext skip là lưới đỡ cuối.
- **NFS hang (nếu chọn 5A):** hard mount mặc định sẽ treo backend pod khi node media down — bắt buộc soft mount + timeout ngắn; health watcher phải coi "NFS timeout" tương đương host down.
- **Liveness 2 tầng:** DB node sống ≠ media host sống (và ngược lại) — watcher T1 nên check cả hai: liveness DB node (gossip/ping) + liveness media mount (stat file probe theo prefix), vì kịch bản YT-folder-node-khác làm hai thứ này tách rời nhau.
- Service worker config không đụng gì (WS không qua Workbox) — không có rủi ro sw2.js.

## Plan

- [ ] **T1 — BE health watcher:** package `internal/health`, poll 5s qua interface `LivenessSource` (impl CRDB gossip_liveness + impl Postgres ping — chạy được trước cả khi migrate xong); ngưỡng 2-fail mới báo down; phát event qua channel. Verify: unit test + giả lập node down → event đúng.
- [ ] **T2 — BE WebSocket hub:** `/api/ws/cluster-health`, broadcast JSON `{nodes:[{name,live}], unavailable_track_count, ts}` khi trạng thái đổi + heartbeat 30s; nâng gorilla/websocket thành direct dep; thêm Upgrade headers 2 lớp nginx. Verify: `wscat` qua domain thật nhận message.
- [ ] **T3 — Shard mapping (Quyết định 3 đã chốt: I2):** bảng `media_hosts(host, path_prefix, node_name)` + query list track theo `file_path LIKE prefix%` của host down; scanner ghi nhận prefix mount khi scan (mỗi mount = 1 shard, vd `/music` = node 1, `/youtube2` = node 2). Setup stream cross-node theo Quyết định 5 (khuyến nghị NFS soft-mount). API REST kèm: `GET /api/cluster/health` (snapshot cho lần load đầu, trước khi WS nối). Verify: tắt host giả lập → danh sách track unavailable đúng theo prefix.
- [ ] **T4 — FE realtime UI (ẨN, không gray-out):** chạy `frontend-index` trước; hook `useClusterHealth` (reconnect backoff+jitter, seed từ snapshot REST); track unavailable bị **filter khỏi mọi list/search/album** (khuyến nghị filter ở backend query — mọi endpoint nhất quán, FE khỏi sót component); album/artist trống sau filter cũng ẩn theo (cascade); banner "⏳ N bài tạm ẩn — node X down" để user hiểu vì sao thư viện vơi đi; PlayerContext vẫn cần skip cho queue đã load từ trước khi node down (qua impact-check/safe-change). Verify: mock WS message → list co giãn đúng không cần reload.
- [ ] **T5 — Verify end-to-end:** tắt 1 node thật (user xác nhận): FE cập nhật ≤10s không reload, bài shard down gray + không click play được, bài khác phát bình thường, smart radio không nhét bài chết vào queue; node sống lại → UI tự phục hồi ≤10s. Ghi kết quả vào wiki.

## Agent Task Assignment

| Task | Agent (CLI) | Lý do chọn | Status |
|------|-------------|------------|--------|
| T1 — health watcher | Claude main (claude-fable-5) | Interface adapter 2 nguồn liveness, ngưỡng chống false-positive — logic lõi | pending |
| T2 — WS hub + nginx 2 lớp | Claude main (claude-fable-5) | Đụng cloudflared nginx sidecar (invariant CF Tunnel — sai là sập toàn site) | pending |
| T3 — shard mapping | Claude main (claude-fable-5) | Phụ thuộc Quyết định 3 của user, đụng schema migrate() | pending |
| T4 — FE realtime UI | Claude main (claude-fable-5) | Đụng PlayerContext (shared core) — bắt buộc impact-check/safe-change/frontend-index | pending |
| T5 — verify e2e | Claude main (claude-fable-5) + user | Kill node thật trên cluster đang chạy | pending |

Một agent xuyên suốt vì contract message WS (schema JSON) xuyên cả 5 task — tách agent sẽ tốn phí đồng bộ contract. HTML seq page do Claude render trực tiếp (standalone `/propose`).

## Success criteria

- Tắt 1 DB node/host: **≤10 giây**, không reload, các bài thuộc shard đó **biến khỏi mọi list/search/album** (album/artist rỗng ẩn theo), banner hiện "N bài tạm ẩn"; bài thuộc node khác vẫn browse + phát bình thường. Metadata trong DB không mất.
- Smart radio / queue không bao giờ chọn bài unavailable trong lúc node down.
- Node sống lại: UI tự phục hồi ≤10 giây, banner biến mất.
- Backend rollout 3 pod: client reconnect có jitter, không reconnect storm, trạng thái nhận được giống nhau từ mọi pod.
- Network blip 1 lần poll không làm UI nhấp nháy (ngưỡng 2-fail hoạt động).
- WS handshake hoạt động qua chain thật cloudflared → nginx sidecar → frontend nginx → backend trên `music.giatbh.io.vn`.

## Notes
- [[100726-cockroachdb-migration-db]] — proposal cha; T1 thiết kế interface để chạy được cả trước khi migrate xong
- [[160626-db-architecture-review]] — "partial library per node" là tương lai mà bảng media_hosts đón sẵn
- [[CozyArchitecture]] — invariant cloudflared nginx sidecar; SSE chatStream đã chạy production (`ai.go:293`)
- [[100726-base-architecture-be-fe]] — badge freshness của draft BASE nếu sống lại sẽ dùng chung banner component này

## Origin
- **Draft:** `wiki/sources/draft/100726-db-health-websocket-be-fe.md`
- **Source:** yêu cầu user 2026-07-10: "cần websocket lên frontend phản ánh đúng trạng thái của db, nếu db down thì toàn bộ sharding bài hát trên db đó down luôn"
- **Commit:** _(filled by `verify-before-commit`)_
- **Date promoted:** _(filled by `verify-before-commit`)_
