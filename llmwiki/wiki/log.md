# Operation Log

## 2026-06-18 — orca-workflow — distributed-db-citus implemented: Citus 12.1 trên 3 nodes, 2655 tracks migrated, app live trên Citus

## 2026-06-18 — harness-update — migrate xong, nợ đã backfill: 0 file (wiki sạch)

## 2026-06-18 — propose — distributed-db-citus

### Việc đã làm
- Propose kiến trúc Distributed DB dùng Citus trên 3 physical nodes
- Liệt kê 6 tiếp cận sai cần loại trừ
- Tạo `sources/draft/180626-distributed-db-citus.md` + sequence diagram HTML
- Cập nhật index.md

---

## 2026-06-18 — postmortem — sw-blank-page-cf-cache + k8s-media-images-not-served

### Việc đã làm
- Ghi lại 2 bugs đã xảy ra và cách fix:
  1. `sources/180626-sw-blank-page-cf-cache.md` — CF override nginx no-store → sw.js cached 4h → stale SW → blank page; fix: rename sw2.js
  2. `sources/180626-k8s-media-images-not-served.md` — /data/covers missing sau migrate + CoreDNS không resolve Deezer
- Cập nhật index.md

## 2026-06-17 — propose — 170626-ui-theme-consistency-all-pages

### Việc đã làm
- Audit 9 page components còn lại chưa áp purple dark theme
- Tạo `wiki/sources/draft/170626-ui-theme-consistency-all-pages.md`
- Tạo `llmwiki/html/170626-ui-theme-consistency-seq.html` (6 task diagrams)
- Chờ user duyệt trước khi implement

## 2026-06-16 — orca-workflow — 160626-db-architecture-review (implement)

### Việc đã làm
- **Task 1**: `k8s/postgres.yaml` + `k8s/postgres-standby.yaml` — đổi hostPath `/tmp/` → `/var/lib/` (fix data mất khi reboot)
- **Task 2**: `k8s/postgres-monitor.yaml` — CronJob mỗi 2 phút: check primary, auto-promote standby nếu primary down, Telegram alert
- **Task 3**: `k8s/db-adapter.yaml` — HAProxy Deployment ×2 (stateless, scalable) làm adapter giữa Backend và Postgres; backend đổi `@postgres:` → `@db-adapter:`
- **Docs**: cập nhật `wiki/draft/orca/160626-db-architecture-review.md` — sửa vị trí adapter (giữa BE và DB, không phải trước Client), diagram mũi tên, adapter là scalable k8s pod
- **Pending**: HA verification (chaos test — kill primary, verify service còn sống)

## 2026-06-14 — theme-deploy + cloudflared-debug — apply purple theme vào live site

### Việc đã làm
- **frontend/src/index.css**: Đổi theme từ Spotify green (`#1DB954`) sang purple/teal glassmorphism (`--green: #a855f7`, `--bg: #050505`), thêm animated orbs, Geist font, glassmorphism sidebar/player/header/cards
- **Standalone HTML** (`Cozyroom (standalone).html`): Inject CSS override via JS sau Babel transform, theme mới hiển thị đúng
- **Docker build**: Build với `--no-cache` (bắt buộc vì cache layer cũ dùng CSS hash cũ `BbawKbmY`) → CSS hash mới `f3k7y1Ve`
- **k8s rollout**: `kubectl rollout restart deployment/frontend` → 3 replicas chạy image mới
- **cloudflared.yaml**: Đổi podAntiAffinity từ `required` → `preferred` + thêm nodeAffinity NotIn `rhein-e2144g` (node có networking broken)

### Root cause phát hiện
**Cloudflare tunnel `homelab` có remote-managed ingress routing** (version 6) với `music.giatbh.io.vn → http://localhost:18080`. Config này push từ Cloudflare API xuống, **override hoàn toàn** `ingress:` trong config.yml local. Frontend k8s pods (`frontend.cozyroom-k8s.svc.cluster.local:80`) không bao giờ được reach.

### Bài học

1. **Docker build cache không thay đổi hash nếu dùng lại layers** — `docker build` (không có `--no-cache`) giữ nguyên CSS hash dù source đã thay đổi. Luôn dùng `--no-cache` khi build frontend để đảm bảo CSS hash được regenerate
2. **imagePullPolicy: Always + same tag = node cache hit** — rollout restart với `imagePullPolicy: Always` vẫn dùng image cũ nếu node đã cache manifest digest đó. Cần đảm bảo push xong TRƯỚC KHI restart, hoặc dùng unique tag per deploy
3. **subPath ConfigMap mount không auto-update** — ConfigMap thay đổi không propagate vào pod dùng `subPath:`. Phải restart pod để nhận config mới
4. **Cloudflare remote tunnel config override local config.yml** — Named tunnel với ingress được set qua Cloudflare dashboard sẽ push config xuống và override local `ingress:` section. Phải update qua Cloudflare dashboard, KHÔNG chỉ sửa ConfigMap trong k8s
5. **podAntiAffinity: required tạo scheduling deadlock** — Với 3 nodes (1 broken), `required` anti-affinity buộc pod vào node broken. Rollout stuck khi node broken không accept workload
6. **Xóa pods để phá deadlock có thể break service** — Nếu cả 3 cloudflared pods đang serve (kể cả từ CF cache), xóa chúng để reschedule sẽ làm 502 trong khi chờ

### Trạng thái hiện tại
- Site **502** — cần update Cloudflare dashboard: tunnel `homelab` → `music.giatbh.io.vn` đổi từ `http://localhost:18080` thành `http://frontend.cozyroom-k8s.svc.cluster.local:80`
- Frontend pods đang serve đúng CSS mới `f3k7y1Ve` (verified qua port-forward)
- 2 cloudflared pods đang Ready (f575784f9) nhưng route sai origin

## 2026-06-11 — harness-update — migrate/update xong, nợ đã backfill: 0 file

## 2026-06-10 — orca-workflow — cover-fetch-race-fix + K8s deploy

- **Root cause**: TOCTOU race in `handler.go` — 2 concurrent requests cùng write `yt_<ytID>.jpg` → JPEG corrupt, cached 7 ngày
- **Fix 1**: `singleflight.Group` cho `serveResizedImage` và YouTube cover fetch — chỉ 1 goroutine làm, còn lại chờ
- **Fix 2**: `downloadYTThumbnail` thêm `context.WithTimeout(15s)` + cleanup partial write
- **Fix 3**: `PlayerBar.tsx` stale image load callback — `cancelled = true` flag + cleanup `img.src = ''`
- **Compile fixes (5 files)**: `*db.RDB → *sql.DB` type mismatch từ Postgres migration WIP — trending.go, eh_cached.go, db_handlers.go, scan.go, main.go
- **K8s**: Build image, push → `100.88.197.64:5000`, `kubectl rollout restart deployment/backend` → 3 replicas Running
- **HTML docs**: `llmwiki/html/100626-cover-race-k8s-deploy.html` — interactive node diagrams, app UI mockup before/after, code diffs
- Files changed: `handler.go`, `scanner.go`, `PlayerBar.tsx`, `trending.go`, `eh_cached.go`, `db_handlers.go`, `scan.go`, `main.go`

## 2026-06-08 — propose — k8s-dashboard-headlamp

## 2026-06-08 — source — wsl2-ssh-autostart
## 2026-06-08 — source — k3s-install-best-practices
## 2026-06-08 — source — grafana-dashboard-best-practices

## 2026-06-06 — orca-workflow — infra-monitoring-complete

## 2026-06-06 — orca-workflow — ansible-k8s-cozyroom-deploy

## 2026-06-07 — propose — k3s-cozyroom-master-control-plane
## 2026-06-07 — implemented — k3s-cluster-cozyroom-deployed (2-node: master+k8s2, NodePort 30080)

## 2026-06-06 — orca-workflow — ai-build-jenkins-deploy

## 2026-06-05 — design-feedback — playlist-play-btn-fix-fe

## 2026-06-05 — orca-workflow — fix-playback-sql-bugs

## 2026-06-02 — fix — YouTube stream proxy: giải quyết lỗi mất tiếng & 403 Forbidden

- **YouTube Stream Proxy** (`api/youtube.go`): Chuyển đổi cơ chế stream từ `http.Redirect` (direct link googlevideo.com) sang **Reverse Proxy trực tiếp**.
  - Người dùng truy cập stream thông qua `/api/youtube/stream/{id}` trên cùng tên miền `music.giatbh.io.vn`, triệt tiêu hoàn toàn lỗi **CORS** và **Mixed Content**.
  - Luồng request đến Google Video luôn sử dụng IP của máy chủ backend, giải quyết triệt để cơ chế chặn IP (IP binding) và lỗi **403 Forbidden** của YouTube.
  - Hỗ trợ đầy đủ **HTTP Range Requests** (`206 Partial Content`), giúp trình duyệt tải buffer nhanh và tua (seek) mượt mà với băng thông tối ưu nhất.
  - Tự động phát hiện và thử lại (retry) với URL mới nếu link YouTube trong cache bị hết hạn (expired/410).
- **Nginx configuration** (`nginx.conf`): Tắt proxy buffering cho `/api/youtube/stream/` (`proxy_buffering off`) để truyền phát âm thanh trực tiếp (real-time streaming) mượt mà không bị trễ hoặc đứng hình.
- Đồng bộ hóa các thay đổi hoàn toàn sạch sẽ trên cả hai thư mục nguồn (`cozyroom` và `workspaces/cozyroom/m`).

## 2026-06-02 — feat — YouTube download: embed metadata + thumbnail làm cover

- `--embed-metadata`: title, artist, album, date được embed thẳng vào file tag (opus/m4a/mp3) khi download
- `--write-thumbnail --convert-thumbnails jpg`: yt-dlp lưu thumbnail ra `<ytID>.jpg`, backend copy vào `coversDir/<albumID>.jpg` đồng bộ (không dùng goroutine nữa), clean up khỏi music dir
- Thumbnail cover endpoint ưu tiên `maxresdefault` (1280×720) → `sddefault` → `hqdefault` → `mqdefault`
- `id8hex()` trong `api/youtube.go` reproduce đúng SHA-256 logic của `scanner.go:id8()` để albumID match

## 2026-06-02 — fix — Reliability: panic recovery, timeouts, stream cache, HLS watcher

- **`panicRecovery` middleware** (`routes.go`): catch Go panic, log full 64KB stack trace, trả 500 thay vì crash server
- **HTTP timeouts** (`main.go`): `WriteTimeout=5m`, `IdleTimeout=2m`, `ReadHeaderTimeout=10s` — unblock goroutine khi client 5G drop
- **YouTube stream URL cache** (`youtube.go`): TTL 4h, lần 2+ trở đi serve ngay không cần gọi yt-dlp
- **Thumbnail qua cloak-proxy** (`handler.go`): fallback placeholder JPEG thay vì 404, log khi fail
- **HLS watcher** (`hls/manager.go`): `Watch(ctx)` goroutine poll 30s, kill ffmpeg job stuck > 3h; `exec.CommandContext` 2h hard timeout
- Root causes: yt-dlp blocking mỗi request, fetch thẳng internet, không có HTTP timeout, không có panic recover, ffmpeg không có timeout
- Draft: `wiki/sources/draft/020626-reliability-fixes-streaming-be.md`

## 2026-06-02 — feat — ADK Scoped State: migrate agent_memory → agent_state

- **Motivation**: Distilled ADK (adk.dev) concepts — State prefix pattern gives one dict, four scopes, zero extra infrastructure.
- **DB**: New `agent_state` table with `(scope, scope_id, key, value, updated_at)` PK `(scope, scope_id, key)`. One-time migration copies `agent_memory` → `agent_state` with `scope='user', scope_id='default'`.
- **MCP tools** (`registry.go`): `remember()` now accepts optional `scope` param (`user`|`session`|`app`); `recall()` uses `ILIKE` (Postgres) and queries `agent_state`; `forget()` accepts scope. Fixed SQLite `?` placeholder bug → Postgres `$N`.
- **AI handler** (`ai.go`): `aiSystemPrompt()` queries `agent_state` separately for `user` and `app` scopes, injects both sections into prompt. `memoryList/Import/Delete` endpoints migrated to `agent_state`.
- **System prompt**: Removed `recall()` instruction (context now auto-injected); added scope guidance for `remember()`.
- **Scopes**: `user/default` (persists across sessions), `session/<id>` (current conversation), `app/global` (all users).
- Build: `go build ./...` — clean, no errors.

## 2026-05-28 — research — Nous Research Hermes Agent Distillation Proposal

- Draft created: `sources/draft/280526-hermes-research-distillation.md`
- Researched Hermes CLI features: Self-improving skills, multi-platform bot gateway (Telegram/Discord), background task automation (cron).
- Proposed integration roadmap for Cozyroom's existing `AIAgentRuntime` including a new `create_custom_skill` tool, a secure Go-based Telegram bot integration, and an SQLite-backed background task scheduler.
- Updated `llmwiki/wiki/index.md` with the new draft file.

## 2026-05-28 — feat — MCP web_search + browse_url via cloak proxy

- `webSearchTool`: DuckDuckGo Instant Answer JSON API via cloak proxy
- `browseURLTool`: fetch any URL via cloak, strip HTML, return 5000 chars text
- `fetchViaCloak` helper reuses existing cloak `POST /fetch` protocol
- `ToolDeps.CloakProxyURL` added, wired from `RouterDeps.CloakProxyURL` in routes.go
- Draft promoted: `280526-mcp-web-search-browse.md` → `concepts/MCPWebSearch.md`

## 2026-05-28 — feat — AI Analytics: cost calculator, MCP analytics tools, dislike in logs

- **Cost estimation**: per-model token pricing persisted in `ai_model_prices` (SQLite); 1s debounced PUT sync; localStorage fast-cache; `≈$X.XXXX` shown on extreme cards
- **OCR pricing**: `POST /api/ai/ocr-pricing` — vision model extracts prices from screenshot; frontend shows editable prompt panel before sending; fuzzy-match fills pricing table
- **Charts**: ComposedChart (stacked token bars per model + cost line), price rate comparison ($/1M input vs output horizontal bars)
- **Date range filter** on extremes and daily data; `all_models` (no LIMIT) vs `models` (top 10 for donut)
- **Dislike in logs tab**: 👎 button on every row → retroactive labeling via `POST /api/ai/logs/{id}/dislike`
- **MCP tools added**: `get_ai_analytics`, `get_ai_logs`, `get_ai_extremes` — AI agent can now self-inspect usage
- **Wiki**: `AIAnalytics.md` fully updated with all above

## 2026-05-27 — bugfix — MCP playlist tool bugs + AI chat log tracking

- Commits: `7fe8faa` (playlist tools), `dffbf82` (chat log tracking), `53157fb` (COALESCE + RadialNav)
- **createPlaylistTool ID bug**: `[]byte(name)[:8]` hex → random `crypto/rand` ID. Root cause: model reused playlist ID as track ID in `play_track` calls (visible in prod logs as ID `706c61796c697374`)
- **New play_playlist tool**: queries first track by position, returns `_frontend_action: play_track` with real album_id. Fixes "create playlist and play" flow.
- **Tool descriptions**: added "NOT a track id" warnings to prevent model confusion
- **System prompt**: added explicit 4-step playlist+play flow
- **chat_logs.tool_errors**: new column tracking per-tool failures; `detectFailure` now flags `tool_error` first; SSE sends `⚠️ Lỗi <tool>: <reason>` in real-time
- **Frontend Logs panel**: collapsible "📋 Lịch sử chat" panel with failed-only toggle, tool error display
- **COALESCE fix**: `listPlaylistTracks` SQL — `NULL duration_s/track_num` caused HTTP 500 + infinite loading
- **RadialNav cover guard**: `track && track.album_id` prevents broken `/api/covers/?w=80`
- Post-mortem: `sources/270526-playlist-tool-bugs-postmortem.md`

## 2026-05-27 — implement — AI Agent Runtime: SSE streaming, fallback chain, token fixes

- Commits: deff30c (SSE streaming), 78ce77c (empty text fix), 8671283 (OpenRouter fallback chain), 4e9d5f1 (play_track DB verify)
- Updated `concepts/AIAgentRuntime.md` with session-2 content (sections 8-21, updated Origin)
- **SSE streaming**: new `POST /api/ai/chat/stream` endpoint; `statusWriter.Flush()` fix in metrics middleware; nginx `proxy_buffering off` block
- **Fallback chain**: 4 free models → 2 cheap paid → 1 reliable paid; `onStatus` callback for live status; `shortModel()` helper; removed nemotron (burns 9-11k tokens unreliably)
- **Token optimization**: removed property-level `description` from tool schemas; capped history at 8 turns server-side (~3000 → ~900 tokens/request)
- **play_track DB verify**: tool now queries DB by ID, falls back to Unicode-safe title search (3-variant LIKE); returns `album_id` + `duration_s`
- **Empty text fallback**: synthesize "Đang phát X" from action data when model returns empty string; moved outside `len(actions)>0` guard
- **Cover fix**: `album_id` now included in play_track response; `onLoad` handler added to PlayerBar cover img
- **Agent memory**: SQLite `agent_memory` table, REST API (GET/PUT/DELETE), React memory panel with export/import/delete

## 2026-05-26 — propose — AI Agent upgrade (memory + token display)

- Draft: `sources/draft/260526-ai-agent-upgrade-be-fe.md`
- Phase A: token in/out display per bubble (all 3 providers)
- Phase B: persistent agent memory via remember/recall/forget MCP tools + system prompt injection
- Status: APPROVED

## 2026-05-26 — doc — AIAgentRuntime template

- New file: `concepts/AIAgentRuntime.md`
- Documents: AI Agent Runtime terminology, 5-layer architecture, provider adapter quirks, agentic loop pattern, RTK tool response rules, chat logging, failure detection, 10-step deployment checklist for new apps
- Key term clarified: lớp tích hợp gọi là **AI Agent Runtime** (aiProvider interface + agentic loop + tool registry + provider adapters)

## 2026-05-26 — implement — MCP server + AI chat tab

- Commit: 3247c88
- New files: internal/mcp/ (5 files), internal/api/ai.go, cmd/mcp-server/main.go, AIAssistantPage.tsx
- Promoted draft → concepts/MCPServer.md
- TSC: clean. Go build/vet: clean.

## 2026-05-26 — propose — MCP server + AI chat tab

- Draft: `llmwiki/wiki/sources/draft/260526-mcp-server-ai-chat-tab-be-fe.md`
- Scope: backend MCP server (HTTP/SSE + stdio), `/api/ai/chat` handler, frontend AIAssistantPage
- Status: PENDING APPROVAL

## 2026-05-26 — verify-before-commit — 7 feature commits

- TSC: clean. Go build/vet: clean. ESLint: not installed (skip).
- Commits: b818364 feat(backend), b2a4a8c feat(trending), 3756f68 feat(youtube), 84955a2 feat(playlists), cf64e53 feat(i18n), 8b1bfcb feat(nav), 3ea64ba chore(wiki)
- Post-commit: added `## Origin` to APIReference.md (was missing)
- Skipped: `backend/debug_album_list.go` (throwaway debug script)

## 2026-05-25 — feat + fix — Corner Tucking, Spot-Expansion, Flat Logo, and 5/7 Month Split

- Commit: `latest — feat(radial): Implement AssistiveTouch-style Edge Tucking, spot expansion, 5/7 month split, and conditional vinyl effects`
- **Tóm tắt giải pháp:**
  - **Edge-Tucking & Loose Clamping**: Nới lỏng phạm vi kẹp tọa độ của đĩa than bubble và sự kiện resize từ `BUBBLE_R + 10` sang `[0, innerWidth/innerHeight]`, cho phép người dùng kéo giấu đi 50% diện tích nút vào các góc/mép màn hình (AssistiveTouch-style) để không che khuất UI.
  - **Expand-At-Its-Spot (Bung ra tại chỗ)**: Phục hồi hoàn toàn khả năng mở menu tại vị trí nguyên bản của bubble (`activeX = pos.x`, `activeY = pos.y`), loại bỏ việc tự trượt về tâm màn hình. Giao diện SVG tận dụng bộ toán quạt `calcArc` chiếu cánh hoa hướng vào trong màn hình nên hoàn toàn không bị tràn cạnh hay mất cánh hoa kể cả khi mở sát góc.
  - **Auto-Scaling Responsive Wrapper**: Bọc aura, SVG, bubble và text editor vào một fixed wrapper. Khi mở ở màn hình hẹp (< 520px), wrapper tự động scale nhỏ lại theo tỉ lệ viewport (`transform: scale(scale)` với tâm `0 0`), chừa lại biên 12px tránh tràn mép tối đa trên mobile.
  - **5/7 concentric Month Split**: Quy hoạch lại 12 tháng lịch tròn thành Vòng 1 gồm 5 tháng (`T1`–`T5`) và Vòng 2 gồm 7 tháng (`T6`–`T12`) thay vì chia đều 6/6, tăng tối đa khoảng giãn cách vật lý của nhãn chữ.
  - **Conditional Vinyl Effect**: Tách biệt hiệu ứng trục và rãnh đĩa than sang class `.radial-bubble--vinyl`. Chỉ gán class này khi có bài hát hoạt động (`track && !calendarMode`). Khi hiển thị logo mặc định hoặc hiển thị Năm, bubble hiển thị phẳng (flat) sạch sẽ, sang trọng.
  - **Mute Input Spinner Arrows**: Ẩn triệt để nút spin mũi tên của input sửa năm bằng `-moz-appearance` và `::-webkit-inner-spin-button`.

## 2026-05-25 — feat + fix — Concentric 6-Ring Radial Calendar Picker & Mobile Optimization

- Commit: `latest — feat(radial): Implement 6-ring Concentric Calendar Picker, Year Selection, and Mobile optimization`
- **Tóm tắt giải pháp:**
  - **6-Ring Concentric Calendar Picker**: Thay thế hoàn toàn vòng 12 tháng chật chội bằng hai vòng đồng tâm riêng biệt: Vòng 1 (Tháng 1-6) và Vòng 2 (Tháng 7-12) với góc quạt 60 độ cực rộng, chống chen chúc chữ tối đa trên màn hình di động. Sắp xếp lại các vòng ngày (Vòng 3: 1-10, Vòng 4: 11-20, Vòng 5: 21-31) và Vòng 6 (Quay lại & Trạng thái).
  - **Mobile-Friendly Single-Click Entry**: Loại bỏ sự phụ thuộc vào sự kiện `dblclick` trên mobile (do bị trình duyệt chặn cho tính năng zoom) bằng cách cho phép: click đơn vào ngày đang chọn để mở Lịch Tròn, click đơn vào Năm `2026` ở đĩa than để mở nhanh trình sửa năm.
  - **Concentric Year & Calendar Buttons**: Thay thế nút dịch chuyển "Ngày cũ hơn" / "Ngày mới hơn" thành phím hiển thị Năm Picker hiện tại (`2026`) và Lịch Tròn (`📅`) làm các điểm chạm mở lịch cực kỳ trực quan.
  - **Viewport Position Clamping Bugfix**: Tự động đưa nút đĩa than nổi về vị trí viewport an toàn khi mount hoặc window resize, khắc phục triệt để lỗi mất nút trên Chrome/Edge.
  - **Math Division-by-Zero Safety**: Phòng ngừa chia cho 0 (`divisor = daysCountC > 0 ? daysCountC : 1`) cho góc quạt của ngày để tránh lỗi kết xuất SVG NaN.

## 2026-05-25 — fix — CustomCrosshairCursor: Recharts v3 ScatterChart cursor props

- Commit: `868410a — fix(trending): Use x/y props in CustomCrosshairCursor (Recharts v3 ScatterChart passes x,y not points)`
- **Root cause (critical, note for all future Recharts ScatterChart work):**
  - Recharts v3 `Cursor.js` chia nhánh theo `chartName`. Với `ScatterChart`, nó làm `restProps = activeCoordinate` rồi spread thẳng vào `cursorProps`, tức là cursor component nhận `x`, `y` ở top-level.
  - Với LineChart/BarChart, Recharts mới dùng `points: getCursorPoints(...)` — đây là `points` array.
  - Code cũ kiểm tra `if (!points || points.length === 0) return null` → `points` luôn `undefined` với ScatterChart → crosshair không bao giờ render.
  - Fix: dùng `{ x, y, width, height, top, left }` thay cho `{ points, ... }`.
- **Bài học:** Đọc source `node_modules/recharts/es6/component/Cursor.js` trước khi implement custom cursor cho bất kỳ chart type nào. Props khác nhau hoàn toàn giữa ScatterChart và các chart khác trong Recharts v3.

## 2026-05-25 — promote — TrendingChartMode.tsx side-by-side layout zoom fix
- Commit: `07c28d4 — fix(trending): Lower side-by-side flex layout threshold to 450px to handle browser zoom`
- Tiếp tục hạ breakpoint của flex-direction cho hai biểu đồ hình tròn xuống 450px, giúp giải quyết triệt để vấn đề tự động xếp dọc khi tương tác click trên các trình duyệt desktop có tỉ lệ zoom lớn hoặc tỉ lệ hiển thị Windows cao (khiến logical width thực tế bị co dưới 550px).

## 2026-05-25 — promote — TrendingChartMode.tsx fix custom cursor parameters
- Commit: `bfed5f8 — fix(trending): Correct props parameters in CustomCrosshairCursor for Recharts ScatterChart`
- Sửa đổi CustomCrosshairCursor trích xuất tọa độ hoạt động `cx`, `cy` từ mảng `points` thay vì nhận trực tiếp từ tham số gốc của Recharts, sửa lỗi không hiển thị con trỏ crosshair khi hover.

## 2026-05-25 — promote — TrendingChartMode.tsx custom aiming crosshair cursor
- Commit: `7bc74fc — feat(trending): Implement custom aiming crosshair cursor for Momentum scatter chart`
- Thiết kế custom cursor dạng tâm ngắm (aim crosshair) có hình vuông bao bọc bong bóng dữ liệu (khoảng đệm động tính theo radius dựa trên impact score), các nét đứt chỉ tâm vẽ từ các cạnh hình vuông đi ra ngoài thay vì cắt thẳng vào trong hình tròn.

## 2026-05-25 — promote — TrendingChartMode.tsx side-by-side layout breakpoint fix
- Commit: `928397b — fix(trending): Keep dual charts side-by-side on windowed desktop viewports`
- Hạ breakpoint của flex-direction xuống 550px để hai biểu đồ luôn giữ bố cục hàng ngang (side-by-side) trên màn hình tablet/cửa sổ thu nhỏ của desktop, tránh việc tự động thu về xếp dọc sau khi tương tác click.

## 2026-05-25 — promote — TrendingChartMode.tsx fix duplicate legend entries
- Commit: `7507166 — fix(trending): Hide duplicate legend entries for Nightingale Rose chart`
- Khắc phục lỗi hiển thị trùng lặp ghi chú (Legend) trên biểu đồ Nightingale Rose bằng cách gắn thuộc tính `legendType="none"` cho lớp Pie bên trong (Weekly Star Delta).

## 2026-05-25 — promote — TrendingChartMode.tsx borderless Pie chart & bottom Legends
- Commit: `a8f192b — feat: Convert standard donut to borderless pie chart and position legends at the bottom`
- Chuyển đổi Donut Chart (bên trái) thành Pie Chart thực sự (`innerRadius={0}`, `paddingAngle={0}`).
- Xóa bỏ viền phân cách (`stroke="none"`) giúp các phần của biểu đồ Pie liền mạch hoàn toàn.
- Thiết lập hiển thị Legend ở phía dưới cho cả 2 biểu đồ (Pie và Nightingale Rose) trên cả desktop và mobile, tránh tình trạng crop/clip chữ.

## 2026-05-25 — promote — TrendingChartMode.tsx stacked Nightingale Rose & mobile positioning
- Commit: `8422b2a — feat: Stack inner and outer layers radially and fix mobile viewport centering`
- Xếp chồng liên tục (stacked radially): Lớp ngoài (total stars) bắt đầu chính xác từ biên của lớp trong (weekly delta), loại bỏ hoàn toàn khoảng đen phân cách.
- Khắc phục triệt để lỗi crop trên mobile: tăng chiều cao container lên 220px, dịch chuyển tọa độ tâm lên `cy="42%"` để chừa khoảng trống cho Legend phía dưới.

## 2026-05-25 — promote — TrendingChartMode.tsx side-by-side Donut & Concentric Nightingale Rose Chart
- Commit: `08e5d08 — feat: Show side-by-side standard donut and concentric Nightingale Rose charts`
- Thiết kế song song: Bảng bên trái là Donut Chart truyền thống (góc = tỷ lệ số repo), bảng bên phải là Nightingale Rose Chart đồng tâm (bán kính = stars/delta).
- Bỏ viền đen (`stroke="none"`) để các khối màu sát nhau, liền mạch và thẩm mỹ hơn.
- Responsive hoàn chỉnh: hiển thị hàng ngang trên Desktop và xếp chồng dọc trên Mobile.

## 2026-05-25 — promote — TrendingChartMode.tsx Nightingale chart & Mobile crop fix
- Commit: `9c00e74 — feat: Implement Nightingale Rose Chart and fix mobile cropping for star delta distribution`
- Cập nhật biểu đồ Donut phân phối star delta thành Nightingale Rose Chart (Polar Area Chart).
- Tỉ lệ bán kính biểu thị căn bậc hai của số lượng repo (`Math.sqrt(count / maxCount)`) giúp trực quan hóa diện tích chính xác.
- Sửa lỗi crop nhãn trên mobile bằng cách ẩn nhãn và hiển thị Legend thay thế.

## 2026-05-24 — propose — sources/draft/240526-youtube-downloads-consolidation.md
- Proposal: Group YouTube Downloads under 'YouTube Downloads' per Uploader and Fix Scanner Metadata Overwrite
- Preserve correct uploader (artist) and track names, but group all tracks from the same uploader under a unified album named "YouTube Downloads"
- Prevent scanner from overwriting YouTube downloaded tracks in the DB on subsequent library scans
- DB migration to consolidate existing downloaded tracks and clean up empty duplicate artists/albums

## 2026-05-24 — propose + research + document — ECC + Understand-Anything integration

- Research phase complete: understand-anything (explore agent) and ecc/everythingclaudecode (explore agent)
- Phase 1 Documentation: Created 3 new concept pages:
  * `concepts/UnderstandAnything.md` (11.1 KB) — 6-7 agent pipeline, tree-sitter parsing, knowledge graph schema
  * `concepts/EccHarness.md` (14.6 KB) — 47 agents, 156-181 skills, hook system, continuous learning
  * `concepts/UnderstandAnything-LlmwikiIntegration.md` (14.3 KB) — 4-phase integration roadmap (short/medium/long-term)
- Agent distribution for execution: Gemini (review), OpenCode (secondary), Copilot+Antigravity (implementation)
- Integration fit assessment: **STRONG** ✅✅✅ for both repos
- Status: Ready for Gemini & OpenCode review (Phase 1 Complete)

## 2026-05-24 — propose — sources/draft/240526-youtube-search-stream-download.md
- Proposal: Tích hợp Tìm kiếm YouTube, Stream nhạc trực tiếp, và Tải nhạc chất lượng cao nhất qua `yt-dlp`
- OpenCode làm Executor, Antigravity làm Planner/Reviewer, Claude không tham gia
- Thêm API endpoints cho YouTube search/stream/download và giao diện tương tác trên SearchPage

## 2026-05-24 — promote — draft/240526-i18n-en-vi-fe.md → concepts/I18n.md
- Commit: `f8b03a2 — feat(i18n): bilingual EN/VI support via i18next`
- i18next + react-i18next, default VI, localStorage persist, 15 files, 9 namespaces
- Lang toggle in Sidebar (shows opposite flag); hardcoded VI in TrendingPage migrated to keys

## 2026-05-24 — propose — sources/draft/240526-i18n-en-vi-fe.md
- i18next + react-i18next, mặc định VI, localStorage persist
- 15 files affected, ~80 strings, lang toggle button trong Sidebar
- Extract hardcoded "Giải quyết"/"Công nghệ"/"Luồng" từ TrendingPage sang translation keys

## 2026-05-24 — promote — draft/240526-trending-chart-mode-fe.md → concepts/TrendingChartMode.md
- Commit: `ddb6759 — feat(trending): Chart Mode with 9 charts, tier chips, repo drawer`
- 9 charts: Scatter (primary), Bar, Donut, Histogram, Lang, Lines, Slope, Treemap, Heatmap
- Mode toggle [Chart|Grid] persisted localStorage; tier chips + RepoDrawer; Recharts

## 2026-05-24 — propose — sources/draft/240526-trending-chart-mode-fe.md
- Chart Mode mặc định cho trang Trending — toggle với Grid Mode
- 9 charts từ data sẵn có (TrendingRepo + StarPoint[]): Bar, Donut, Histogram, Language, Scatter, Lines, Slope, Treemap, Heatmap
- Badge chip 4 tier → drawer filter + cross-link charts; Recharts library
- AGY review integrated: Scatter làm primary, line chart cap 10, slope chart, topics treemap, palette separation

## 2026-05-24 — promote — draft/230526-llmwiki-setup-join-skills.md → concepts/LlmwikiSetupFlow.md
- Commit: `bec038b — feat(skills): add new-project-setup + join-project setup skills`
- Created concepts/LlmwikiSetupFlow.md — design decisions, flow summaries, RTK guard rationale
- Removed draft row from index.md, added concept row
- Draft retained at sources/draft/ for history

## 2026-05-23 — propose — sources/draft/230526-llmwiki-setup-join-skills.md
- Proposal: 2 skill mới — new-project-setup (deploy llmwiki từ đầu) + join-project (orient nhanh)
- Gửi agy review trước khi implement

## 2026-05-23 — ingest — github.com/rtk-ai/rtk (v0.40.0)
- Created concepts/RTK.md — cơ chế, 4 filter strategies, hook system, integration với Claude/OpenCode/agy
- Created sources/rtk-ai-rtk.md — source record, design principles, relevant commands cho project
- Relevance: token efficiency trong multi-agent workflow; hook transparent, không cần sửa skills

## 2026-05-23 — promote — draft/230526-trending-impact-ui-fe.md → concepts/TrendingInsights.md
- Commit: `d5c4927 — feat(trending): AI industry-impact scoring + hero card + tier badges`
- AI 5-field prompt (impact_score 1-10, impact_label), GitHub 30d query, hero card, CSS tier badges

## 2026-05-23 — fix — skills subfolder structure + verify-before-commit enforcement
- Reorganised `llmwiki/skills/` into 3 subfolders: `wiki/`, `orca/`, `setup/`
- Updated `orca-workflow.md` to replace `<loop>` placeholders with actual paths
- Updated `verify-before-commit.md` to mark steps 6-7 as MANDATORY (gap that caused this omission)
- Updated `CLAUDE.md` skills table with new paths

## 2026-05-23 — draft — sources/draft/230526-trending-impact-ui-fe.md
- Proposal: Trending page — fix source (>30d stars>50), impact color tiers, weekly champion hero card

## 2026-05-23 — draft — sources/draft/230526-4-issues-wiki-search-lyrics-cover-fe.md
- Proposal: 4 issues — wiki/llmwiki migration, restore broken search bar (AppRoutes.tsx never committed), lyrics sync scroll lag, cover image first-play race


## 2026-05-19 — draft — sources/draft/190526-remove-tab-toast-lyrics-back-fe.md
- Proposal: remove mobile NPO tab toast, replace with left-zone tap to go back to Now Playing

## 2026-05-19 — promote — draft/190526-lyrics-stale-fetch-race-fix-fe.md → concepts/PlayerBugfixes190526.md
- Commit: `6b8f4b9`
- Three bugs: AbortController for lyrics race, preloaded duration fix, progress bar white fill

## 2026-05-19 — propose (amended) — sources/draft/190526-lyrics-stale-fetch-race-fix-fe.md
- Bug A: rapid skip → stale lyrics (AbortController fix in LyricsView + api.ts)
- Bug B: duration always 0:00 after preloaded track swap (read el.duration directly in startTrack)
- Bug C: progress bar no fill, thumb hidden until hover (CSS gradient + thumb opacity fix)

## 2026-05-19 — promote — Draft → sources/190526-translate-shortcut-overlay.md
- Commit: `ab52f60`
- Promoted from `wiki/sources/draft/190526-translate-shortcut-hide-header-fe.md`

## 2026-05-19 — implement — Translate shortcut + hide header buttons (mobile)
- `LyricsView`: forwardRef + useImperativeHandle exposes `toggleTranslation`; `onTranslateActiveChange` callback
- `PlayerBar`: `showCtrls()` touch handler, `ctrlsTimerRef` 3s auto-fade, `lyricsRef`, `.npo-translate-btn` floating button
- `index.css`: `.npo--ctrls-active` class gates opacity/pointer-events for all 3 buttons; translate btn positioned `absolute` inside `.npo-controls`
- TS clean: `npx tsc --noEmit` passed in WSL
- Draft updated: `wiki/sources/draft/190526-translate-shortcut-hide-header-fe.md`
- Concept updated: `wiki/concepts/MobileUI.md`

## 2026-05-19 — propose — Translate shortcut + hide header buttons (mobile)
- Nút translate (🌐) thêm shortcut ra ngoài khu vực media controls; 2 nút header góc (back chevron + 3-dot) ẩn mặc định
- Draft: `wiki/sources/draft/190526-translate-shortcut-hide-header-fe.md`

## 2026-05-19 — propose — Architecture docs site (html/architecture.html)
- Single HTML file, macOS-style glassmorphism, 4 sections: infra / parallel dev / deploy / file ownership
- Draft: `wiki/sources/draft/190526-architecture-docs-site.md`

## 2026-05-19 — infra — Split frontend/backend into separate containers
- Tách monolith 1 container thành 2: nginx (frontend) + Go (backend)
- `Dockerfile` → backend-only; `Dockerfile.frontend` → Node build + nginx
- `nginx.conf`: static SPA + proxy /api /stream /stream-video /hls
- `docker-compose.yml`: frontend exposed :18080, backend internal
- Lý do: mỗi lần sửa UI hoặc backend chỉ rebuild container tương ứng (~1-3 phút), không rebuild toàn bộ
- Updated `concepts/Architecture.md`; no new wiki page created

## 2026-05-19 — verify-before-commit — commit 6f13c4a
- Promoted `190526-eh-download-broken-reader-blackscreen-comics.md` → updated `concepts/ComicsDownloader.md`
- Promoted `190526-remove-tab-toast-lyrics-back-fe.md` → updated `concepts/NowPlayingUI.md`
- No new pages created (updates to existing concepts)
- PWA update banner + apple-touch-icon fix also documented in NowPlayingUI.md

## 2026-05-19 — propose — EH: cover store + online reader + proxy-routed user download
- Old: auto-background download hit CDN directly → failed → black screen
- New: cover+link auto-fetch (unchanged); read online via proxy; download user-initiated via proxy
- `fetchImageViaProxy()` routes image bytes through cloak proxy (same as cover thumbnails)
- Remove `discoverEH()` auto-queueing; add POST endpoint for user-triggered download
- Fix `fetchHTML()` infinite recursion; fix `downloadEH()` silent nil on 0 pages
- Draft: `wiki/sources/draft/190526-eh-download-broken-reader-blackscreen-comics.md`

## 2026-05-19 — propose — Remove tab toast, tap left-zone returns to Now Playing
- Xoá `showTabs` state + `tabsTimeoutRef` + `handleNpoClick` trong `PlayerBar.tsx`
- Thêm transparent overlay `npo-back-zone` (absolute, left half) chỉ render khi `mobileTab === 'lyrics'` → click → `setMobileTab('player')`
- Không đụng `LyricsView.tsx`, `index.css` (trừ có thể cần 1 CSS rule nhỏ cho zone)
- Draft: `wiki/sources/draft/190526-remove-tab-toast-lyrics-back-fe.md`

## 2026-05-19 — cleanup — Remove stale drafts (keep only 17-19)
- Deleted 32 stale draft files from `wiki/sources/draft/` (all pre-dating May 17)
- Updated `wiki/index.md` — removed deleted draft entries
- Kept 3 recent proposals: 170526-mini-player-redesign, 170526-lyrics-auto-translate, 190526-remove-tab-toast
- Verified all promoted drafts have corresponding commits in git history

## 2026-05-19 — lint
- **Orphans flagged (0):** All wiki files are listed in wiki/index.md.
- **Missing links fixed (16):** Added [[concepts/Lyrics]] in CleanArchitecture.md (2 places), NowPlayingUI.md (2 places), 190526-remove-tab-toast-lyrics-back-fe.md (3 places); [[concepts/Scanner]] in CleanArchitecture.md (2 places), VideoStreaming.md, 120526-add-ebook-support-media.md (2 places), 150526-artist-multi-image-fetch.md; [[concepts/DeezerEnricher]] in 110526-jellyfin-features-extraction.md; [[concepts/CleanArchitecture]] in 110526-jellyfin-features-extraction.md; [[concepts/EbookEnhancements]] in 130526-scraper-integration-backend.md.
- **Contradictions flagged (3):** (1) 5 concept pages still have `# Proposal:` titles despite living in `concepts/` — EbookThemes.md, EbookEnhancements.md, AudioReliability.md, LyricsUI.md, GaplessPlayback.md. (2) AudioReliability.md:36 references draft `120526-fix-audio-interruption-audio.md` which does not exist. (3) `sources/prometheus-standalone-container-infra.md` and `sources/draft/080526-prometheus-standalone-container-infra.md` are byte-identical duplicates.
- **Stale claims flagged (0):** No wiki page references raw/ (raw/ is empty except for README.md/.gitkeep).
- **Index gaps filled (0):** All wiki files are already indexed.
- **Empty pages flagged (0):** All wiki files have substantive content.
- **Missing Origin flagged (22):** concepts/EbookThemes.md, concepts/EbookEnhancements.md, sources/prometheus-standalone-container-infra.md, ebook_migration_task.md, and 18 draft files in sources/draft/ (see below). Flagged as incomplete — do not guess source.
  - sources/draft/190526-remove-tab-toast-lyrics-back-fe.md
  - sources/draft/150526-artist-multi-image-fetch.md, 150526-ssr-evaluation.md, 150526-hentaihunter-comics-improve.md, 150526-lyrics-save-reload-fix-fe.md
  - sources/draft/130526-stremio-ui-tmdb-integration.md, 130526-ebook-management-collections.md, 130513-ebook-reader-rendering-issue.md
  - sources/draft/120526-in-browser-ebook-reader.md, 120526-hardcoded-login-screen.md, 120526-netflix-films-ui-fe.md
  - sources/draft/110526-jellyfin-features-extraction.md, 110526-media-streaming-architecture-proposal-backend.md, 110526-video-streaming-handover.md
  - sources/draft/100526-clean-architecture-acid-refactor-backend.md
  - sources/draft/090526-musixmatch-lyrics-fix-backend.md, 090526-redesign-npo-artist-card-fe.md
  - sources/draft/080526-prometheus-standalone-container-infra.md, 040526-mobile-ui-fe.md
- **Draft status overview:** 47 draft files total. 16 correspond to promoted concepts. 9 are handoff/status documents. 3 are recent proposals (May 17–19, not yet promoted). 19 are pending proposals with unclear implementation status — candidates for cleanup decision.



## 2026-05-17 — propose — Lyrics auto-translation
- Auto-detect foreign lyrics, translate to VN via Google Translate unofficial (no key) with full-song context
- Toggle button in lyrics toolbar; interleaved display below each line; SQLite cache
- Draft: `wiki/sources/draft/170526-lyrics-auto-translate-fe-be.md`

## 2026-05-17 — propose — Mobile mini player redesign
- Vinyl cover → play/pause button (remove separate button)
- Layout: title (left) · prev·vinyl·next (center) · artist (right)
- Long text: fade mask at edge instead of hard clip; hover → marquee scroll
- Draft: `wiki/sources/draft/170526-mini-player-redesign-mobile-fe.md`

## 2026-05-17 — promote — Comics offline downloader + Lyrics reliability
- Promoted `wiki/sources/draft/150526-comics-offline-prefetch-backend-fe.md` → `wiki/concepts/ComicsDownloader.md`
- Promoted `wiki/sources/draft/150526-lyrics-save-reload-fix-fe.md` → `wiki/concepts/LyricsReliability.md` (merged with subsequent fixes)
- Commits covered: `6a6e8cd` (downloader + lyrics UX), `d65f84b` (cache poisoning + tap), `32919cc` (mobile panel CSS)
- Lint status: ESLint not configured (no config file), noted. TypeScript + `go vet` + `go build` all pass.

## 2026-05-15 — propose — Comics offline pre-fetch engine
- Change: EH latest TTL 30 min → 6 h (download cycle); metadata refresh stays 30 min.
- New: background downloader goroutine, `comics_downloads` table, local file serving, delete endpoint.
- FE: default grid = downloaded only; search = external; delete button + path display.
- Key risk: EH ban during bulk download → worker pauses, retries next cycle.
- Key risk: disk exhaustion → `MAX_COMICS_GB` hard cap.
- Draft: `wiki/sources/draft/150526-comics-offline-prefetch-backend-fe.md`.

## 2026-05-15 — propose — Image optimisation for sub-1s loading
- Root causes identified: no `Cache-Control` headers on cover endpoints; covers served at original resolution (often 200–500 KB) with no resize.
- Plan: Phase 1 cache headers (10 min), Phase 2 resize-on-demand `?w=N` in backend (~100 lines), Phase 3 frontend sends correct `w` per context.
- No new deps: uses Go stdlib `image/jpeg` + `golang.org/x/image/draw`.
- Draft: `wiki/sources/draft/150526-image-optimisation-perf.md`.

## 2026-05-15 — handoff — Comics covers + Mobile standalone shell
- Fix MangaDex cover: `mdFetchFirstPage` + proxy qua `/api/scraper/md/img` (at-home token không expose ra browser).
- Fix E-Hentai cover: homepage dùng layout khác search — rewrite `fetchEHLatest` với `ehHomepageRe` regex mới.
- Fix tab-switch flash: `sourceCache` useRef trong ComicsPage.
- Mobile standalone: `useIsMobile` hook + `MobileShell.tsx` + `AppRoutes` split + `ComicsPageMobile` (3-col grid, detail overlay).
- Handoff: `wiki/sources/draft/150526-session-handoff-comics-mobile.md`.

## 2026-05-15 — query — Mobile standalone UI + server-side image cache rules
- Wiki đã ghi MobileUI (CSS responsive, đã implement) và SSR eval (SSG recommend, chưa implement).
- User xác nhận 2 luật bất biến: (1) mobile phải standalone riêng, không responsive từ desktop; (2) ảnh cover phải backend proxy/cache trước khi client nhận.
- Lưu vào memory: `feedback_mobile_ui_rule.md`, `feedback_server_side_image_cache.md`.
- Không tạo wiki page mới (insight đã nằm trong memory, không phải kiến trúc kỹ thuật mới).

## 2026-05-15 — propose — SSR Evaluation
- Evaluated SSR + SSG for Cozyroom.
- **SSR (Next.js)**: Not recommended — migration touches every file, adds Node.js to production.
- **SSG via ReactDOMServer + StaticRouter**: Recommended — no deployment change, no new runtime, all users see same content.
- Updated `wiki/sources/draft/150526-ssr-evaluation.md` with SSG option.

## 2026-05-15 — propose — Lyrics save reload fix
- Save lyrics triggered `doFetch()` which set `loading=true` and cleared results, flashing "Finding lyrics…".
- Fix: added `silent` param to `doFetch()` — skips loading state, refetches in background.
- Changed `handleSave` to call `doFetch(trackId, true)`.
- See `wiki/sources/draft/150526-lyrics-save-reload-fix-fe.md`.

## 2026-05-15 — propose — Comics cover + tab-switch fix
- Issue A: MangaDex grid covers grey — `fetchMDLatest` uses at-home server URLs (expiring, hotlink-blocked) instead of stable cover art CDN. Fix: add `includes[]=cover_art` to manga list call, replace goroutine pool with `mdBuildResults()`.
- Issue B: Tab switch loading flash — frontend doesn't cache per-source results; `setResults([])` on every switch. Fix: `useRef` cache per source, restore instantly, refetch silently.
- See `wiki/sources/draft/150526-comics-cover-tabswitch-fix-fe-be.md`.

## 2026-05-15 — propose — Hentaihunter comics improvement
- Evaluated Hentaihunter (Python CLI doujinshi downloader) for improving NSFW comics.
- Currently Cozyroom only has E-Hentai + MangaDex scrapers.
- Recommendation: Add nhentai scraper natively in Go (has JSON API) — do NOT embed Hentaihunter directly.
- See `wiki/sources/draft/150526-hentaihunter-comics-improve.md`.

## 2026-05-15 — propose — Multi-artist image composite
- Artist có separator (`,`, `&`, `feat.`) không hiển thị ảnh vì Deezer search cả cụm fail.
- Recommendation: Server-side composite — enricher parse tên, search từng artist, ghép ảnh.
- 1 ảnh full, 2 split 50/50, 3 split 33%, 4 2x2 grid, 5+ chỉ 4 đầu.
- See `wiki/sources/draft/150526-artist-multi-image-fetch.md`.

## 2026-05-15 — propose — Desktop Mode + TOC Navigation for Ebook Reader
- Desktop mode: toggle to remove 720px max-width cap on `.epub-html-page`; state persisted to localStorage.
- TOC navigation: new `GET /api/ebooks/{id}/toc` endpoint parses toc.ncx/nav.xhtml from EPUB zip; frontend drawer lets user jump to any chapter via existing `goToPage()`.
- Affected: `EbookReaderPage.tsx`, `ebook_pages.go`, `routes.go`, `index.css`.
- Draft: `wiki/sources/draft/150526-desktop-mode-toc-ebook-fe-be.md`.

## 2026-05-15 — propose — GitHub Trending Tab + AI Analysis (v2)
- Tab tracking GitHub repos tăng star nhanh nhất; log theo ngày; AI analysis per repo (problem/tech/flow) via Gemini 2.5 Flash; star curve; date dropdown; ACID transaction.
- Schema: 3 tables mới (trending_repos, trending_daily, trending_star_history).
- Draft: `wiki/sources/draft/150526-github-trending-tab-fe-be.md`.

## 2026-05-15 — handoff — EPUB image fix + CloakBrowser EH integration
- EPUB HTML pages: thêm `/asset` endpoint, rewrite img src, fix regex single/double quote, fix scroll (display:block).
- CloakBrowser: cloak-proxy Python sidecar (dedicated thread pattern), wired vào EHCachedHandler qua CLOAK_PROXY_URL env var.
- Deployed và verify: EH search trả 25 kết quả, EPUB ảnh load đúng, scroll hoạt động.
- Handoff: `wiki/sources/draft/150526-session-status-epub-eh.md`.

## 2026-05-15 — propose — CloakBrowser E-Hentai bot bypass
- Propose dùng CloakBrowser Docker sidecar (CDP mode) + chromedp để thay plain HTTP scraping của E-Hentai.
- chromedp đã có sẵn trong go.mod — chỉ cần thêm docker-compose service + sửa scraper.go.
- Draft: `wiki/sources/draft/150526-cloakbrowser-eh-bypass-backend.md`.

## 2026-05-14 — feature — EPUB Reader Complete Rewrite (backend page extraction)
- Loại bỏ toàn bộ react-reader/epub.js stack.
- `backend/internal/api/ebook_pages.go`: mới hoàn toàn — mở EPUB zip, parse OPF spine, serve ảnh (fixed-layout) hoặc HTML body (reflowable) qua 2 endpoint mới.
- `frontend/src/pages/EbookReaderPage.tsx`: viết lại từ đầu — `<img>` cho manga, `<div>` cho text, tap zones cho paged mode.
- Xóa `react-reader` khỏi `package.json`.
- Build: 0 lỗi. Chưa verify trên device.
- Tạo handoff doc `wiki/sources/draft/140526-epub-reader-rewrite-status.md`.
- Cập nhật `wiki/index.md`.

## 2026-05-14 — propose — Rebrand to Cozyroom
- Tạo draft proposal `wiki/sources/draft/140526-rebrand-to-cozyroom.md` để đổi toàn bộ thông tin nhận diện từ "home-spotify" sang "Cozyroom".
- Ảnh hưởng: Go module (go.mod + 30+ imports), frontend package.json, Docker container, Prometheus, README, wiki files, favicon.
- Plan: rename module → replace imports → update package.json → update Docker → update UI strings → new logo → rewrite README → update wiki.
- Cập nhật `wiki/index.md`.

## 2026-05-12 — sync — Template Pull (Downstream)
- Pulled updated template files from `https://github.com/Rheinmir/setup.git`.
- Updated: `AGENT.md`, `skills/md-to-html.md`, `skills/sync-template.md`.
- New: `commands/serve`, `skills/onboard-codebase.md`.
- Created missing `.template-manifest.json` for future syncs.

## 2026-05-12 — propose — Hardcoded Login Screen
- Tạo draft proposal `wiki/sources/draft/120526-hardcoded-login-screen.md` để thêm màn hình đăng nhập với tài khoản hardcode `giatbh` / `0797042389gia`.
- Cập nhật `wiki/index.md`.

## 2026-05-12 — fix — Trickplay/poster hexID bug + not-ready metadata
- Commit: `262a559 — fix(api): remove hexID check from trickplay/poster endpoints`
- Video IDs are 8 hex chars; hexID regex required 16 → sprite/poster always 404'd
- Not-ready trickplay response now includes static fields (interval, cols, dims)
- Found via smoke test during verify-before-commit

## 2026-05-11 — feature — Jellyfin-Inspired Features (4-pack)
- Commit: `024d9c5 — feat(backend): implement 4 Jellyfin-inspired features`
- MetadataProvider interface → DeezerProvider refactored; TMDbProvider added (video posters via TMDB_API_KEY)
- Trickplay: lazy FFmpeg sprite generation (160×90, 10s interval, 10 cols), `/api/trickplay/{id}` + `/sprite`
- AdaptivePlayback: `CanDirectPlay(ua, path)` + `/api/videos/{id}/stream` smart redirect
- ResumeState: `playback_progress` table, `GET/POST /api/playback/progress`
- Promoted draft `110526-jellyfin-features-extraction.md` → `wiki/concepts/JellyfinFeatures.md`

## 2026-05-11 — propose — Jellyfin Features Extraction
- Kéo source code Jellyfin về `/scratch` để nghiên cứu kiến trúc.
- Tạo draft proposal `wiki/sources/draft/110526-jellyfin-features-extraction.md` trích xuất 4 tính năng: Metadata Providers, Trickplay Thumbnails, Device Profile Transcoding, và Resume State.
- Cập nhật `wiki/index.md`.

## 2026-05-11 — docs — Added wiki entries for workflow skills
- Created `wiki/sources/skill-propose.md` — documents propose skill (plan-before-code gate)
- Created `wiki/sources/skill-verify-before-commit.md` — documents verify-before-commit skill (quality gate + Docker rebuild)
- Updated `skills/verify-before-commit.md` to include Docker rebuild as step 6

## 2026-05-11 — feature — HLS on-the-fly streaming with hls.js (full seeking)
- Commit: `5faba38 — feat(video): replace fMP4 pipe with on-the-fly HLS for full seeking`
- `internal/hls.Manager`: ffmpeg generates 4s segments + m3u8, cached in /data/hls/; ready signal after first segment (~4s)
- Frontend: hls.js replaces bare `<video src>` — handles playlist polling, buffering, full seek
- ffmpeg runs at ~130x real-time (v:copy), Arcane ep fully segmented in <20s
- Updated `wiki/concepts/VideoStreaming.md` with HLS architecture notes

## 2026-05-11 — feature — Video streaming with MPEG-TS transcoding
- Commit: `f400c80 — feat(video): add video streaming with MPEG-TS transcoding support`
- Built and tested: 18 videos indexed from F:\Films (Arcane S1, Oppenheimer, Fantastic Beasts — all .ts)
- All .ts files remuxed on-the-fly to fragmented MP4 via ffmpeg (video copy, AAC audio, no re-encode)
- Promoted draft `110526-media-streaming-architecture-proposal-backend.md` → `wiki/concepts/VideoStreaming.md`
- Removed stale handover draft `110526-video-streaming-handover.md` from index (temporary context file)

## 2026-04-28 — init — Knowledge Base initialized
- Created folder structure: concepts/, entities/, sources/, sources/draft/
- Created wiki/index.md, wiki/log.md
- Created AGENT.md

## 2026-05-03 — init — Knowledge Base setup completed; stray files ingested
- Created commands/ folder
- Moved and reformatted 3 stray root .md files into wiki/sources/:
  - AGENT-business.md → wiki/sources/project-requirements.md
  - AGENT-code.md → wiki/sources/tech-stack-decisions.md
  - quickStorm.md → wiki/sources/homelab-music-brainstorm.md
- Updated wiki/index.md with 3 new entries
- CLAUDE.md left in root (Claude Code system file, not a project doc)

## 2026-05-03 — scaffold — MVP codebase scaffolded
- Created Go backend: cmd/server/main.go, internal/api/{routes,handler}.go, internal/db/db.go, Dockerfile, go.mod
- Created React/Vite frontend: src/{main.tsx,App.tsx,index.css}, index.html, package.json, tsconfig.json, vite.config.ts
- Created docker-compose.yml, .gitignore, data/.gitkeep
- Replaced template README.md with project run instructions
- Created wiki/concepts/Architecture.md; updated wiki/index.md
- Cognee deferred: will integrate after LLM wiki offline phase

## 2026-05-03 — feature — Full browser UI + library scanner
- Implemented library scanner: walks /music, reads ID3/Vorbis tags via dhowden/tag, upserts artists/albums/tracks into SQLite
- SHA-256-based 8-byte hex IDs: id8(name), id8(artistID+albumTitle), id8(filePath)
- Cover art extracted from embedded tag pictures → /data/covers/{albumID}.jpg
- Background goroutine scan on startup (non-blocking — server starts immediately)
- Full Spotify-dark React UI: ArtistsPage (grid), ArtistPage (albums), AlbumPage (tracklist), Sidebar, Header
- PlayerContext with HTML5 Audio, queue management, play/pause/seek/prev/next
- PlayerBar with progress bar, track info, playback controls
- useRef pattern for all mutable state in audio event handlers (avoids stale closures)

## 2026-05-03 — feature — Shuffle, Repeat, Search, Lossless/320 transcoding
- Backend: internal/transcode package — ffmpeg pipe to ResponseWriter (FLAC→320kbps MP3 on-the-fly)
- Backend: GET /api/search — LIKE queries across artists/albums/tracks, returns all three arrays
- Backend: GET /stream/{id}?q=320 — transcodes lossless files; passes through MP3/AAC directly
- Frontend: SearchPage with artists/albums/tracks sections; Header search input navigates to /search?q=
- PlayerContext: RepeatMode (off/one/all), shuffle (boolean), Quality (lossless/320)
- PlayerBar: shuffle, prev, play/pause, next, repeat, quality toggle (LOSSLESS / 320 MP3)
- Docker: ffmpeg added to alpine runtime image

## 2026-05-03 — fix — Track titles showing raw filenames
- Root cause: many files have ID3 Title tag set to auto-generated filename with timestamp suffix
- Fix: cleanTitle() in scanner strips _YYYYMMDD_HHMMSS suffix and leading track-number prefix (01. / 01 - )
- Applied to both filename fallback and ID3 title when timestamp pattern detected
- Triggered POST /api/scan rescan to repopulate titles

## 2026-05-04 — feature — Deezer artist image enricher
- internal/enricher/deezer.go: background goroutine fetches artist photos from Deezer API (no auth)
- Rate-limited to ~3 req/sec; incremental (skips artists that already have image_path)
- Downloads picture_xl (1000px) → /data/artist-images/{artistID}.jpg
- GET /api/artist-images/{id} route added to serve files
- listAlbums response now includes artist_image_url (via JOIN) — used by ArtistPage hero
- listArtists response includes image_url — used by ArtistsPage grid cards
- Enricher runs on every container start after any pending library scan

## 2026-05-04 — feature — Smart Radio mode
- Backend: GET /api/smart-queue?track_id=X&limit=N — weighted random SQL ORDER BY
  - Same artist: score 8, same genre: 5, genre-family (LIKE): 3, else: 1
  - Each score × RANDOM factor [0.5–1.5] → smooth gradient, not hard category blocks
- DB migration: ALTER TABLE tracks ADD COLUMN genre TEXT (additive, ignores if exists)
- Scanner now reads m.Genre() and stores genre on each track
- Frontend: ShuffleMode = 'off' | 'shuffle' | 'smart' (replaces boolean shuffle)
- PlayerContext: smart mode pre-fetches 30-track buffer via fetchSmartQueue, auto-refills when <10 remain
- PlayerBar: shuffle button cycles off → shuffle (green) → smart (purple sparkle ✦)
- Smart mode coexists with quality toggle and repeat independently

## 2026-05-04 — Mobile UI proposal
- Proposed CSS-only responsive layout (Option A): sidebar hide, bottom tab nav, mini player bar at ≤640px
- Draft at wiki/sources/draft/040526-mobile-ui-fe.md

## 2026-05-05 — PWA, SPA routing fix, Media Session controls
- Commit: f703b53 — feat: PWA install, SPA routing fix, Media Session controls
- vite-plugin-pwa → manifest + service worker + PWA icons; app installable on Android/iOS
- InstallBanner.tsx: inline "Cài ngay" button via beforeinstallprompt (Android Chrome only)
- spaHandler (backend/internal/api/spa.go): Go backend returns index.html for unknown paths (fixes 404 on reload)
- Cloudflared tunnel updated to target Docker container at :18080, not transient Vite dev server
- Media Session API wired in PlayerContext.tsx: lock-screen/notification shows title, artwork, prev/next/seek
- Extended wiki/concepts/MobileUI.md with PWA, Media Session, SPA fix, and deployment topology sections

## 2026-05-04 — Mobile UI (Option B)
- Draft: wiki/sources/draft/040526-mobile-ui-fe.md
- Commit: 8aacc82 — feat: mobile UI — bottom nav, mini player bar, slide-up now-playing sheet
- Promoted to: wiki/concepts/MobileUI.md
- MobileNav bottom tab bar, 64px mini player, full-screen slide-up sheet with cover art + all controls
- Desktop layout unchanged; breakpoint at 640px

- Draft: none (no prior draft)
- Commit: 1a24b9f — feat: parallel multi-source lyrics with desktop overlay + save
- Promoted to: wiki/concepts/Lyrics.md
- Parallel goroutine fetch, source dropdown, desktop overlay, FE-gated save to sidecar .lrc

## 2026-05-08 — infra — Prometheus + Grafana migrated to standalone Docker Compose stack
- Draft approved and implemented: wiki/sources/prometheus-standalone-container-infra.md
- Created ~/observability/ with prometheus.yml, docker-compose.yml, prometheus-data/, grafana-data/
- Migrated 214 MB Prometheus TSDB + 53 MB Grafana data from WSL systemd locations
- Ownership set: prometheus-data → UID 65534 (nobody), grafana-data → UID 472 (grafana)
- Stopped and disabled prometheus.service + grafana-server.service (systemd)
- Workaround: grafana:13.0.1 has 0-byte /run.sh bug → entrypoint set to direct binary
- Both containers started with network_mode: host; targets confirmed: home-spotify up, wsl-node-exporter up
- Grafana health: {"database":"ok","version":"13.0.1"}

## 2026-05-06 — fix+feature — Lyrics reliability & observability pass
- **Crash fix**: `parseLRC` returned nil slice → JSON `null` → `null.length` TypeError in FE. Fixed to `[]LyricLine{}`.
- **Cache fix**: FE in-memory Map → sessionStorage (persists across reloads); format-validated on read.
- **Save fix**: music volume is `:ro`; save now writes to `/data/lyrics/{trackID}.lrc` (writable). `fetchSidecar` checks that path first.
- **Fast sidecar path**: if sidecar present + no online cache, return sidecar immediately and warm online cache in background goroutine. Previously blocked up to 8s waiting for all 3 APIs.
- **Source monitor**: `GET` response now includes `sources[]` with per-source `found/lines/err`. FE shows collapsible `n/n` panel.
- **Cache badge + Refresh**: `cached` bool in response; Refresh button calls `DELETE /api/lyrics/{id}` + clears sessionStorage.
- **Save error reporting**: split into two try/catch blocks with step-specific messages; API returns `HTTP {status}: {body}`.

## 2026-05-08 — ingest — UI/UX evaluation của live site
- Quan sát thủ công toàn bộ luồng điều hướng trên https://music.giatbh.io.vn
- Distill thành wiki/sources/music-giatbh-io-vn-evaluation.md (5 nhóm vấn đề)
- Xóa file tạm root/music_giatbh_io_vn_evaluation.md
- Cập nhật wiki/index.md với entry mới

## 2026-05-09 — propose — Redesign Now Playing Overlay Artist Info
- Created draft proposal `wiki/sources/draft/090526-redesign-npo-artist-card-fe.md`
- Added to `wiki/index.md`

## 2026-05-09 — feature — Redesign Now Playing Overlay UI
- Refactored `PlayerBar.tsx` to remove `.npo-artist` card and place `.npo-info-artist` text under the track title.
- Updated `index.css`: increased mobile `.npo-cover` size (`min(80vw, 340px)`).
- Refactored `.npo-tabs` to use a consistent pill-shaped button design instead of invisible borders.
- Implemented Youtube-style disappearing toggle: `.npo-tabs` are hidden by default (`opacity: 0`), and only appear for 3 seconds when tapping anywhere on the `.npo-body`.

## 2026-05-09 — propose — Fix Musixmatch Lyrics Source
- Investigated Musixmatch integration and found the token extraction regex was failing due to absolute URLs.
- Created draft proposal `wiki/sources/draft/090526-musixmatch-lyrics-fix-backend.md` to fix `mxmSecret()` in `lyrics.go`.
- Added to `wiki/index.md`.

## 2026-05-10 — propose — Clean Architecture & ACID Refactoring
- Created draft proposal `wiki/sources/draft/100526-clean-architecture-acid-refactor-backend.md` to restructure backend into Domain/Repository/Usecase layers and introduce Unit of Work for transactions.
- Added to `wiki/index.md`.

## 2026-05-10 — feature — Clean Architecture & ACID Refactoring (implemented)
- Created `internal/domain/` with entity structs (`Artist`, `Album`, `Track`, `Stats`, `SearchResult`) and repository interfaces (`ArtistRepository`, `AlbumRepository`, `TrackRepository`, `SearchRepository`, `StatsRepository`, `LyricsCacheRepository`, `SettingsRepository`, `UnitOfWork`, `UnitOfWorkFactory`).
- Created `internal/repository/sqlite/` with 7 repository implementations + UoW factory. All SQL queries extracted from handler/enricher/scanner.
- Created `internal/usecase/` with `LibraryUsecase`, `LyricsUsecase`, `SettingsUsecase`.
- Refactored `internal/api/handler.go`: zero `h.db` references — all queries delegated to usecases.
- Refactored `internal/api/lyrics.go`: lyrics handler now uses `LyricsUsecase` for cache CRUD and `LibraryUsecase.TrackMeta` for metadata.
- Refactored `internal/api/lastfm.go`: all settings reads/writes use `SettingsUsecase`.
- Refactored `internal/api/routes.go`: `NewRouter` now accepts `RouterDeps` struct with usecases instead of raw `*sql.DB`.
- Refactored `internal/enricher/deezer.go`: accepts `domain.ArtistRepository` instead of `*sql.DB`.
- Rewrote `cmd/server/main.go`: explicit DI wiring (DB → Repos → Usecases → Router).
- `library/scanner.go` unchanged — already ACID (uses its own `db.Begin()` internally).
- Build passes with zero errors (`go build ./...`).

## 2026-05-10 — promote — Clean Architecture concept promoted
- Draft `wiki/sources/draft/100526-clean-architecture-acid-refactor-backend.md` promoted to `wiki/concepts/CleanArchitecture.md`.
- Commit: `e01eebf — refactor: enforce clean architecture and ACID guarantees across backend`
- `wiki/index.md` updated with promoted concept entry.

## 2026-05-10 — propose — Gapless Playback & Early Preloading
- Created draft proposal `wiki/sources/draft/100526-gapless-playback-preloading-fe.md` to eliminate track switching latency using a dual-audio preloading strategy.
- Added to `wiki/index.md`.

## 2026-05-10 — promote — Gapless Playback concept promoted
- Draft `wiki/sources/draft/100526-gapless-playback-preloading-fe.md` promoted to `wiki/concepts/GaplessPlayback.md`.
- Commit: `9dc66bd — feat(player): implement spotify-style gapless playback and update brand logos`
- `wiki/index.md` updated with promoted concept entry.

## 2026-05-10 — propose — Lyrics UI Improvements (Auto-scroll & Fade-out)
- Created draft proposal `wiki/sources/draft/100526-lyrics-ui-improvements-fe.md` to enhance the lyrics view with hidden scrollbars, edge fading, and auto-scrolling for plain text.
- Added to `wiki/index.md`.

## 2026-05-11 — promote — Lyrics UI Improvements concept promoted
- Draft `wiki/sources/draft/100526-lyrics-ui-improvements-fe.md` promoted to `wiki/concepts/LyricsUI.md`.
- Commit: `238bae4 — feat(ui): enhance lyrics view with auto-scroll and fade-out`
- `wiki/index.md` updated with promoted concept entry.

## 2026-05-11 — propose — Media Streaming Architecture (Video & Ebook)
- Created draft proposal `wiki/sources/draft/110526-media-streaming-architecture-proposal-backend.md` to evaluate Microservices vs Modular Monolith for video and ebook features.
- Added to `wiki/index.md`.

## 2026-05-11 — feature — Implement Video Streaming MVP
- Created backend Clean Architecture layers for Video (`VideoRepo`, `VideoUsecase`, `VideoHandlers`).
- Added `videos` SQLite table and `/films` background scanner.
- Added `/api/videos` and `/stream-video/{id}` endpoints.
- Mapped `F:\Films` to `/films` in `docker-compose.yml`.
- Created frontend `VideosPage` and `VideoPlayerPage`, added navigation links.
- Created `wiki/sources/draft/110526-video-streaming-handover.md` context file for agent hand-off due to WSL docker build permission limits.

## 2026-05-12 — propose — Add Ebook Support
- Tạo draft proposal `wiki/sources/draft/120526-add-ebook-support-media.md` để triển khai thư viện và trình đọc Ebook (EPUB/PDF).
- Đề xuất mount thư mục `F:\Ebooks` từ Windows host.
- Cập nhật `wiki/index.md`.

## 2026-05-12 — feature — Modernize Now Playing UI (implemented)
- Commit: `bdf5079 — feat(ui): modernize Now Playing with dynamic artwork-driven visualizer and immersive background`
- Implemented 'Premium Capsule' mirrored equalizer with frequency-responsive gradients and auto-brightness boost.
- Refactored LyricsView tools into a toggleable settings panel with seamless fade-out animations.
- Replaced static NPO background with a layered blurred-cover and dynamic-tint system.
- Fixed ReferenceError in PlayerBar that caused application freezing on search navigation.

## 2026-05-12 — feature — Netflix-style Films UI (implemented)
- Commit: `bdf5079 — feat(ui): modernize Now Playing with dynamic artwork-driven visualizer and immersive background`
- `backend/internal/domain/entity.go`: Added `GroupName string` field to `Video`.
- `backend/internal/repository/sqlite/video.go`: Populate `GroupName = filepath.Base(filepath.Dir(v.FilePath))` in `List`.
- `frontend/src/pages/VideosPage.tsx`: Full rewrite — hero banner, grouping by folder, horizontal carousels, poster thumbnail with fallback SVG.
- `frontend/src/index.css`: Added isolated `.netflix-*` CSS for carousels and hero section.

## 2026-05-12 — propose — Redesign Films UI to Netflix Style
- Created draft proposal `wiki/sources/draft/120526-netflix-films-ui-fe.md` to redesign the films interface with thumbnails and grouping based on folder metadata.
- Added to `wiki/index.md`.

## 2026-05-12 — feature — Netflix-style Films UI (implemented)
- `backend/internal/domain/entity.go`: Added `GroupName string` field to `Video`.
- `backend/internal/repository/sqlite/video.go`: Populate `GroupName = filepath.Base(filepath.Dir(v.FilePath))` in `List`.
- `frontend/src/pages/VideosPage.tsx`: Full rewrite — hero banner, grouping by folder, horizontal carousels, poster thumbnail with fallback SVG, `first-child` / `last-child` transform-origin fix.
- `frontend/src/index.css`: Added `~210` lines of isolated `.netflix-*` CSS (hero, slider, card hover-scale, overlay info, responsive breakpoints).
- TypeScript type-check: 0 errors.

- [2026-05-12 12:01:19] Downstreamed template files from setup master repo.

## 2026-05-12 12:02:56 - sync-template pull - Downstreamed template files from setup master repo
- Updated AGENT.md, CLAUDE.md, 02-Setup-Knowledge-Base.md, skills\verify-before-commit.md

## 2026-05-12 12:28:37 - sync-template pull - Bulk downstreamed template files from setup master repo
- Updated .agent, .opencode, numbered kickoff files, AGENT.md, CLAUDE.md, and all skills/wiki templates.

## 2026-05-12 — fix — Lyrics reload logic & source selection
- **Fix**: Changed GET /api/lyrics/{id} to be blocking/synchronous when cache is missing, instead of returning local results immediately. This ensures the 'Reload' button actually shows fresh online results.
- **Improvement**: Added pickBest logic in LyricsView.tsx to automatically select synced lyrics over plain text and avoid defaulting to 'embedded' if better sources are found.
- **Commit**: a986968 — fix: ensure lyrics reload is synchronous and prioritizes high-quality sources to prevent 'embedding' overwrite
- **Updated concept**: [concepts/Lyrics.md](concepts/Lyrics.md)

## 2026-05-12 — feature — Audio Reliability (Error handling & Auto-retry)
- Commit: `25c1af5 — feat(audio): prevent silent audio interruptions and resource leaks via frontend retries and backend context management`
- Triển khai cơ chế tự động thử lại (auto-retry) lên đến 3 lần khi gặp lỗi mạng (`MEDIA_ERR_NETWORK`).
- Quản lý vòng đời tiến trình FFmpeg bằng `context.Context`, đảm bảo giải phóng tài nguyên ngay khi ngắt stream.
- Thêm `error` listeners cho audio elements để log lỗi chi tiết.
- Thêm metric `music_stream_errors_total`.
- Promoted draft `120526-fix-audio-interruption-audio.md` → `wiki/concepts/AudioReliability.md`.

## 2026-05-12 — feature — Ebook NSFW & PDF Cover Extraction
- Triển khai tính năng đánh dấu NSFW cho Ebook với bảo mật bằng mật khẩu (`owner712002`).
- Tự động làm mờ (`blur`) ảnh bìa các sách NSFW trong thư viện.
- Tích hợp `poppler-utils` (pdftoppm) vào Docker để trích xuất trang đầu PDF làm ảnh bìa.
- Cập nhật schema database (`is_nsfw` column) và API đồng bộ trạng thái.
- Promoted draft `120526-ebook-nsfw-pdf-cover.md` → `wiki/concepts/EbookEnhancements.md`.

## 2026-05-12 — propose — In-Browser Ebook Reader Integration
- Tạo draft proposal `wiki/sources/draft/120526-in-browser-ebook-reader.md` để tích hợp `react-reader` (EPUB) và `react-pdf` (PDF).
- Lên kế hoạch đồng bộ tiến độ đọc (progress sync) và giao diện đọc chuyên dụng (immersive UI).
- Cập nhật `wiki/index.md`.

## 2026-05-13 — feature — MangaDex + E-Hentai Comics Integration (Phase 1)
- Tích hợp scraper trực tiếp vào backend (không cần service riêng):
  - `backend/internal/api/scraper.go`: handlers cho MangaDex API + E-Hentai HTML scraping
  - `backend/internal/api/routes.go`: thêm 7 routes scraper
- Tạo `frontend/src/pages/ComicsPage.tsx`: split-panel UI với search, grid, detail, chapter list, reader overlay
- Cập nhật `frontend/src/api.ts` với scraper calls
- Thêm nav "Comics" vào Sidebar
- Build backend + frontend: thành công, 0 lỗi
- Demo: search "đấu phá" → 4 kết quả MangaDex; search "milf" → 26 kết quả E-Hentai

## 2026-05-13 — docs — MangaDex Scraper Source Extracted
- Clone repo `Darkrai9x/vbook-extensions` vào `C:\Users\olive\vbook-extensions` (951 files, 96 extensions)
- Viết `scraper/` standalone test: source MangaDex hoạt động, E-Hentai hoạt động
- Tạo mockup UI tại `scraper/mockup.html`
- TCP connectivity test: các trang VN (bachngocsach, wikicv, khotruyen) bị Cloudflare chặn hoặc offline

## 2026-05-13 — propose — Ebook Management: Collections & Filtering
- Tạo draft proposal `wiki/sources/draft/130526-ebook-management-collections.md` để thêm quản lý collection và filter đồng thời (NSFW + Collection).

## 2026-05-13 — feature — Ebook Themes & Style Normalization
## 2026-05-13 — feature — Ebook Themes & Style Normalization
- Triển khai hệ thống theme (Light, Dark, Sepia) và tùy chỉnh font size cho trình đọc EPUB.
- Sử dụng cơ chế CSS injection với `!important` để khắc phục triệt để lỗi "trắng trang" do xung đột màu chữ của sách.
- Lưu trữ tùy chọn người dùng vào `localStorage` và tự động khôi phục khi mở sách.
- Promoted draft `130526-fix-ebook-blank-screen-fe.md` → `wiki/concepts/EbookThemes.md`.

## 2026-05-13 — propose — Integrate Scraper into Backend
- Tạo draft proposal `wiki/sources/draft/130526-scraper-integration-backend.md` để tích hợp scraper (MangaDex + E-Hentai) vào backend.
- Đề xuất 2 approaches: A (standalone scraper binary) và B (merge vào backend) — recommend A cho MVP.
- Lên kế hoạch 6 phases: backend API → ComicsPage → detail modal → reader → download CBZ → NSFW guard.
- Cập nhật `wiki/index.md`.

## 2026-05-13 — propose — Stremio-Inspired UI & TMDB Integration
- Tạo draft proposal `wiki/sources/draft/130526-stremio-ui-tmdb-integration.md` để nâng cấp tab Films với giao diện Stremio và metadata TMDB.
- Lên kế hoạch tích hợp backdrops, plots, ratings và genres từ TMDB.
- Cập nhật `wiki/index.md`.

## 2026-05-13 — docs — Ebook Reader Rendering Fix Handoff
- Tạo `wiki/sources/draft/130526-ebook-reader-rendering-fix-status.md` — handoff document cho session debug fixed-layout EPUB.
- CSS transform scale approach (Kindle-style) đã hoạt động cho manga; blank white SVG separator pages vẫn còn.
- Cập nhật `wiki/index.md`.

## 2026-05-13 — fix — Strengthen blank page skip for KCC white SVG separators
- `EbookReaderPage.tsx` `rendered` event: thay `querySelector('img,svg')` bằng `hasVisibleImage` (naturalWidth > 0) và `hasVisibleSvg` (có child không phải white/none fill) để bắt được KCC blank separator pages.
- Thêm `key={readMode}` vào `<ReactReader>` để force remount khi đổi paged/scroll — đảm bảo `epubOptions.spread:'none'` được epub.js áp dụng trên rendition mới.

## 2026-05-14 — propose — EPUB Reader Complete Rewrite
- Tạo draft proposal `wiki/sources/draft/140526-epub-reader-rewrite-fe-be.md` để loại bỏ toàn bộ react-reader/epub.js stack.
- Hướng tiếp cận mới: backend Go mở EPUB zip, trích xuất từng trang (ảnh cho manga, HTML cho text), serve qua 2 API mới. Frontend chỉ là image/HTML viewer đơn giản — không iframe, không CSS injection.
- Cập nhật `wiki/index.md`.

## 2026-05-13 — fix — Per-book state leak when navigating between ebooks
- Root cause: React Router reuses `EbookReaderPage` instance across `/ebook/:id` routes — `readMode` và `location` giữ nguyên giá trị của sách trước, gây lỗi khi mở sách thứ 2 trở đi.
- Fix: gộp tất cả state reset (`loading`, `location`, `pageNumber`, `readMode`) vào một `useEffect([id])` duy nhất.
- Fix: đổi key của `<ReactReader>` thành `` `${id}-${readMode}` `` để force full remount khi đổi sách hoặc đổi mode.

## 2026-05-15 — lint
- **Orphans flagged (7):** wiki/ebook_migration_task.md, wiki/sources/draft/040526-mobile-ui-fe.md, wiki/sources/draft/080526-prometheus-standalone-container-infra.md, wiki/sources/draft/110526-jellyfin-features-extraction.md, wiki/sources/draft/110526-media-streaming-architecture-proposal-backend.md, wiki/sources/draft/110526-video-streaming-handover.md, wiki/sources/draft/130513-ebook-reader-rendering-issue.md — not linked from any other page or wiki/index.md
- **Missing links fixed (12):** Added [[DeezerEnricher]] in Architecture.md (3 places), tech-stack-decisions.md, JellyfinFeatures.md; [[SmartRadio]] in Architecture.md, Scanner.md, MobileUI.md; [[CleanArchitecture]] in VideoStreaming.md, 110526-media-streaming-architecture-proposal-backend.md, 110526-video-streaming-handover.md, 120526-add-ebook-support-media.md; [[MobileUI]] in music-giatbh-io-vn-evaluation.md
- **Contradictions flagged (2):** (1) concepts/AudioReliability.md, concepts/EbookEnhancements.md, concepts/EbookThemes.md, concepts/GaplessPlayback.md, concepts/LyricsUI.md all have "# Proposal:" titles despite living in `concepts/` (published) folder — inconsistent with draft/convention boundary. (2) concepts/AudioReliability.md:36 references draft `120526-fix-audio-interruption-audio.md` which does not exist in sources/draft/ — stale draft path.
- **Stale claims flagged (0):** No wiki page references a `raw/` source file (raw/ directory is empty except for .gitkeep/README.md).
- **Index gaps filled (7):** Added ebook_migration_task.md, 040526-mobile-ui-fe.md, 080526-prometheus-standalone-container-infra.md, 110526-jellyfin-features-extraction.md, 110526-media-streaming-architecture-proposal-backend.md, 110526-video-streaming-handover.md, 130513-ebook-reader-rendering-issue.md to wiki/index.md.
- **Empty pages flagged (0):** All wiki files have substantive content beyond headers.
- **Missing Origin flagged (2):** concepts/EbookEnhancements.md, concepts/EbookThemes.md — no `## Origin` section found; both are concept pages with proposal-style content lacking source attribution.

## 2026-05-25 — propose — Favorite Playlist Pill (Star + Dropdown)
- Tạo draft proposal `wiki/sources/draft/260525-favorite-playlist-pill.md` để chuẩn bị cho chức năng tạo/quản lý playlist yêu thích.
- Đề xuất giải pháp lưu trữ song song: Local (localStorage) và Permanent (SQLite + xác thực mật khẩu `owner712002`).
- Mô tả chi tiết giao diện Capsule/Pill `[ ★ | ▾ ]` cho mỗi bài hát và trang quản lý Playlist mới.
- Cập nhật `wiki/index.md`.

## 2026-05-25 — feature — Favorite Playlist Pill (Star + Dropdown)
- Triển khai thành công cụm nút Capsule/Pill `[ ★ | ▾ ]` bên cạnh mỗi dòng bài hát để yêu thích nhanh hoặc chọn đưa vào nhiều playlist.
- Hoàn thiện cơ chế lưu trữ kép linh hoạt: Local Playlists (lưu JSON vào `localStorage`) và Permanent Playlists (SQLite DB trên server).
- Tích hợp Modal xác thực mật khẩu chủ sở hữu `owner712002` ở phía client và xác thực chặt chẽ trên Go backend khi ghi dữ liệu vĩnh viễn.
- Cập nhật trang quản lý Playlists để xem, phát và tổ chức bài hát từ mọi loại danh sách phát.
- Promoted draft `260525-favorite-playlist-pill.md` → `wiki/concepts/FavoritePlaylistPill.md`.
- Cập nhật `wiki/index.md`.


## 2026-05-25 — propose — Trending Radial Menu Controls (Layer 3)
- Tạo draft proposal `wiki/sources/draft/260525-trending-radial-menu-controls-fe.md` để đưa bộ nút điều khiển trang Thịnh hành vào Lớp thứ 3 của Radial Menu (Nightingale Rose).
- Đề xuất loại bỏ các header controls trực quan trên trang `TrendingPage.tsx` và ánh xạ chúng thành 3 cánh hoa mờ tùy chọn (Chart, Grid, Refresh) ở vòng tròn ngoài cùng.
- Thiết lập hệ thống `CustomEvent` đồng bộ trạng thái hai chiều không phụ thuộc trực tiếp (zero-coupling) giữa menu toàn cục và trang nội dung.
- Cập nhật `wiki/index.md`.

## 2026-05-25 — feature — Trending Radial Menu Controls (Layer 3)
- Tích hợp thành công bộ nút điều hành trang Thịnh hành (Grid/Chart Mode và Refresh) vào Lớp đồng tâm thứ 3 ngoài cùng của Nightingale Rose Radial Menu.
- Mở rộng SVG petals container từ `300px` lên `400px`, dời tâm xoay về `(200, 200)` và tối ưu toạ độ vẽ concentric Layer 3.
- Áp dụng màu nền dimmer mờ (`0.45` opacity) và spin animation cho nút Refresh.
- Đồng bộ giao diện 2 chiều không kết nối trực tiếp (zero-coupling) qua hệ thống `CustomEvent` giữa `RadialNav.tsx` và `TrendingPage.tsx`.
- Promoted draft `260525-trending-radial-menu-controls-fe.md` → `wiki/concepts/TrendingRadialMenuControls.md`.
- Cập nhật `wiki/index.md`.

## 2026-05-27 — doc — 7 features documented: AI Analytics, Chat Sessions, Markdown rendering, Datetime prompt, album_id bug, Progress restore, Queue locking

- Commits: `961fe96` + `4e9d5f1` (album_id fix, already committed); rest is working tree on top of `5bcef19`
- **New concept files (7):**
  - `concepts/AIAnalytics.md` — AIStatsPage with Recharts (7 chart types), paginated logs tab, dislike flow (POST /api/ai/logs/{id}/dislike), backend stats endpoint
  - `concepts/AIChatSessions.md` — session_id UUID per conversation, sessions/session-messages API, restoreSession() rebuilds full conversation
  - `concepts/AIMarkdownRendering.md` — react-markdown + remarkGfm on assistant bubbles, 17 CSS rules for tables/code/lists
  - `concepts/AIDatetimeInjection.md` — time.Now().In(UTC+7) in system prompt so agent knows today
  - `concepts/PlayTrackAlbumIDFix.md` — SQL join fix: LEFT JOIN through albums (not t.artist_id which doesn't exist)
  - `concepts/ProgressRestoreReload.md` — beforeunload saves currentTime to localStorage
  - `concepts/QueueLocking.md` — lockedQueueRef blocks smart fill when explicit playlist playing
- All files have `## Origin` sections
- Updated `wiki/index.md` with 7 new concept entries


## 2026-06-11 — install-harness — mode=migrate
- Cài harness L0–L4 (validators, hooks, pre-commit, wiki-health, evals)
- ⚠ CÓ NỢ wiki (thiếu Origin / index lệch) — backfill trước khi tin Stop hook

## 2026-06-11 — install-harness — mode=migrate
- Cài harness L0–L4 (validators, hooks, pre-commit, wiki-health, evals)
- ⚠ CÓ NỢ wiki (thiếu Origin / index lệch) — backfill trước khi tin Stop hook

## 2026-06-11 — install-harness — mode=migrate
- Cài harness L0–L4 (validators, hooks, pre-commit, wiki-health, evals)
- ⚠ CÓ NỢ wiki (thiếu Origin / index lệch) — backfill trước khi tin Stop hook

## 2026-06-11 — install-harness — mode=migrate
- Cài harness L0–L4 (validators, hooks, pre-commit, wiki-health, evals)

## 2026-06-11 — harness-update — migrate/update xong, nợ đã backfill: 12 file

## 2026-06-11 — install-harness — mode=migrate
- Cài harness L0–L4 (validators, hooks, pre-commit, wiki-health, evals)

## 2026-06-12 — install-harness — mode=migrate
- Cài harness L0–L4 (validators, hooks, pre-commit, wiki-health, evals)

## 2026-06-12 — harness-update — migrate xong, nợ đã backfill: 0 file (wiki sạch)
- 2026-06-18 20:24 — session `50a0eb63` — 12 tool calls — files: 180626-distributed-db-citus-seq.html, 180626-distributed-db-citus.md, 180626-k8s-media-images-not-served.md, 180626-sw-blank-page-cf-cache.md, MEMORY.md, index.md, log.md, nginx.conf …

## 2026-06-18 — install-harness — mode=migrate
- Cài harness L0–L4 (validators, hooks, pre-commit, wiki-health, evals)
## 2026-06-19 — orca-onboard — wiki-generation — CozyArchitecture, OnboardingTour, ProjectStructure created
## 2026-06-19 — orca-onboard — phase4-html — 190626-onboard-cozyroom.html created
## 2026-06-19 — orca-onboard — all-phases-done — knowledge-graph.json, ONBOARDING.md, domain-graph.json, wiki (3 files), html created
