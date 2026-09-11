# Cozyroom — Tài liệu Yêu cầu Sản phẩm (PRD)

| | |
|---|---|
| **Sản phẩm** | Cozyroom — Self-hosted personal media platform |
| **Phiên bản PRD** | 1.0 |
| **Ngày** | 2026-09-11 |
| **Trạng thái** | Active development (mô tả toàn bộ chức năng đang chạy trên production) |
| **Chủ sở hữu** | giatbh (owner-operator, single-tenant) |
| **Production** | https://music.giatbh.io.vn (k3s, namespace `cozyroom-k8s`) |
| **Phương pháp lập** | Reverse-engineered từ code thật bởi 7 "engineer agent" theo domain; prompt lưu tại [`prd/agent-prompts.md`](prd/agent-prompts.md) |

> **Cách đọc tài liệu này.** Đây là PRD "mô tả hiện trạng" (as-built): nó ghi lại ĐẦY ĐỦ mọi chức năng Cozyroom đang có, kèm yêu cầu chức năng (FR đánh số), business rule, edge case và ràng buộc phi chức năng — chưng cất trực tiếp từ mã nguồn. Nó vừa là spec để đội ngũ/agent mở rộng an toàn, vừa là bản đồ kiến thức cho người mới. Ký hiệu: **FR** = yêu cầu chức năng; **BR** = business rule/ràng buộc; **EC** = edge case; **NFR** = yêu cầu phi chức năng.

---

## Mục lục

- **Chương 1** — Tóm tắt điều hành (Executive Summary)
- **Chương 2** — Tầm nhìn, Mục tiêu & Ngoài mục tiêu
- **Chương 3** — Personas & Đối tượng người dùng
- **Chương 4** — Nguyên tắc sản phẩm
- **Chương 5** — Information Architecture & Điều hướng (bảng 20 route)
- **Chương 6** — Kiến trúc & Hạ tầng
- **Chương 7** — Domain: Âm nhạc (Music)
- **Chương 8** — Domain: Phim & Video (Video Streaming)
- **Chương 9** — Domain: Sách điện tử & Truyện tranh (Reader)
- **Chương 10** — Domain: Trợ lý AI (AI Assistant & MCP)
- **Chương 11** — Domain: Playlist, Ghi chú & Xu hướng (Social)
- **Chương 12** — Frontend, Điều hướng & Trải nghiệm (UX/UI)
- **Chương 13** — Mô hình dữ liệu hợp nhất
- **Chương 14** — Yêu cầu phi chức năng (NFR) xuyên suốt
- **Chương 15** — Mô hình xác thực & Bảo mật single-tenant
- **Chương 16** — Ràng buộc & Quyết định kiến trúc (ADR)
- **Chương 17** — Rủi ro & Nợ kỹ thuật đã biết
- **Chương 18** — Ngoài phạm vi & Lộ trình
- **Chương 19** — Thuật ngữ (Glossary) & Phụ lục

---

## Chương 1 — Tóm tắt điều hành (Executive Summary)

**Cozyroom** là một nền tảng media cá nhân **self-hosted, single-tenant** chạy trên cụm k3s tại nhà, phục vụ toàn bộ thư viện số của một chủ sở hữu: **nhạc, phim, sách điện tử và truyện tranh** — cộng thêm một lớp **trợ lý AI điều khiển-bằng-ngôn-ngữ-tự-nhiên**, **phân tích xu hướng GitHub**, và các công cụ cộng tác nhẹ (playlist, Kanban). Nó là "instrument panel" cho đời sống media của một người: gọn, ít trang trí, ưu tiên độ tin cậy và khả năng vận hành hơn là hào nhoáng.

Điểm khác biệt so với một media server thông thường (Jellyfin/Plex):

- **Một app hợp nhất mọi loại media** — nhạc (thư viện local + YouTube), video (HLS transcode on-demand), ebook (EPUB/PDF reader), comics (scrape + tải offline từ MangaDex/E-Hentai) — dưới một hệ điều hướng và một hệ thiết kế duy nhất.
- **AI là một "control surface" bậc nhất**: 38 MCP tool cho phép trợ lý tìm/phát nhạc, tải hàng loạt từ YouTube, dựng playlist, xem trending, đặt lịch tác vụ — bằng câu lệnh tiếng Việt/Anh, đa nhà cung cấp (DeepSeek/OpenRouter/Gemini/Anthropic) với fallback tự động.
- **Nhạc là "phòng máy" tinh xảo nhất**: gapless dual-audio, smart radio 4-tier, lyrics đa nguồn + dịch tự động, Last.fm scrobble, tìm kiếm không dấu tiếng Việt, đĩa vinyl xoay làm nút phát.
- **Homelab thật, làm testbed hạ tầng**: PostgreSQL 16 primary + hot standby tự promote, PgBouncer, Cloudflare Tunnel, Prometheus/Grafana, cloak-proxy egress ẩn danh, PWA offline-first.

**Quy mô hệ thống (thời điểm lập PRD):** ~140 API endpoint, ~40 bảng dữ liệu, 20 route frontend, ~37 component React, 38 MCP tool, 6 domain nghiệp vụ, 2 ngôn ngữ (vi/en).

---

## Chương 2 — Tầm nhìn, Mục tiêu & Ngoài mục tiêu

### 2.1. Tầm nhìn

> Một "căn phòng ấm" số duy nhất, nơi chủ nhân truy cập mọi media của mình từ bất kỳ thiết bị nào, điều khiển bằng giọng nói/chữ qua AI, với trải nghiệm nghe-nhìn-đọc mượt như app thương mại nhưng hoàn toàn thuộc sở hữu cá nhân — đồng thời là sân chơi để thực hành vận hành hạ tầng thật.

### 2.2. Mục tiêu sản phẩm (Goals)

- **G1 — Hợp nhất media:** một app phục vụ nhạc/phim/sách/truyện từ thư viện local, không cần chuyển ứng dụng.
- **G2 — Trải nghiệm nghe nhạc hạng nhất:** gapless, smart radio, lyrics đồng bộ + dịch, offline, chất lượng lossless.
- **G3 — AI điều khiển toàn app:** trợ lý gọi tool thực thi hành động thật (phát nhạc, tải, dựng playlist, lên lịch), không chỉ trả lời.
- **G4 — Truy cập mọi nơi:** PWA cài được, offline-first, chạy tốt trên mobile/desktop, phơi ra Internet an toàn qua Cloudflare Tunnel.
- **G5 — Vận hành tin cậy:** không bao giờ gián đoạn phát nhạc; DB có dự phòng; quan sát được (metrics/alert).
- **G6 — Chi phí tối thiểu:** ưu tiên model AI rẻ/free, cache nhiều tầng, tận dụng CDN edge.

### 2.3. Ngoài mục tiêu (Non-goals)

- **N1 — KHÔNG đa người dùng/đa tenant.** Không có hệ đăng nhập cấp app, không tài khoản, không phân quyền per-user cho media. (Ngoại lệ hẹp: Kanban có hệ user cộng tác riêng — xem Chương 11/15.)
- **N2 — KHÔNG tracking cá nhân hoá per-user.** Mọi số liệu là **aggregate-only** cho một chủ nhà.
- **N3 — KHÔNG phải sản phẩm thương mại/SaaS.** Không billing, không onboarding công khai, không SLA; đây là homelab một người.
- **N4 — KHÔNG tự ý phân phối lại nội dung.** Scrape/tải chỉ phục vụ sử dụng cá nhân offline.
- **N5 — KHÔNG microservice.** Có chủ đích là monolith (xem ADR, Chương 16).

---

## Chương 3 — Personas & Đối tượng người dùng

### 3.1. Owner-Operator (persona chính — "chủ nhà")

Một cá nhân am hiểu kỹ thuật, vừa là **người dùng cuối** vừa là **người vận hành hạ tầng**. Nghe nhạc/xem phim/đọc sách hằng ngày; đồng thời deploy k3s, theo dõi Prometheus, chỉnh DB. Kỳ vọng: giao diện như "bảng điều khiển thiết bị" — legible, ít trang trí, thao tác nhanh; mọi thứ verify được bằng số liệu thật. Đây là người duy nhất có **owner password** (`owner712002`) — chìa khoá admin cho mọi thao tác ghi nhạy cảm.

### 3.2. Guest Listener (khách nghe)

Người thân/bạn bè truy cập link công khai để nghe nhạc/xem nội dung. **Không đăng nhập**, không thao tác ghi lên dữ liệu chung (playlist vĩnh viễn, NSFW, debug đều bị chặn bằng owner password). Có thể tạo playlist **local** (chỉ trong trình duyệt của họ), nghe offline.

### 3.3. Collaborator (cộng tác viên Kanban)

Người được mời vào bảng Notes/Kanban: tự đăng ký → owner duyệt → nhận session, có role per-board (admin/member/viewer). Phạm vi cộng tác **chỉ giới hạn ở Kanban**, không đụng tới media.

### 3.4. AI Assistant (actor phi-người)

Trợ lý AI được xem như một "người dùng" đặc biệt: nhận câu lệnh ngôn ngữ tự nhiên và **thực thi hành động** qua 38 MCP tool (phát nhạc, tải YouTube, CRUD playlist, lên lịch, ghi nhớ). Là một control surface song song với UI, không thay thế UI.

---

## Chương 4 — Nguyên tắc sản phẩm

- **P1 — Instrument panel, không phải app giải trí hào nhoáng.** Giao diện đọc-được-tức-thì, ít trang trí, tự tin về cái gì bấm được. (DESIGN.md: "closer to an instrument panel than a consumer entertainment app".)
- **P2 — Monochrome Paper White.** Accent duy nhất là trắng (`--green` = trắng), luôn đi kèm chữ đen; nền Void Black `#050505`. Không hue thứ hai (ngoại lệ hẹp: tile genre duotone, palette chart). Độ sâu bằng ánh sáng (glow trắng), không bằng bóng tối hay màu thứ hai.
- **P3 — Không bao giờ gián đoạn phát nhạc.** Mọi lỗi phụ (ghi play, transcode, insight, sub-query search) degrade im lặng; playback là ưu tiên tối thượng.
- **P4 — Local-first, offline-first.** Thư viện là file local; PWA cache nhiều tầng; nghe nhạc offline qua IndexedDB; SW auto-update.
- **P5 — Single-tenant simplicity.** Không hệ auth phức tạp; một owner password + vài bề mặt gated. Aggregate-only stats. Đơn giản có chủ đích.
- **P6 — AI là control surface, không phải gadget.** AI thực thi hành động thật qua tool, tái dùng cùng usecase/DB như UI; ưu tiên model rẻ + fallback bền.
- **P7 — Homelab như testbed.** Chấp nhận vài SPOF (backend 1 replica) đổi lấy đơn giản; nhưng DB có hot standby + tự promote; quan sát được; quy trình deploy có verify live.
- **P8 — Thay đổi phẫu thuật trên monolith.** Nhiều file dùng chung (`routes.go`, `handler.go`, `db.go` `migrate()`, `AppRoutes.tsx`, `Sidebar.tsx`); mọi thay đổi phải impact-check, giữ đúng convention domain, chỉ thêm idempotent.

---

## Chương 5 — Information Architecture & Điều hướng

### 5.1. Bảng route (20 màn hình)

Route khai báo phẳng trong `AppRoutes.tsx` (không nested, không lazy-load, **không route 404 riêng**). Route mặc định `/` là **thư viện Nghệ sĩ** (không có trang "home" riêng).

| Route | Trang (component) | Domain | Mô tả |
|---|---|---|---|
| `/` | ArtistsPage | Music | Landing thư viện: lưới nghệ sĩ + rail A–Z + lọc nội bộ + LibraryStatsBar |
| `/discover` | DiscoverPage | Music | "Khám phá": hero album, mix khám phá (seeded shuffle), gợi ý smart-queue, shelf |
| `/artist/:id` | ArtistPage | Music | Chi tiết nghệ sĩ: hero + lưới album (hover play) |
| `/album/:id` | AlbumPage | Music | Chi tiết album: hero cover + tracklist (click phát cả album làm queue) |
| `/albums` | AlbumsPage | Music | Toàn bộ album, rail A–Z, lọc `?q=` |
| `/tracks` | TracksPage | Music | Toàn bộ track, lọc `?q=` |
| `/search` | SearchPage | Music/YT | Tìm đa chế độ: genre grid / Artists·Albums·Tracks + kết quả YouTube (Stream/Download) + Channel; empty→Ask AI |
| `/videos` | VideosPage | Video | Lưới poster phim theo nhóm thư mục, lọc `?q=` |
| `/video/:id` | VideoPlayerPage | Video | Player HLS toàn màn hình (hls.js / native Safari) |
| `/trending` | TrendingPage | Trending | GitHub trending: Chart/Grid mode, chọn ngày, refresh; đồng bộ RadialNav qua custom-event |
| `/ebooks` | EbooksPage | Reader | Bookshelf: lưới ebook, badge EPUB/PDF, lọc Collection + NSFW (gated) |
| `/ebook/:id` | EbookReaderPage | Reader | Đầu đọc EPUB/PDF: TOC, Paged↔Scroll, theme/font, lưu tiến độ |
| `/comics` | ComicsPage | Reader | Duyệt/tải/đọc truyện: MangaDex + E-Hentai (gated), Downloads offline |
| `/playlists` | PlaylistsPage | Social | Playlist local + permanent (gated), mosaic cover, tải offline |
| `/notes` | NotesPage | Social | Kanban đầy đủ có auth riêng: board/column/card/label/subtask/comment/RBAC |
| `/ai` | AIAssistantPage | AI | Chat AI streaming, MediaCard action, slash-command, memory panel |
| `/ai/stats` | AIStatsPage | AI | Dashboard usage/cost AI, bảng giá per-model (OCR), logs |
| `/stats/music` | MusicStatsPage | Music | Analytics nghe nhạc: Last.fm sync, top-10, line 30 ngày, insight AI |
| `/tools` | ToolsPage | System | Gallery 37 MCP tool, preview iframe, CTA deep-link `/ai` |
| `/debug` | RequestLogPage | System | Console debug hạ tầng (gated): latency, endpoint chậm, topology, traceroute |

### 5.2. Ba mặt điều hướng song song

1. **Sidebar** (desktop >900px): cột dọc glass, thu gọn được (220px↔56px); nhóm Library + khối Last.fm + toggle theme/ngôn ngữ.
2. **RadialNav** (bong bóng nổi kéo-thả, cả desktop + mobile): đĩa vinyl xoay khi phát, magnet-snap vào nút play, mở sheet lưới ô với các mode Main/Trending/Calendar/Playlist-picker; kiêm nút play/pause.
3. **MobileNav** (legacy): đã `display:none` — RadialNav thay thế trên mobile (nợ kỹ thuật cần dọn).

Trên mobile (≤900px): sidebar ẩn, hai pill đáy nổi (player-mini + search island), RadialNav là nav chính.

### 5.3. Bề mặt gated bằng owner password

Playlist **permanent** (tạo/sửa/xóa/thêm track), lưu **lyrics**, đặt **NSFW** ebook/comic, trang **`/debug`**, và **duyệt user Kanban** — đều yêu cầu owner password `owner712002`, cache trong `sessionStorage`, re-prompt khi 401/412. Không có hệ auth cấp app (single-tenant).

---

## Chương 6 — Kiến trúc & Hạ tầng (Architecture & Infrastructure)

### 6.1. Tổng quan kiến trúc

Cozyroom là một **homelab media app single-tenant** đóng gói dưới dạng **monolith Go backend + SPA React frontend**. Backend là một tiến trình Go duy nhất phục vụ đồng thời: REST API, streaming (audio/video/HLS), MCP server, AI chat, scraper, cron jobs, và các background worker (scan thư viện, enrich metadata, trending). Frontend là bản build tĩnh (Vite) được nginx phục vụ, proxy toàn bộ `/api`, `/stream*`, `/hls`, `/mcp` về backend.

Toàn hệ chạy trên **k3s** (namespace `cozyroom-k8s`) trên một cụm máy bare-metal tại nhà, nối nhau qua Tailscale, phơi ra Internet qua **Cloudflare Tunnel** tại domain `music.giatbh.io.vn`. Đây là **monolith có chủ đích** (không tách microservice); hệ quả là một số file dùng chung (`routes.go`, `handler.go`, `db.go` `migrate()`) là điểm nghẽn phối hợp giữa các domain.

Sơ đồ tổng thể (luồng request thật):

```
Internet
  │  https://music.giatbh.io.vn
  ▼
Cloudflare Edge (CDN cache asset tĩnh + /stream có Cache-Control public)
  │  Cloudflare Tunnel (cloudflared, 2 replica, http2)
  ▼
Service frontend (NodePort 30080, ClusterIP :80)  ── cũng truy cập LAN qua NodeIP:30080
  ▼
Pod frontend  (nginx:alpine, 3 replica, SPA build tĩnh)
  │  proxy_pass path động → backend.cozyroom-k8s.svc.cluster.local:8080
  ▼
Service backend (ClusterIP :8080)
  ▼
Pod backend  (Go monolith, 1 replica)  ──► cloak-proxy:8765 (egress ẩn danh scraper/yt-dlp)
  │  DATABASE_URL = postgres://cozyroom:***@db-adapter:5432/cozyroom
  ▼
Service db-adapter (:5432) → Pod db-adapter (PgBouncer, 2 replica, pool_mode=transaction)
  ▼
Service postgres (:5432) → Pod postgres-0 (PostgreSQL 16-alpine, StatefulSet, PRIMARY)
                                │  streaming replication (WAL)
                                ▼
                            Pod postgres-standby-0 (PostgreSQL 16, hot standby, node khác)
```

Ràng buộc quan trọng về nguồn sự thật hạ tầng: **`k8s/db-adapter.yaml` trên đĩa mô tả một kiến trúc HAProxy → CockroachDB 3 node KHÔNG đúng thực tế.** Deployment thật đã rollback về `k8s/db-adapter.yaml.postgres-backup` — kiểm chứng live cho thấy image đang chạy là `pgbouncer/pgbouncer:latest`, PgBouncer trỏ về PostgreSQL 16 thật. Mọi SQL đặc thù engine phải viết theo Postgres, và trước khi suy luận trạng thái phải verify bằng:
```
kubectl get deployment db-adapter -n cozyroom-k8s -o jsonpath='{.spec.template.spec.containers[0].image}'
```

### 6.2. Backend — monolith Go, clean-ish architecture

Điểm vào: `backend/cmd/server/main.go`. Một tiến trình, lắng nghe `:8080`, phân tầng theo hướng clean architecture (không tuyệt đối):

- **Repository layer** (`internal/repository/postgres`): `ArtistRepo`, `AlbumRepo`, `TrackRepo`, `SearchRepo`, `StatsRepo`, `LyricsCacheRepo`, `SettingsRepo`, `VideoRepo`, `PlaybackRepo`, `ComicsDownloadsRepo`, và `UoWFactory` (Unit-of-Work cho transaction). Tất cả nhận `*sql.DB` mở qua driver `pgx/v5/stdlib`.
- **Usecase layer** (`internal/usecase`): `LibraryUsecase`, `LyricsUsecase`, `SettingsUsecase`, `VideoUsecase`, `EbookUsecase`, `PlaybackUsecase`.
- **Delivery/API layer** (`internal/api`): router `net/http` `ServeMux` (Go 1.22 pattern routing), middleware, các nhóm handler theo domain.
- **Hạ tầng phụ**: `internal/hls` (HLS Manager + watchdog giết ffmpeg treo), `internal/transcode` (ffmpeg on-the-fly + cache đĩa), `internal/enricher` (Deezer/TMDb/GitHub), `internal/mcp` (MCP tool registry), `internal/cron` (scheduled AI tasks), bot bridge `telegram`/`teams`/`discord`, `internal/metrics` (Prometheus), `internal/library` (scanner nhạc/video/ebook).

Background worker khởi động trong `main()`: scan lần đầu (nếu DB trống), enrich ảnh nghệ sĩ/poster phim, dọn transcode cache mỗi 1h (mặc định 5000 MB), poll GitHub trending mỗi 12h kèm enrich AI. HTTP server: `ReadHeaderTimeout 10s`, `WriteTimeout 5m`, `IdleTimeout 2m`. Build ra 2 nhị phân: `server` + `mcp-server`. Runtime cần: `ffmpeg`, `poppler-utils`, `tesseract-ocr`, `yt-dlp` + Node 22, `traceroute`.

### 6.3. Frontend — React SPA

Build bằng **Vite + React**, plugin `vite-plugin-pwa`. `vite.config.ts` đặt `build.outDir = '../backend/dist'` — output đổ thẳng sang thư mục backend (chủ đích). Dev server proxy `/api`, `/stream`, `/stream-video`, `/hls` về `localhost:8080`. Deploy k3s dùng thẳng `vite build`, **không chạy `tsc`** — lỗi type chỉ lộ runtime; bắt buộc `tsc --noEmit` thủ công trước deploy.

### 6.4. Database

**Engine prod: PostgreSQL 16-alpine** (StatefulSet `postgres-0`) qua PgBouncer. Driver `pgx`, `DATABASE_URL` có `sslmode=disable&default_query_exec_mode=simple_protocol`. Pool Go: `MaxOpenConns=10`, `MaxIdleConns=5`. PgBouncer: `pool_mode=transaction`, `max_client_conn=5000`, `default_pool_size=50`.

Migration idempotent trong `db.go` `migrate()` — `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, không versioned. **Quy tắc phối hợp: chỉ THÊM statement idempotent vào cuối `migrate()`, không tái cấu trúc.** Extension `pg_trgm` + hàm `f_unaccent(TEXT)` tự viết (IMMUTABLE, 67 ký tự dấu tiếng Việt + `đ→d`).

(Danh sách bảng đầy đủ xem Chương 13 — Mô hình dữ liệu hợp nhất.)

### 6.5. Routing framework

`internal/api/routes.go` là khung mux:
- **`RouterDeps` struct**: gom mọi dependency router cần — usecase (`Lib`, `Lyrics`, `Settings`, `Playback`, `Video`, `Ebook`), `UoW`, `ScanDB *sql.DB`, các path (`MusicPath`, `FilmsPath`, `EbooksPath`, `YtDownloadPath`, `CoversDir`, ...), khóa API (`LastfmKey/Secret`, `GeminiKey/Keys`, `OpenRouterKey`, `AnthropicKey`, `DeepSeekKey`, `GithubToken`), `CloakProxyURL`, `HLSMgr`, `MaxComicsGB`.
- **`NewRouter(d RouterDeps)`** trả `(http.Handler, *ComicsDownloader, *AIHandlers)`. Dựng struct `handlers` dùng chung (nhạc/ebook/stream), rồi handler group riêng: `VideoHandlers`, `ScraperHandlers`, `EHCachedHandler`, `ComicsDownloader`, `TrendingHandlers`, `YouTubeHandlers`, `PlaylistHandlers`, `NotesHandlers`, `BoardHandlers`, `KanbanAuthHandlers`, `AIHandlers`, MCP registry (`/mcp`).
- **Middleware**: `metricsMiddleware(panicRecovery(mux))` — normalize path (hex 16 ký tự → `{id}` giữ cardinality Prometheus thấp), đo request, ring buffer cho `/api/debug/requests`; panic recovery log stack 64KB trả 500.
- Route `/` cuối gắn `spaHandler{root: "./dist"}`.

### 6.6. Triển khai k8s (deployment topology)

Namespace `cozyroom-k8s` trên k3s. WSL2 này chính là k3s master; thao tác qua `wsl -d Ubuntu-22.04 -- bash -c "kubectl ..."`.

| Thành phần | Kind | Replica | Image | Ghi chú |
|---|---|---|---|---|
| `backend` | Deployment | **1** | `cozyroom-backend:k8s` | maxSurge 1/maxUnavailable 0; pin node; readiness `/api/health`; mount music/films/ebooks readonly |
| `frontend` | Deployment | **3** | `cozyroom-frontend:k8s` | Service **NodePort 30080**; podAntiAffinity trải node; limits 200m/128Mi |
| `db-adapter` | Deployment | 2 | **`pgbouncer/pgbouncer:latest`** | ⚠️ yaml trên đĩa ghi HAProxy nhưng thực tế PgBouncer |
| `postgres` | StatefulSet | 1 | `postgres:16-alpine` | PRIMARY; PVC 10Gi; `wal_level=replica`, `hot_standby=on` |
| `postgres-standby` | StatefulSet | 1 | `postgres:16-alpine` | Hot standby node khác; `pg_basebackup --wal-method=stream` |
| `cloudflared` | Deployment | 2 | `cloudflared:latest` | Tunnel → frontend:80 |
| `cloak-proxy` | Deployment | 1 | `cozyroom-cloak:k8s` | Egress ẩn danh (:8765) |
| `postgres-monitor` | CronJob | mỗi 2' | `postgres:16` | Primary down → `pg_promote()` + alert Telegram |
| `stream-health-monitor` | CronJob | mỗi 2' | `curlimages/curl` | Query Prometheus → alert Telegram |

Storage: PV hostPath pin node. Media readonly `/mnt/f` (music `/mnt/f/250930music`, films `/mnt/f/Films`, ebooks `/mnt/f/Ebooks`). Dữ liệu ghi (`/data`) trên PVC `cozyroom-data`. Registry riêng `100.88.197.64:5000`.

### 6.7. Docker build

- **`Dockerfile`** (backend): multi-stage — `golang:alpine` build tĩnh `CGO_ENABLED=0` → `server` + `mcp-server`; `alpine:3.19` cài `ffmpeg poppler-utils tesseract-ocr traceroute`, copy Node 22, tải `yt-dlp`, `EXPOSE 8080`.
- **`Dockerfile.frontend`**: `node:20-alpine` `npm ci` + `npx vite build`; output ở `/app/backend/dist`; `nginx:alpine` copy `--from=builder /app/backend/dist` → `/usr/share/nginx/html`.

### 6.8. Networking, nginx, CDN

`nginx.conf` phục vụ SPA + reverse proxy backend, `resolver 10.43.0.10`. Cache theo path: `index.html`/`sw*.js`/`manifest` → `no-cache`; `/assets/` hashed → `max-age=31536000 immutable`; SSE/audio/video/HLS → `proxy_buffering off`, timeout đến 3600s. Cloudflare tunnel + edge cache audio lossless (`public, max-age=3600`).

### 6.9. Service Worker / PWA

`VitePWA` `registerType: autoUpdate`, `skipWaiting`, `clientsClaim`, SW **`sw3.js`**. Postmortem: CF override no-cache `sw.js` → SW cũ → trang trắng; fix = đổi tên SW (sw→sw2→sw3). Runtime cache: covers/artist-images StaleWhileRevalidate 30 ngày; artists/albums/stats SWR 7 ngày; tracks/search NetworkFirst 4s. Manifest `standalone`, `theme_color #050505`.

### 6.10. Xác thực & single-tenant

**KHÔNG có hệ user/auth cấp app.** Hai cơ chế bảo vệ ghi: (1) **owner password `owner712002`** (header `X-Owner-Password`/`?password=`) cho sửa playlist, NSFW ebook, debug, duyệt user Kanban; (2) **hệ auth Kanban riêng** (register→owner duyệt, session token, RBAC per-board fail-closed) chỉ phạm vi Kanban. Ràng buộc cứng: không đụng `verifyOwnerPassword`/`OwnerPassword` trong `playlists.go`. Số liệu **aggregate-only**, không tracking per-user.

### 6.11. Cấu hình & secrets

Cấu hình từ env (`envOr`), inject qua k8s Secret `cozyroom-secret`: `POSTGRES_PASSWORD`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `GEMINI_API_KEYS`, `GITHUB_TOKEN`, optional `TELEGRAM_*`. Prod chỉ có key DeepSeek/OpenRouter/Gemini (không Anthropic) — chọn provider động. Pod nhận `POD_NAME`/`NODE_NAME`/`POD_IP` qua downward API.

### 6.12. Observability

- **Prometheus** scrape `/metrics` + `kube-state-metrics`: `music_stream_errors_total`, `HTTPRequestsTotal`, `HTTPDurationSeconds`, `StreamsTotal`, `SmartQueueTotal`, `SearchesTotal`... Correlation id không vào label (chỉ log).
- **Grafana** dashboard (từng sự cố datasource hỏng).
- **Alerting**: 2 CronJob/2 phút → Telegram (`stream-health-monitor`, `postgres-monitor` tự promote standby). Telegram từng không ổn định.
- **Debug endpoints** (owner-gated): `/api/debug/{requests,instance,services,traceroute}`.
- Backend QoS BestEffort (không đặt resource limits).

### 6.13. NFR hệ thống

- **Availability**: best-effort homelab, không SLA. Backend 1 replica (SPOF, maxUnavailable 0); frontend 3 replica; Postgres primary + hot standby tự promote.
- **Performance**: GIN trgm; cover resize + cache + singleflight; transcode cache đĩa; SW cache; CF edge. Pool Go 10 → PgBouncer 5000/50.
- **Storage**: media readonly `/mnt/f`; app data PVC; Postgres 10Gi (+10Gi standby); transcode cache dọn về 5000 MB/1h; comics ≤ 50GB.
- **Backup**: hot standby là dự phòng chính; **chưa có backup logical định kỳ** — khoảng trống cần lưu ý.
- **RÀNG BUỘC TUYỆT ĐỐI**: production DB SQLite lịch sử tại `/mnt/c/Users/olive/orca/workspaces/home-spotify/m/data/metadata.db`. Trước mọi thao tác container/`--force-recreate`: PHẢI `docker inspect <container> | grep -A5 Mounts`, KHÔNG đổi path `./data` khi chưa backup, KHÔNG recreate khi chưa xác nhận DB path với user. Vi phạm = mất dữ liệu không khôi phục.

### 6.14. Quy trình build & deploy

1. Build qua WSL2: `docker build -f Dockerfile[.frontend] -t 100.88.197.64:5000/cozyroom-{backend,frontend}:k8s .` (frontend chạy `tsc --noEmit` trước vì `vite build` bỏ qua typecheck).
2. Push registry `100.88.197.64:5000`.
3. `kubectl rollout restart deployment/{backend,frontend} -n cozyroom-k8s` + `rollout status --timeout=120s`.
4. **Verify live** trên `NodeIP:30080` trước khi báo hoàn thành.

## Chương 7 — Domain: Âm nhạc (Music)

> Phạm vi: quét thư viện, tracks/albums/artists, tìm kiếm thông minh, phát nhạc/streaming, hàng đợi, smart radio, Last.fm, số liệu nghe, lyrics, player UI, Discover. App **single-tenant** — không có tài khoản/người dùng; mọi số liệu là gộp toàn app. DB production là **PostgreSQL thật** (pgbouncer), không phải CockroachDB.

Ký hiệu: FR = yêu cầu chức năng; BR = business rule/ràng buộc; EC = edge case đã xử lý.

### 7.1. Quét thư viện & lập chỉ mục (Library Scanner)

**Mô tả:** Đi qua thư mục nhạc, đọc tag audio, trích cover, và upsert artists/albums/tracks. Albums/artists KHÔNG phải thực thể ingest riêng — chúng được **suy ra từ tag của track** khi quét.

**Luồng:** `POST /api/scan` → `handlers.scan` → `scanLibrary()` → `library.Scan(db, musicPath, coversDir)`. Cũng chạy khi khởi động (nếu thư viện rỗng) và qua MCP tool `ScanFunc`.

- **FR-MUS-001** Scanner đi qua `musicPath` bằng `filepath.Walk`, chỉ nhận file có đuôi trong whitelist (case-insensitive): `.mp3 .flac .m4a .ogg .aac .wav .opus .webm`. File khác bị bỏ qua im lặng.
- **FR-MUS-002** Toàn bộ lần quét chạy trong **một transaction** (`cozydb.Transact`). Khi serialization retry, counter `Result{Tracks, Errors}` được reset ở đầu closure để không đếm trùng.
- **FR-MUS-003** Mỗi file lỗi (`indexFile` err) chỉ log `scanner: skip <path>: <err>`, tăng `Errors`, KHÔNG abort lần quét. Response trả `{"music_scanned": <n>, "music_errors": <n>}`.
- **FR-MUS-004** Đọc metadata qua `github.com/dhowden/tag`; lỗi parse tag bị bỏ qua, file vẫn được index với fallback. Mặc định khi thiếu tag: artist `"Unknown Artist"`, album `"Unknown Album"`, title = `cleanTitle(filename)`. Chỉ giá trị tag khác rỗng mới override mặc định.
- **FR-MUS-005** `cleanTitle` làm sạch title suy từ filename bằng 2 regex: `reTimestamp = _\d{8}_\d{6}$` (đuôi `_YYYYMMDD_HHMMSS` của file tải), `reTrackNum = ^\d+[.\-\s]+` (tiền tố số thứ tự "01. ", "3-"). Áp cho ID3 Title tag **chỉ khi** tag khớp `reTimestamp`.
- **FR-MUS-006** Thời lượng: tag ID3 không mang độ dài stream, nên gọi `ffprobe` (`-show_entries format=duration`, timeout **15s**), làm tròn giây. Khi re-index, duration chỉ ghi đè khi probe mới `> 0` (SQL `CASE WHEN excluded.duration_s > 0 THEN excluded.duration_s ELSE tracks.duration_s END`) — probe lỗi không xoá giá trị tốt.
- **FR-MUS-007** Cover mỗi album trích **một lần**: nếu tag có `Picture()`, ghi `{coversDir}/{albumID}.jpg` chỉ khi file chưa tồn tại; set `cover_path = "/api/covers/" + albumID`. Không có cover → log `scanner: no ID3 cover` và để trống.

**Business rules / gotchas:**
- **BR-MUS-008 (ID derivation):** `id8(s) = sha256(lower(trim(s)))` cắt 8 byte đầu → 16 hex. `artistID = id8(name)`; `albumID = id8(artistID + albumTitle)` (cùng tên album khác artist là 2 album khác nhau); `trackID = id8(path)` (danh tính track = đường dẫn file → di chuyển file tạo track row mới). Đây là lý do `hexID = ^[0-9a-f]{16}$`.
- **BR-MUS-009 (fast-skip incremental):** File **YouTube download** (basename = 11 ký tự khớp `reYouTubeID = ^[a-zA-Z0-9_-]{11}$`), file **`.wav`**, hoặc file dưới thư mục con **`/mp3/`** — nếu đã có trong DB thì return ngay (không re-probe/re-tag). Mọi file khác luôn đọc lại và upsert (thực chất full re-index mỗi lần quét).
- **BR-MUS-010 (upsert asymmetry):** `artists`/`albums` dùng `ON CONFLICT(id) DO NOTHING` — tên artist, cover/year album chỉ ghi lần đầu, KHÔNG cập nhật về sau. `tracks` dùng `ON CONFLICT(id) DO UPDATE` toàn bộ cột (trừ duration có CASE guard) — metadata track ĐƯỢC refresh mỗi lần quét.
- **BR-MUS-011 (ingest thay thế download):** `IndexFileWithMetadata(...title, artist, album)` cho phép override tag (dùng cho YouTube download); set `track_num=0, year=0, genre=""`, KHÔNG gọi ffprobe (duration=0). Với YouTube ID (basename 11 ký tự) chạy `go downloadYTThumbnail(...)` async fetch `img.youtube.com/vi/{id}/{maxres|hq|mq}default.jpg`.
- **EC-MUS-012** `IsEmpty` = `SELECT COUNT(*) FROM tracks == 0` → trigger initial scan khi thư viện rỗng.

**File chính:** `backend/internal/library/scanner.go`, `backend/internal/api/scan.go`, `backend/internal/db/db.go`.

### 7.2. Làm giàu ảnh nghệ sĩ (Artist Image Enrichment — Deezer)

- **FR-MUS-013** `ArtistImageProvider` interface = `ArtistImageURL(ctx, name) (string, error)`. `DeezerProvider` gọi `https://api.deezer.com/search/artist?q=...&limit=1` (public, không cần key), trả URL đầu tiên khác rỗng theo ưu tiên **picture_xl → picture_big → picture_medium**.
- **FR-MUS-014** `FetchArtistImages` (batch): lấy artist từ `repo.ListWithoutImage()`; **self-healing** — artist có `image_path` nhưng file mất trên đĩa → reset DB + fetch lại. Rate limit `Sleep(350ms)` (~3 req/s).
- **FR-MUS-015** Tách nghệ sĩ (`splitArtists`, tối đa **4**) qua 3 pass: separator có khoảng trắng (`", "`, `"; "`, `" & "`, `" feat. "`, `" ft. "`, `" vs. "`, `" x "`) → trim separator cuối → separator trần.
- **FR-MUS-016** `compositeImages`: 1 ảnh → JPEG quality 90; 1–3 nghệ sĩ → 1 hàng; **4 nghệ sĩ → lưới 2×2**; resize `draw.ApproxBiLinear`.

**BR/EC:** `http.Get` Deezer không có timeout/context (gotcha). Ảnh thành phần lỗi → bỏ qua; 0 ảnh → artist giữ nguyên không ảnh.

**File chính:** `backend/internal/enricher/deezer.go`, `provider.go`.

### 7.3. Tracks / Albums / Artists (thực thể & trang danh sách)

- **FR-MUS-017** `GET /api/tracks?album_id=` — list track, `ORDER BY t.track_num, t.title`, không phân trang. `album_id` rỗng = tất cả. Cache `max-age=300`.
- **FR-MUS-018** `GET /api/albums?artist_id=` — join albums→artists, `ORDER BY ar.name, al.year, al.title`. `GET /api/albums/{id}` — 1 album, 404 nếu nil. Cache `max-age=300`.
- **FR-MUS-019** `GET /api/artists` — `ORDER BY name`. `GET /api/artists/{id}` → `GetDetail`: `COUNT(DISTINCT albums)`, `COUNT(DISTINCT tracks)`, danh sách `Genres`. Yêu cầu hexID → 404 nếu sai.
- **FR-MUS-020 (ArtistsPage):** grid toàn bộ artist, sort A→Z `localeCompare`, có **A-Z rail** (anchor scrollIntoView), và ô lọc **nội bộ riêng** (`filterQuery`, substring) — KHÔNG dùng `?q=` URL. Avatar = ảnh thật hoặc gradient `gradientFor(name)` + chữ cái đầu.
- **FR-MUS-021 (ArtistPage):** `GET /api/albums?artist_id={id}`; tên/ảnh artist suy từ `albums[0]`. Hero + grid album hover play-overlay; hiện `year` chỉ khi `>0`.
- **FR-MUS-022 (AlbumPage):** hero (cover 400px, fallback ♪) + tracklist. Click row → `play(t, tracks)` — **seed cả album làm queue** (cơ chế "play all"). Row đang phát nhận class `track-row--active`; cột # hiện SVG equalizer động khi `isCurrent && isPlaying`, ngược lại là số thứ tự.
- **FR-MUS-023 (AlbumsPage):** grid toàn album, sort title, lọc **`?q=`** (title HOẶC artist_name). A-Z rail, ẩn khi có `q`.
- **FR-MUS-024 (TracksPage):** list phẳng, sort title, lọc `?q=` (title OR artist_name OR album_title). Click row → `play(t2, shown)` — seed danh sách đang hiển thị làm queue.
- **FR-MUS-025 (Favorites):** `FavoritePill` keyed theo `trackId`, `stopPropagation` để favorite không trigger play row.

**File chính:** repos `postgres/{track,album,artist}.go`; pages `{ArtistsPage,ArtistPage,AlbumPage,AlbumsPage,TracksPage}.tsx`.

### 7.4. Tìm kiếm thông minh (Smart Search)

**Luồng:** `GET /api/search?q=` → `SearchRepo.Search`. Response `{artists:[], albums:[], tracks:[]}`.

- **FR-MUS-026** Query tối thiểu **2 ký tự** (sau TrimSpace); ngắn hơn → mảng rỗng, không chạm DB. Cache `max-age=30`.
- **FR-MUS-027** Match qua `f_unaccent(col) ILIKE f_unaccent($1)` với `lk = "%"+query+"%"`. 3 query riêng: Artists (name, LIMIT 20), Albums (title OR artist name, LIMIT 20), Tracks (title OR artist OR album title, LIMIT 30).
- **FR-MUS-028** De-dup mỗi category bằng `seen map`. Sắp xếp **thuần alphabet** — KHÔNG có relevance scoring / prefix-boost.
- **BR-MUS-029 (`f_unaccent`):** hàm SQL tự viết `translate(lower(t), <src>, <dst>)` — KHÔNG dùng extension `unaccent` (vì `đ` không có phân rã Unicode, map thủ công `đ→d`). Bảng nguồn **67 ký tự** nguyên âm có dấu + `đ`. `IMMUTABLE` để dùng trong GIN expression index.
- **BR-MUS-030 (index):** `pg_trgm` + GIN trigram cả trên cột thô (`idx_*_trgm`) lẫn biểu thức chuẩn hoá (`idx_*_unaccent_trgm`) → `ILIKE '%...%'` không quét toàn bảng.
- **BR-MUS-031 (context-aware top search):** ô search Header xét `pathname` tìm trong tab hiện tại: `/ebooks`→`/ebooks?q=`, `/comics`→`/comics?q=`, `/videos`→`/videos?q=`, `/albums`→`/albums?q=`, `/tracks`→`/tracks?q=`, còn lại → `/search` (music). Debounce **300ms**, navigate `{replace:true}`. ArtistsPage dùng filter nội bộ riêng nên KHÔNG nằm trong luồng `?q=`.
- **BR-MUS-032 (`yt:` prefix):** SearchPage chạy song song `/api/search` (local) và `/api/youtube/search`. Kết quả YouTube là **track hạng nhất**: nút Stream tạo Track tổng hợp `yt:<videoId>` và `play()`; nút Download `POST /api/youtube/download`. YT result trùng tên (case-insensitive) với track local được đánh dấu 'done'.
- **EC-MUS-033** Lỗi sub-query bị nuốt → category đó rỗng, hàm vẫn trả `nil` error. `%`/`_` của user không escape.
- **EC-MUS-034 (SearchPage empty):** kết quả rỗng → copy "no results" + CTA **Ask AI** link `/ai` với `state={{prompt:q}}`.
- **EC-MUS-035 (ChannelView):** click uploader mở view kênh YouTube — browse phân trang 20/lần hoặc search-trong-kênh.

**File chính:** `postgres/search.go`, `db/db.go` (f_unaccent), `SearchPage.tsx`, `Header.tsx`.

### 7.5. Genres (Browse-by-genre)

- **FR-MUS-036** `GET /api/genres` → grid `{Name, TrackCount, CoverURL}`, `ORDER BY total DESC`, cache `max-age=300`. `GET /api/genres/{genre}` → `{albums, tracks}` (tracks LIMIT 200).
- **BR-MUS-037 (chuẩn hoá genre):** `genreKeyExpr = upper(regexp_replace(genre,'[^a-zA-Z0-9]+','','g'))` gộp "Pop"/"POP" và "V-POP"/"V.POP" thành một tile. Tên hiển thị = cách viết thô phổ biến nhất; cover = album nhiều track nhất.
- **BR-MUS-038 (Browse UI):** khi `?q=` rỗng, SearchPage hiện `GenreGrid` (tile duotone `genre-tile--{i%6}`, cố ý phá luật One-Accent). Drill-down hiện Albums grid + Tracks table của genre.

**File chính:** `postgres/track.go` (`ListGenres`, `GetByGenre`), `SearchPage.tsx`.

### 7.6. Streaming audio & Engine phát nhạc

**Backend streamer — `GET /stream/{id}` (`h.stream`):**
- **FR-MUS-039** Resolve path qua `TrackFilePath`; rỗng → 404. Đọc `client_id`/`attempt_id` query — CHỈ dùng trong log để nhóm retry, **không** đưa vào Prometheus label.
- **FR-MUS-040 (3 chế độ theo `?q=`):**
  1. `?q=320` — transcode 320kbps MP3. Cache hit → `http.ServeFile` (Range-seekable, `X-Cache: hit`). Miss → stream ffmpeg live qua `flushWriter`, cache đĩa để replay/preload.
  2. `?q=lossless-clean` — passthrough lossless đã strip metadata (chỉ khi `IsLossless`), giữ bit-perfect, loại tag hỏng làm crash demuxer browser.
  3. Mặc định — passthrough trực tiếp, `X-Quality: lossless`, **`Cache-Control: public, max-age=3600`**, `http.ServeFile`.
- **BR-MUS-041 (gapless qua cache):** preload track kế re-request cùng URL; sau khi cache, nhận file Range-seekable thay vì chạy lại ffmpeg (postmortem mobile-stutter 2026-07-12).
- **BR-MUS-042 (cache header):** chỉ path lossless mặc định set `public, max-age=3600` để CF edge-cache. Path transcode set `no-cache`.
- **EC-MUS-043** `flushWriter` flush sau mỗi ghi (cặp với nginx `proxy_buffering off`). `q=lossless-clean` trên file không lossless tự rơi về passthrough. Transcode fail được log/đếm nhưng response đã bắt đầu → client thấy stream cụt.

**Frontend engine — `PlayerContext.tsx`:**
- **FR-MUS-044 (dual-audio gapless):** 3 phần tử `Audio()`: `audioA`, `audioB` (2 slot đổi mượt track local), `audioYT` riêng cho YouTube (bypass Web Audio CORS). `getActive()` trả `audioYT` khi id bắt đầu `yt:`.
- **FR-MUS-045 (preload):** `PRELOAD_LOOK_AHEAD_S = 30`. Preload khi đổi track + fallback khi `duration - progress <= 30`. Bỏ preload khi `repeat==='one'` hoặc `shuffle==='shuffle'`. `preloadPendingId` set đồng bộ; `preloadedTrackId` set sau `canplay`. Swap seamless trong `startTrack` lật `activeSlot` trước async offline-check.
- **FR-MUS-046 (chất lượng & fallback cascade):** `Quality = 'lossless'|'320'` + tier ẩn `'lossless-clean'`. Override per-track lưu localStorage `hs-track-quality-overrides` (cap **300**, LRU). Cascade theo `el.error.code`: code 2 (network) retry **3 lần** @ **800ms** (giữ vị trí); code 4 ở `320` → lossless passthrough; code 3/4 ở lossless → `lossless-clean` → `320`. Mọi lỗi POST `/api/playback/error`.
- **BR-MUS-047 (`yt:` exempt):** track `yt:` stream qua `/api/youtube/stream/{id}`, miễn toàn bộ quality-fallback.
- **BR-MUS-048 (duration cho live-transcode):** stream transcode live có `el.duration === Infinity` → dùng `t.duration_s` từ DB.
- **FR-MUS-049 (persistence & recovery):** state lưu localStorage `hs-player`. `beforeunload`/`onPause` lưu progress. `visibilitychange`→visible đọc lại `currentTime/duration/paused` thật (sửa progress bar đơ khi OS thu hồi decoder nền). Offline: `getOfflineObjectURL(trackId)` bypass network/preload/fallback.
- **EC-MUS-050** `safeUUID()` fallback; `getClientId()` id thiết bị ổn định; `isIOS()` xử iPadOS báo "Macintosh".

**File chính:** `backend/internal/api/handler.go` (`stream`), `transcode/*`, `frontend/src/PlayerContext.tsx`.

### 7.7. Điều khiển phát & Hàng đợi (Transport, Queue, Modes)

- **FR-MUS-051 (play semantics):** `play(t)` một track đơn; `play(t, queue)` seed cả list. Nếu `newQueue.length > 1` → set `lockedQueueRef = true` (chặn smart-fill nhiễm). Không queue + `shuffleMode==='smart'` → unlock + `fillSmartQueue(t.id)`.
- **FR-MUS-052 (transport):** `toggle()`; `seek(s)`; `prev()` — nếu `currentTime > 3s` restart, ngược lại idx-1 (wrap nếu `repeat==='all'`); `next()` — smart: tiến tuần tự + refill nếu <10; shuffle: random idx `!== idx`; else tuần tự, wrap nếu `repeat==='all'`.
- **FR-MUS-053 (modes):** `RepeatMode = off|one|all`; `ShuffleMode = off|shuffle|smart`. `onEnd`: repeat one replay; smart tiến+refill; shuffle random; else tuần tự/wrap hoặc dừng.
- **FR-MUS-054 (queue — view+jump only):** `QueueList` render history+current+upcoming; click/Enter/Space → `playFromQueue(i)`. **KHÔNG có remove/reorder/clear** — queue chỉ đổi qua play/smart-fill/advance.
- **BR-MUS-055 (playFromQueue):** cố ý bỏ path newQueue của `play()` nên không lật `lockedQueueRef` — hành xử như next/prev.

**File chính:** `PlayerContext.tsx`, `QueueList.tsx`.

### 7.8. Smart Queue / Smart Radio (recommender)

**Luồng:** `GET /api/smart-queue?track_id=&limit=` → `TrackRepo.SmartQueue`.

- **FR-MUS-056** `track_id` phải hexID → 400; `limit` mặc định **30**, clamp **1–100**; seed không tồn tại → 404.
- **FR-MUS-057 (4 tier, trọng số 8:5:3:1 / mẫu 17):** Tier1 cùng artist (`RANDOM()`); Tier2 genre chính xác (chỉ khi genre khác rỗng); Tier3 genre tương tự (pg_trgm `t.genre % seed.genre`); Tier4 random fallback.
- **BR-MUS-058 (shortfall carry):** tier thiếu → dồn want sang tier kế → tổng đạt `limit`, một artist đông bài không lấn hết đa dạng. Thay query `ORDER BY CASE...` cũ (postmortem "SmartQueue O(N log N)"). `seen` map chống trùng chéo tier.
- **FR-MUS-059 (smart radio fill FE):** `fillSmartQueue` chèn ngay sau vị trí hiện tại (giữ history+current, dedupe id). Refill khi còn **<10** track phía trước và `!lockedQueueRef`. Guard `fetchingSmartRef`.

**File chính:** `postgres/track.go` (`SmartQueue`), `PlayerContext.tsx`.

### 7.9. Player UI (PlayerBar, Mini, NPO, VinylDisc, RadialNav, Equalizer)

- **FR-MUS-060 (desktop bar):** controls: shuffle-mode, Prev, **VinylDisc** 48px (đĩa quay khi phát, overlay play/pause, gọi `toggle`), Next, Repeat. Progress `range` step **0.5**. Phải: FavoritePill, queue, ✦ SMART, quality (`LOSSLESS`↔`320K`), Background Sounds. Click nền bar mở NPO; double-click đóng.
- **FR-MUS-061 (trích màu cover):** effect `[track]` load cover 80px crossOrigin, canvas 1×2, lấy pixel trên/dưới; luminance `<60` boost sáng+bão hoà; `coverColors` nuôi Equalizer, gradient NPO, aura RadialNav.
- **FR-MUS-062 (mini player):** pill nổi Apple-Music (ẩn khi NPO mở), progress shimmer, cover thumb, title+artist, play/pause + **next** (không prev). Tap mở NPO.
- **FR-MUS-063 (Now Playing Overlay):** luôn trong DOM, `npo--open` toggle. Nền cover blur + gradient. Tab Player/Lyrics (mobile). **Esc đóng**. Body: cover 512px, `<Equalizer/>`; controls mobile: queue, 🌐 translate, ⚡ auto-translate, progress, transport. `onTouchStart` hiện controls, auto-ẩn **3000ms**.
- **FR-MUS-064 (VinylDisc):** đĩa quay (grooves + label + lỗ tâm), tái dùng nút play/pause. `showText` khi `size*0.46 >= 26`; placeholder ♪ + "COZYROOM / HI·FI AUDIO" khi thiếu cover/404.
- **FR-MUS-065 (RadialNav):** bubble vinyl kéo-thả (`BUBBLE_R=24`), lưu `radial-nav-pos`, **magnet snap** trong **50px** vào `.player-mini-play-btn`/`.npo-play-btn`. Tap khi menu mở + có track → `toggle()`. Menu grid frosted 4×5 điều hướng nhiều route; mode trending/calendar/playlist-picker.
- **FR-MUS-066 (Equalizer):** `BARS=60`, `RANGE=0.6`, `getByteFrequencyData`, log-scale, gradient từ `coverColors`. Render null nếu không có analyser.
- **BR-MUS-067 (Web Audio / iOS):** `AnalyserNode` fftSize 256. **Bỏ hoàn toàn trên iOS** (`createMediaElementSource` reroute output vĩnh viễn + iOS suspend AudioContext nền) — iOS không visualizer nhưng phát nền ổn định. MediaSession vẫn chạy.
- **FR-MUS-068 (MediaSession):** set `metadata` (title + artwork 512×512; KHÔNG set artist/album), handlers `play/pause/nexttrack/previoustrack/seekto`.

**File chính:** `components/{PlayerBar,VinylDisc,RadialNav,Equalizer}.tsx`.

### 7.10. Lyrics (fetch, sync, dịch, chỉnh sửa)

**Luồng:** `GET/POST/DELETE /api/lyrics/{id}`, `GET /api/lyrics/{id}/translate`, `GET /api/lyrics/detect-language`.

- **FR-MUS-069 (4 tầng nguồn ưu tiên giảm dần):** (1) **Embedded tag** (keys `LYRICS`/`USLT`/`©lyr`, đọc tươi); (2) **Sidecar `.lrc`** (`{lyricsDir}/{id}.lrc` rồi file kề bên); (3) **Online** từ cache DB hoặc fetch **song song**: LRCLIB + NetEase + QQ Music + Musixmatch. Chỉ online được cache.
- **FR-MUS-070 (parse LRC):** `parseLRC` xử `[mm:ss.xx]` (nhiều timestamp/dòng), strip Enhanced LRC inline `<mm:ss.cc>`, sort tăng theo time.
- **FR-MUS-071 (online providers):** LRCLIB (6s, instrumental→`[Instrumental]`); NetEase (spoof UA/Referer, 8s); QQ (strip JSONP, 8s); Musixmatch — user token cache **20h**, thử `track.richsync.get` (word-level) rồi fallback `track.lyrics.get`.
- **FR-MUS-072 (cache):** bảng `lyrics_cache(track_id PK, results, fetched_at)` chỉ cache online (ghi bằng `context.Background()` để sống sót request cancel). `warmOnlineCache` pre-warm nền.
- **FR-MUS-073 (ghi lyrics):** `saveLyrics` POST `{lrc}` ghi CẢ embedded tag (`ffmpeg -metadata LYRICS=`, chỉ flac/mp3/ogg/m4a/aac, atomic rename) VÀ sidecar, invalidate cache. DELETE xoá cache.
- **FR-MUS-074 (dịch tự động):** `detect-language` dùng Google Translate. `translate?lang=` (default `vi`) cache trong `lyrics_translations(track_id, lang, ...)`; chọn synced **sidecar > embedded > online**; batch dịch một request; 404 nếu không có synced.

**Frontend LyricsView:**
- **FR-MUS-075** Session cache prefix `lyr:` (cap **200**). `pickBest` = synced đầu tiên. AbortController per trackId.
- **FR-MUS-076 (sync highlight):** `currentPairIdx` = pair cuối có `time <= progress`; phát hiện bilingual; auto-scroll dòng active tới **45%**; styling theo khoảng cách (opacity/scale/blur).
- **FR-MUS-077 (translate UI):** switch sticky `manualOn`; check `sessionStorage lyr-tr:{id}` rồi fetch. Auto-translate: nếu cache show ngay; else `detectLyricsLanguage` với **1 retry sau 1000ms**, chỉ dịch khi `lang && lang!=='vi'`.
- **BR-MUS-078 (chỉnh sửa — password gate):** `handleSave` nhận `admin123` hoặc `owner712002` (cái sau lưu bền qua `hs-lyrics-auth='1'`). Tools panel: source picker, save, translate, auto-translate, refresh.

**File chính:** `backend/internal/api/lyrics.go`, `postgres/lyrics_cache.go`, `LyricsView.tsx`.

### 7.11. Last.fm (login, now-playing, scrobble, backfill)

Kết nối một tài khoản Last.fm cho toàn app (single-tenant), lưu ở `settings` (`lastfm_session_key`, `lastfm_username`). Mọi call tới `ws.audioscrobbler.com/2.0/`, client timeout 10s.

- **FR-MUS-079** `GET /api/lastfm/status` → `{connected, username, configured}`. `POST /api/lastfm/login` qua `auth.getMobileSession` (`authToken = MD5(lower(user)+MD5(pass))`); 503 nếu chưa cấu hình, 401 nếu sai. `DELETE /api/lastfm/disconnect` → 204.
- **FR-MUS-080** `POST /api/lastfm/now-playing` → `track.updateNowPlaying`; `POST /api/lastfm/scrobble` (default ts=now) → `track.scrobble`; 401 nếu chưa có session.
- **BR-MUS-081 (signing):** `lfmSign` = sort key alphabet, nối `key+value` (không separator), append secret, MD5 hex → `api_sig` (thêm SAU khi ký).
- **FR-MUS-082 (backfill một lần):** `POST /api/lastfm/backfill-play-counts` job nền kéo `userplaycount` lifetime mỗi track (qua `track.getInfo`, public), `UPDATE tracks SET lastfm_backfill_count = GREATEST(...)` (idempotent), sleep **250ms**/track. Guard `backfillMu` → 409 nếu đang chạy. `GET` cùng path poll `{running, done, total, error}`.
- **BR-MUS-083 (trigger scrobble — client side):** Đổi track: reset `scrobbledRef`, fire `lastfmNowPlaying`. Điều kiện scrobble: bỏ nếu `duration < 30`; `threshold = min(duration*0.5, 240)`; khi `progress >= threshold && progress >= 30` → fire CẢ `lastfmScrobble` VÀ `recordPlay`. **Đây là ngưỡng "nghe thật" duy nhất — mọi tính năng đếm nghe phải tái dùng.**
- **EC-MUS-084** `lastfm_backfill_count` là snapshot lifetime KHÔNG có timestamp → chỉ vào tổng, không vào histogram theo ngày.

**File chính:** `backend/internal/api/lastfm.go`, `PlayerContext.tsx`.

### 7.12. Số liệu nghe & Music Insight

- **FR-MUS-085 (recordPlay):** `POST /api/tracks/{id}/play` → insert append-only vào `track_plays` (một row/lượt nghe hoàn tất). Fire-and-forget: lỗi DB chỉ log, LUÔN trả **204**. **KHÔNG có ngưỡng server-side** — ngưỡng nghe thật thực thi ở client (BR-MUS-083).
- **BR-MUS-086 (công thức play count):** dùng thống nhất: `lastfm_backfill_count + COUNT(track_plays)`.
- **FR-MUS-087 (playStats):** `GET /api/stats/plays?days=30` (clamp 1–365). Top (LIMIT 10): join tracks→albums→artists LEFT JOIN track_plays, `HAVING count > 0`. Daily: `GROUP BY to_char(to_timestamp(played_at),'YYYY-MM-DD')` (chỉ local; backfill không có timestamp nên không xuất hiện — split cố ý).
- **FR-MUS-088 (MusicStatsPage):** `staleTime` **30s**. Hiển thị: hero tổng lượt 30 ngày; blurb AI insight; spotlight track #1; BarChart Top 10; LineChart lượt/ngày. Nút "Đồng bộ Last.fm" (poll 2s). Empty: "Chưa có dữ liệu — nghe vài bài (đủ 30s trở lên)". Accent = `var(--green)` + `#000`.
- **FR-MUS-089 (Music Insight):** `GET /api/ai/music-insight` → blurb tiếng Việt 1–2 câu về top-5. Provider qua `selectProvider("")` (ưu tiên DeepSeek > Anthropic > Gemini > OpenRouter — **không hardcode Anthropic**). Cache theo ngày UTC+7 trong `settings`. **Degrade im lặng `{insight:""}`** nếu không provider/data/call fail.
- **FR-MUS-090 (stats thư viện):** `GET /api/stats` → `{Artists, Albums, Tracks}` (COUNT), cache `max-age=60`.

**File chính:** `handler.go` (`playStats`, `recordPlay`, `stats`), `music_insight.go`, `postgres/track.go`, `MusicStatsPage.tsx`.

### 7.13. Discover (Khám phá)

- **FR-MUS-091** Nguồn: `fetchPlayStats(90)`, `fetchTracks('')`, `fetchAlbums()`, `fetchArtists()`, `fetchSmartQueue(top[0].id)`.
- **FR-MUS-092 (các section):** (1) LibraryStatsBar; (2) Hero 3 album đầu; (3) **"Khám phá cho bạn"** — mix trung tâm: track KHÔNG thuộc top, shuffle seeded Fisher-Yates (salt = `top.length`, ổn định per-mount), lấy 12, chèn tối đa 3 track quen sau mỗi 4 track lạ, cap 14; (4) **"Gợi ý từ '{seed.title}'"** — smart-queue, 12 đầu; (5) shelf albums `slice(3,21)`; (6) shelf artists `slice(0,18)`.
- **BR-MUS-093** Mix ổn định per-mount (seeded shuffle). Không có route backend `/discover` — trang ghép từ endpoint sẵn có.

**File chính:** `DiscoverPage.tsx`.

### 7.14. Phục vụ cover art & ảnh nghệ sĩ (resize)

- **FR-MUS-094 (cover):** `GET /api/covers/{id}`. `yt:<11-char>` → cache `{coversDir}/yt_{id}.jpg`, kiểm magic byte JPEG `FF D8`, singleflight fetch `i.ytimg.com/vi/{id}/{maxres→sd→hq→mq}default.jpg` (8s), fail → **503 no-store**, success → 7 ngày. hexID → `serveResizedImage`.
- **FR-MUS-095 (artist image):** `GET /api/artist-images/{id}` hexID → `serveResizedImage` từ `artistImgDir`.
- **FR-MUS-096 (resize):** `?w=` chỉ nhận whitelist **{80,200,300,400,512}**. Cache `{dir}/resized/{id}_{w}.jpg`, singleflight, không upscale, `draw.BiLinear`, JPEG **quality 75**, cache 7 ngày.

**File chính:** `handler.go` (`cover`, `artistImage`, `serveResizedImage`).

### 7.15. Resume vị trí phát & Ambient sounds

- **FR-MUS-097 (resume):** `GET/POST /api/playback/{type}/{id}` (`type ∈ track|video`) — bảng `playback_progress`, upsert. Không có bản ghi → `{position_s:0}`.
- **FR-MUS-098 (playback error log):** `POST /api/playback/error` log `[PLAYBACK_ERROR]`. Luôn 200.
- **FR-MUS-099 (ambient):** `GET /api/ambient-sounds` list file → `[{name,label}]`; `GET /api/ambient-sounds/{name}` (guard `[A-Za-z0-9_-]` chống path-traversal) serve qua `http.ServeFile`. Tách khỏi streamer nhạc.

**File chính:** `playback.go`, `postgres/playback.go`, `handler_ambient.go`.

### 7.16. Bảng tổng hợp API endpoints (domain Music)

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/search?q=` | Tìm artists+albums+tracks, accent-insensitive, min 2 ký tự |
| GET | `/api/smart-queue?track_id=&limit=` | Recommender 4-tier (mặc định 30, clamp 1–100) |
| GET | `/api/genres` `/api/genres/{genre}` | Grid thể loại / drill-down |
| GET | `/api/tracks?album_id=` | List track |
| POST | `/api/tracks/{id}/play` | Ghi 1 lượt nghe, luôn 204 |
| GET | `/api/albums?artist_id=` `/api/albums/{id}` | List / chi tiết album |
| GET | `/api/artists` `/api/artists/{id}` | List / chi tiết nghệ sĩ |
| GET | `/api/artist-images/{id}?w=` `/api/covers/{id}?w=` | Ảnh nghệ sĩ / cover (hex hoặc `yt:<id>`) |
| GET | `/stream/{id}?q=` | Stream audio (lossless / lossless-clean / 320) |
| GET | `/api/stats` `/api/stats/plays?days=` | Kích cỡ thư viện / top 10 + histogram |
| GET | `/api/ai/music-insight` | Blurb AI top-5 |
| GET/POST/DELETE | `/api/lyrics/{id}` | Lyrics / ghi / xoá cache |
| GET | `/api/lyrics/{id}/translate?lang=` `/api/lyrics/detect-language` | Dịch / phát hiện ngôn ngữ |
| GET/POST/DELETE | `/api/lastfm/{status,login,disconnect,now-playing,scrobble,backfill-play-counts}` | Last.fm |
| GET/POST | `/api/playback/{type}/{id}` `/api/playback/error` | Resume / log lỗi |
| GET | `/api/ambient-sounds` `/api/ambient-sounds/{name}` | Âm thanh nền |
| POST | `/api/scan` | Quét thư viện |
| GET/POST | `/api/youtube/{search,channel,download,stream/{id}}` | (adjacent) YouTube |

### 7.17. Data model touchpoints

`artists` (`id`, `name`, `image_path`, DO NOTHING); `albums` (`id`, `artist_id`, `title`, `year`, `cover_path`, ghi một lần); `tracks` (`id`, `album_id`, `title`, `track_num`, `file_path`, `genre`, `duration_s`, `lastfm_backfill_count`, upsert toàn cột + CASE guard duration); `track_plays` (`id`, `track_id`, `played_at`, append-only); `lyrics_cache`; `lyrics_translations`; `playback_progress`; `settings` (keys `lastfm_session_key`, `lastfm_username`, `music_insight_cache`). Index: `pg_trgm` GIN trên cột thô + `f_unaccent(col)`; `idx_albums_artist_id`, `idx_tracks_genre` (partial), `idx_track_plays_*`.

### 7.18. Yêu cầu phi chức năng (thể hiện trong code)

- **Reliability — không bao giờ gián đoạn phát:** `recordPlay` luôn 204; transcode fail chỉ log/đếm; scanner bỏ qua file lỗi; insight/search degrade im lặng.
- **Performance:** cache HTTP phân tầng (search 30s, list 300s, stats 60s, cover 7 ngày, stream lossless 3600s); SmartQueue tránh `ORDER BY CASE` bằng 4 query có index; trigram GIN; singleflight resize/YT cover; gapless qua cache; preload 30s.
- **Rate-limit bên thứ ba:** backfill Last.fm 250ms/track; Deezer 350ms/artist; client Last.fm timeout 10s; lyrics providers 6–8s song song.
- **Observability:** metrics `SearchesTotal`, `SmartQueueTotal`, `StreamsTotal{quality}`, `StreamErrorsTotal{quality,reason}`, `NowPlayingTotal`, `ScrobblesTotal`, `LyricsTotal{cached}`. Correlation id chỉ trong log.
- **Resilience client:** fallback lossless→clean→320 + retry 3×@800ms; recovery `visibilitychange`; offline store bypass network; iOS bỏ Web Audio.

## Chương 8 — Domain: Phim & Video (Video Streaming)

Domain Video là hệ thống streaming phim homelab single-tenant, xây trên nguyên tắc "transcode khi cần" (on-demand HLS) với ffmpeg. Backend đã hiện thực khá đầy đủ (direct-play, HLS transcode, trickplay, poster TMDb, resume progress), nhưng **frontend hiện chỉ dùng một phần nhỏ**: `VideoPlayerPage` chỉ phát qua HLS và bỏ trống nhiều năng lực backend (direct-play thông minh, trickplay scrubbing, resume). Phần này ghi rõ đâu là năng lực đã wired end-to-end, đâu là backend-ready nhưng chưa nối UI.

### 8.1. Thư viện phim (Video Library)

**User flow:** `/videos` → `GET /api/videos` → nhóm theo `group_name` (thư mục cha) → click thẻ → `/video/:id`.

- **FR-VID-001** Quét `FILMS_PATH` (mặc định `/films`) đệ quy, nhận file `.mp4/.mkv/.ts/.avi` vào bảng `videos`.
- **FR-VID-002** ID = 8 hex đầu SHA-256(đường dẫn file) — ổn định theo path.
- **FR-VID-003** Title = tên file bỏ mở rộng; `group_name` = thư mục cha.
- **FR-VID-004** Danh sách sort `title ASC`.
- **FR-VID-005** Quét idempotent qua `INSERT ... ON CONFLICT(id) DO UPDATE`.
- **FR-VID-006** Frontend lưới poster nhóm theo `group_name`; empty state "Thả poster phim của bạn vào đây".
- **FR-VID-007** Lọc client-side theo `?q=` (title, không phân biệt hoa thường).

**Gotcha:** **Duration luôn = 0** — scanner set cứng `DurationS: 0`, KHÔNG chạy ffprobe cho video. Hệ quả: UI không hiển thị thời lượng và trickplay `count` luôn = 0. `file_path` KHÔNG expose ra JSON.

**EC:** File lỗi đọc → `WalkDir` bỏ qua. Danh sách rỗng → `[]` (không null).

**File chính:** `library/video_scanner.go`, `repository/postgres/video.go`, `VideosPage.tsx`, `GET /api/videos`.

### 8.2. Direct Play (phát file trực tiếp có Range) — backend-ready, chưa nối UI

- **FR-VID-010** `GET /stream-video/{id}` phục vụ file gốc với Range đầy đủ (`http.ServeContent`).
- **FR-VID-011** `smartStream` quyết định direct-play: `.mp4/.m4v` → luôn direct; `.mkv/.webm` → direct nếu UA chứa "chrome"/"firefox"; còn lại → HLS.
- **FR-VID-012** `smartStream` redirect 302 tới `/stream-video/{id}` hoặc `/hls/{id}/index.m3u8`.

**GAP:** `VideoPlayerPage.tsx` KHÔNG gọi `smartStream`/`/stream-video/` — luôn phát HLS. Toàn bộ direct-play là dead code từ góc nhìn UI. `ToFragmentedMP4` (remux fMP4) cũng chưa route.

**File chính:** `api/video.go`, `transcode/device.go`, `transcode/transcode.go`.

### 8.3. HLS Streaming (transcode on-demand) — đường phát chính

**User flow:** `/video/:id` → `hls.js` `loadSource('/hls/{id}/index.m3u8')` (Safari native). Backend `serveHLS`: `index.m3u8` → `EnsureReady` khởi động ffmpeg + block tới khi playlist xuất hiện; segment `.ts` → chờ file ghi ra đĩa.

- **FR-VID-020** `GET /hls/{id}/{file}` chỉ chấp nhận `file` khớp `^(index\.m3u8|\d{5}\.ts)$` — chống path traversal.
- **FR-VID-021** Yêu cầu `index.m3u8` → khởi động ffmpeg nếu chưa có + block tới khi segment đầu xuất hiện; không được → 503.
- **FR-VID-022** ffmpeg: `-c:v copy` (không re-encode video), `-c:a aac -b:a 192k`, `-hls_time 4`, `-hls_list_size 0` (VOD), `-hls_flags independent_segments`, segment `%05d.ts`.
- **FR-VID-023** `index.m3u8` → `application/vnd.apple.mpegurl` + `no-cache`. Segment → `video/mp2t`.
- **FR-VID-024** Segment request chờ file xuất hiện (poll 300ms) thay vì 404 ngay — hỗ trợ phát khi transcode đang chạy.
- **FR-VID-025** Job đã hoàn tất (playlist có `#EXT-X-ENDLIST`) tái sử dụng từ đĩa, KHÔNG chạy lại ffmpeg.
- **FR-VID-026** Manager dedupe: mỗi video id tối đa 1 job ffmpeg (map `running` + mutex).

**Business rules:**
- Job treo >3h bị watcher kill (tick 30s); mỗi ffmpeg hard-timeout 2h.
- Waiter không leak: `ready` channel close ở `defer` → job fail trả 503.
- `-c:v copy`: codec video gốc (HEVC/H265) trình duyệt không giải mã được thì HLS fail phía client dù transcode "thành công" — hệ thống KHÔNG transcode video sang H264.

**EC:** File hỏng → ffmpeg treo → bị kill bởi timeout; waiter nhận 503. Client disconnect → hủy chờ (`r.Context()`), ffmpeg job chạy trên `context.Background()` vẫn chạy nền tới xong (cache cho lần sau).

**File chính:** `hls/manager.go`, `api/video.go` (`serveHLS`), `VideoPlayerPage.tsx`.

### 8.4. Poster / Artwork phim

- **FR-VID-030** Có `TMDB_API_KEY` → chạy nền lúc khởi động, tìm poster TMDb cho video chưa có, tải về `VIDEO_POSTER_DIR/{id}.jpg`, cập nhật `poster_path`.
- **FR-VID-031** TMDb rate-limit ~2 req/s (sleep 500ms), ảnh `w500`, lấy kết quả đầu.
- **FR-VID-032** `GET /api/video-posters/{id}` phục vụ `{id}.jpg`; nếu chưa có → sinh bằng ffmpeg trích 1 frame tại `00:00:10`, scale `800:-1`, `-q:v 2`.
- **FR-VID-033** Frontend `<img loading="lazy">`, fallback SVG khi lỗi.

**Gotcha:** Poster TMDb và fallback ffmpeg dùng CÙNG path. Fallback KHÔNG gọi `SetPosterPath` nên `poster_url` rỗng, frontend cứ trỏ `/api/video-posters/{id}` (endpoint tự sinh khi được gọi) → mọi phim luôn có ảnh (ít nhất frame @10s).

**File chính:** `enricher/tmdb.go`, `api/video.go` (`videoPoster`).

### 8.5. Trickplay / Thumbnail scrubbing (sprite sheet) — backend-ready, chưa nối UI

- **FR-VID-040** `GET /api/trickplay/{id}` trả metadata: `interval_s=10`, `cols=10`, `frame_width=160`, `frame_height=90`.
- **FR-VID-041** Nếu chưa ready → sinh sprite nền (goroutine), set `trickplay_ready=1` khi xong.
- **FR-VID-042** Sprite ffmpeg: `fps=1/10`, scale `160x90`, tile `10x999`, xuất 1 PNG.
- **FR-VID-043** `GET /api/trickplay/{id}/sprite` phục vụ PNG (`max-age=86400`).

**Gotcha:** `count = ceil(DurationS / interval)` mà `DurationS` luôn 0 → `count: 0` dù sprite đã sinh. **GAP:** `VideoPlayerPage.tsx` KHÔNG gọi trickplay — không có UI preview khi tua.

**File chính:** `api/trickplay.go`, `transcode/trickplay.go`.

### 8.6. Resume progress — backend-ready, chưa nối UI video

- **FR-VID-050** `POST /api/playback/progress` chấp nhận `item_type ∈ {track, video}` — upsert `playback_progress`.
- **FR-VID-051** `GET /api/playback/progress/{type}/{id}` trả vị trí (hoặc `position_s=0`).
- **FR-VID-052** `item_id` validate hexID; type sai → 400.

**GAP:** `VideoPlayerPage.tsx` KHÔNG lưu/khôi phục vị trí — video luôn phát từ đầu. Backend đã sẵn sàng nhận `item_type="video"`.

### 8.7. Trình phát video (VideoPlayerPage)

- **FR-VID-060** `/video/:id` khởi tạo `hls.js` nạp `/hls/{id}/index.m3u8`; Safari native set `video.src`.
- **FR-VID-061** Hủy hls.js khi unmount.
- **FR-VID-062** Nút Back về `/videos` + controls native `<video controls autoPlay>`.

**Gotcha:** Không chọn chất lượng/bitrate (HLS single-rendition, không master playlist đa bitrate). Không phụ đề/subtitle ở bất kỳ tầng nào. Seek dựa controls native, không preview thumbnail.

### 8.8. Chưa có / Placeholder (ghi rõ để tránh nhầm)

- **Phụ đề (subtitle/CC):** KHÔNG có ở mọi tầng.
- **Adaptive bitrate thật:** KHÔNG (HLS single-rendition).
- **Direct-play / Trickplay / Resume trên UI:** backend có nhưng UI không dùng.
- **Duration video:** không ffprobe → luôn 0.
- **`ToFragmentedMP4`:** code có nhưng chưa route.
- **Quản lý thư viện (xoá/sửa metadata video):** KHÔNG có endpoint mutation ngoài scan + poster/trickplay flags.

### Endpoint API (Video) & Data model

| Method | Path | Wired UI? |
|---|---|---|
| GET | `/api/videos` | Có |
| GET | `/stream-video/{id}` | Không |
| GET | `/api/videos/{id}/stream` (smartStream) | Không |
| GET | `/hls/{id}/{file}` | Có (đường chính) |
| GET | `/api/video-posters/{id}` | Có |
| GET | `/api/trickplay/{id}` + `/sprite` | Không |
| GET/POST | `/api/playback/progress[...]` (type=video) | Không |

Data model: `videos` (`id`, `title`, `duration_s` luôn 0, `size_bytes`, `file_path`, `trickplay_ready`, `poster_path`); `playback_progress` (dùng chung track/video).

### NFR (Video)

- **Transcode perf:** HLS bắt đầu phát ngay khi segment đầu (4s) ghi ra đĩa (progressive, poll 300ms); `-c:v copy` giảm tải CPU; mỗi video 1 job ffmpeg; output cache đĩa; hard-timeout 2h + watcher kill >3h.
- **Streaming reliability:** waiter luôn được đánh thức (channel close defer); filename validate regex; client disconnect hủy chờ nhưng transcode nền tiếp tục để hoàn tất cache.
- **Storage:** HLS_DIR `/data/hls`, TRICKPLAY_DIR, VIDEO_POSTER_DIR, TRANSCODE_CACHE_DIR trên volume bền. Transcode **audio** cache tự dọn LRU-by-mtime khi vượt `TRANSCODE_CACHE_MAX_MB` (5000MB), chạy 1h (singleflight dedupe đã fix bug "chunk loopback" git `3ceb933` — KHÔNG đổi cơ chế cache khi chưa đọc lịch sử). **HLS output và trickplay/poster hiện KHÔNG có cleanup tự động** — chỉ audio cache có.

## Chương 9 — Domain: Sách điện tử & Truyện tranh (Reader)

Domain gồm ba mảng độc lập về nguồn dữ liệu nhưng chung triết lý "đọc tại chỗ": (1) **Ebook library & reader** đọc EPUB/PDF quét từ ổ local; (2) **Comics/Manga browser** tra cứu online qua scraper 2 nguồn ngoài (MangaDex, E-Hentai); (3) **Comics downloader** kéo gallery/chapter về đĩa đọc offline. Single-tenant, mọi trạng thái NSFW/collection/progress dùng chung một "chủ nhà".

### 9.1. Thư viện Ebook (Bookshelf)

**User flow:** `/ebooks` → lưới bìa → lọc Collection / NSFW → click mở reader.

- **FR-EB-001** Quét đệ quy `EbooksPath` (mặc định `F:\Ebooks`), nhận `.epub`/`.pdf`, upsert `ebooks`. ID = `sha256(filepath)[:4 bytes]` (8 hex chars).
- **FR-EB-002** EPUB: trích metadata từ OPF (`<dc:title>`, `<dc:creator>`, cover). Bìa lưu `coversDir/{id}.jpg`, phục vụ `/api/ebook-covers/{id}`.
- **FR-EB-003** PDF: bìa sinh bằng `pdftoppm` (trang 1 → JPEG). Không có → UI dùng SVG fallback.
- **FR-EB-004** Không có collection thủ công → gán collection = tên thư mục cha.
- **FR-EB-005** Re-scan giữ nguyên `IsNSFW` và `Collection` đã set (đọc `existing` trước khi upsert).
- **FR-EB-006** UI lọc Collection (dropdown distinct) + NSFW (`Family Friendly`/`NSFW Only`/`All Content`) + `?q=` (substring title). Mặc định `clean`.
- **FR-EB-007** Toggle NSFW từng ebook (🔞, cần password) và sửa collection (📁, prompt).
- **FR-EB-008** Hiển thị số item sau lọc, badge format/NSFW/collection; bìa NSFW blur (`nsfw-blur`).

**Business rules / gotchas:**
- **Mật khẩu NSFW hardcoded `owner712002`** ở CẢ frontend (so sánh trực tiếp) và backend (`setEbookNSFW` từ chối nếu `password != "owner712002"`). Lưu `localStorage['ebook-nsfw-pass']`.
- API `GET /api/ebooks` trả TẤT CẢ ebook (kể cả NSFW) không cần auth — che giấu chỉ ở client.
- ID 8-hex-char → **rủi ro collision** trên thư viện lớn; đổi tên/di chuyển file = đổi ID = mất progress/NSFW/collection.
- EPUB metadata parse bằng **regex trên OPF**, không phải XML parser.

**File chính:** `library/ebook_scanner.go`, `api/ebook.go`, `usecase/ebook.go`, `EbooksPage.tsx`.

### 9.2. Ebook Reader (EPUB + PDF)

**User flow:** click ebook → reader tải trang + ToC → đọc paged (tap 2 mép) hoặc scroll → chỉnh theme/font → tiến độ tự lưu.

- **FR-RD-001** EPUB: parse spine từ `container.xml` → OPF; `GET /api/ebooks/{id}/pages` = mảng `{index, type}` (`type` = `"image"` fixed-layout/image-only, hoặc `"html"` reflowable).
- **FR-RD-002** Nhận diện image: có `<meta viewport width=N>` HOẶC body chỉ chứa `<img>`/`<image>` không text. Image → serve bytes ảnh embed; html → serve `<body>` inner với `<img src>` rewrite thành `/api/ebooks/{id}/asset?path=...`.
- **FR-RD-003** `GET /api/ebooks/{id}/page/{n}` trả nội dung 1 trang (cache 1h). `GET /api/ebooks/{id}/asset?path=` serve asset trong zip (cache 1h).
- **FR-RD-004** ToC: `GET /api/ebooks/{id}/toc` parse EPUB3 nav trước, fallback EPUB2 NCX; map href → spine index. `[]` nếu không có.
- **FR-RD-005** PDF: `GET /api/ebooks/{id}/content` serve file gốc, render react-pdf (worker từ CDN unpkg). Scroll giới hạn 50 trang; paged render 1 trang.
- **FR-RD-006** Điều hướng paged: 2 tap-zone (trái lùi, phải tiến) + indicator; page mode có phím mũi tên.
- **FR-RD-007** Lưu tiến độ `POST /api/ebooks/{id}/progress` = spine index (EPUB) hoặc số trang (PDF). Mở lại seek về vị trí (nếu hợp lệ).
- **FR-RD-008** Settings localStorage: `reader-theme` (light/dark/sepia, **global**), `reader-font-size` (80–200%, global), `reader-desktop` (wide, global), `epub-mode-{id}` (paged/scroll, **per-book**).

**Gotchas:** Reader lấy metadata bằng `fetch('/api/ebooks')` rồi `find(id)` — **tải cả thư viện** để lấy 1 cuốn. EPUB parse hoàn toàn bằng regex. `fontSize` chỉ áp trang HTML. Progress EPUB là **spine index** (không phải CFI). PDF worker phụ thuộc CDN `unpkg.com` → mất mạng ngoài = PDF không render.

**File chính:** `api/ebook_pages.go`, `api/ebook.go`, `EbookReaderPage.tsx`.

### 9.3. Comics/Manga Browser (Scraper 2 nguồn)

**User flow:** chọn nguồn (md/eh) → gõ từ khoá → grid → click title → panel chi tiết → Start Reading → overlay reader (scroll/page).

- **FR-CB-001 (MangaDex search):** `GET /api/scraper/md/search?q=` gọi MangaDex API (limit 20), lọc `contentRating` = safe+suggestive. Title ưu tiên vi→en, cover 256px.
- **FR-CB-002 (MD latest):** `GET /api/scraper/md/latest` = 20 mới nhất; cover qua `/at-home/server`, proxy `/api/scraper/md/img`. Cache in-memory 10 phút.
- **FR-CB-003 (MD chapters/pages):** `GET /api/scraper/md/chapters/{id}` (limit 100, lang vi+en). `GET /api/scraper/md/pages/{id}` từ `/at-home/server`, cache in-memory 1h.
- **FR-CB-004 (MD img proxy):** `GET /api/scraper/md/img?url=` proxy ảnh (chỉ `image/*`), cache 600s.
- **FR-CB-005 (EH latest):** `GET /api/scraper/eh/latest` scrape homepage EH (regex), cache 30 phút.
- **FR-CB-006 (EH search):** `GET /api/scraper/eh/search?q=&page=` scrape `?f_search=`, parse `<tr>` bằng regex. **Cache Postgres 6h**.
- **FR-CB-007 (EH detail):** `GET /api/scraper/eh/detail?url=` ưu tiên **JSON API** `api.e-hentai.org` (method `gdata`, rate 5s/req), fallback scrape HTML. **Cache Postgres 24h**.
- **FR-CB-008 (EH pages):** `GET /api/scraper/eh/pages?url=` trả link page-viewer. **Cache Postgres 24h**.
- **FR-CB-009 (EH image):** `GET /api/scraper/eh/image?url=` proxy ảnh; nếu url page-viewer, tự extract ảnh thật. Cache 86400s.
- **FR-CB-010 (Reader overlay):** scroll (lazy) hoặc page (1 ảnh + phím + ESC). Nếu tất cả ảnh fail → gợi ý "tải về đọc offline".

**Business rules / gotchas:**
- **Nguồn EH khoá sau mật khẩu `owner712002`** (prompt khi đổi tab sang `eh`).
- **Fetch ảnh/HTML ngoài PHẢI đi qua `cloakProxyURL`** (`EHCachedHandler`). **GOTCHA:** endpoint đọc-online `sc.ehImage` (trong `scraper.go`, `ScraperHandlers`) lại gọi **HTTP trực tiếp** bằng `ehState.client`, KHÔNG qua cloak — chỉ luồng downloader mới qua cloak. Điểm lệch có thể lộ IP khi đọc online EH.
- **Ba implementation EH song song:** `scraper.go` (HTTP trực tiếp + rate limiter + ban tracking), `eh_cached.go` (cloak + cache Postgres — cái được wire cho latest/search/detail/pages), `headless_eh.go` (chromedp — **không đăng ký route nào**, legacy/dead). Route thực: latest/search/detail/pages → cached; `eh/image` → scraper trực tiếp.
- **Rate-limit & ban tracking (EH):** `RateLimiter` 6 req/phút (HTML), 10/phút (ảnh); ban khi 403/429 hoặc >30 req/phút; ban 5–15 phút (backoff); phát hiện ban qua chuỗi HTML. EH API `gdata` 5s/req.
- MangaDex mặc định che explicit (safe+suggestive); ưu tiên vi→en.

**EC:** EH banned → 429 + thông báo. Không kết quả → empty. Ảnh EH cần session proxy — thiếu session ⇒ ảnh fail.

**File chính:** `api/scraper.go`, `eh_cached.go`, `headless_eh.go` (legacy), `repository/postgres/comics_cache.go`, `ComicsPage.tsx`.

### 9.4. Comics Downloader (đọc offline)

Background service discover bìa mới mỗi 6h và tải gallery (EH) / toàn bộ chapter (MD) về đĩa (`comicsDir`) khi user bấm Download.

- **FR-DL-001 (Discovery):** Mỗi 6h (+ 1 lần start) chạy `discoverEH` + `discoverMD` — chỉ chèn **bìa + metadata** (status `idle`), KHÔNG tự tải. `backfillMDCovers` bù bìa thiếu.
- **FR-DL-002 (Enqueue):** `POST /api/scraper/enqueue/eh/{gid}/{token}` và `POST /api/scraper/enqueue/md/{mangaId}` → `queued` rồi `go processQueue`. Bỏ qua nếu đã `done`/`downloading`/`queued`.
- **FR-DL-003 (Download EH):** lấy page-viewer qua `fetchPagesViaAPI`, extract URL ảnh thật, tải **qua cloak proxy**, rate 6/phút. Lưu `eh/{gid}/NNNN.ext`.
- **FR-DL-004 (Download MD):** paginate toàn bộ chapter (limit 100), mỗi chapter `/at-home/server`, tải ảnh CDN (referer mangadex), rate 30/phút. Lưu `md/{mangaID}/{chapterID}/NNNN.ext`.
- **FR-DL-005 (Verify):** mỗi ảnh kiểm magic bytes (JPEG/PNG/WEBP) + size ≥ 1KB; fail → xoá. 0 ảnh thành công → `failed`.
- **FR-DL-006 (Progress):** `SetProgress(downloaded, total)`; UI hiện `%`.
- **FR-DL-007 (Serve local):** `GET /api/scraper/local/{id}/{file...}` serve ảnh (cache 7 ngày). Filename luôn `.jpg` nhưng handler glob mọi extension. Chặn `..` traversal.
- **FR-DL-008 (Local chapters):** `GET /api/scraper/local/{id}/chapters` liệt kê chapter MD + số ảnh → dropdown chọn chapter khi đọc local.
- **FR-DL-009 (List/Delete/Retry):** `GET /api/scraper/downloads`; `DELETE /api/scraper/downloads/{id}` (xoá bản ghi + `LocalDir`); `POST /api/scraper/downloads/{id}/retry`.
- **FR-DL-010 (Disk limit):** `overLimit()` walk toàn `comicsDir` tính tổng size; ≥ `MaxComicsGB` (50GB) → tạm dừng queue.

**Gotchas:** Downloader không auto-tải. Start: `CleanupV1()` + `ResetDownloading()` (reset item kẹt `downloading` do restart). EH download phụ thuộc cloak proxy có EH session. ID prefix `eh_{gid}`/`md_{mangaId}`. File index 4-digit zero-pad.

**File chính:** `api/comics_downloader.go`, `repository/postgres/comics_downloads.go`, `ComicsPage.tsx`.

### Endpoint API & Data model (Reader)

**Ebook:** GET `/api/ebooks`, `/api/ebooks/{id}/{content,pages,page/{n},asset,toc}`, `/api/ebook-covers/{id}`; POST `/api/ebooks/{id}/{nsfw,progress,collection}`.
**Scraper MD:** GET `/api/scraper/md/{latest,search,chapters/{id},pages/{id},img}`.
**Scraper EH:** GET `/api/scraper/eh/{latest,search,detail,pages,image}`.
**Downloader:** GET `/api/scraper/downloads`, `/api/scraper/local/{id}/{chapters,file...}`; DELETE `/api/scraper/downloads/{id}`; POST `/api/scraper/downloads/{id}/retry`, `/api/scraper/enqueue/{eh/{gid}/{token},md/{mangaId}}`.

Data model: `ebooks` (id 8-hex, title, author, format, size_bytes, file_path, cover_url, is_nsfw, collection, progress); `comics_downloads` (id prefix, source, title, cover, token, local_dir, page_count, downloaded, status idle/queued/downloading/done/failed, error); `comics_search_cache`/`comics_gallery_cache`/`comics_chapter_cache` (TTL 6h/24h/24h); in-memory `atHomeCache` (MD 1h), `latestCache` (md 10min, eh 30min).

### NFR (Reader)

- **Scrape reliability:** Multi-layer rate limit + ban tracking EH (6/phút HTML, 10/phút ảnh, backoff 5–15 phút khi 403/429); MD API timeout 15s. Đọc online EH dựa scrape HTML nên dễ vỡ khi EH đổi layout (regex-based).
- **Ẩn danh / cloak:** Mọi fetch EH của cached + downloader phải qua `cloakProxyURL`; **cần vá lỗ hổng `sc.ehImage` gọi trực tiếp** để không lộ IP khi đọc online.
- **Cache:** Postgres (search 6h, gallery/pages 24h) + in-memory để giảm chạm nguồn ngoài → giảm nguy cơ ban.
- **Storage:** Downloader tôn trọng `MaxComicsGB` (50GB); verify magic bytes; serve local cache 7 ngày; ảnh EPUB/page cache 1h.
- **Reliability offline:** Truyện `done` đọc hoàn toàn từ file local; reset trạng thái `downloading` kẹt khi restart; retry thủ công.
- **Bảo mật nội dung:** Gating NSFW hiện chỉ password hardcoded ở client + 1 endpoint; **API list/scrape không thực sự chặn** — cần nâng ở tầng server nếu cần bảo mật thật.

## Chương 10 — Domain: Trợ lý AI (AI Assistant & MCP)

### Tổng quan

Domain AI là một **chat agent đa nhà cung cấp có khả năng gọi công cụ (agentic loop)**, cho phép điều khiển toàn bộ app bằng ngôn ngữ tự nhiên (tìm/phát nhạc, tải YouTube, quản lý playlist, xem trending, đặt lịch, bật âm nền...), kèm **bộ nhớ bền vững (agent memory)**, **ghi log + phân tích chi phí token**, và **thư viện 38 MCP tool** thực thi trực tiếp qua hàm Go. Single-tenant → state dùng scope cố định `default`/`global`.

**File chính:** `api/ai.go` (loop, provider, logging), `api/ai_providers.go` (4 adapter), `api/music_insight.go`, `mcp/registry.go` + `registry_ambient.go` (38 tool), `mcp/tool.go`, `db/db.go` (schema); FE `AIAssistantPage.tsx`, `AIStatsPage.tsx`, `ToolsPage.tsx`, `data/mcpTools.ts`.

### 10.1. Chat Assistant (agentic loop, streaming)

**User flow:** `/ai` gõ lệnh → POST `/api/ai/chat/stream` `{message, history, model, session_id, now_playing}` → backend chọn provider, inject system prompt + memory + thời gian + bài đang phát, chạy loop → UI nhận SSE `status` realtime → event cuối `{text, actions, model, provider, tokens_in/out, log_id}` → render markdown + tự thực thi action.

- **FR-AI-001** 2 endpoint: `POST /api/ai/chat` (JSON) và `/api/ai/chat/stream` (SSE, UI dùng).
- **FR-AI-002** Loop giới hạn `maxToolRounds = 25`.
- **FR-AI-003** Tool-call trong 1 vòng chạy song song, giới hạn 4 goroutine (semaphore) — không spawn 24 yt-dlp cùng lúc.
- **FR-AI-004** System prompt ép model gộp nhiều tool-call cùng loại vào MỘT lượt (batch).
- **FR-AI-005** History cắt còn tối đa 8 lượt gần nhất.
- **FR-AI-006** Tool-call nhưng text rỗng → fallback text ("Đang phát ..." / "Xong rồi!"). Không bao giờ bubble rỗng.
- **FR-AI-007** Tool result có `_frontend_action` → bóc thành `action` (type + id/title/artist/album_id/duration_s/mode/tracks) trả UI.
- **FR-AI-008** 429 → HTTP 429 (SSE: `error`) kèm thông báo tiếng Việt. UI tự retry 1 lần (2s).
- **FR-AI-009** Mỗi lượt ghi `chat_logs` (token, response_ms, session_id, tool_errors, actions), trả `log_id`.
- **FR-AI-010** SSE set `X-Accel-Buffering: no`, `Cache-Control: no-cache`.
- **FR-AI-011** `ExecutePrompt(sessionID, message, history, model)` chạy chat programmatically (Cron/Telegram).

**Gotchas:** System prompt là load-bearing (copy nguyên văn bảng markdown trending, gọi `remember()` khi học, quy tắc playlist). `_frontend_action` là quy ước ngầm — tool điều khiển player mới PHẢI trả field này + thêm nhánh `executeAction()` ở FE. `send`/`actions`/`toolErrors` chia sẻ giữa goroutine → qua mutex.

**EC:** Tool không tồn tại → `{"error":"tool X not found"}`, loop tiếp. Model 0 tool-call → thoát sớm. `safeUUID` hiện đệ quy gọi chính nó (bug tiềm ẩn cần xác nhận).

### 10.2. Multi-provider LLM & Provider Selection

- **FR-AI-020** `selectProvider(model)` theo prefix: `deepseek-*`→DeepSeek, `claude-*`→Anthropic, `gemini-*`→Gemini, else→OpenRouter.
- **FR-AI-021** `model == ""` (mặc định): ưu tiên **DeepSeek > Anthropic > Gemini > OpenRouter**; model mặc định `deepseek-v4-flash` (disableThinking).
- **FR-AI-022** Prefix trỏ provider không có key → lỗi rõ ("ANTHROPIC_API_KEY not set").
- **FR-AI-023** DeepSeek có `fallback` sang OpenRouter (`deepseek/deepseek-v4-flash:free`) khi 429/5xx/lỗi mạng.
- **FR-AI-024** OpenRouter tự thử chuỗi `openRouterFallbacks` (free→paid) khi 429/5xx, `onStatus` báo UI.
- **FR-AI-025** Interface `aiProvider`: `initMessages`, `call`, `appendAssistant`, `appendToolResults`, `ModelID`, `Provider`, `SetSystemPrompt`.
- **FR-AI-026** Adapter chuẩn hóa schema tool: Anthropic (`input_schema`), Gemini (type HOA, `function_declarations`), DeepSeek/OpenRouter (OpenAI `tools[].function`).
- **FR-AI-027** `call` trả `(text, calls, tokIn, tokOut, done, err)`; DeepSeek đọc `prompt_cache_hit_tokens`.

**Ràng buộc QUAN TRỌNG:** **Production CHỈ có `DEEPSEEK_API_KEY` và `OPENROUTER_API_KEY`** (không Anthropic/Gemini). Mọi tính năng mới PHẢI dùng `h.selectProvider("")`, TUYỆT ĐỐI KHÔNG hardcode Anthropic. HTTP client chung timeout 60s. OpenRouter luôn set `HTTP-Referer`.

### 10.3. System prompt, datetime & now-playing injection

- **FR-AI-030** `aiSystemPromptWith(np)` = prompt base + memories + "Thời gian hiện tại: YYYY-MM-DD HH:MM (UTC+7, Weekday)".
- **FR-AI-031** Nếu có bài đang phát → thêm 'Đang phát: "title" — artist (id: id)'.
- **FR-AI-032** Inject tối đa 8 memory scope `user` + 5 setting scope `app` vào prompt (không cần `recall()` mỗi câu). Toàn domain dùng UTC+7.

### 10.4. Agent Memory (bộ nhớ bền vững, ADK-style scoped state)

Bảng `agent_state` một-bảng-nhiều-scope: `user` (bền), `session` (chỉ hội thoại), `app` (toàn app). UI panel 🧠 quản lý facts scope user.

- **FR-AI-040** `remember(key, value, scope)` upsert `ON CONFLICT(scope, scope_id, key)`; scope không hợp lệ → `user`; `app` dùng `scope_id='global'`, else `default`.
- **FR-AI-041** `recall(query)` ILIKE key/value scope `user`+`app`, ≤10 fact.
- **FR-AI-042** `forget(key, scope)` xóa theo scope.
- **FR-AI-043** `GET /api/ai/memory` trả mọi fact sort updated_at desc.
- **FR-AI-044** `PUT /api/ai/memory` (import) thay TOÀN BỘ scope user/default trong 1 transaction.
- **FR-AI-045** `DELETE /api/ai/memory/{key}` chỉ xóa scope user/default.

**Gotcha:** Bảng cũ `agent_memory` đã migrate sang `agent_state`; code mới không ghi vào `agent_memory`.

### 10.5. Chat Sessions / History (rooms)

- **FR-AI-050** Client sinh `session_id` (UUID), gửi kèm mọi request.
- **FR-AI-051** `GET /api/ai/sessions` group `chat_logs` theo `session_id`, trả `{session_id, preview, last_at, turns}`, limit 50.
- **FR-AI-052** `GET /api/ai/sessions/{id}/messages` trả mọi lượt theo thời gian + actions.
- **FR-AI-053** Khôi phục session nạp lại cả `messages` (hiển thị) lẫn `history` (context), tiếp tục cùng `session_id`.

### 10.6. Markdown rendering & Trending leaderboard UI

- **FR-AI-060** Bubble render markdown (`react-markdown` + `remark-gfm`).
- **FR-AI-061** Bảng markdown (từ `get_trending`) → component `AiTable` (rank gradient, trend ▲▼, expand Stack/Flow, link GitHub).
- **FR-AI-062** Mỗi bubble hiện logo provider + badge + tên model + token ↑in ↓out.
- **FR-AI-063** Action `play_track` → `MediaCard` (cover, Phát/Prev/Next/Favorite, Smart Mix, Tải về nếu YouTube).
- **FR-AI-064** `log_id` → `ReactionBar` emoji; 👎 gọi `POST /api/ai/logs/{id}/dislike`.
- **FR-AI-065** Slash-command: gõ `/x` gợi ý từ `MCP_TOOLS`, Tab/Enter điền prompt, ghost-text autocomplete.

### 10.7. AI Stats, Logs & Cost (AIStatsPage)

- **FR-AI-070** `GET /api/ai/stats` trả: daily (30 ngày), models, providers, failures, hourly, actions, summary.
- **FR-AI-071** `GET /api/ai/logs?failed=1&limit=&offset=` phân trang.
- **FR-AI-072** `GET /api/ai/extremes` request tốn/rẻ token nhất.
- **FR-AI-073** `GET /api/ai/stats/daily` token in/out theo ngày×model.
- **FR-AI-074** `GET/PUT /api/ai/model-prices` bảng giá (`price_in/out`, `cached_in/out` per 1M). UI debounce 1s; **DB thắng localStorage** khi mount.
- **FR-AI-075** `POST /api/ai/ocr-pricing` dùng vision model qua OpenRouter (`google/gemini-2.0-flash-001`) trích bảng giá từ ảnh base64.
- **FR-AI-076** Chi phí tính client-side: `tokens/1M × price`.

**Gotchas:** `ocr-pricing` là **ngoại lệ hợp lệ duy nhất** gọi thẳng OpenRouter (cần vision model). **BUG:** UI gọi `POST /api/ai/ocr-text` nhưng **endpoint KHÔNG tồn tại backend** — OCR-text hỏng. `detectFailure` heuristic gắn `failed=1` theo tool_error hoặc cụm "không tìm thấy/không thể/xin lỗi...".

### 10.8. MCP Tool Registry — DANH SÁCH ĐẦY ĐỦ 38 TOOL

Tất cả gọi trực tiếp hàm Go của `LibraryUsecase`/DB (native, không HTTP). Đăng ký `NewRegistry`.

**Nhạc/thư viện:** `search_music`, `list_artists`, `get_artist`, `list_albums`, `list_tracks`, `scan_library`, `get_stats`.
**Player (trả `_frontend_action`):** `play_track` (verify id, fallback tìm theo title), `toggle_play`, `next_track`, `prev_track`, `set_shuffle_mode` (off/shuffle/smart), `set_repeat` (off/one/all).
**YouTube:** `search_youtube` (yt-dlp ≤8, 30s), `download_youtube` (tải audio đồng bộ, trả track_id thật, khuyến nghị batch), `play_youtube_stream` (`yt:<vid>`).
**Playlist:** `list_playlists`, `create_playlist` (trả playlist_id ≠ track_id), `add_to_playlist` (ON CONFLICT DO NOTHING), `play_playlist` (nạp queue + phát), `remove_from_playlist`, `delete_playlist`.
**Trending/Analytics:** `get_trending` (→ markdown table ≤15), `get_ai_analytics`, `get_ai_logs`, `get_ai_extremes`.
**Memory:** `remember`, `recall`, `forget`.
**Web:** `web_search` (DuckDuckGo qua **cloak proxy**), `browse_url` (fetch qua cloak, strip HTML, ≤5000 ký tự).
**System/scheduling/skill:** `create_custom_skill` (sinh file skill markdown trong `llmwiki/skills/`, cập nhật manifest), `schedule_agent_task` (cron vào `scheduled_tasks`, reload cron), `get_scheduled_tasks`, `delete_scheduled_task`.
**Ambient (trả `_frontend_action`):** `list_ambient_sounds`, `play_ambient_sound` (name + volume 0–1, mặc định 0.3), `stop_ambient_sound`.

**Business rules:** `web_search`/`browse_url` cần `CloakProxyURL`. `download_youtube` ghi `YtDownloadPath`. `search_youtube`/`download_youtube` phụ thuộc binary `yt-dlp`. `create_custom_skill` ghi filesystem pod (ephemeral nếu restart). MCP cũng expose qua `POST /mcp` và stdio. **Tool rủi ro chạy không cần xác nhận trong loop:** `download_youtube`, `delete_playlist`/`remove_from_playlist`, `schedule_agent_task`, `create_custom_skill`.

### 10.9. Music Insight (AI một-lần, không tool)

- **FR-AI-090** `GET /api/ai/music-insight` trả cache trong ngày (`settings.music_insight_cache`); nếu không, gọi `selectProvider("")` với `tools=nil`, lưu cache.
- **FR-AI-091** Degrade im lặng `{insight:""}` nếu no provider/no data/fail. **Mẫu chuẩn cho gọi model một-lần**: tái dùng `aiProvider` (không tool-loop) + cache qua `settings`.

### 10.10. Tools Gallery (ToolsPage)

- **FR-AI-100** `/tools` hiển thị catalog `MCP_TOOLS` dạng card (lọc category, search), mỗi card iframe preview lazy.
- **FR-AI-101** Modal chi tiết: flow, prompt mẫu, route UI, nút "Dùng tool này với AI" → `/ai` prompt điền sẵn.

**Gotcha:** `MCP_TOOLS` (frontend, 37 mục) viết tay TÁCH RỜI registry backend (38 tool) → thêm/xóa tool backend PHẢI cập nhật `mcpTools.ts` thủ công. `mcpTools.ts` hiện mojibake (lỗi encoding).

### Endpoint API & Data model (AI)

`POST /api/ai/chat` + `/chat/stream`; `GET /api/ai/logs`; `POST /api/ai/logs/{id}/dislike`; `GET /api/ai/sessions` + `/sessions/{id}/messages`; `GET /api/ai/stats` + `/extremes` + `/stats/daily`; `POST /api/ai/ocr-pricing`; `GET/PUT/DELETE /api/ai/memory[/{key}]`; `GET/PUT /api/ai/model-prices`; `GET /api/ai/music-insight`; `POST /mcp`. (⚠️ `POST /api/ai/ocr-text` UI gọi nhưng backend chưa implement.)

Data model: `chat_logs` (id, created_at UTC+7, model, provider, user_msg, ai_msg, actions JSON, failed, fail_reason, tokens_in/out, tool_errors JSON, response_ms, session_id, tokens_cached_in; index partial session_id != ''); `agent_state` (PK scope,scope_id,key); `agent_memory` (LEGACY); `ai_model_prices` (model PK, price_in/out, cached_in/out); `scheduled_tasks` (id, cron_expression, prompt, last_run_at); `settings` key `music_insight_cache`.

### NFR (AI)

- **Cost:** mặc định DeepSeek v4 Flash (disableThinking) + model `:free`; cắt history 8 lượt; inject memory thay `recall()`; DeepSeek prompt cache; cache music-insight theo ngày.
- **Latency:** timeout 60s/call; yt-dlp 30s; tool-call song song (≤4); SSE + status realtime; `response_ms` đo mỗi lượt.
- **Fallback & độ bền:** DeepSeek→OpenRouter free khi 429/5xx; OpenRouter duyệt 6 model fallback + retry 1s; UI retry 1 lần (2s) + nút "Thử lại"; loop chống treo `maxToolRounds=25`; không bao giờ bubble rỗng. Single-tenant: state scope cố định. TUYỆT ĐỐI không hardcode Anthropic.

## Chương 11 — Domain: Playlist, Ghi chú & Xu hướng (Social)

Ba khối độc lập về dữ liệu: (1) **Playlists**, (2) **Notes/Kanban** (kaneo-port đa board có phân quyền), (3) **GitHub Trending** (scrape + AI enrichment). Single-tenant → "quyền" là cục bộ theo tính năng.

**Ràng buộc xuyên suốt:**
- **`verifyOwnerPassword` (playlists.go:21) là bất khả xâm phạm.** Owner password `owner712002` là credential admin duy nhất cho cả playlists vĩnh viễn LẪN kanban. `verifyKanbanAccess` là **superset nghiêm ngặt** của `verifyOwnerPassword` — owner luôn vào được.
- **Local vs Permanent playlist là khái niệm cốt lõi.** Local chỉ trong `localStorage` (`cozyroom_local_playlists`), không đụng server, không cần mật khẩu. Permanent ở bảng `playlists`, mọi ghi bị `verifyOwnerPassword` chặn.
- ID sinh mới dùng `genHexID()` (8 byte hex). DB production PostgreSQL thật.

### 11.1. Playlists

#### 11.1.1. Local vs Permanent
- **FR-PL-001** Gộp local (`getLocalPlaylists()`) + permanent (`GET /api/playlists`) thành danh sách thống nhất, đánh dấu `is_local`.
- **FR-PL-002** Local lưu `localStorage['cozyroom_local_playlists']` JSON.
- **FR-PL-003** Local ID `'local_' + Date.now() + '_' + random`; Favorites local `'local_favs_' + Date.now()`.
- **FR-PL-004** Ghi permanent gửi mật khẩu qua header `X-Owner-Password` hoặc `?password=`; sai → 401.
- **FR-PL-005** FE cache mật khẩu đúng vào `sessionStorage['cozyroom_owner_password']`, xóa khi 401/412.

**Gotchas:** Local/permanent dùng chung `Playlist` type, phân nhánh bằng `is_local`. `sessionStorage` cho mật khẩu (hết phiên quên). Không có endpoint sửa nội dung local playlist.

#### 11.1.2. Favorites (nút sao)
- **FR-PL-006** Nút sao xác định "đã star" bằng track có trong bất kỳ playlist tên `"Favorites"`.
- **FR-PL-007** Chưa có "Favorites" → tạo playlist **local** "Favorites" + thêm track.
- **FR-PL-008** Có "Favorites" → toggle track vào/ra.

**Gotcha:** "Favorites" nhận diện **theo tên chuỗi cứng**; trùng tên local+perm → chọn cái đầu tiên `find()` (local trước).

#### 11.1.3. Trang chi tiết playlist
- **FR-PL-009** `GET /api/playlists` trả kèm `cover_ids` (≤4 album cover theo `MIN(position)`) và `track_ids` (theo `position ASC`).
- **FR-PL-010** Mosaic: <4 bìa → 1 bìa full; ≥4 → 2x2; 0 → placeholder gradient hash theo tên.
- **FR-PL-011** Track permanent từ `GET /api/playlists/{id}/tracks` (refetch 3s); local resolve client-side map `track_ids` với `fetchTracks('')`.
- **FR-PL-012** Đổi tên inline: local → localStorage; permanent → `PATCH /api/playlists/{id}` + mật khẩu.
- **FR-PL-013** Xóa: local → confirm; permanent → modal mật khẩu → `DELETE /api/playlists/{id}`.
- **FR-PL-014** Phát toàn bộ: `play(tracks[0], tracks)` nạp queue.
- **FR-PL-015** Tải offline từng track: fetch `/stream/{id}?q=320` → IndexedDB (`saveOfflineTrack`), quota đầy → toast.

**Gotchas:** Poll 3s cả list playlist lẫn track perm (đồng bộ khi thao tác từ FavoritePill tab khác). `useDominantColor` đọc pixel canvas. Backend `addTrackToPlaylist` verify track tồn tại + idempotent (`position` = MAX+1). Xóa perm: xóa `playlist_tracks` thủ công trước (không FK cascade).

**File chính:** `PlaylistsPage.tsx`, `FavoritePill.tsx`, `offlineStore.ts`, `api/playlists.go`.

### 11.2. Notes / Kanban (kaneo-port, đa board, phân quyền)

> Roadmap kaneo-port 17-module đang triển khai. KHÔNG đụng `verifyOwnerPassword`; handler mới phải qua `verifyKanbanAccess` + `hasPermission` fail-closed.

#### 11.2.1. Hệ auth kép
Kanban có hệ auth riêng kiểu Gitea: đăng ký → owner duyệt → session token. Owner password vẫn là "chìa vạn năng".

- **FR-KB-001** `verifyKanbanAccess` trả `IsOwner:true` nếu owner password đúng; nếu không, xác thực session `X-Kanban-Session` (chưa hết `expires_at` + user `approved`).
- **FR-KB-002** Đăng ký hash bcrypt; username 3–32, password ≥6. Username `rejected` được đăng ký lại.
- **FR-KB-003** Session TTL 30 ngày; token 32 byte hex.
- **FR-KB-004** Màu avatar sinh **tất định từ username** (8 màu cố định).
- **FR-KB-005** Duyệt/từ chối/list pending CHỈ owner password (dùng `verifyOwnerPassword` trực tiếp, KHÔNG `verifyKanbanAccess`) — approved user không duyệt được người khác.
- **FR-KB-006** Khi duyệt, gán ngay membership `(board, user)→role` (mặc định `member` board `default`).

**Gotcha:** Owner password key `cozyroom_owner_password` **dùng chung với playlists** — vào kanban bằng owner cũng mở khóa perm playlist cùng phiên.

#### 11.2.2. RBAC per-board (fail-closed)
- **FR-KB-007** `hasPermission(db, identity, boardID, resource, action)`: owner → true; else tra `kanban_board_members ⋈ kanban_roles`, parse JSON `permissions`. **Fail-closed:** thiếu membership/role lạ/JSON hỏng → DENY.
- **FR-KB-008** Resource×action: `board`/`column`/`label` × CRUD, `note` × CRUD+**assign**, `comment` × CRUD. 4 role hệ thống (owner/admin=full, member=full note+comment nhưng read board/column/label, viewer=read).
- **FR-KB-009** Board mới seed 4 role + 3 cột mặc định; người tạo (không phải owner) gán `admin` trên board đó.

**EC:** Board `default` seed role ID cố định. User approved trước module role được backfill `member` trên board default.

#### 11.2.3. Boards, Columns, Labels
- **FR-KB-010** CRUD board `/api/boards*`. Tạo: bất kỳ identity xác thực. Sửa/xóa cần `board:update`/`delete`.
- **FR-KB-011** **Xóa board bị chặn nếu còn note** (409); check quyền TRƯỚC check note.
- **FR-KB-012** Xóa board cascade labels/columns/members/roles.
- **FR-KB-013** CRUD column `/api/boards/{id}/columns*`; **xóa column bị chặn nếu còn note** (409).
- **FR-KB-014** CRUD label; xóa label cascade `kanban_note_labels` (mất tag, không mất task).
- **FR-KB-015** `upsertMember` cấp/đổi role của approved user trên board, gate `board:update`.

**Gotchas:** FE đổi tên column bằng `window.prompt`. Tạo board/column clear input đồng bộ chặn double-submit.

#### 11.2.4. Notes + Subtasks + Comments
- **FR-KB-016** `GET /api/notes?board_id=` trả note kèm `label_ids` (N+1 chủ đích) + tiến độ subtask (`COUNT(*) FILTER (WHERE done=1)`).
- **FR-KB-017** Tạo/sửa/xóa note cần `note:create/update/delete`. `position` = MAX+1.
- **FR-KB-018** `validColumnInBoard` xác nhận `column_id` thuộc `board_id` trước khi ghi (chống hỏng chéo board).
- **FR-KB-019** `updateNote` đa năng: sửa field + di chuyển cột/board/position + thay label (`replaceNoteLabels` delete-all-then-insert).
- **FR-KB-020** Xóa note cascade `kanban_note_labels`/`subtasks`/`comments`.
- **FR-KB-021** Subtask CRUD gate `note:update` của board chứa note.
- **FR-KB-022** Comment CRUD; **tác giả = identity đã xác thực, KHÔNG lấy tên client gửi** (chống mạo danh).
- **FR-KB-023** Priority: `''`/`low`/`medium`/`high`. `due_date` epoch giây; badge "quá hạn" khi `due_date*1000 < Date.now()`.

**Gotchas:** Move/reorder gọi `updateNote` lặp từng note (`persistColumnOrder`). Kéo-thả chỉ chuyển cột (thêm cuối cột đích). Legacy `column_key` giữ (nullable) backfill sang `column_id`.

**File chính:** `api/notes.go`, `api/boards.go`, `api/auth_kanban.go`, `NotesPage.tsx`.

### 11.3. GitHub Trending (scrape + AI enrichment + dashboard)

#### 11.3.1. Thu thập & làm giàu
- **FR-TR-001** `FetchTrendingRepos` scrape github.com/trending (ưu tiên cloak proxy rồi HTTP trực tiếp); parse `article.Box-row`; **fail nếu <10 repo** (coi là đổi layout).
- **FR-TR-002** Topic per-repo qua GitHub API (sleep 50ms); lịch sử sao backfill 7 ngày.
- **FR-TR-003** Làm giàu AI (Gemini keys + OpenRouter): model trả **đúng 5 dòng** Solved/Technology/Flow (tiếng Việt ≤10-12 từ, cấm CJK)/Impact (1-10)/Label (`transformative|significant|incremental|niche`), ghi `trending_daily`. Điểm clamp ≤10.
- **FR-TR-004** Refresh khóa `atomic.Bool running` → 409 nếu đang chạy; enrichment thêm **lease DB** (`enrich_lease`, TTL 2h) — chỉ 1 pod enrich.
- **FR-TR-005** `POST /api/trending/enrich` (forceEnrich) bỏ qua lease.

**Gotchas:** **Không có "AI dedup" riêng** — chống trùng dựa **khóa chính DB** (`trending_repos.id` = repo path, `trending_daily` PK `(repo_id, date)`). Refresh không yêu cầu auth (single-tenant).

#### 11.3.2. Tier & hiển thị (grid + chart)
- **FR-TR-006** `getTier(repo)` ưu tiên `impact_label`; else suy từ `impact_score`: ≥8 transformative, ≥6 significant, ≥4 incremental, ≥1 niche.
- **FR-TR-007** `GET /api/trending?date=` trả repo của ngày (mặc định mới nhất), sort `impact_score DESC, star_delta DESC, stars DESC`; `star_delta = GREATEST(0, stars − sao mẫu sớm nhất)`.
- **FR-TR-008** `GET /api/trending/dates`; `GET /api/trending/history?id=` cho sparkline.
- **FR-TR-009** Chế độ xem lưu `localStorage['trending-view-mode']` (chart|grid, mặc định chart). Grid: repo đầu hero.
- **FR-TR-010** TrendingPage đồng bộ 2 chiều với **RadialNav qua CustomEvent** (`trending-mode-changed`/`-refresh-status`/`-data-loaded` phát; `trending-set-mode`/`-refresh-trigger`/`-set-date`/`-click-chip` nghe).
- **FR-TR-011** Chart dashboard 12-cột, 9 biểu đồ (Momentum Bubble, Top Star Gains, Languages, Star Delta Distribution donut+Nightingale, Impact histogram, Growth Lines, Net Velocity, Topics treemap top-40, Impact×Language heatmap).
- **FR-TR-012** Cross-filter qua `onFilter(title, repos)`: 1 repo → `RepoPopup`; nhiều → `RepoDrawer`.
- **FR-TR-013** Màu "mono ladder" theo tier (`--chart-1/3/5/7`) + palette hash cho ngôn ngữ.
- **FR-TR-014** Treemap so kỳ trước (`prevRepos` = ngày liền trước) hiển thị delta %.
- **FR-TR-015** RepoCard: owner/name, tier badge+emoji+điểm/10, stars+delta, language+topic, 3 dòng AI, sparkline, link github.

**Gotchas:** **Lỗi TS pre-existing `TreemapContentType`** không liên quan — KHÔNG sửa. `getTier` **định nghĩa trùng** ở TrendingRepoCard.tsx (export) và TrendingChartMode.tsx (nội bộ) — đổi ngưỡng phải sửa CẢ HAI.

**File chính:** `api/trending.go`, `enricher/{github.go,aitrends.go}`, `TrendingPage.tsx`, `TrendingChartMode.tsx`, `TrendingRepoCard.tsx`.

### Endpoint API & Data model (Social)

**Playlists** (ghi cần password): GET `/api/playlists` + `/{id}/tracks`; POST `/api/playlists`; PATCH/DELETE `/api/playlists/{id}`; POST/DELETE `/api/playlists/{id}/tracks[/{track_id}]`.
**Notes/Kanban** (ghi cần `verifyKanbanAccess`+`hasPermission`): `/api/notes[/{id}[/subtasks|comments]]`, `/api/boards[/{id}[/columns|labels|roles|members]]`.
**Kanban Auth:** POST `/api/kanban/{register,login,logout}`; GET `/api/kanban/users`; GET `/api/kanban/admin/pending` + POST `/admin/users/{id}/{approve,reject}` (**owner-only**).
**Trending** (không auth): GET `/api/trending?date=` + `/dates` + `/history?id=`; POST `/api/trending/{refresh,enrich}`.

Data model: `playlists`, `playlist_tracks`; `kanban_notes/boards/columns/labels/note_labels/subtasks/comments/users/sessions/roles/board_members`; `trending_repos/daily/star_history`; `enrich_lease`. (Chi tiết cột xem Chương 13.)

### NFR (Social)

- **NFR-01 Single-tenant:** Owner password hardcode là chủ ý homelab, không phải secret thật; kanban user chỉ là cộng tác nhẹ; trending endpoint công khai.
- **NFR-02 Bảo mật cục bộ:** bcrypt password; comment author từ identity (chống mạo danh); RBAC fail-closed; permission check trước business-rule check (không rò rỉ trạng thái tài nguyên).
- **NFR-03 Bất khả xâm phạm:** `verifyOwnerPassword` + tính superset của `verifyKanbanAccess` là bất biến.
- **NFR-04 Hiệu năng cá nhân:** N+1 có chủ đích (dataset nhỏ); poll 3s đủ, không websocket.
- **NFR-05 Concurrency trending:** `atomic.Bool` in-process + lease DB TTL 2h cross-pod (tự thu hồi khi pod chết).
- **NFR-06 Bền dữ liệu:** xóa board/column bị chặn khi còn note; giữ cột legacy để đảo ngược; backfill idempotent.

## Chương 12 — Frontend, Điều hướng & Trải nghiệm (UX/UI)

Chi tiết nghiệp vụ từng domain nằm ở chương domain; ở đây mô tả **màn hình, layout và tương tác** của lớp trình bày React + TypeScript.

### 12.0. Ngăn xếp & khung ứng dụng

- **Stack:** React + TypeScript, Vite, `react-router-dom` (BrowserRouter), `react-i18next`, `@tanstack/react-query`, `recharts`, `hls.js`, `react-pdf`/EPUB renderer, `vite-plugin-pwa` (Workbox).
- **Cây provider:** `BrowserRouter` → `AutoUpdateServiceWorker` → `AppRoutes`; trong `AppRoutes`: `DialogProvider` → `BgSoundsProvider` → `PlayerProvider` → `.shell`. **Player, background-sounds, dialog/toast là global** (nhạc không dừng khi chuyển trang).
- **Khung layout (`.shell`)** CSS grid: cột `--sidebar-w (220px) | 1fr`; hàng `1fr | --player-h (72px) | 0px`. `.main-wrapper` chứa `InstallBanner` + `Header` + `<main class="main">` cuộn nội bộ. `PlayerBar`, `MobileSearchBar`, `MobileNav`, `RadialNav` là con trực tiếp của `.shell`, luôn mounted.
- **File chính:** `AppRoutes.tsx`, `App.tsx`, `components/{Sidebar,Header,RadialNav,PlayerBar,MobileNav,MobileSearchBar,InstallBanner}.tsx`, `{Player,BgSounds,Dialog}Context.tsx`, `index.css` (~5.6k dòng), `vite.config.ts`, `i18n/*.json`, `DESIGN.md`, `offlineStore.ts`, `useScrollRestoration.ts`.

### 12.1. Bản đồ route & màn hình

Route khai báo phẳng (không nested, không lazy-load, **không route 404 riêng**). `/` là thư viện Nghệ sĩ (không có "home" riêng). (Bảng 20 route đầy đủ xem Chương 5.)

**Ghi chú IA:** Không có auth cấp app (single-tenant). Bề mặt gated bằng owner password: playlist permanent, lyrics save, NSFW ebook/comic, `/debug`, `/notes`. Ba trang thư viện music (`/`, `/albums`, `/tracks`) liên kết chéo qua `LibraryStatsBar`. `useScrollRestoration` khôi phục cuộn per-route trên `.main` (retry qua `ResizeObserver`).

### 12.2. Mô hình điều hướng (3 mặt song song)

**a) Sidebar (desktop >900px):** cột dọc glass, thu gọn 220px↔56px (persist `sidebar-collapsed`). Brand + nhóm Library (Khám phá/Phim/Sách/Comics/Trending/Playlists/Notes/AI/Số liệu nghe/Request Log) + khối Last.fm (connected/form login) + toggle theme Dark/Light & ngôn ngữ VI/EN. Link "Artists" và "Số liệu AI" KHÔNG ở sidebar.

**b) RadialNav** — xem 12.3.

**c) MobileNav (legacy/đã tắt):** thanh nav đáy 8 icon, **đang `display:none`** ở cả desktop lẫn ≤900px (RadialNav thay thế). Component còn trong DOM — nợ kỹ thuật.

### 12.3. RadialNav — menu bong bóng kéo-thả (signature UX)

Bong bóng 48px nổi, kéo-thả tự do, hít nam châm (magnet-snap), mở sheet frosted glass lưới ô ở giữa màn hình.

**Bubble:** vị trí lưu `localStorage['radial-nav-pos']`; kéo bằng pointer events, phân biệt tap/drag ngưỡng 5px. **Magnet-snap:** thả gần (≤50px) `.player-mini-play-btn`/`.npo-play-btn` → hít vào tâm + bám real-time (rAF), tự chuyển giữa 2 nam châm tùy NPO mở/đóng. **Theo trạng thái nhạc:** có track → đĩa vinyl xoay (cover, xoay khi phát, placeholder ♪ nếu cover lỗi); không track → `CozyroomMark`. Aura glow lấy màu `coverColors`. **Tap:** không track → mở menu; đang mở + có track → toggle play/pause; đang mở + không track → đóng.

**Menu (frosted sheet, lưới ô 56px):** căn giữa viewport, tối đa 4 cột × 5 hàng, ô mở stagger. Các mode: **Main** (Artists/AI/Playlist/Sounds + star/thêm playlist nếu có track + Phim/Sách/Comics/Trending/Tìm kiếm); **Trending** (Chart/Grid/Refresh + 4 ô tier có số đếm + dải chọn ngày, giao tiếp `TrendingPage` qua custom-events); **Calendar** (vòng tháng + vòng ngày + double-tap sửa năm); **Playlist-picker** (thêm/bớt track hiện tại, permanent gated).

### 12.4. Thanh Search context-aware

- **Desktop (`Header.tsx`):** tìm trong tab hiện tại theo `pathname` (`/ebooks`,`/comics`,`/videos`,`/albums`,`/tracks` → `?q=` tới list đó; else `/search`). Debounce **300ms**, `navigate({replace:true})`, xoá query → path gốc.
- **Mobile (`MobileSearchBar.tsx`):** "search island" nổi riêng, mirror pill nhạc; luôn tìm `/search?q=` (xoá → `navigate(-1)`). Host nút toggle queue "Up Next"; guard tránh render trùng khi NPO mở.

### 12.5. Player bar & Now Playing overlay — UX/layout

**Desktop bar (`.player-full`):** Left tên bài (click bar mở NPO); Center `shuffle → prev → VinylDisc play/pause → next → repeat` + progress; Right FavoritePill/queue/✦ SMART/quality/Background Sounds.
**Mobile mini-bar (`.player-mini`):** cover + title/artist + play + next (không prev), progress "water-shimmer". Ẩn khi NPO mở.
**Now Playing Overlay (`.npo`):** full-screen, **luôn trong DOM** (toggle opacity/pointer-events → guard tránh render trùng queue-panel). Header back + tab Player/Lyrics + 3-chấm; body cover lớn + Equalizer + LyricsView; controls (queue/dịch 🌐/auto ⚡/progress/transport). Đóng: Esc / chevron / double-click. Chạm hiện controls 3s.
**Queue "Up Next" (`QueueList.tsx`):** past/current/upcoming, highlight ♫, `playFromQueue`. Mở từ NPO / player bar / mobile search island — cùng `queueOpen`.
**Toast lỗi phát:** hiện khi `playbackError` + nút đóng.

### 12.6. Background Sounds

Context global phát **âm nền lặp vô hạn** (thẻ `<audio>` riêng). Danh mục: 3 noise cố định (Balanced/Bright/Dark) + ambient từ `/api/ambient-sounds` (ambient dài random điểm bắt đầu). State persist `localStorage['bg-sounds']`. Panel mở từ RadialNav/nút loa player bar; popover glass, đóng click-outside.

### 12.7. Pattern UX xuyên suốt

- **Dialogs & Toasts (`DialogContext.tsx`):** `confirm(opts): Promise<boolean>` (modal, biến thể `danger`) + `toast(message, type)` (stack, tự ẩn 4s). Thay `window.confirm/alert`.
- **BackButton:** auto-ẩn khi cuộn xuống, hiện khi cuộn lên (bám `.main`); biến thể `overlay` cho reader/video; ghim `env(safe-area-inset)` mobile.
- **Scroll restoration:** nhớ vị trí per-route trên `.main`, retry qua `ResizeObserver`.
- **Glass/liquid ("Midnight Deck"):** mica glass token-hoá (`--glass-fill*`, `--hairline*`, `--border*`) đảo alpha theo theme; `backdrop-filter: blur(20–30px) saturate(1.8)`; aura/gradient lấy màu động từ cover; 2 orb radial-gradient trắng mờ animate nền.
- **Elevation "Light-Not-Color":** độ sâu bằng glow trắng + translateY, không bóng tối.
- **Deep-link liên domain:** Search empty→`/ai`; ToolsPage→`/ai`; AI MediaCard→điều khiển player.

### 12.8. PWA & Offline

- **Config:** `registerType: 'autoUpdate'`, SW **`sw3.js`**, `skipWaiting`+`clientsClaim` → bản mới tự kích hoạt (đôi khi tự reload — chấp nhận). Lịch sử: đổi `sw`→`sw2`→`sw3` do sự cố stale-SW/blank-page (CF override no-cache).
- **Runtime cache:** covers/artist-images StaleWhileRevalidate (1000/500 entry, 30 ngày); artists/albums/stats SWR (7 ngày); tracks/search NetworkFirst (4s); max file 4MB.
- **Manifest:** "Cozyroom", `standalone`, `portrait`, theme `#050505`, icon `icon-v3-192/512.png`. Meta iOS đầy đủ.
- **Install banner:** bắt `beforeinstallprompt`, ẩn nếu `display-mode: standalone`.
- **Offline tracks (`offlineStore.ts`):** **IndexedDB** (`cozyroom-offline`) lưu blob nhạc — **tách hoàn toàn khỏi Cache Storage/SW** (chủ ý sau sự cố blank-page). Player ưu tiên `getOfflineObjectURL` trước network; cache object-URL tránh leak; xử lý `QuotaExceededError`.
- **Media Session API:** metadata + handler play/pause/next/prev/seekto cho màn khoá OS. Không Web Audio visualizer trên iOS (giữ phát nền ổn định).

### 12.9. Đa ngôn ngữ (i18n)

`react-i18next`, 2 ngôn ngữ **vi/en**, key theo namespace (nav/ai/auth/search/trending/charts/player/lyrics/library/playlist/youtube/install/lang). Mặc định `vi` (`fallbackLng: en`), lưu `localStorage['app-language']`, đổi tức thì từ sidebar. Còn **chuỗi hardcode tiếng Việt** ở vài nơi (label "Notes", "Số liệu nghe", placeholder "Tìm trong…", aria-label RadialNav) — nợ i18n.

### 12.10. Theming (Dark/Light — monochrome "Paper White")

Design system trong **`DESIGN.md`**. **Operator console monochrome**, không màu thương hiệu.
- **Màu:** nền Void Black `#050505`, surface `#0e0e0e`, elevated `#111`, 3 bậc text opacity (.92/.55/.32). **Accent = Paper White**: `--green` **là trắng** (không xanh), luôn kèm `color:#000`. `--purple` cũng trắng (alias legacy). **Không có `--accent`** (resolve rỗng — bug đã ship).
- **Light theme:** đảo token cấu trúc (`--bg #eef0f2`, `--surface #fff`); **accent KHÔNG đảo** (giữ trắng vì nhiều nút hardcode `color:#000`). Glass đảo sang alpha đen.
- **Áp theme trước paint:** script inline `index.html` đọc `localStorage['cozyroom-theme']` set `data-theme` trước React mount (tránh flash).
- **Typography:** Display **Space Grotesk**, Body/UI **Geist**, Label/data **Geist Mono** ("Mono-Means-Machine": model name/token/timestamp/rank).
- **Charts:** palette categorical `--chart-1..8` + 4 semantic; mark đơn-series key theo `--text`. Ngoại lệ màu: tile genre duotone.

### 12.11. Responsive & Mobile (breakpoint 900px)

- **Desktop:** sidebar + top-header + player bar full-width. **Mobile (≤900px):** `.shell` 1 cột; hai thanh đáy **nổi `position:fixed`** (player-mini `--player-h: 64px` + search island `64px + safe-area`, nâng `--bottom-lift: 24px`). Sidebar ẩn, MobileNav ẩn → RadialNav + search island là nav chính. NPO mở → ẩn search island.
- **Wide-monitor scaling:** cột reading-width mở max-width theo 3 mốc 1920/2560/3840px.
- **Chống tràn ngang:** nội dung rộng cuộn container riêng; `minmax(0,1fr)` chống tràn; `.main-wrapper overflow-x:hidden`.
- Dùng `100dvh`, `overscroll-behavior: contain`. Rail A–Z ẩn ≤640px; ô lọc font 16px (tránh iOS zoom).

### 12.12. Component dùng chung

`LibraryStatsBar` (cross-nav "N artists · N albums · N tracks"), `TrendingRepoCard`, `Equalizer` (60 bar theo AnalyserNode), `LyricsView` (lyric đồng bộ + dịch, save gated), `FavoritePill` (sao + dropdown playlist), `QueueList`, `VinylDisc` (đĩa xoay + placeholder "COZYROOM HI·FI"), `Spinner` (5 chấm equalizer), `BackButton`, `CozyroomMark`, `InstallBanner`.

### 12.13. FR & NFR lớp UI

**FR:** FR-UI-01 Persistent player/queue/bg-sounds xuyên route; FR-UI-02 Radial nav kéo-thả + magnet-snap + mode; FR-UI-03 Search context-aware; FR-UI-04 NPO full-screen; FR-UI-05 Background sounds; FR-UI-06 Theme & Lang toggle (áp light trước paint); FR-UI-07 PWA install + auto-update; FR-UI-08 Offline nhạc IndexedDB; FR-UI-09 Dialog/Toast global; FR-UI-10 Scroll restoration + BackButton auto-hide; FR-UI-11 Password-gated surfaces; FR-UI-12 Responsive shell mobile.

**NFR — A11y:** focus ring toàn cục `:focus-visible` (outline 2px trắng, đè `outline:none` cũ — sửa WCAG 2.4.7); NavLink/nút có `title`+`aria-label`; queue item `role="button"`+Enter/Space; RadialNav aria-label động. **Nợ a11y:** nhiều nút icon-only, radial menu không role menu, MobileNav ẩn nhưng còn DOM, chuỗi hardcode chưa i18n.
**NFR — Performance:** cover/list SWR, search NetworkFirst 4s; `.main` cuộn nội bộ; `img loading="lazy"`; ToolsPage lazy iframe IntersectionObserver; `100dvh`; lưu ý chi phí GPU nhiều lớp `backdrop-filter`. Deploy k3s `vite build` **không tsc** → chạy `tsc --noEmit` + verify route live NodePort trước/sau deploy.
**NFR — Theming robustness:** mọi mark/chart dùng `currentColor`/`var(--text)` thay `#fff` hardcode (nếu không vô hình ở light theme).
**NFR — Resilience:** SW auto-update chấp nhận reload bất chợt; offline store tách khỏi SW cache; playback có toast lỗi + fallback chất lượng.

**Ba điểm lưu ý:** (1) **MobileNav bị ẩn hoàn toàn** — xác nhận có gỡ; (2) `/` là thư viện Nghệ sĩ, **không có home riêng** và **không có route 404**; (3) một số chuỗi vẫn **hardcode tiếng Việt** ngoài hệ i18n.

## Chương 13 — Mô hình dữ liệu hợp nhất

Toàn bộ schema định nghĩa trong `backend/internal/db/db.go` hàm `migrate()` (idempotent: `CREATE TABLE IF NOT EXISTS` + `ALTER ... ADD COLUMN IF NOT EXISTS`), engine PostgreSQL 16. Tổng ~40 bảng, nhóm theo domain.

### 13.1. Nhạc
| Bảng | Cột chính | Ghi chú |
|---|---|---|
| `artists` | id(hex16), name, image_path | upsert DO NOTHING (name không đổi sau lần đầu) |
| `albums` | id, artist_id, title, year, cover_path | cover/year ghi một lần |
| `tracks` | id, album_id, title, track_num, duration_s, file_path, genre, lastfm_backfill_count | upsert DO UPDATE + CASE guard duration |
| `track_plays` | id, track_id, played_at | append-only, index track_id + played_at |
| `lyrics_cache` | track_id(PK), results, fetched_at | chỉ cache online |
| `lyrics_translations` | (track_id,lang)(PK), lines_json, created_at | bản dịch |

### 13.2. Video & Playback
| Bảng | Cột chính | Ghi chú |
|---|---|---|
| `videos` | id, title, duration_s(luôn 0), size_bytes, file_path, trickplay_ready, poster_path | |
| `playback_progress` | (item_type,item_id)(PK), position_s, updated_at | dùng chung track/video |

### 13.3. Reader (ebook/comics)
| Bảng | Cột chính |
|---|---|
| `ebooks` | id(8-hex), title, author, format, size_bytes, file_path, cover_url, is_nsfw, collection, progress, created_at |
| `comics_cache`/`comics_galleries`/`comics_pages` | cache scrape (TTL 6h/24h/24h) |
| `comics_downloads` | id(prefix eh_/md_), source, title, cover, token, local_dir, page_count, downloaded, status, error |

### 13.4. Trending
| Bảng | Cột chính |
|---|---|
| `trending_repos` | id(=repo path), name, url, description, language, topics |
| `trending_daily` | (repo_id,date)(PK), stars, star_delta, problem_solved, tech_used, simple_flow, impact_score, impact_label |
| `trending_star_history` | (repo_id,sampled_at)(PK), stars |

### 13.5. Playlist & Kanban
| Bảng | Cột chính |
|---|---|
| `playlists` / `playlist_tracks` | id,name / (playlist_id,track_id)(PK),position,added_at |
| `kanban_notes` | id, board_id, column_id, column_key(legacy), title, content, position, priority, due_date, assigned_user_id |
| `kanban_boards` / `kanban_columns` / `kanban_labels` / `kanban_note_labels` | cấu trúc board |
| `kanban_subtasks` / `kanban_comments` | checklist / bình luận (author_user_id, author_label) |
| `kanban_users` | id, username(UNIQUE), password_hash(bcrypt), status, color | hệ auth Kanban |
| `kanban_sessions` | token(PK), user_id, expires_at |
| `kanban_roles` | id, board_id, name, permissions(JSON), is_system | RBAC per-board |
| `kanban_board_members` | (board_id,user_id)(PK), role_id |

### 13.6. AI & Hệ thống
| Bảng | Cột chính |
|---|---|
| `chat_logs` | id, created_at, model, provider, user_msg, ai_msg, actions, failed, tokens_in/out, tool_errors, response_ms, session_id, tokens_cached_in |
| `agent_state` | (scope,scope_id,key)(PK), value, updated_at | memory ADK 3 scope |
| `agent_memory` | key(PK), value | LEGACY (đã migrate) |
| `ai_model_prices` | model(PK), price_in/out, cached_in/out |
| `scheduled_tasks` | id, cron_expression, prompt, last_run_at |
| `settings` | key(PK), value | lastfm_session_key, lastfm_username, music_insight_cache |
| `enrich_lease` | key(PK), holder, expires_at | mutual-exclusion cross-pod |

### 13.7. Quy ước ID & Index
- **ID nhạc**: `id8(s) = sha256(lower(trim(s)))[:8 bytes]` = 16 hex. artistID=id8(name), albumID=id8(artistID+albumTitle), trackID=id8(path). Regex `^[0-9a-f]{16}$`.
- **ID ebook/video**: sha256(path)[:4 bytes] = 8 hex (rủi ro collision cao hơn).
- **ID social**: `genHexID()` 8 byte random.
- **Index hiệu năng**: `pg_trgm` GIN trên cột thô + `f_unaccent(col)` (search không dấu); `idx_albums_artist_id`; `idx_tracks_genre` partial `WHERE genre != ''`; `idx_track_plays_*`; `chat_logs` partial index `session_id != ''`.
- **Hàm `f_unaccent(TEXT)`**: IMMUTABLE, bảng dịch 67 ký tự dấu tiếng Việt + `đ→d` (vì `đ` không có phân rã Unicode).

---

## Chương 14 — Yêu cầu phi chức năng (NFR) xuyên suốt

### 14.1. Reliability
- **NFR-R1 — Không gián đoạn phát nhạc:** mọi lỗi phụ degrade im lặng (`recordPlay` luôn 204; transcode fail chỉ log/đếm; scanner bỏ file lỗi; music-insight/search sub-query nuốt lỗi).
- **NFR-R2 — Chống treo:** HLS job hard-timeout 2h + watcher kill >3h; AI loop `maxToolRounds=25`; waiter luôn được đánh thức (channel close defer).
- **NFR-R3 — DB dự phòng:** Postgres primary + hot standby streaming; CronJob `postgres-monitor` tự `pg_promote()` khi primary chết.

### 14.2. Performance
- **NFR-P1 — Cache phân tầng:** HTTP (search 30s, list 300s, stats 60s, cover/ảnh 7 ngày, stream lossless 3600s); SW client (SWR/NetworkFirst); CF edge cache audio lossless.
- **NFR-P2 — Index & singleflight:** GIN trgm cho `ILIKE` không dấu; SmartQueue 4 query có index (tránh `ORDER BY CASE` toàn bảng); singleflight resize ảnh/YT cover/transcode.
- **NFR-P3 — Gapless & preload:** dual-audio + preload look-ahead 30s + cache đĩa Range-seekable.
- **NFR-P4 — Pool DB:** Go 10 conn → PgBouncer 5000 client / 50 server (transaction mode).

### 14.3. Cost (AI)
Ưu tiên model rẻ/free (DeepSeek v4 Flash disableThinking, model `:free`); cắt history 8 lượt; inject memory thay `recall()`; DeepSeek prompt cache; cache music-insight theo ngày; dashboard ước tính chi phí theo bảng giá.

### 14.4. Security (single-tenant)
Owner password `owner712002` (homelab, không phải secret thật) gate ghi nhạy cảm; Kanban bcrypt + RBAC fail-closed; comment author từ identity (chống mạo danh); permission check trước business-rule check. **Gating NSFW/scrape hiện chỉ client-side** — API không thực sự chặn (cần nâng nếu muốn bảo mật thật).

### 14.5. Rate-limit & lịch sự bên thứ ba
Backfill Last.fm 250ms/track; Deezer 350ms/artist; EH scrape 6/phút HTML + 10/phút ảnh + ban tracking backoff 5–15 phút; EH gdata 5s/req; MangaDex timeout 15s; lyrics providers 6–8s song song.

### 14.6. Observability
Prometheus `/metrics` (StreamsTotal, SearchesTotal, SmartQueueTotal, StreamErrorsTotal, HTTP*, ...); path normalize `{id}` giữ cardinality thấp; correlation id chỉ trong log; 2 CronJob alert Telegram (stream health, postgres); debug endpoints owner-gated.

### 14.7. Offline & PWA
IndexedDB nhạc offline (tách khỏi SW cache); SW auto-update; runtime cache cover/list/search; Media Session cho màn khoá OS.

### 14.8. i18n & A11y
vi/en `react-i18next` (còn nợ hardcode VI); focus ring `:focus-visible` (WCAG 2.4.7); `aria-label`/`title`; nợ a11y icon-only + radial menu không role.

---

## Chương 15 — Mô hình xác thực & Bảo mật single-tenant

Cozyroom **không có hệ đăng nhập cấp app**. Có 3 lớp:

1. **Public (không auth):** đọc/nghe/xem toàn bộ media, tìm kiếm, trending, chat AI, tạo playlist **local**. Là mặc định cho Guest Listener.
2. **Owner password (`owner712002`, hardcode):** gate mọi thao tác ghi nhạy cảm — playlist permanent (tạo/sửa/xóa/thêm track), lưu lyrics, đặt NSFW ebook/comic, panel `/debug`, và **duyệt user Kanban**. Truyền qua header `X-Owner-Password` hoặc `?password=`; FE cache `sessionStorage`, re-prompt khi 401/412. `verifyOwnerPassword` (playlists.go) là **bất khả xâm phạm**.
3. **Kanban session auth (độc lập):** register → owner duyệt → session token (`X-Kanban-Session`, TTL 30 ngày) → RBAC per-board (owner/admin/member/viewer, permission JSON fail-closed). `verifyKanbanAccess` là **superset nghiêm ngặt** của owner password. Chỉ phạm vi Kanban.

**Egress ẩn danh:** scraper (EH/comics), `web_search`/`browse_url`, yt-dlp đi qua `cloak-proxy` để ẩn IP nhà. **Lỗ hổng đã biết:** `sc.ehImage` (đọc online EH) gọi HTTP trực tiếp, bỏ qua cloak — cần vá.

**Ranh giới nguy hiểm:** production DB SQLite lịch sử tại `/mnt/c/.../home-spotify/m/data/metadata.db` — tuyệt đối không đụng khi thao tác container (xem ADR-9).

---

## Chương 16 — Ràng buộc & Quyết định kiến trúc (ADR)

- **ADR-1 — Monolith có chủ đích.** Không tách microservice; đổi lại `routes.go`/`handler.go`/`db.go migrate()` là file dùng chung → thay đổi phải impact-check + chỉ thêm idempotent.
- **ADR-2 — PostgreSQL (rollback từ CockroachDB).** Prod dùng Postgres 16 + PgBouncer (`db-adapter`). `k8s/db-adapter.yaml` trên đĩa STALE (mô tả HAProxy/CockroachDB) — verify image live trước khi viết SQL đặc thù engine.
- **ADR-3 — Single-tenant, owner-password.** Không hệ user/auth cấp app; stats aggregate-only. Đơn giản đổi lấy không cá nhân hoá.
- **ADR-4 — `vite build` → `backend/dist`, deploy skip tsc.** Output frontend đổ sang backend; deploy k3s không chạy tsc → BẮT BUỘC `tsc --noEmit` thủ công + verify route live NodePort trước/sau deploy.
- **ADR-5 — SW rename để né CF cache.** File SW đổi tên (sw→sw2→sw3) vì CF override no-cache gây stale-SW blank-page.
- **ADR-6 — Offline store tách khỏi SW cache.** Nhạc offline ở IndexedDB riêng (bài học sự cố blank-page), không dùng Cache Storage.
- **ADR-7 — Ngưỡng "nghe thật" duy nhất (client-side).** `progress >= min(duration*0.5, 240) && >= 30s && duration >= 30` (BR-MUS-083) — mọi tính năng đếm nghe tái dùng, không tạo ngưỡng mới. Server `recordPlay` không có ngưỡng.
- **ADR-8 — iOS bỏ Web Audio.** `createMediaElementSource` reroute output vĩnh viễn + iOS suspend AudioContext nền → iOS không có visualizer nhưng phát nền ổn định; MediaSession vẫn chạy.
- **ADR-9 — Bảo vệ DB path sản xuất.** Trước mọi `docker compose --force-recreate`: PHẢI `docker inspect <container> | grep -A5 Mounts`, KHÔNG đổi path `./data` khi chưa backup, KHÔNG recreate khi chưa xác nhận DB path với user.
- **ADR-10 — Provider selection động.** Prod chỉ có DeepSeek/OpenRouter (+Gemini) — dùng `selectProvider("")`, KHÔNG hardcode Anthropic. Fallback tự động DeepSeek→OpenRouter, OpenRouter duyệt chuỗi free→paid.

---

## Chương 17 — Rủi ro & Nợ kỹ thuật đã biết

### 17.1. Lỗi/thiếu sót đã xác nhận
- **AI `ocr-text` hỏng:** `AIStatsPage.tsx` gọi `POST /api/ai/ocr-text` nhưng backend **chưa implement** endpoint này.
- **`safeUUID` đệ quy:** hàm fallback UUID (FE) gọi chính nó ở nhánh try → nguy cơ stack-overflow (cần xác nhận).
- **`sc.ehImage` lộ IP:** đọc online E-Hentai gọi HTTP trực tiếp, bỏ qua cloak proxy.
- **`TreemapContentType` tsc error:** lỗi type pre-existing ở `TrendingChartMode.tsx` (recharts Treemap trả null) — không chặn deploy (skip tsc), nhưng `tsc --noEmit` báo.
- **`mcpTools.ts` drift + mojibake:** catalog FE (37) viết tay tách rời registry BE (38) → phải sync thủ công; file lưu tiếng Việt lỗi encoding.
- **`getTier` định nghĩa trùng:** ở `TrendingRepoCard.tsx` (export) và `TrendingChartMode.tsx` (nội bộ) — đổi ngưỡng phải sửa cả hai.

### 17.2. Video — nhiều năng lực backend-ready nhưng chưa nối UI
Direct-play, trickplay scrubbing, resume progress đều đã có backend nhưng `VideoPlayerPage` không dùng. `duration_s` video luôn 0 (không ffprobe) → không hiển thị thời lượng, trickplay `count`=0. Không phụ đề, không adaptive bitrate thật (HLS single-rendition). `ToFragmentedMP4` chưa route.

### 17.3. Rủi ro dữ liệu & hạ tầng
- **ID collision:** ebook/video ID 4-byte (8 hex) — rủi ro trùng trên thư viện rất lớn; đổi tên/di chuyển file = đổi ID = mất progress/NSFW/collection.
- **Backend SPOF:** 1 replica, QoS BestEffort (không resource limit); node pin backend + postgres primary là điểm phụ thuộc đơn.
- **Backup:** chỉ có hot standby; **chưa có backup logical định kỳ** mã hóa trong repo.
- **Không versioned migration:** chỉ idempotent `migrate()` — khó rollback schema có chủ đích.
- **Phụ thuộc bên ngoài:** yt-dlp (YouTube), cloak proxy (scrape/web), CDN unpkg (PDF worker), scrape regex EH/GitHub dễ vỡ khi site đổi layout.
- **Deezer `http.Get` không timeout/context** (enricher artist image).

### 17.4. Nợ UX/UI
- **MobileNav** ẩn hoàn toàn nhưng còn trong DOM — cần gỡ hoặc xác nhận.
- **Không có route 404**; path lạ render trống.
- **Nợ i18n:** một số chuỗi hardcode tiếng Việt ngoài hệ i18n.
- **Nợ a11y:** nút icon-only, radial menu không role menu.
- **Owner password hardcoded** ở cả FE lẫn BE (`owner712002`) — chấp nhận cho homelab, không dùng được cho môi trường công khai thật.

---

## Chương 18 — Ngoài phạm vi & Lộ trình

### 18.1. Ngoài phạm vi (khẳng định lại)
Multi-tenant / hệ auth cấp app; tracking cá nhân hoá per-user; billing/SaaS; phân phối lại nội dung; microservice. (Xem Chương 2.3.)

### 18.2. Lộ trình gợi ý (từ nợ kỹ thuật)
- **Kanban kaneo-port:** hoàn thiện 17-module (đã ship base + RBAC per-board; còn các module nâng cao).
- **Video wiring:** nối direct-play/trickplay/resume vào UI; ffprobe duration; cân nhắc phụ đề + adaptive bitrate.
- **Vá bảo mật:** `sc.ehImage` qua cloak; cân nhắc gating NSFW/scrape ở tầng server; implement hoặc gỡ `ocr-text`.
- **Dọn nợ:** gỡ MobileNav; sync `mcpTools.ts`↔registry; sửa `safeUUID`/`getTier` trùng/`TreemapContentType`; hoàn thiện i18n.
- **Hạ tầng:** backup logical định kỳ; cân nhắc resource limit backend; ID dài hơn cho ebook/video nếu thư viện lớn.

---

## Chương 19 — Thuật ngữ (Glossary) & Phụ lục

### 19.1. Glossary
- **Single-tenant:** một chủ sở hữu duy nhất; không hệ user cấp app.
- **Owner password:** `owner712002` — credential admin duy nhất, gate ghi nhạy cảm.
- **MCP tool:** công cụ trợ lý AI gọi trực tiếp hàm Go (native), thực thi hành động thật.
- **`_frontend_action`:** quy ước ngầm để tool điều khiển trả action cho UI thực thi trên player.
- **Smart radio / smart-queue:** recommender 4-tier (cùng artist → genre chính xác → genre tương tự → random).
- **Gapless (dual-audio):** 2 phần tử Audio đổi mượt để phát liền mạch không khoảng lặng.
- **HLS on-demand:** transcode file thành segment .ts theo yêu cầu, phát progressive.
- **Cloak proxy:** egress proxy ẩn danh cho scrape/yt-dlp/web.
- **`f_unaccent`:** hàm SQL bỏ dấu tiếng Việt để search không phân biệt dấu.
- **Local vs Permanent playlist:** localStorage (client) vs server (gated password).
- **RBAC per-board (Kanban):** quyền là thuộc tính của cặp (board, user).
- **RadialNav:** bong bóng điều hướng kéo-thả kiêm nút play, mở menu lưới ô.
- **NPO:** Now Playing Overlay — màn phát nhạc full-screen.
- **Paper White:** accent trắng duy nhất (`--green`), luôn kèm chữ đen.

### 19.2. Phụ lục A — Chỉ mục nhóm FR
- **FR-MUS-001…099** — Domain Âm nhạc (Chương 7).
- **FR-VID-001…062** — Domain Video (Chương 8).
- **FR-EB / FR-RD / FR-CB / FR-DL** — Domain Reader: Ebook / Reader / Comics browser / Downloader (Chương 9).
- **FR-AI-001…101** — Domain AI (Chương 10).
- **FR-PL / FR-KB / FR-TR** — Domain Social: Playlist / Kanban / Trending (Chương 11).
- **FR-UI-01…12** — Lớp Frontend/UX (Chương 12).

### 19.3. Phụ lục B — Tài liệu liên quan
- `prd/agent-prompts.md` — prompt của 7 engineer agent đã lập PRD này.
- `DESIGN.md` — hệ thiết kế (monochrome Paper White, tokens, typography).
- `CLAUDE.md` — hướng dẫn agent + personas domain + ràng buộc DB.
- `README.md` — hướng dẫn dev/deploy + API reference tóm tắt.
- `llmwiki/wiki/` — knowledge base agent-maintained (concepts, sources, postmortems).

---

*Kết thúc PRD Cozyroom v1.0.*
