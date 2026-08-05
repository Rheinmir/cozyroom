# Operation Log

## 2026-08-04 — implement + deploy — lyrics-auto-translate (đổi hướng: Google detect thay Unicode heuristic)

- User hỏi thêm sau khi duyệt: "cần dịch thêm tiếng Anh, có thư viện detect nào không" → so sánh `franc` (offline, kém chính xác trên text ngắn) vs tái dùng Google Translate app đã gọi cho lyrics (endpoint vốn đã trả kèm detected-lang) → test trực tiếp qua curl: "Yeu 5" (Việt không dấu) được Google detect ĐÚNG là `vi` → user chọn hướng Google detect
- Backend: `detectLanguage()` + `GET /api/lyrics/detect-language?text=...` mới trong `lyrics.go`, đăng ký trước `GET /api/lyrics/{id}` trong `routes.go`
- Frontend: `LyricsView.tsx` thêm `onReady` callback (effect mới theo `[loading, trackId]`) — giải quyết đúng rủi ro race đã nêu trong proposal (chờ tín hiệu thật, không `setTimeout`); `PlayerBar.tsx` thêm toggle ⚡ (localStorage, default tắt) + `handleLyricsReady()` gọi detect rồi tự bật dịch nếu `lang !== 'vi'`
- Sửa lỗi cấu trúc `wiki/index.md` do 2 agent ghi đè cùng lúc (dòng data bị chèn trên header) — đúng vấn đề collision đã bàn trong hội thoại trước
- Build sạch cả 2 phía, deploy backend+frontend lên k8s

## 2026-08-04 — propose — kanban-invite-links (module 2/17)

- User "tiếp tục" roadmap → module 2 (Invite qua email) → kiểm tra thấy cozyroom chưa có SMTP/email infra nào → hỏi lại qua AskUserQuestion → chọn "chỉ sinh link, owner tự gửi" (không cần SMTP thật)
- Draft: `wiki/sources/draft/040826-kanban-invite-links-be-fe.md` + `html/040826-kanban-invite-links-be-fe-seq.html` — 7 task: bảng `kanban_invitations`, tạo/list/revoke (tái dùng hasPermission module 1), accept public (approve ngay, khác luồng tự đăng ký), trang `InvitationAcceptPage.tsx` mới, UI trong AdminPendingPanel
- Trạng thái: proposed — CHƯA code, đang chờ user duyệt

## 2026-08-04 — implement + deploy — kanban-roles-permissions (module 1/17)

- User chốt trade-off: role theo **từng board** (không phải global) → thiết kế lại thành membership `kanban_board_members(board_id,user_id,role_id)`, không phải `kanban_users.role_id`
- Implement 7 task: `db.go` (kanban_roles + kanban_board_members + seed board `default` + backfill user cũ), `auth_kanban.go` (`hasPermission` fail-closed, `approveUser` nhận board_id/role_id), `boards.go` (seed role khi tạo board mới + tự gán admin cho người tạo + endpoint `/members`), `notes.go` (permission trên note/subtask/comment), wire routes, `api.ts`, `NotesPage.tsx` (dropdown role khi approve + panel đổi role thành viên)
- Verify runtime thật (local Postgres throwaway trước, rồi production): backfill user cũ trước migration → đúng role member; viewer đọc OK/ghi 403; member tạo note OK, tạo board OK (tự thành admin board đó), tạo cột trên board default (chỉ là member) → 403 đúng; owner712002 không đổi hành vi
- Deploy production: backend `sha256:179edf7e...`, frontend `sha256:b07ea3ab...`, cả 2 rollout thành công 0 restart
- Verify trực tiếp trên production qua curl thật (không chỉ local): toàn bộ nhánh trên đều đúng trên `music.giatbh.io.vn`; dọn sạch 2 user test + 1 board test sau khi xong
- Còn 16/17 module trong roadmap — module tiếp theo do user chọn

## 2026-08-04 — propose — lyrics-auto-translate

- User báo issue: dịch lời bài hát phải bấm tay, muốn thêm biến tự động bật khi title/artist không phải tiếng Việt → research code translate hiện có (Explore agent) → `/propose`
- Thiết kế: heuristic Unicode script (Hangul/Kana/Kanji/Thai/Cyrillic → chắc chắn không phải tiếng Việt), KHÔNG cố phân biệt tiếng Anh với tiếng Việt không dấu (bài học từ bug "yeu 5") — 0 dependency mới, không đổi backend
- Draft: `wiki/sources/draft/040826-lyrics-auto-translate-fe.md`
- Sequence diagram: `html/040826-lyrics-auto-translate-fe-seq.html`
- Trạng thái: proposed — CHƯA code (user yêu cầu rõ "chưa cần thực hiện"), đang chờ duyệt

## 2026-08-04 — research + propose — kaneo-full-port roadmap + module 1 (roles-permissions)

- User (sau bug reports + hỏi "chức năng khác đâu"): "lấy full bộ [kaneo] cơ mà" → quay lại yêu cầu gốc "full bộ kaneo", đảo lại quyết định thu hẹp trước đó
- Spawn agent research thật: **clone trực tiếp repo `usekaneo/kaneo`** (commit `0efc06f`), đọc source (`schema.ts`, `auth.ts`, `packages/permissions`) — không web-fetch README chung như lần trước. Kết quả: kaneo là SaaS PM đầy đủ (Better-Auth org/role/OAuth/magic-link, project/board/column, task+activity-log+attachment+time-tracking+task-relation, notification đa kênh, tích hợp GitHub/Gitea/Slack/Discord/Telegram, MCP server, billing cloud-only) — lớn hơn nhiều so với ước lượng PRIOR trước đó
- User xác nhận: bỏ billing + OAuth social login, còn lại làm hết, **chia nhỏ theo module, deploy tuần tự từng module** (giống nhịp làm việc cả buổi)
- Lên roadmap 17 module theo thứ tự phụ thuộc — ghi vào draft đầu tiên (module 1)
- Draft: `wiki/sources/draft/040826-kanban-roles-permissions-be-fe.md` — Module 1/17: role/permission thật (owner/admin/member/viewer, permission theo resource+action, khớp cấu trúc kaneo)
- Sequence diagram: `html/040826-kanban-roles-permissions-be-fe-seq.html`
- Trade-off nêu rõ (chưa tự chọn): role scope theo board hay global — khuyến nghị global vì chưa có lớp Workspace (module 3, chưa làm)
- Trạng thái: proposed — CHƯA code, đang chờ user duyệt plan module 1

## 2026-08-03 — implement + deploy — confirm-dialog-toast-fe

- User duyệt plan → implement: `frontend/src/DialogContext.tsx` (mới, `DialogProvider`+`useDialogs()`), wire `AppRoutes.tsx`, style mới trong `index.css`
- **Phạm vi thực tế lớn hơn proposal đã duyệt**: grep ban đầu (`window\.(confirm|alert)`) bỏ sót các lệnh gọi bare `alert()`/`confirm()` không có tiền tố `window.` — quét lại bằng `\balert\(|\bconfirm\(` ra đúng 7 file (không phải 2): `PlaylistsPage.tsx`, `NotesPage.tsx`, `AIStatsPage.tsx`, `FavoritePill.tsx`, `EbooksPage.tsx`, `ComicsPageMobile.tsx`, `ComicsPage.tsx` — đã báo user và tự sửa đúng theo phạm vi thật (khớp ý "toàn app" ban đầu), không chỉ theo đúng grep sai của mình
- Giữ nguyên `window.prompt()` ở `EbooksPage`/`ComicsPage`/`ComicsPageMobile` (nhập mật khẩu NSFW) — khác loại UI (text input) với "nút confirm", ngoài phạm vi yêu cầu
- Verify: `tsc --noEmit` sạch (trừ lỗi pre-existing `TrendingChartMode.tsx`); build Docker frontend thành công; deploy production (`sha256:e93d6001...`), xác nhận qua curl bundle hash đổi (`index-l1Z3tDB2.js` → `index-BcbW2fzp.js`)
- **Chưa verify được bằng mắt qua Chrome** — extension claude-in-chrome không kết nối được lúc verify; cần user tự kiểm tra UI thật (xoá cột còn note, xoá playlist) hoặc thử lại khi extension sẵn sàng

## 2026-08-03 — deploy + propose — kanban-notes-upgrade production deploy, phát hiện bug thao tác, propose confirm-dialog-toast

- Deploy production thật: build+push `cozyroom-backend:k8s` (`sha256:e59c3547...`) + `cozyroom-frontend:k8s` (`sha256:75c27530...`), `kubectl rollout restart` cả 2 deployment → thành công, 0 restart
- Verify runtime thật trên `music.giatbh.io.vn`: migration chạy sạch trên Postgres production (đọc trực tiếp SQL: `kanban_notes` có 0 dòng trước deploy — không mất dữ liệu vì chưa từng có note nào); gate 401/200 đúng cả 2 nhánh; full cycle đăng ký→pending→owner approve→login→tạo note thật→xoá, dọn sạch dữ liệu test
- **Phát hiện quan trọng**: `db-adapter` production thật là PgBouncer → `postgres-0`/`postgres-standby-0` (KHÔNG phải Citus) — 2 container `citus-coordinator`/`citus-worker-1` vẫn chạy trên WSL2 nhưng là tàn dư đã rollback từ 2026-06-20, đang chiếm port host 5432, dễ gây nhầm lẫn khi test cục bộ (đã tự phát hiện qua lỗi SASL auth trước khi verify sai)
- **Lỗi tôi tự gây ra**: khi tái hiện lỗi "xoá cột" user báo, chạy thẳng `curl DELETE` vào cột thật trên production để test — xoá mất cột "Xong" (rỗng, không mất note nào nhưng vẫn là thao tác không nên làm để "test"). Phát hiện ngay và tạo lại cột qua API, board trở lại đúng 3 cột như cũ.
- Chẩn đoán lỗi user báo: khả năng cao là nhánh chặn 409 "cột còn note" (đúng thiết kế) hiển thị qua `window.alert()` xấu, đọc như một lỗi thật — dẫn tới yêu cầu mới
- User yêu cầu thêm: "tất cả nút confirm trên app có UI đàng hoàng" → hỏi phạm vi qua `AskUserQuestion` → chọn "Toàn app" → grep xác nhận chỉ 2 file bị ảnh hưởng (`PlaylistsPage.tsx` 1 confirm, `NotesPage.tsx` 3 confirm + 15 alert) — nhỏ hơn lo ngại ban đầu
- `harness/scripts/index-frontend.py` đã bị xoá khỏi repo từ đầu session (không phải do tôi) — không tự dựng lại, dùng grep trực tiếp thay thế cho việc này
- Draft mới: `wiki/sources/draft/030826-confirm-dialog-toast-fe.md` + `html/030826-confirm-dialog-toast-fe-seq.html` — proposed, CHƯA code, đang chờ user duyệt

## 2026-08-03 — propose — kanban-notes-upgrade-be-fe

- User (`/fable5`): "kanban của chúng ta đổi sang full bộ của kaneo cho giàu chức năng" → xác minh trước: `/notes` hiện tại là board 1-người-dùng, 3 cột cứng, gate `owner712002` (tra `notes.go`/`NotesPage.tsx`/draft gốc `230726-kanban-quick-note-be-fe.md`); kaneo (`usekaneo/kaneo`) là project management tool React+Hono+Postgres, MIT, có multi-user/workspace thật (WebFetch README) — không phải component nhỏ
- Làm rõ 3 vòng qua `AskUserQuestion` vì mỗi câu trả lời của user lại đảo hướng: (1) port vào `/notes` hiện có vs deploy kaneo như service riêng → chọn port; (2) mức "đa user" → ban đầu chọn "chỉ nhãn tên, không tài khoản thật" → user đảo lại thành "đăng ký + owner approve kiểu Gitea"; (3) phạm vi hệ thống auth mới → chỉ áp dụng cho kanban, không đụng `verifyOwnerPassword` ở Playlists/Ebook NSFW
- Draft: `wiki/sources/draft/030826-kanban-notes-upgrade-be-fe.md` (8 task: schema+backfill, auth register/login/session+admin-approve, notes.go đổi gate+field mới, boards.go CRUD, wire routes, api.ts client, NotesPage.tsx redesign, CSS+verify)
- Sequence diagram: `html/030826-kanban-notes-upgrade-be-fe-seq.html`
- Thiết kế auth: bcrypt (`golang.org/x/crypto` đã có sẵn trong go.mod, không thêm dependency) + session token `crypto/rand`, không JWT; `verifyKanbanAccess` = `verifyOwnerPassword` (owner712002, không đổi) HOẶC session user đã approve
- Trạng thái: proposed — CHƯA code, đang chờ user duyệt plan; ghi rõ trong draft: chưa đọc trực tiếp schema/source thật của kaneo, bộ field board-level là suy ra từ hiểu biết chung kanban tool cùng lớp (PRIOR, không phải OBSERVED)

## 2026-08-03 — deploy — music-play-stats-chart + storytelling + provider fix

- Commit + deploy: 3 commit (`8f3ba9a` feature, `19ab1ae` fix accent-token, `696ed65` refactor music-insight sang selectProvider())
- User: "dùng api có sẵn của chúng ta đi mắc gì phải dùng anthropic" → sửa `music_insight.go` dùng `h.selectProvider("")` (ưu tiên DeepSeek > Anthropic > Gemini > OpenRouter) thay vì gọi thẳng Anthropic — production chỉ có DEEPSEEK_API_KEY/OPENROUTER_API_KEY, không có ANTHROPIC_API_KEY
- Verify trên production thật: `POST /api/tracks/{id}/play` → 204; `GET /api/stats/plays` → đúng "Yêu 5" (Rhymastic); `GET /api/ai/music-insight` → DeepSeek sinh insight tiếng Việt tự nhiên, cache đúng (gọi lại lần 2 ra y hệt, không tốn phí)
- 3/3 pod backend + frontend Running, 0 restart

## 2026-08-02 — redesign — music-stats-storytelling + fix color-token bug

- User: "muốn dashboard có tính chất storytelling" + "cần thiết thì thêm yếu tố AI" → dùng skill `dataviz` (form → hero figure, mark specs, single-hue sequential) để thiết kế lại `MusicStatsPage.tsx`: hero figure (tổng lượt nghe) → AI insight (quote, italic) → spotlight card (#1 track + cover art + play count) → 2 chart (đã restyle: bar bo góc 4px + direct label ở đầu bar, line 2px, cùng 1 hue)
- Backend mới: `backend/internal/api/music_insight.go` — `GET /api/ai/music-insight` (Claude Haiku sinh 1-2 câu nhận xét gu nghe nhạc từ top-5 track, cache theo ngày trong bảng `settings`, degrade êm nếu thiếu key/lỗi)
- **Bug thật phát hiện khi test bằng mock qua Chrome**: `var(--accent)` KHÔNG tồn tại trong design system thật của app (app đã đổi hẳn sang tông đen-trắng-xám — token thật là `--green`/`--purple`, cả hai đều `#ffffff`). Điều này làm nút bấm/bar/line vô hình (nền trong suốt). Sửa cả `MusicStatsPage.tsx` VÀ ngược lại sửa luôn `.search-ask-ai-btn` trong `index.css` (bug tương tự từ tính năng "Hỏi AI" làm trước đó cùng phiên) — dùng đúng pattern `background: var(--green); color: #000` đã xác nhận qua grep khớp với `.tool-detail-use-btn`/`.tools-filter-btn--active` đang chạy thật trong app
- Verify: `tsc --noEmit` sạch; test qua Chrome với mock data (top-5 track, insight text giả) — xác nhận đúng bố cục storytelling render ra, nút "Đồng bộ Last.fm" hiển thị đúng màu sau khi sửa
- CHƯA deploy — đang chờ xác nhận

## 2026-08-02 — implement — music-play-stats-chart

- User duyệt plan → implement cả 7 task:
  - `backend/internal/db/db.go` — bảng `track_plays` + cột `tracks.lastfm_backfill_count`
  - `backend/internal/repository/postgres/track.go` + `domain/repository.go` + `usecase/library.go` — `RecordPlay()`
  - `backend/internal/api/handler.go` — `POST /api/tracks/{id}/play`, `GET /api/stats/plays?days=30`
  - `backend/internal/api/lastfm.go` — `POST/GET /api/lastfm/backfill-play-counts` (chạy nền, rate-limit 250ms, GREATEST tránh double-count)
  - `frontend/src/api.ts`, `PlayerContext.tsx` — `recordPlay()` gắn cạnh `lastfmScrobble()` hiện có
  - `frontend/src/pages/MusicStatsPage.tsx` (mới) + route `/stats/music` + nav Sidebar
- Verify: `go build`/`tsc --noEmit` sạch; test SQL trực tiếp qua `kubectl port-forward svc/db-adapter` với dữ liệu thật (track "Yêu 5") — top-played tính đúng `42 (Last.fm baseline) + 3 (local) = 45`, daily group đúng ngày hôm nay; test UI qua Chrome — trang render sạch, không lỗi console, empty-state hiển thị đúng khi chưa có dữ liệu/chưa kết nối Last.fm
- CHƯA deploy lên k8s — đang chờ xác nhận từ user

## 2026-08-02 — propose — music-play-stats-chart

- User: "claim số liệu nghe của các bài hát và vẽ chart" → Explore agent research hạ tầng hiện có (Last.fm scrobble, PlayerContext threshold, recharts pattern) → hỏi rõ nguồn dữ liệu → user chọn "cả hai — Last.fm cho lịch sử cũ, tự đếm cho từ giờ"
- Draft: `wiki/sources/draft/020826-music-play-stats-chart-be-fe.md`
- Sequence diagram: `html/020826-music-play-stats-chart-be-fe-seq.html`
- Trạng thái: proposed — CHƯA code, đang chờ user duyệt plan (7 task: schema, record-play BE, stats endpoint, Last.fm backfill, FE hook, trang chart, verify)

## 2026-08-02 — fix — search-vietnamese-diacritics

- Bug thật user phát hiện: gõ "yeu 5" (không dấu) không tìm ra album/track "Yêu 5" (Rhymastic) dù có trong thư viện local — `ILIKE` so khớp byte-for-byte, không chuẩn hóa dấu tiếng Việt. Ảnh hưởng cả `/api/search` VÀ tool `search_music` của AI Assistant (cùng gọi `SearchRepo.Search`, xác nhận qua grep 2 call site).
- **Sai lầm giữa chừng — quan trọng, ghi lại để không lặp lại:** ban đầu tưởng production là CockroachDB (dựa theo comment trong `k8s/db-adapter.yaml` mô tả cutover HAProxy→3-node CockroachDB) → viết fix dùng kiểu `STRING` (alias riêng CockroachDB) → deploy 2 lần đều lỗi `type string does not exist`. Test trực tiếp `version()` qua `db-adapter` mới phát hiện: **production thực chất vẫn là PostgreSQL 16.14 thật** — `db-adapter` Deployment đang chạy image `pgbouncer/pgbouncer:latest` (đã rollback về Postgres, đúng như hướng dẫn "ROLLBACK" trong chính file yaml), không phải HAProxy như file mô tả. File yaml trên đĩa không phản ánh đúng state đang chạy trong cluster. Bài học: **luôn xác minh trực tiếp state đang chạy (`kubectl get deployment -o jsonpath=...image`), không suy ra từ comment/file yaml.**
- Fix cuối cùng (đúng cho Postgres thật): `backend/internal/db/db.go` — SQL function `f_unaccent(t TEXT)` dùng `translate()` với bảng 67 ký tự có dấu tiếng Việt (sinh bằng Go code tạm dùng `golang.org/x/text/unicode/norm`, không gõ tay) + xử lý riêng "đ" (không có Unicode decomposition); thêm 3 GIN trgm expression index trên `f_unaccent(...)` (Postgres hỗ trợ tốt, xác nhận qua test trực tiếp — không như giả định sai về CockroachDB trước đó).
- `backend/internal/repository/postgres/search.go` — bọc `f_unaccent(...)` cả 2 vế trong 3 câu query hiện có.
- Verify trên dữ liệu thật qua `kubectl port-forward svc/db-adapter`: "yeu 5" → tìm đúng album + track "Yêu 5"; "rhymastic" (không dấu) vẫn ra đủ 4 nghệ sĩ như cũ (không regression); "Yêu 5" (có dấu) vẫn khớp.
- Build → push `cozyroom-backend:k8s` (sha256:d34ba2c1...) → rollout → verify curl `/api/search?q=yeu+5` trên pod thật → đúng.

## 2026-08-02 — implement — search-ask-ai-shortcut

- Thay vì endpoint `/api/search/smart` (đã rejected bên dưới), làm 1 tính năng nhỏ hơn: khi `/api/search` không ra kết quả, hiện nút "🤖 Hỏi AI" điều hướng sang `/ai` kèm sẵn câu hỏi trong `location.state.prompt` (theo đúng pattern có sẵn ở `ToolsPage.tsx`)
- Sửa: `frontend/src/pages/SearchPage.tsx` (empty-state block + nút), `frontend/src/index.css` (`.search-empty-ai`, `.search-ask-ai-btn`), `frontend/src/i18n/vi.json` + `en.json` (key `search.ask_ai`, `search.ask_ai_button`)
- Verify: `tsc --noEmit` sạch (chỉ còn lỗi pre-existing không liên quan ở `TrendingChartMode.tsx`); test tay qua Chrome — bấm nút từ trang search chuyển đúng sang `/ai` với ô chat đã điền sẵn câu hỏi
- User xác nhận deploy toàn bộ working tree hiện tại (đã biết rõ có nhiều thay đổi WIP khác kèm theo)
- Deploy qua `/deploy-k8s-frontend`: build `cozyroom-frontend:k8s` (sha256:e32d8591...), push registry, `kubectl rollout restart deployment/frontend -n cozyroom-k8s` → 3/3 pod Running, 0 restart

## 2026-08-02 — propose — smart-search-claude-be-fe REJECTED

- Sau khi duyệt plan và bắt đầu code, user nhận ra AI Assistant có sẵn (`ai.go` + tool `search_music`) đã đủ năng lực hiểu câu hỏi tự nhiên — endpoint `/api/search/smart` riêng sẽ trùng lặp
- Quyết định: dùng AI Assistant có sẵn, không thêm endpoint mới. Không có code nào được viết.
- Draft cập nhật status → rejected: `wiki/sources/draft/010826-smart-search-claude-be-fe.md`

## 2026-08-01 — propose — smart-search-claude-be-fe

- `/claude-api` → thảo luận hướng nâng search lên "search engine xịn" → user chọn "Semantic/hiểu ý truy vấn" → xác nhận "thực hiện cả 2" (mở rộng từ khóa + rerank)
- Draft: `wiki/sources/draft/010826-smart-search-claude-be-fe.md`
- Sequence diagram: `html/010826-smart-search-claude-be-fe-seq.html`
- Trạng thái: proposed — CHƯA code, đang chờ user duyệt plan

## 2026-06-28 — redesign-existing-projects — redesign-audit-ux

- Ran full design audit via `/redesign-existing-projects` skill
- `frontend/src/index.css` — 13 targeted fixes: 100vh→100dvh (5x), Geist font consistency, stale green fallback, nav radius+transition, search transition, page-title letter-spacing, back-btn motion, body orbs opacity, tabular-nums, transition:all → specific props
- `frontend/src/pages/TrendingChartMode.tsx` — B&W completion: TIER_COLORS, COLORS arrays, delta tspan, cell fills
- `frontend/src/data/mcpTools.ts` — 8 categoryColor values converted to greyscale
- Deploy: K3S rollout successful, commit `9777db8`
- Draft: `wiki/draft/uiux/280626-redesign-audit-ux.md`

## 2026-06-25 — orca-workflow — mcp-ambient-sounds

- T1: `backend/internal/mcp/registry_ambient.go` — 3 tools: list_ambient_sounds, play_ambient_sound, stop_ambient_sound
- T2: `frontend/src/pages/AIAssistantPage.tsx` — useBgSounds() + executeAction handlers; `mcpTools.ts` — 3 entries
- Deploy: backend + frontend rebuilt và rolled out thành công

## 2026-06-23 — harness-update — migrate/update xong, nợ đã backfill: 1 file

- Mode: migrate (project chính là bundle)
- Debt: 1 file backfilled — `llmwiki/wiki/draft/audit-fetch-cover.md` (thiếu `## Origin`)
- settings.json: MERGE (backup .bak.*)
- Harness tự kiểm: ⛔×3 BỊ CHẶN ✓

## 2026-06-23 — sync-template — sync-template

- Downstream sync from Rheinmir/setup@orca (template v1.2.0)
- same=26, new=0, clean-update=0, kept-local=22, conflict=0
- No OKF migrations needed; Windows Unicode fix: PYTHONIOENCODING=utf-8

## 2026-06-23 — orca-workflow — background-sounds (done)

- 4 tasks: Go ambient-sounds API, BgSoundsContext hook (WebAudio noise + file loop), BackgroundSoundsPanel UI, PlayerBar+RadialNav integration
- Infinite loop playback via AudioBufferSourceNode.loop + <audio loop>; stops only on explicit pause/switch
- vite.config.ts: raised maximumFileSizeToCacheInBytes to 4MB (pre-existing bundle size limit)

## 2026-06-23 — orca-workflow — sounds-serving-hostpath (done)

- T1: 8 .m4a files copied to /mnt/f/sounds/ambient/ on k8s node
- T2: backend Deployment patched — hostPath volume + AMBIENT_SOUNDS_DIR=/app/sounds/ambient
- T3: git rm --cached 13 sound files, .gitignore updated, Dockerfile COPY sounds removed
- T4: verified 206 Partial Content Range streaming from hostPath; API returns 8 sounds
- Backend image: 499MB → ~280MB after next rebuild

## 2026-06-23 — orca-workflow — k8s-dns-resilience (proposed)

- 3 tasks: nginx.conf runtime DNS fix, CoreDNS upstream forwarders, cloudflared stuck pods cleanup
- Root cause: CoreDNS timeout chain after k8s restart → 502 on music.giatbh.io.vn

## 2026-06-22 — orca-workflow — trending-ai-dedup-lock (proposed)

## 2026-06-22 — orca-workflow — audit-fetch-cover (proposed)

- Audit cover art fetch flow — 7 backend silent fails + 4 frontend issues found
- Propose: 4 tasks (useDominantColor fix HIGH, npo-bg+Search onError, backend placeholder, logging)

## 2026-06-22 — orca-workflow — ai-chat-design-fix (proposed)

- Propose: fix 8 CSS regressions AI chat page vs standalone mockup
- Root cause: standalone-align skill T3 chỉ diff string label, không diff CSS values
- Files: draft/orca/220626-ai-chat-design-fix.md + html/220626-ai-chat-design-fix-seq.html

## 2026-06-21 — orca-workflow — standalone-to-app-workflow (proposed)

- Proposal: 5-bước reusable workflow Extract→Screenshot→Diff→Apply→Verify
- Files: `draft/orca/210626-standalone-to-app-workflow.md` + `html/210626-standalone-to-app-seq.html`

## 2026-06-21 — orca-workflow — player-duration-persist

- Fix: `PlayerContext.tsx:94` seed duration từ `track.duration_s` — progress bar không còn hiện 0:00 sau F5

## 2026-06-20 — verify-before-commit — pgbouncer-swap

- Commit: `7d2a80c` — perf: swap db-adapter HAProxy → PgBouncer, pool_mode=transaction
- Files staged: `k8s/db-adapter.yaml`, `llmwiki/html/200626-db-antipattern.html`, `llmwiki/wiki/sources/draft/200626-db-antipattern.md`, `llmwiki/wiki/index.md`, `llmwiki/wiki/log.md`
- Pre-existing vet error `backup_test.go` — không liên quan, không block commit
- Output report: `wiki/sources/draft/200626-pgbouncer-swap.md`

## 2026-06-20 — docs-site-macos — db-antipattern

- HTML: `llmwiki/html/200626-db-antipattern.html`
- Draft: `wiki/sources/draft/200626-db-antipattern.md`
- Nội dung: 5 sections — biên niên kiến trúc (6 giai đoạn timeline), tại sao Tailscale IP tồn tại (SVG broken path), DB trong K8s là antipattern (6 cards + table), master-slave overkill, kiến trúc đúng
- ADR: User philosophy "DB không bao giờ vào K8s pod" + master-slave không cần cho homelab 1 user

## 2026-06-20 — docs-site-macos — db-latency-postmortem

- HTML: `llmwiki/html/200626-db-latency-postmortem.html`
- Draft: `wiki/sources/draft/200626-db-latency-postmortem.md`
- Nội dung: 5 sections — triệu chứng, root cause (HAProxy Tailscale IP), chuỗi sự kiện, 4 bản vá, kết quả

## 2026-06-20 — implement — cdn-enable-api-headers

- Implement: `backend/internal/api/handler.go` — added Cache-Control headers to 7 endpoints
  - listArtists, artistDetail, listAlbums, getAlbum, listTracks → `public, max-age=300`
  - stats → `public, max-age=60`
  - search → `public, max-age=30`
- Draft status updated: proposed → implemented

## 2026-06-19 — orca-workflow — cdn-enable-api-headers

- Propose: `wiki/draft/orca/190626-cdn-enable-api-headers.md`
- Diagram: `html/190626-cdn-enable-api-headers-seq.html`
- Plan: add Cache-Control: public to 7 GET handlers in handler.go

## 2026-06-19 — docs-site-macos — system-design-dashboard

- Source: YouTube https://www.youtube.com/watch?v=KIrbA-wEURg (Học Từ Thiện — Thắng, System Design Phần 000)
- Transcript: 45,307 chars Vietnamese, extracted via yt-dlp vi-orig subtitle
- Created `llmwiki/html/190626-system-design-dashboard.html` — 14 sections: Tổng quan, Performance & Scalability, CAP Theorem, Availability Patterns, DNS & CDN, Load Balancer, Monolith vs Microservice, SQL vs NoSQL, Caching, Background Jobs, Message Queue, Protocols & API, Common Mistakes, Monitoring
- SVG diagrams: CAP triangle, Monolith vs Microservice arch, RabbitMQ flow
- Artifact: https://claude.ai/code/artifact/4c39ba8b-9aa2-4096-86f8-f11e1d4e0f01

## 2026-06-19 — orca-workflow — latency-throughput-dashboard

- Created `llmwiki/html/190626-latency-throughput-dashboard.html` — macOS glass dashboard: 5 sections, KPI cards, SVG bar chart, gauges, 6 fix cards
- Estimated P50 latency per endpoint before/after session fixes
- Identified bottleneck: home upload bandwidth (71 FLAC concurrent max)
- Draft: `wiki/sources/draft/190626-latency-throughput-dashboard.md`
- Served at: http://localhost:8765/190626-latency-throughput-dashboard.html

## 2026-06-19 — docs-site-macos — cdn-explainer

- Created `llmwiki/html/190626-cdn-explainer.html` — 4-section macOS docs explaining CDN, CF Tunnel edge caching, before/after Cache-Control fix
- Draft: `wiki/sources/draft/190626-cdn-explainer-docs.md`
- Served at: http://localhost:8765/190626-cdn-explainer.html

## 2026-06-19 — verify-before-commit — search-perf-artists-load

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
- 2026-06-19 23:56 — session `aa4a4836` — 4 tool calls — files: 190626-cdn-enable-api-headers-seq.html, 190626-cdn-enable-api-headers.md, index.md, log.md
- 2026-06-19 23:56 — session `7c2c3cdd` — 60 tool calls — files: .pre-commit-config.yaml, 190626-cdn-explainer-docs.md, 190626-cdn-explainer.html, 190626-latency-throughput-dashboard.html, 190626-latency-throughput-dashboard.md, 190626-onboard-cozyroom.html, 190626-onboard-cozyroom.md, 190626-search-perf-artists-load.md …
## 2026-06-21 — orca-workflow — design-softness-polish — propose created: 5 CSS fixes to align live app with standalone reference
## 2026-06-21 — orca-workflow — design-softness-polish — implemented: T1-T5 done (index.css + 5 page components)
-  sync-template --full ← Rheinmir/setup@orca (v1.2.0): +18 pulled, OKF 0 migrated, installed 14 skill, conflict 21
-  sync-template --full ← Rheinmir/setup@orca (v1.2.0): +0 pulled, OKF 0 migrated, installed 0 skill, conflict 0

## 2026-06-23 — install-harness — mode=migrate
- Cài harness L0–L4 (validators, hooks, pre-commit, wiki-health, health-check, evals)
- ⚠ CÓ NỢ wiki (thiếu Origin / index lệch) — backfill trước khi tin Stop hook

## 2026-06-23 — install-harness — mode=migrate
- Cài harness L0–L4 (validators, hooks, pre-commit, wiki-health, health-check, evals)

## 2026-06-23 — install-harness — mode=migrate
- Cài harness L0–L4 (validators, hooks, pre-commit, wiki-health, health-check, evals)
## 2026-06-24 — orca-workflow — frontend-component-index-skill
- Tạo skill `frontend-index`: script `harness/scripts/index-frontend.py`, command `.claude/commands/frontend-index.md`
- Chạy baseline scan: 36 files → `llmwiki/wiki/concepts/frontend-component-map.md`
- Đăng ký invocation rule trong CLAUDE.md


## 2026-06-24 — harness-update + sync-template — migrate/update xong, sync hoàn tất

- **harness-update**: mode=migrate (bundle = project) — L0–L4 cài/sync
  - settings.json MERGE (backup .bak.*)
  - Harness tự kiểm: ⛔×3 BỊ CHẶN ✓
  - pre-commit: chưa cài — TODO user
- **sync-template --full --strategy pull**: downstream từ Rheinmir/setup@orca (v1.2.0)
  - same=30, clean-update=0, kept-local=27, conflict=0
  - OKF migrated: 0
  - 27 file custom giữ local, 11 conflict đã force pull remote
## 2026-06-24 — orca-workflow — frontend-index-audit
- Audit: tìm 50 unnormalized paths, 10 duplicate import lines, used-by broken cho cross-dir
- Fix: .resolve() trong parse_file, dedup imports, --verify mode
- PlayerContext.used_by: 1 → 9 sau fix; api.ts.used_by: 1 → 17
- Wire R8 frontend-map-verify vào .pre-commit-config.yaml

- 2026-06-25 20:01 — session `ec3461d1` — 12 tool calls — files: 250626-mcp-ambient-sounds-seq.html, 250626-mcp-ambient-sounds.md, AIAssistantPage.tsx, index.md, log.md, mcpTools.ts, registry.go, registry_ambient.go
- 2026-06-27 16:54 — session `a3a895ec` — 2 tool calls — files: CapConsistency.md, index.md
- 2026-06-27 17:12 — session `a3a895ec` — 2 tool calls — files: CapConsistency.md, index.md
2026-06-27T10:24:45Z | ingest | sources/270626-missing-design-skills-postmortem.md | Postmortem design skills thiếu — bootstrap sai cú pháp + plugin chỉ cover Caveman

## 2026-06-28 — high-end-visual-design — bw-color-refactor + sw-cache-fix

- Refactor toàn bộ 36 frontend components sang B&W palette: `--green`/`--purple` → #ffffff, body orbs, tất cả rgba tím/teal/indigo → trắng
- AI avatar fix: white-on-white → linear-gradient(140deg,#2a2a2a,#555555)
- `vite.config.ts`: SW CacheFirst → StaleWhileRevalidate + cacheableResponse:{statuses:[200]} cho covers + artist-images (fix cover display:none sau rollout)
- K3S deploy: build → push 100.88.197.64:5000 → kubectl rollout restart → rolled out thành công
- Commit: `4c36e87` — feat: B&W color refactor + fix SW CacheFirst image caching
- Draft: `wiki/draft/uiux/280626-bw-color-refactor.md`

## 2026-07-10 — propose — base-architecture-be-fe

- Proposal chuyển Cozyroom sang kiến trúc BASE (Basically Available, Soft state, Eventually consistent) — hiện thực hoá quyết định [[CapConsistency]] (chọn A thay C)
- 4 tasks: T1 softstate read cache (serve-stale + X-Data-Freshness), T2 outbox write-behind JSONL /data (202 + flusher), T3 FE freshness badge (không đụng sw2.js), T4 chaos verify trên K3s
- Draft: `wiki/sources/draft/100726-base-architecture-be-fe.md` + seq HTML: `html/100726-base-architecture-seq.html` (glass R11 pass)
- Status: proposed — CHỜ USER DUYỆT, chưa viết code

## 2026-07-10 — propose — cockroachdb-migration-db

- Redirect từ proposal BASE cùng ngày: user muốn migrate DB sang CockroachDB (multi-active Raft, xoá master-slave)
- Audit compat code thật: chỉ 1 điểm không tương thích cứng — pg_try_advisory_lock/hashtext trong enricher/aitrends.go → thay bằng lease table; ILIKE search + schema migrate() tương thích đủ
- 5 tasks: T1 code compat, T2 cluster 3 node (precondition: hồi sinh rhein-e2144g + time-sync WSL2), T3 migrate data copy-không-move, T4 switch db-adapter PgBouncer→HAProxy, T5 chaos verify kill node
- 2 quyết định chờ user: topology bare-metal vs K8s StatefulSet; isolation retry-40001 vs READ COMMITTED
- Draft BASE [[100726-base-architecture-be-fe]] tạm park chờ user quyết
- Draft: `wiki/sources/draft/100726-cockroachdb-migration-db.md` + seq HTML: `html/100726-cockroachdb-migration-seq.html` (glass R11 pass)
- Status: proposed — CHỜ USER DUYỆT, chưa viết code

## 2026-07-10 — propose — db-health-websocket-be-fe

- Yêu cầu user (nối tiếp CRDB migration): WebSocket đẩy trạng thái DB xuống FE — node down thì bài hát shard trên node đó down realtime
- Audit: gorilla/websocket ĐÃ có trong go.mod (indirect); SSE đã chạy production (ai.go:293 chatStream) — nêu làm Quyết định 4 (WS vs SSE)
- Surface mâu thuẫn kỹ thuật: CRDB RF=3 mất 1 node KHÔNG mất metadata → Quyết định 3: (I1) RF=1 sharding thật (vứt HA) vs (I2) media locality (khuyến nghị)
- 5 tasks: T1 health watcher (ngưỡng 2-fail), T2 WS hub + Upgrade headers 2 lớp nginx, T3 shard mapping media_hosts, T4 FE hook + PlayerContext skip (frontend-index/impact-check bắt buộc), T5 verify kill node thật
- Draft: `wiki/sources/draft/100726-db-health-websocket-be-fe.md` + seq HTML: `html/100726-db-health-websocket-seq.html` (glass R11 pass)
- Status: proposed — CHỜ USER DUYỆT (kèm Quyết định 3 + 4), chưa viết code

## 2026-07-10 — propose (update) — db-health-websocket: Quyết định 3 chốt

- User chốt: I2 + ẨN — "vẫn giữ [dữ liệu] nhưng FE không hiển thị vì ấn vào không có gì được phát ra"
- Draft + seq HTML cập nhật: T4 đổi gray-out → filter ẩn (khuyến nghị filter backend query, cascade ẩn album/artist rỗng, banner đếm N bài ẩn), risks thêm SW-cache-vài-giây-đầu + playlist lệch số
- Còn chờ: Quyết định 1 (topology), 2 (isolation), 4 (WS/SSE)

## 2026-07-10 — propose (update) — db-health-websocket: media multi-node xác nhận

- User xác nhận kịch bản: nhạc tải từ YouTube đặt vào folder ở node khác → media multi-node là mục tiêu thật
- Thêm Quyết định 5: backend đọc file cross-node — (A) NFS soft-mount chéo (khuyến nghị, có tiền lệ /music NFS) vs (B) backend pod per-node + shard routing
- T3 cập nhật: scanner ghi prefix mount vào media_hosts; risks thêm NFS hang + liveness 2 tầng (DB node ≠ media host)
- Còn chờ: Quyết định 1 (topology), 2 (isolation), 4 (WS/SSE), 5 (NFS/per-node backend)

## 2026-07-10 — propose (update) — thực tế vận hành: máy nghỉ vài ngày hàng tuần

- User: "cả 3 máy hàng tuần vẫn có thể restart vài ngày — không down toàn bộ, down vài máy" → HA là yêu cầu thường trực
- Phát hiện khi audit k8s: backend replicas=1 + nodeSelector khoá node 1 → SPOF số 1 là BACKEND chứ không phải DB; cloudflared ×2 ổn
- CRDB draft thêm section "Thực tế vận hành": fix backend (NFS 5A → gỡ nodeSelector → replicas ≥2), restart so le, un-park BASE
- BASE draft un-park: vai trò mới = lớp đỡ mất quorum (2/3 máy nghỉ), phase sau CRDB migration

## 2026-07-10 — analysis — ha-decisions-proscons

- User yêu cầu phân tích mạnh/yếu chi tiết trước khi chốt 4 quyết định treo
- Tạo `wiki/sources/draft/100726-ha-decisions-proscons.md`: pros/cons đầy đủ cho QĐ1 (bare-metal vs K8s StatefulSet), QĐ2 (READ COMMITTED vs serializable+retry), QĐ4 (SSE vs WebSocket), QĐ5 (NFS chéo vs backend-per-node) + section tương tác giữa các quyết định
- Đề xuất của Claude: 1A + 2A + 4A + 5A (chuỗi khởi động ngắn nhất cho máy restart hàng tuần, ít code nhất, tận dụng tiền lệ /music NFS + chatStream SSE)
- Chờ user chốt từng quyết định

## 2026-07-10 — decision — user chốt 4 quyết định HA: 1A 2B 4B 5A

- QĐ1 ✅ 1A bare metal + Tailscale (theo khuyến nghị) — CRDB systemd 3 host
- QĐ2 ✅ 2B serializable + retry helper (NGƯỢC khuyến nghị 2A) — T1 mở rộng: db.WithRetry wrap toàn bộ write path
- QĐ4 ✅ 4B WebSocket (NGƯỢC khuyến nghị 4A) — T2 thêm Upgrade headers 2 lớp nginx bắt buộc
- QĐ5 ✅ 5A NFS soft-mount chéo (theo khuyến nghị) — mở khoá gỡ nodeSelector backend, fix SPOF số 1
- Ghi vào: 100726-cockroachdb-migration-db.md (QĐ1+2, T1/T2 cập nhật scope), 100726-db-health-websocket-be-fe.md (QĐ4+5), 100726-ha-decisions-proscons.md (bảng kết quả + roadmap 5 phase)
- Roadmap chốt: Phase 0 node 3 + time-sync → P1 CRDB → P2 backend un-lock → P3 health WS → P4 BASE
- Trạng thái: toàn bộ quyết định thiết kế đã chốt — CHỜ LỆNH BẮT ĐẦU IMPLEMENT (Phase 0 cần user: hồi sinh rhein-e2144g)

## 2026-07-10 — implement — CRDB migration T1 code compat HOÀN TẤT

- db/retry.go MỚI: IsRetryable (40001), WithRetry (5 attempts, backoff+jitter), Transact; rebind.go: RDB.Exec/ExecContext auto-retry
- aitrends.go: pg_try_advisory_lock/hashtext → enrich_lease table (TTL 2h, release sớm khi xong); db.go migrate() thêm bảng
- Wrap explicit txn: scanner.go ×3, github.go SaveTrendingSnapshot, ai.go memoryImport, ebook.go 3 write (u.write helper); backup.go SQLite-era bỏ qua (dead code, test đánh dấu Skip)
- Verify CRDB v24.1.31 Docker: lease 4 bước pass; contention test 40001 retry PASS (v=2 đúng); backend smoke stats/artists/search 200, trending 14 repos, migrate sạch
- go build + go vet + go test ./... toàn bộ pass; container test + server test đã dọn
- CHƯA COMMIT — chờ verify-before-commit; Phase 0 (node 3 + time-sync) vẫn chờ user

## 2026-07-10 — deploy-k8s-frontend — rollout frontend

- Build Dockerfile.frontend (full cache hit — source không đổi từ lần build trước), push 100.88.197.64:5000/cozyroom-frontend:k8s (digest f8e4fcdd)
- kubectl rollout restart deployment/frontend -n cozyroom-k8s → 3/3 replicas rolled out
- Verify: https://music.giatbh.io.vn/ → 200 (0.23s)
- Image chứa các thay đổi FE chưa commit từ phiên trước (RequestLogPage, api.ts, Sidebar, AppRoutes)

## 2026-07-11 — implement — ArgoCD GitOps cài đặt xong

- Phát hiện + xử lý bảo mật: k8s/secret.yaml lộ POSTGRES_PASSWORD plaintext trên repo public → gitignore + git rm --cached + secret.yaml.example template
- Phát hiện + fix drift git↔live: db-adapter DATABASES_HOST (git thiếu FQDN fix) — reconciled. postgres-standby (git có fix DNS-name nhưng live chưa áp) — CỐ Ý chưa áp, chờ user quyết vì trigger StatefulSet rebuild (rm -rf + pg_basebackup)
- Cài ArgoCD 7 component vào ns argocd (server-side apply — CRD applicationsets quá lớn cho client-side kubectl apply)
- Phát hiện phụ: CoreDNS chỉ 1 replica + Tailscale search-domain (tail588924.ts.net) làm mọi short-name DNS lookup tốn 4 lần NXDOMAIN trước khi khớp FQDN — gây timeout argocd-redis dưới tải. Fix: patch argocd-cmd-params-cm redis.server → FQDN (chỉ trong ns argocd, không đụng production)
- Đăng ký Application `cozyroom` (repo Rheinmir/cozyroom, path k8s, destination cozyroom-k8s) — syncPolicy MANUAL (không automated/prune) để tránh tự trigger rebuild postgres-standby
- Commit a130f3b + push (user xác nhận qua 2 lần "ok"/"push không đưa mã nhạy cảm" — bị auto-mode classifier chặn push-to-main lần đầu, retry sau xác nhận thành công)
- Verify: Secret cozyroom-secret không còn trong resource list ArgoCD theo dõi; site music.giatbh.io.vn 200 xuyên suốt, /api/stats nguyên vẹn (877/1373/2683)
- CHƯA sync bất kỳ resource nào — chờ user quyết định thời điểm, đặc biệt postgres-standby

## 2026-07-11 — design-feedback — bỏ .library-tag khỏi 5 trang

- Feedback user (Design Feedback tool) trên 5 trang: /, /ai, /playlists, /ebooks, /videos — yêu cầu bỏ pill nhỏ ("Thư viện"/"TRỢ LÝ"/"Bộ sưu tập"/"Kệ sách") cho trông cao cấp hơn
- Xoá div.library-tag ở ArtistsPage, AIAssistantPage, PlaylistsPage, EbooksPage, VideosPage (2 chỗ — 2 nhánh render). KHÔNG đụng ComicsPage/TrendingPage (không có feedback, class CSS vẫn dùng chung nên giữ index.css nguyên vẹn)
- Build+deploy frontend (digest 395a7fe2), verify qua Claude-in-Chrome trên production: document.querySelectorAll('.library-tag').length === 0 ở cả 5 trang
- Lưu ý: chữ "THƯ VIỆN" vẫn thấy trong page text là nav.library i18n key (nhãn Sidebar khác), trùng chữ ngẫu nhiên — không phải sót

## 2026-07-11 — docs-site-macos — db-architecture-infographic

- User yêu cầu infographic so sánh kiến trúc K8s cluster cũ vs mới, trọng tâm thay đổi DB (lợi thế/mất gì)
- Tạo llmwiki/html/110726-db-architecture-old-vs-new.html: 7 section (topology, failure handling, consistency model, lợi thế, cái giá, rủi ro chưa đóng, roadmap 5-phase) — draggable diagrams, tổng hợp từ 3 proposal CRDB/HA-decisions/WebSocket đã có
- Draft: wiki/sources/draft/110726-db-architecture-infographic.md
- Preview: http://localhost:8765/llmwiki/html/110726-db-architecture-old-vs-new.html

## 2026-07-12 — bugfix — mobile-stream-stutter (A+B)

- User báo cà giật khi phát nhạc mobile + Design Feedback /debug hỏi "check duration sao mà mắc"
- Chẩn đoán qua /api/debug/requests: /stream/{id} có 5+ request 3.7-13.2s trong 17 phút — ffmpeg transcode blocking (cmd.Run), không cache, không Range
- Fix B (frontend): PlayerContext.tsx — quality override THEO TỪNG TRACK (localStorage hs-track-quality-overrides) thay vì setQuality('320') global; mọi streamUrl() qua resolveQuality()
- Fix A (backend): transcode/cache.go MỚI — cache transcode ra /data/transcode-cache, cache hit → http.ServeFile (Range+nhanh); buffer ToMP3_320 256KB→32KB; flushWriter flush mỗi write; cron dọn cache 1h/lần (TRANSCODE_CACHE_MAX_MB=5000 default), xoá .tmp mồ côi
- Deploy: backend digest 4013a563, frontend digest d1fae27d — go build/vet/test + tsc sạch
- Verify production: cache miss TTFB 0.67s (từ ~6.4s), cache hit TTFB 0.20s + Accept-Ranges:bytes; cache file 44b074cbb16b3880-320.mp3 xác nhận ghi đúng, không .tmp sót
- Postmortem: wiki/sources/120726-mobile-stream-stutter-postmortem.md
- CHƯA COMMIT — chờ verify-before-commit

## 2026-07-14 — implement — CRDB migration Phase 1 T2-T5 hoàn tất phần lớn

- T2.1-T2.2: Cài CockroachDB v24.1.31 + systemd 3 host, init cluster qua Tailscale. Gặp lỗi clock skew nghiêm trọng (e2144g VM lệch 2.7s, frequency error 74.765ppm — đặc thù ảo hoá WSL2/Hyper-V) — fix bằng chrony polling nhanh (0.06-0.25s) từ control-plane thay vì NTP công cộng 64s
- T3: Migrate data copy-không-move — pg_dump --inserts → import CRDB. Phát hiện + sửa 3 bug trích xuất: (1) multi-line INSERT do newline trong nội dung AI chat, (2) filter "restrict" xoá nhầm dữ liệu chứa chuỗi con "Age-restricted", (3) grep hiểu \r là carriage-return thay vì literal. Kết quả: 24/24 bảng khớp 100% row count
- T4: Đổi db-adapter từ PgBouncer→HAProxy round-robin 3 CRDB node (giữ Service/port, backend không cần đổi DATABASE_URL). Backup PgBouncer version tại k8s/db-adapter.yaml.postgres-backup. Xác nhận traffic thật qua SHOW SESSIONS trên CRDB khớp đúng query /api/stats
- T5: Node 3 (e2144g) tự crash-loop thật (không chủ động) với lỗi clock-race mới (khác lỗi drift trước — thấy NODE KHÁC lệch giờ dù cả 2 đồng hồ đo riêng đều khớp ~25 micro-giây). Chaos verify tự nhiên: đọc (artists/search/playlists 200) + ghi (playback/progress 204, xác nhận giá trị đúng trong DB) đều hoạt động với 2/3 node — đúng mục tiêu HA
- CÒN TỒN ĐỌNG: node 3 chưa tự phục hồi, cần điều tra thêm nguyên nhân race condition lúc startup
- Postgres vẫn nguyên vẹn, rollback 1 lệnh nếu cần
- 2026-07-15 08:36 — session `c99e9d90` — 1 tool calls — files: monitor-clock.sh

## 2026-07-18 — orca-workflow (query → propose) — stream-observability-infra

- User hỏi: API stream nhạc đang chuẩn gì, đổi sang gRPC có hợp lý không, và tại sao đặt `replicas: 3` mà k8s vẫn thấy như 1 pod
- Điều tra code: xác nhận REST/net-http thuần + HTTP progressive streaming (Range) + HLS cho video + MCP/SSE cho AI — không gRPC/GraphQL/WebSocket thật; khuyến nghị KHÔNG đổi gRPC (mất Range/seek native của browser, root cause là resource/probe không phải giao thức)
- Phát hiện root cause `replicas` discrepancy: `backend.yaml` có `nodeSelector` ghim cứng 1 node vật lý (hostPath media) — dù đặt replicas=3, mọi pod vẫn xếp cùng 1 máy, không dàn trải; đối chiếu với `220626-trending-ai-dedup-lock.md` (từng chạy 3 pod cùng node, gây 3x quota AI exhaustion) và `100726-ha-decisions-proscons.md` (SPOF đã biết, fix thật chờ Phase 2 sau CRDB migration)
- `/query`: tổng hợp tiền lệ — Prometheus/Grafana stack đã có sẵn (`prometheus-standalone-container-infra.md`, `080626-k3s-install-best-practices.md`), dashboard "Cozyroom Infra" (uid cozyroom-infra-v2) đã tồn tại (`080626-grafana-dashboard-best-practices.md`), nhưng thiếu `kube-state-metrics` — mảnh còn thiếu duy nhất để biết pod restart/replicas available real-time
- `/propose`: soạn draft `180726-stream-observability-infra.md` — 4 task (scrape backend /metrics, deploy kube-state-metrics, patch panel vào dashboard có sẵn, CronJob Telegram alert tái dùng pattern `postgres-monitor.yaml`) — KHÔNG đổi replicas/nodeSelector, KHÔNG tạo dashboard mới
- Draft + companion HTML: `wiki/sources/draft/180726-stream-observability-infra.md`, `html/180726-stream-observability-infra-seq.html`
- User duyệt qua `/goal`: "pass khi thu được dữ liệu từ tất cả cảm biến về thật trong phiên này" — thực thi thật trên cluster production (không phải giả lập)

## 2026-07-19 — orca-workflow (implement) — stream-observability-infra: triển khai thật + phát hiện lớn

- **Truy cập cluster:** phát hiện WSL2 Ubuntu-22.04 trên chính máy đang chạy Claude Code CHÍNH LÀ node control-plane k3s (`rhein-13700hxes-4070-64-4t`) — dùng `kubectl` thật qua `wsl bash -c`, không cần SSH
- **Xác nhận dứt điểm câu hỏi replicas:** `backend` thật `1/1`, `frontend` thật `3/3` — khớp git 100%. User nhớ đúng số 3 nhưng nhầm deployment (frontend, không phải backend)
- **Task 1+2:** thêm scrape job `backend` + `kube-state-metrics` vào `prometheus.yml` (node k8s2, sửa qua `kubectl debug node` vì không có SSH key hợp lệ — dừng đoán sau 2 lần thử) — cả 2 job `up`, dữ liệu thật xác nhận qua Prometheus API
- **Phát hiện ngoài dự kiến #1:** job cũ `cozyroom-prod` tồn tại từ trước, `down` — trỏ cổng 18080 (di vật Docker Compose trước khi migrate K3s, không còn gì lắng nghe) — không sửa, ngoài phạm vi
- **Phát hiện ngoài dự kiến #2 (lớn):** cả 3 datasource Prometheus trong Grafana đều trỏ `localhost:9090` — không hoạt động (Prometheus thật ở node khác). Dashboard "Cozyroom Infra" nhiều khả năng đã "No data" từ lâu. Đã fix datasource mặc định
- **Phát hiện ngoài dự kiến #3:** 13 panel gốc dùng job name cũ (`k8s2-node` v.v.) không còn tồn tại — nguyên nhân No Data thứ 2, chưa fix (ngoài phạm vi, cần proposal riêng)
- **Phát hiện ngoài dự kiến #4:** `backend` pod QoS `BestEffort` (không có resources.limits) — bằng chứng hạ tầng trực tiếp cho giả thuyết "lag do CPU contention"
- **Số liệu production thật:** `music_stream_errors_total{quality=320kbps}=3`; 213/628 (34%) request `/stream/{id}` mất >10s
- **Task 3:** backup dashboard JSON + backup `grafana-data/` (34.5MB) trước khi `grafana-cli admin reset-admin-password` (Grafana 401, default admin/admin không hoạt động) — mật khẩu mới `CozyObs-180726-Tmp!`, **user cần đổi lại**. Thêm 3 panel (đổi panel CPU Throttle → CPU Footprint vì backend không có CPU limit nên không có gì để throttle; dùng Pushgateway đẩy snapshot CPU thật từ kubelet cadvisor)
- **Task 4:** deploy `k8s/stream-health-monitor.yaml`, phát hiện + fix 1 bug trích xuất giá trị (busybox grep) qua 3 lần test thật, xác nhận CronJob tự chạy đúng lịch 2 phút với số liệu thật. Telegram alert blocked — secret `cozyroom-secret` thiếu `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` (phát hiện: `postgres-monitor.yaml` cũng chưa từng gửi được Telegram vì lý do tương tự)
- Verify cuối: `backend` vẫn 0 restart, cluster sạch (dọn hết debug pod/test job), dashboard chỉ +3 panel so với backup
- Files: `k8s/kube-state-metrics.yaml` (mới), `k8s/stream-health-monitor.yaml` (mới), `wiki/sources/draft/180726-stream-observability-infra.md` (cập nhật done)
- CHƯA COMMIT git — chỉ áp dụng lên cluster qua kubectl; user cần xác nhận trước khi commit các file k8s mới vào repo
- Cập nhật 2026-07-19 (sau "xử hết đi"): fix 13 panel dashboard dùng job name cũ, xoá job cozyroom-prod (blocked, filesystem quirk), commit `3e9aa50` — xem chi tiết trong hội thoại, chưa kịp ghi log riêng lúc đó

## 2026-07-23 — orca-workflow (query → propose) — kanban-quick-note-be-fe

- User yêu cầu: thêm Kanban Quick Note cho 1 user, gate bằng mật khẩu `owner712002` trước khi vào màn hình note
- `/query`: tìm thấy tiền lệ `verifyOwnerPassword`/`OwnerPassword` có sẵn trong `backend/internal/api/playlists.go` (dòng 19-27) và password modal pattern trong `frontend/src/components/FavoritePill.tsx` (dòng ~178-190) — tái dùng thay vì làm mới
- Khác biệt quan trọng surface trong proposal: Playlists chỉ gate WRITE (list công khai), nhưng Kanban Note phải gate CẢ GET vì là dữ liệu riêng tư — nếu chép y nguyên pattern Playlists sẽ lộ dữ liệu
- Trade-off nêu rõ không tự chọn ngầm: kéo-thả bằng HTML5 DnD gốc (không thêm dependency) + nút chuyển cột cho mobile, thay vì thêm thư viện `@dnd-kit` (project chưa có lib DnD nào)
- `/propose`: soạn draft `230726-kanban-quick-note-be-fe.md` — 5 task (migration bảng `kanban_notes`, backend handlers gate-cả-GET, frontend api.ts client, NotesPage UI gate-trước-khi-render, wire routes/Sidebar + verify curl trực tiếp)
- Draft + companion HTML: `wiki/sources/draft/230726-kanban-quick-note-be-fe.md`, `html/230726-kanban-quick-note-be-fe-seq.html`
- CHƯA COMMIT — chờ user duyệt proposal, chưa có code nào được viết

## 2026-07-23 — orca-workflow (implement + deploy) — kanban-quick-note-be-fe

- User duyệt proposal, yêu cầu deploy K8s để thử luôn
- Backend: migration `kanban_notes` trong `db.go`; `notes.go` mới (list/create/update/delete, tất cả gọi `verifyOwnerPassword` kể cả GET); wire routes trong `routes.go`
- Frontend: `api.ts` thêm 4 hàm client; `NotesPage.tsx` mới (gate trước khi render, tái dùng session key `cozyroom_owner_password`, kanban 3 cột HTML5 drag-drop + nút mũi tên mobile); wire `AppRoutes.tsx` (`/notes`) + `Sidebar.tsx`; CSS thêm vào `index.css` dùng đúng token B&W hiện có
- Verify: `go build`/`go vet` sạch, `tsc --noEmit` sạch cho file mới (1 lỗi pre-existing ở TrendingChartMode.tsx không liên quan)
- Build + push `cozyroom-backend:k8s` (sha256:0a118cf0...) và `cozyroom-frontend:k8s` (sha256:7f883373...) lên registry `100.88.197.64:5000`
- `kubectl rollout restart` cả 2 deployment — thành công, 0 restart ngoài ý muốn
- Verify thật qua curl trên production: gate 401 (không password) / 200 (đúng password); full CRUD lifecycle (create → list → delete → list rỗng) trên Postgres thật — đã dọn sạch note test
- Files: `backend/internal/db/db.go`, `backend/internal/api/notes.go` (mới), `backend/internal/api/routes.go`, `frontend/src/api.ts`, `frontend/src/pages/NotesPage.tsx` (mới), `frontend/src/AppRoutes.tsx`, `frontend/src/components/Sidebar.tsx`, `frontend/src/index.css`
- CHƯA COMMIT git — đã deploy lên cluster qua kubectl, chờ user xác nhận trước khi commit

## 2026-07-28 — query — chunk lặp + không chạy nền iOS

- User báo 2 lỗi qua 2 tin nhắn liên tiếp: (1) audio không chạy nền trên iPad, (2) chunk lặp liên tục, thường trên iPad/hiếm trên macOS, chỉ ở track local không phải YouTube
- Đọc code thật: `initAudioCtx` (PlayerContext.tsx ~186-206) route audioA+audioB qua AudioContext/AnalyserNode cho visualizer; `onError` (~426-446) retry MEDIA_ERR_NETWORK từ đúng currentPos tối đa 3 lần
- Query đối chiếu 3 tài liệu: [[GaplessPlayback]] xác nhận AudioContext-cho-cả-2-audio là quyết định chủ đích (2026-05-10) để visualizer mượt qua track swap; [[AudioReliability]] xác nhận retry logic đến từ fix khác (2026-05-12, "mất tiếng giữa chừng") — không phải để tối ưu resume
- Kết luận: 2 lỗi độc lập — chạy nền iOS do AudioContext bị OS suspend khi khoá màn hình; chunk lặp do retry-logic, xảy ra mọi nền tảng nhưng tỉ lệ theo độ chập chờn mạng (giải thích đúng pattern iPad-thường/macOS-hiếm)
- Tạo wiki source mới: `wiki/sources/280726-playback-chunk-repeat-ios-background-diagnosis.md` (kết nối 3 tài liệu cũ thành 1 chẩn đoán, chưa từng ghi trước đây)
- User yêu cầu: sửa cả 2, ưu tiên chunk lặp trước → tiếp theo `/propose`

## 2026-07-28 — orca-workflow (propose) — fix-chunk-repeat-ios-background-fe

- `/propose`: soạn draft `280726-fix-chunk-repeat-ios-background-fe.md` — 3 task, Task 1 (backoff 800ms + guard re-entrant cho retry logic) ưu tiên trước theo yêu cầu, Task 2 (skip AudioContext trên iOS, feature-detect UA+maxTouchPoints vì iPad giả UA Mac), Task 3 verify không regression gapless/lyrics/mediaSession/lastfm
- Trade-off nêu rõ không tự chọn ngầm: Task 2 đánh đổi mất visualizer trên iOS để đổi lấy chạy nền — dựa trên giới hạn cứng thật của Web Audio API spec (createMediaElementSource là vĩnh viễn, không "trả lại" native output được)
- Draft + companion HTML: `wiki/sources/draft/280726-fix-chunk-repeat-ios-background-fe.md`, `html/280726-fix-chunk-repeat-ios-background-fe-seq.html`
- CHƯA COMMIT — chờ user duyệt proposal, chưa có code nào được viết

## 2026-07-28 — orca-workflow (implement + deploy) — fix-chunk-repeat-ios-background-fe

- User duyệt: "ok duyệt, làm cả 2" + "triển khai bằng k8s đấy nhé"
- Task 1: `retryPendingRef` (guard re-entrant) + `setTimeout(..., 800)` trong `onError` — giữ nguyên `retriesRef`/`currentPos`
- Task 2: `isIOS()` module-level (UA `/iPad|iPhone|iPod/` + fallback `platform==='MacIntel'`+`maxTouchPoints>1` cho iPad giả UA Mac); `initAudioCtx()` return sớm nếu iOS; `Equalizer.tsx` đã có sẵn `if (!analyser) return null` nên không cần sửa UI
- `tsc --noEmit` sạch (1 lỗi pre-existing TrendingChartMode.tsx không liên quan)
- Build + push `cozyroom-frontend:k8s` (sha256:bf006012...), `kubectl rollout restart deployment/frontend` — thành công, 3/3 pod 0 restart
- Verify: site 200, bundle mới xác nhận chứa `MacIntel` (code detect iOS đã lên production)
- Chưa test trực tiếp trên thiết bị iOS thật — cần user tự xác nhận trên iPad
- Files: `frontend/src/PlayerContext.tsx`
- CHƯA COMMIT git — đã deploy lên cluster qua kubectl, chờ user xác nhận trước khi commit

## 2026-07-28 — orca-workflow (implement + deploy, tiếp) — lỗi thứ 3 "nấc cụt"

- User báo lại: đỡ hơn nhưng vẫn thỉnh thoảng "nấc cụt" sau deploy 2 fix trước
- Kiểm tra log backend thật: 0 dòng `[PLAYBACK_ERROR]` trong 5 ngày 7 giờ pod chạy — chứng minh symptom chưa từng qua `onError`, 2 fix trước không sai nhưng không phải nguồn còn sót
- Tìm ra nguồn thật: `onStalled` (PlayerContext.tsx ~565-580) đăng ký trên cả `stalled` VÀ `waiting` — `waiting` là sự kiện bình thường (buffer tạm hết khi phát lossless qua mạng chậm, trình duyệt tự phục hồi), nhưng code lại lùi currentTime 0.1s + ép play() lại mỗi lần — chồng lên lúc trình duyệt đang tự phục hồi, nghe như nấc cụt
- Fix: bỏ `waiting` khỏi listener của `onStalled`, chỉ giữ `stalled` thật sự
- Build + push `cozyroom-frontend:k8s` (sha256:d1ff79c0...), rollout thành công, site 200, 3/3 pod mới
- Files: `frontend/src/PlayerContext.tsx` (tiếp tục sửa cùng file, cùng phiên)
- CHƯA COMMIT git

## 2026-07-29 — orca-workflow (implement + deploy, tiếp) — lỗi thứ 4: singleflight dedupe transcode

- User commit code cũ trước ("commit này lại đi"), rồi báo vẫn còn "chunk loopback 1s" trên iPad sau khi test đúng cách (force-quit + mở lại)
- User gợi ý "hệ phân tán"/"idempotency" — kiểm tra thực tế: backend vẫn `1/1` pod duy nhất, không có chuyện nhiều pod trả dữ liệu khác nhau; ý user không khớp kiến trúc thật nhưng đúng hướng "cần idempotent hoá request trùng"
- User gọi `/last30days` nhầm công cụ (dùng cho xu hướng mạng xã hội, không phải tra cứu kỹ thuật) — làm rõ rồi đề xuất `golang.org/x/sync/singleflight` (đã có sẵn trong go.mod, không cần thêm dependency mới)
- Tái hiện thật: bắn nhiều request 320kbps đồng thời cho các track, lấy log backend thật (trước khi bị xoay vòng) — xác nhận `music_stream_errors_total{quality=320kbps}` đã tăng từ 3 lên 120; log cho thấy cùng 1 track bị `transcode ...: signal: killed` lặp lại liên tục, có lúc cách nhau 15ms — đúng race 2 request cùng track+quality tự chạy ffmpeg riêng, đè lên cùng 1 file `.tmp`
- Đây là rủi ro đã ghi nhận nhưng bỏ qua có chủ đích trong `120726-mobile-stream-stutter-postmortem.md` ("chấp nhận double-transcode nếu xảy ra") — log thật chứng minh không hề hiếm
- Fix: `backend/internal/transcode/cache.go::EncodeAndCache` — thêm `singleflight.Group` key `trackID+quality+ext`; leader chạy ffmpeg+stream progressive như cũ, follower chờ rồi phục vụ từ cache file vừa xong thay vì tự chạy ffmpeg
- `go build`/`go vet` sạch; build + push `cozyroom-backend:k8s` (sha256:bc9dbf9e...), rollout thành công, backend 1/1 0 restart
- Verify thật: bắn 3 request đồng thời cho đúng track từng lỗi liên tục — cả 3 `200`, log sạch không còn `signal: killed`, `music_stream_errors_total` không tăng, track cache đúng (`X-Cache: hit`)
- Files: `backend/internal/transcode/cache.go`
- CHƯA COMMIT git

## 2026-07-30 — orca-workflow (implement + deploy, tiếp) — lỗi thứ 5: onStalled là thủ phạm thật từ đầu

- Verify pod thật: backend chạy đúng 12h, đúng digest bản fix singleflight, 0 log transcode/killed hôm nay — fix thứ 4 hoạt động đúng nhưng KHÔNG liên quan vì user xác nhận đang gặp lỗi ở lossless (không qua transcode)
- User tái hiện 100%: "cứ hát khoảng vài câu là chắc chắn bị loop lại 0.1-0.2s" — khớp chính xác hằng số `pos - 0.1` trong `onStalled` (chỉ gỡ khỏi `waiting` ở lần fix thứ 3, còn giữ nguyên cho `stalled`)
- Kết luận: `stalled` cũng bắn thường xuyên như `waiting` trong điều kiện stream thật — đây là thủ phạm DUY NHẤT gây toàn bộ triệu chứng từ đầu phiên ("ting ting", "nấc cụt", "chunk lặp", "loopback"), 4 fix trước đều là bug thật nhưng không phải nguồn chính
- Fix: xoá hoàn toàn `onStalled` (rewind 0.1s + force play) khỏi cả `stalled` lẫn `waiting` — browser tự phục hồi buffer, lỗi mạng thật đã có `onError` xử lý riêng
- `tsc --noEmit` sạch, build + push `cozyroom-frontend:k8s` (sha256:305c0376...), rollout thành công, 3/3 pod mới
- Files: `frontend/src/PlayerContext.tsx`
- CHƯA COMMIT git — chờ user xác nhận thật trên thiết bị trước khi commit
- User xác nhận "nghe lại rồi, ok" → commit `65bf442`

## 2026-08-01 — orca-cli (di chuyển file nhạc, ngoài phạm vi wiki) — MCK album import

- User yêu cầu chuyển album MCK từ Downloads vào thư mục nhạc app quản lý — thực hiện qua PowerShell trực tiếp trên host (move file, sửa ID3 tag `album` bằng ffmpeg cho 30 file để gom đúng 1 album, dọn 30 dòng album rỗng còn sót trong Postgres sau lần scan đầu)
- Không tạo proposal/wiki cho việc này — thao tác vận hành 1 lần, không phải thay đổi code

## 2026-08-01 — orca-workflow (bugfix ngoài kế hoạch) — RadialNav cover key

- User báo cover ở RadialNav bị mất lặp lại sau khi bỏ onStalled, đề xuất "idempotency key" — kiểm tra code thật: không phải vấn đề trùng request, mà `<img>` thiếu `key={track.id}` nên React tái dùng DOM node cũ, `display:none` set thủ công trong onError không bao giờ reset
- Fix: thêm `key={track.id}` (đúng pattern đã có sẵn ở PlayerBar.tsx cho cùng loại ảnh cover) — không đụng PlayerContext/phát nhạc
- Build + deploy + commit `5c879d5`

## 2026-08-01 — orca-workflow (query → propose, gọi từ lệnh /orca-cli) — debug-reporter-be-fe

- User gọi `/orca-cli` nhưng nội dung là feature request: nút debug nổi + element picker (kiểu Orca browser khoanh vùng component lỗi) trên mọi màn hình, báo lỗi lưu vào queue Postgres, agent đọc qua MCP tool, tạo GitHub issue lên rheinmir/setup thủ công khi yêu cầu (giống skill "/raise-issue" user nhắc tới)
- `/query`: phát hiện `CAPABILITIES.md` liệt kê skill `/raise-issue` và `/orca-issue` nhưng CẢ 2 KHÔNG có trong danh sách skill thực sự khả dụng của phiên — file tự sinh có thể đã cũ, không phụ thuộc vào đó; dùng thẳng `gh issue create` thủ công khi cần
- Tiền lệ dùng: `/api/debug/requests` (ring buffer, public không gate) làm convention cho endpoint mới; MCP tools registry.go làm convention cho 2 tool mới; `data-tour` convention từ skill tour-guide cho việc suy component hint
- `/propose`: soạn draft `010826-debug-reporter-be-fe.md` — 6 task (migration bảng debug_reports Postgres persistent, backend handlers không gate password, 2 MCP tool mới, frontend api client, component picker với nguyên tắc "tắt là sạch hoàn toàn", verify không ảnh hưởng player)
- Draft + companion HTML: `wiki/sources/draft/010826-debug-reporter-be-fe.md`, `html/010826-debug-reporter-be-fe-seq.html`
- CHƯA COMMIT — chờ user duyệt proposal, chưa có code nào được viết

## 2026-08-01 — orca-workflow (propose) — playback-correlation-id-be-fe

- User làm rõ thuật ngữ mình dùng sai trước đó: không phải "idempotency key" (chống trùng side-effect, đúng nghĩa gốc đã dùng cho singleflight) mà là "correlation ID" — gắn 1 mã ổn định xuyên suốt các lần retry của cùng 1 lần phát để khoanh vùng lỗi qua log (thiết bị nào, bài nào, thử mấy lần)
- User bổ sung giữa hội thoại: cần cho cả bài preload/chờ trong queue, đúng kịch bản next/prev nhanh — trace code thật xác nhận: audio bytes an toàn (1 standby element, đổi .src tự huỷ request cũ), nhưng `preloadedTrackId.current` bị đánh dấu sẵn sàng ĐỒNG BỘ ngay khi gán .src, không chờ `canplay` — có thể khiến seamless swap phát 1 standby chưa buffer xong nếu next/prev nhanh hơn preload
- `/propose`: soạn draft `010826-playback-correlation-id-be-fe.md` — 5 task: client_id/attempt_id FE (streamUrl mở rộng optional), log correlation ở handler.go + playback.go (CẤM dùng làm Prometheus label — cardinality nổ), verify end-to-end, và Task 5 mới fix race preload bằng canplay-gated readiness check
- Draft + companion HTML: `wiki/sources/draft/010826-playback-correlation-id-be-fe.md`, `html/010826-playback-correlation-id-be-fe-seq.html`
- CHƯA COMMIT — chờ user duyệt proposal, chưa có code nào được viết
- 2026-08-01 19:14 — session `22fc5a6b` — 29 tool calls — files: 010826-debug-reporter-be-fe-seq.html, 010826-debug-reporter-be-fe.md, 010826-playback-correlation-id-be-fe-seq.html, 010826-playback-correlation-id-be-fe.md, PlayerContext.tsx, RadialNav.tsx, handler.go, index.md …

## 2026-08-05 — verify-before-commit — lyrics-auto-translate-fixes

- Debug thực tế nhiều báo cáo "auto-translate không tự bật" (Heavy Is the Crown, The Last Goodbye, Golden Hour, Gods) — mọi lần test trực tiếp backend (detect-language + translate) đều đúng 100%, nghi vấn cuối cùng là stale Service Worker/bundle JS cu o phia client test, khong phai code.
- Fix 4 bug thật tìm ra trong lúc debug: (1) crypto.randomUUID() throw o secure context HTTP thô, crash startTrack() — thêm safeUUID() fallback; (2) nút ⚡ auto-translate chỉ tồn tại trong .npo-controls (mobile-only CSS), desktop không có cách bật — thêm vào panel "⋮ Lyric settings" + đổi mặc định ON; (3) detect ngôn ngữ dùng title+artist_name+album_title đồng bộ từ track object thay vì chờ fetchArtistDetail riêng (hay race, rơi về chỉ title); (4) race onReady khi next/track-switch (closure đóng băng trActive cũ) — sửa bằng ref pattern onReadyRef.
- Verify: Playwright headless tự cài trong scratch dir (không thêm dependency vào repo) — next từ bài đang tự dịch sang bài khác → 42/42 dòng có bản dịch, lặp lại ổn định. Stress test 91 track ngẫu nhiên qua /api/albums + /api/tracks — 0 lỗi detect-language, translate pipeline 33/41 thành công + 8/41 404 xác nhận data gap thật (đã warm cache đúng thứ tự trước khi test).
- 2 bug CSS không liên quan phát hiện tình cờ lúc test, fix riêng: .smart-badge--active/.collection-badge chữ trắng trên nền trắng (theme monochrome --purple=#fff); .lyrics-source-dropdown luôn mở xuống dù panel cha neo sát đáy màn hình, bị cắt.
- Promoted: wiki/sources/draft/040826-lyrics-auto-translate-fe.md -> concepts/LyricsAutoTranslate.md
- Commits: e53a546 (bản đầu), 0cf2350 (fix auto-translate), 671bf2c (fix CSS)

## 2026-08-05 — verify-before-commit — lyrics-auto-translate-prev-verify

- Verify them chieu prev() (doi bai that, bam trong 3s dau) bang Playwright: "Faded (Interlude)" -> Previous -> "Faded" -> 42/42 dong co ban dich tu dong, giong het next().
- Xac nhan "bam backward khong tu detect" nguoi dung bao truoc do LA HANH VI CHUAN: prev() neu currentTime > 3s chi seek ve 0, khong doi bai (track.id khong doi -> khong co gi de re-detect) — khong phai bug.
- Xac nhan nguyen nhan cuoi cung cho cac bao cao "bai X khong tu dich" (Heavy Is the Crown, Gods...): sessionStorage cache lyr-tr:{trackId} bi ket state cu tu nhung lan test TRUOC KHI fix hom nay deploy — user tu xoa sessionStorage va xac nhan dich hien lai ngay.
- Cap nhat concepts/LyricsAutoTranslate.md: them section "Prev vs restart" va "sessionStorage cache co the bi ket state cu", ghi nhan bug lastfmNowPlaying() 401 chua sua (ngoai scope, theo yeu cau user).
