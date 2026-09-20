---
type: draft
title: Phân tích pros/cons 4 quyết định HA — topology CRDB, isolation, transport, media cross-node
status: analysis
tags: [architecture, decision-record, cockroachdb, ha, nfs, sse, websocket]
timestamp: 2026-07-10
---

# 100726-ha-decisions-proscons
**Type:** draft
**Status:** analysis — chờ user chốt 4 quyết định
**Tags:** architecture, decision-record, ha
**Proposed:** 2026-07-10

## Bối cảnh

Phân tích chi tiết phục vụ user chốt 4 quyết định còn treo của bộ 3 proposal ([[100726-cockroachdb-migration-db]], [[100726-db-health-websocket-be-fe]], [[100726-base-architecture-be-fe]]). Ràng buộc vận hành đã xác nhận: **cả 3 máy hàng tuần có thể restart/nghỉ vài ngày (không bao giờ down toàn bộ, nhưng down vài máy là thường trực)**; media sẽ multi-node (VD: YT downloads đặt folder ở node khác); backend hiện `replicas:1` + nodeSelector = SPOF số 1.

---

## Quyết định 1 — CockroachDB chạy ở đâu?

### (1A) Bare metal trên 3 host WSL2 + Tailscale

**Pros:**
- Khớp ADR đã ghi của chính user ([[200626-db-antipattern]]): "DB bare metal, stateless apps trong K8s" — không phải đảo ngược quyết định cũ.
- **Máy restart hàng tuần → systemd `enable` là đủ để CRDB tự dậy theo máy.** User đã có sẵn kinh nghiệm + boot script WSL2 ([[080626-wsl2-ssh-autostart]]) — đúng chỗ mạnh hiện có.
- Né hoàn toàn bẫy PVC/hostPath immutable — bài học thật: postgres từng nằm `/tmp/k8s-pgdata` (mất data khi reboot) và PV `k8s-data` bị immutable không sửa được path.
- Không phụ thuộc K3s sống: máy dậy là DB dậy, không cần chờ control-plane K3s (vốn cũng chạy trên chính các máy này) khởi động xong.
- Data path là đường dẫn disk thật, backup/inspect trực tiếp không cần exec vào pod.
- Tailscale mesh đã có sẵn và đã dùng cho DB trước đây (di vật `100.88.197.64:5432` chứng minh pattern này từng là thiết kế đúng).

**Cons:**
- Ops thủ công: 3 systemd unit, upgrade CRDB phải làm từng host (nhưng CRDB hỗ trợ rolling upgrade từng node — hợp lịch restart so le).
- Không có kubectl/rolling-restart; observability phải thêm scrape target Prometheus thủ công (đã có stack Prometheus sẵn — chỉ là thêm 3 target).
- WSL2 systemd phải bật (`/etc/wsl.conf systemd=true`) — user đã làm rồi cho SSH/Docker.

### (1B) K8s StatefulSet 3 replicas

**Pros:**
- kubectl một cửa: logs, rollout, describe — đồng nhất với phần còn lại của stack.
- Restart policy tự động, upgrade image = `kubectl set image`.

**Cons:**
- Mâu thuẫn trực tiếp ADR user đã tuyên bố — cần lý do mạnh để đảo, hiện không có.
- Lặp lại đúng chỗ đau cũ: PVC hostPath immutable, hostPath nằm sai chỗ là mất data khi máy reboot — mà máy reboot **hàng tuần**.
- Thứ tự khởi động: máy dậy → WSL2 dậy → K3s dậy → PVC attach → pod schedule → CRDB dậy. Mỗi mũi tên là một chỗ kẹt; bare metal chỉ có: máy dậy → systemd dậy CRDB.
- K3s agent NotReady (như e2144g từng bị) = pod không schedule được dù máy thực ra sống.

**Verdict đề xuất: 1A.** Với nhịp restart hàng tuần, chuỗi khởi động ngắn nhất thắng.

---

## Quyết định 2 — Isolation level

### (2A) READ COMMITTED (CRDB ≥ 23.2)

**Pros:**
- Hành vi giống hệt Postgres đang chạy → **zero code change** cho toàn bộ write path hiện có.
- Không bao giờ gặp lỗi retry 40001 → không có kịch bản "500 lạ lúc scanner với cron chạy trùng".
- Cozyroom là single-user homelab: các anomaly mà READ COMMITTED cho phép (write skew...) cần 2 writer tranh chấp logic phức tạp — không tồn tại ở đây.

**Cons:**
- Yếu hơn về lý thuyết consistency (nhưng bằng đúng mức Postgres hiện tại — không thụt lùi so với hôm nay).
- Cần CRDB ≥ 23.2 (không phải vấn đề — bản mới nhất 24.x).

### (2B) SERIALIZABLE + retry helper

**Pros:**
- Mức isolation mạnh nhất, là đường "chính đạo" được CRDB test nhiều nhất.
- Retry helper là pattern chuẩn, viết một lần dùng mãi.

**Cons:**
- Phải wrap **mọi** write transaction: scanner upsert hàng loạt, cron enrichment, playlists, progress, AI logs... — sót một chỗ là lỗi 40001 nổ intermittent, khó tái hiện.
- Scanner + cron + user action chạy trùng là có thật trong app này → 40001 sẽ xảy ra thật chứ không lý thuyết.
- Thêm code cho một lợi ích (chống write-skew) mà workload này không cần.

**Verdict đề xuất: 2A.** Đổi sang serializable sau này chỉ là một câu SET — cửa không đóng.

---

## Quyết định 4 — Transport đẩy trạng thái xuống FE

### (4A) SSE (Server-Sent Events)

**Pros:**
- **Đã chạy production trong chính app này**: AI chatStream (`ai.go:293`, text/event-stream) đi qua đúng chain cloudflared → nginx sidecar → frontend nginx với `proxy_buffering off` — nghĩa là zero config hạ tầng mới, rủi ro tích hợp ≈ 0.
- Nhu cầu thật là một chiều (server báo, FE nghe) — SSE khớp đúng, không thừa.
- `EventSource` browser tự reconnect kèm `Last-Event-ID` — khỏi tự viết backoff/jitter/heartbeat.
- Go implementation = HTTP handler thường + Flusher, ít code hơn hẳn WS hub.

**Cons:**
- Một chiều — nếu sau này cần client gửi ngược qua cùng kênh thì phải nâng cấp.
- Giới hạn ~6 kết nối HTTP/1.1 per domain của browser (mỗi tab 1 stream → thực tế không chạm).

### (4B) WebSocket

**Pros:**
- Hai chiều — đáng giá nếu tương lai muốn **server chủ động đẩy lệnh xuống FE** (VD: AI agent từ Telegram điều khiển player đang mở — hiện `_frontend_action` chỉ đi qua response chat; WS mở đường cho push thật).
- `gorilla/websocket` đã có sẵn trong go.mod.

**Cons:**
- Handshake Upgrade phải config đúng ở **cả 2 lớp nginx** (cloudflared sidecar + frontend nginx) — thiếu 1 lớp là fail âm thầm, và nginx sidecar là invariant nhạy cảm nhất hệ thống (sai là sập toàn site).
- Heartbeat/reconnect/backoff tự viết cả 2 đầu.
- Cho nhu cầu 1 chiều hiện tại là over-engineering.

**Verdict đề xuất: 4A cho feature này.** Khi nào làm "AI push lệnh xuống player" thì nâng WS thành proposal riêng — lúc đó chi phí config nginx được trả bằng một tính năng thật sự cần 2 chiều.

---

## Quyết định 5 — Backend đọc file media cross-node

### (5A) NFS soft-mount chéo

**Pros:**
- **Mở khoá fix SPOF số 1 ngay lập tức:** backend gỡ được nodeSelector → `replicas ≥ 2` rải node → node 1 nghỉ vài ngày app vẫn sống. Đây là giá trị lớn nhất, vượt cả bản thân chuyện media.
- Có tiền lệ trong stack: `/music` đã là NFS read-only mount — pattern đã được vận hành thật.
- Code backend **không đổi một dòng** — file path vẫn là file path; chỉ thêm mount + row `media_hosts`.
- Audio streaming ~320kbps qua LAN/Tailscale là không đáng kể về băng thông.
- Node media nghỉ → NFS soft-mount timeout → health watcher báo down → bài ẩn — khớp hoàn hảo với cơ chế hide đã chốt.

**Cons:**
- Soft mount có thể trả I/O error giữa stream khi node chết (chấp nhận được — file đã chết thì stream nào cũng chết).
- Video/HLS transcode đọc qua NFS nặng hơn audio — ffmpeg đọc tuần tự trên LAN vẫn ổn, nhưng đáng theo dõi.
- Mỗi host media phải chạy NFS server trong WSL2 (thêm 1 service vào boot script — đã có khung sẵn).

### (5B) Backend pod per-node + shard routing

**Pros:**
- Đọc disk local — không network overhead, shared-nothing đúng nghĩa.
- Failure domain tự nhiên: node chết chỉ chết đúng pod + media của nó.

**Cons:**
- Phải **tự build lớp routing**: request stream track X → pod nào? Cần router đọc `media_hosts` (nginx không làm được việc này một mình — cần Go proxy hoặc ingress logic tự chế). Đây là surface bug hoàn toàn mới.
- Mỗi pod vẫn pinned vào node của nó — không gỡ được bản chất SPOF cho các request thuộc node nghỉ (đúng là chỉ media node đó chết, nhưng lớp routing thêm điểm hỏng mới).
- Scan/serve coordination phức tạp lên theo số node.

**Verdict đề xuất: 5A trước, 5B là bước tiến hoá** (backend ưu tiên đọc local nếu file nằm local, NFS nếu không — hybrid tự nhiên về sau).

---

## Tương tác giữa các quyết định

- **1A + 5A hợp thành bức tranh nhất quán:** mỗi máy vật lý = 1 CRDB node (systemd) + export NFS media của nó; K8s chỉ còn chạy stateless (backend/frontend/cloudflared/db-adapter). Máy nghỉ → CRDB còn quorum, media node đó ẩn, backend pod trôi sang máy khác — app sống.
- **2A + 4A là hai quyết định "ít code nhất":** toàn bộ effort dồn vào chỗ khó thật (cluster, NFS, health map) thay vì retry helper và nginx config.
- Nếu chọn 4B (WebSocket): cộng ~1 ngày effort config + test 2 lớp nginx, đổi lấy kênh 2 chiều chưa có consumer.

---

## ✅ KẾT QUẢ CHỐT (user, 2026-07-10): 1A · 2B · 4B · 5A

| QĐ | User chọn | Theo khuyến nghị? | Hệ quả scope |
|----|-----------|-------------------|--------------|
| 1 — Topology | **1A** Bare metal + Tailscale | ✔ | CRDB systemd 3 host, vào boot script WSL2; K8s Service Endpoints trỏ 3 Tailscale IP |
| 2 — Isolation | **2B** Serializable + retry | ✘ (khuyến nghị 2A) | T1 mở rộng: `db.WithRetry(fn)` + wrap toàn bộ write path, audit từng call site, test ép contention |
| 4 — Transport | **4B** WebSocket | ✘ (khuyến nghị 4A) | T2 thêm hạng mục bắt buộc: Upgrade headers cả 2 lớp nginx + test kỹ; heartbeat/reconnect tự viết. Đổi lại: kênh 2 chiều sẵn cho AI-push-lệnh tương lai |
| 5 — Media x-node | **5A** NFS soft-mount chéo | ✔ | Mở khoá gỡ nodeSelector backend → replicas ≥2 (fix SPOF số 1); NFS server vào boot script từng host media |

User chọn ngược khuyến nghị ở QĐ2 và QĐ4 — ưu tiên consistency mạnh nhất và kênh 2 chiều tương lai, chấp nhận thêm effort code/config. Ghi nhận, không tranh luận lại.

## Thứ tự thực hiện (roadmap chốt)

1. **Phase 0 — Precondition:** hồi sinh node 3 (`rhein-e2144g`) + time-sync 3 host. ⛔ Chặn tất cả phase sau.
2. **Phase 1 — CRDB migration** ([[100726-cockroachdb-migration-db]]): T1 code compat (lease table + WithRetry serializable) → T2 cluster bare metal → T3 migrate data copy-không-move → T4 switch db-adapter → T5 chaos verify.
3. **Phase 2 — Backend un-lock (5A):** NFS export chéo → gỡ nodeSelector → `replicas ≥ 2` → verify node 1 nghỉ app vẫn sống. Fix SPOF số 1.
4. **Phase 3 — Health WebSocket + ẩn shard** ([[100726-db-health-websocket-be-fe]]): watcher → WS hub (nginx 2 lớp) → media_hosts → FE ẩn + PlayerContext skip → chaos verify.
5. **Phase 4 — BASE layer** ([[100726-base-architecture-be-fe]], un-parked): softstate + outbox — lưới đỡ khi 2/3 máy nghỉ chồng lấn.

## Origin
- **Draft:** `wiki/sources/draft/100726-ha-decisions-proscons.md`
- **Source:** user yêu cầu 2026-07-10: "phân tích pro cons" trước khi chốt 4 quyết định; user chốt "1A 2B 4B 5A" cùng ngày
- **Commit:** _(filled by `verify-before-commit`)_
