# PRD — Prompt của các Engineer Agent

Tài liệu này lưu lại **nguyên văn prompt** đã giao cho từng subagent (engineer) trong quá trình kiểm kê tính năng để dựng PRD. Mục đích: lưu vết (audit), tái sử dụng khi cần regenerate PRD, và minh bạch nguồn gốc mỗi section.

- **Bối cảnh chung** gửi cho mọi agent: viết PRD cực chi tiết cho app Cozyroom (homelab media app, single-tenant). Mỗi agent kiểm kê ĐẦY ĐỦ domain của mình từ code thật rồi trả về MỘT section PRD hoàn chỉnh (markdown, tiếng Việt), KHÔNG ghi ra đĩa.
- **Định dạng yêu cầu mỗi feature:** tên + mô tả, user flow, Yêu cầu chức năng (FR-xxx đánh số), business rules/ràng buộc/gotchas, edge cases, file/endpoint chính (cite path). Cuối section: endpoint API, data model touchpoints, yêu cầu phi chức năng.
- Output từng agent được **tổng hợp trực tiếp vào `PRD.md`** (một file PRD duy nhất), không tách file rời.

| # | Engineer (subagent_type) | Section trong PRD.md |
|---|---|---|
| 1 | `music-engineer` | Domain: Âm nhạc |
| 2 | `video-engineer` | Domain: Phim & Video |
| 3 | `reader-engineer` | Domain: Sách & Truyện tranh |
| 4 | `ai-engineer` | Domain: Trợ lý AI & MCP |
| 5 | `social-engineer` | Domain: Playlist, Ghi chú & Xu hướng |
| 6 | `infra-engineer` | Kiến trúc & Hạ tầng |
| 7 | `general-purpose` | Frontend, Điều hướng & Trải nghiệm |

---

## 1. music-engineer — Domain: Âm nhạc

> Bạn đang giúp viết một PRD (Product Requirements Document) cực chi tiết cho app Cozyroom (homelab media app, single-tenant). Nhiệm vụ của bạn: kiểm kê ĐẦY ĐỦ và CHI TIẾT toàn bộ chức năng thuộc domain ÂM NHẠC từ code thật, rồi trả về MỘT SECTION PRD hoàn chỉnh (markdown, tiếng Việt) cho domain này.
>
> Phạm vi domain music: tracks/albums/artists, tìm kiếm (smart search), phát nhạc/streaming, hàng đợi (queue), smart radio/shuffle modes, Last.fm scrobble/insight, số liệu nghe (play stats/music stats), lyrics (fetch, hiển thị, auto-translate), player UI (PlayerBar, NowPlaying overlay, mini player, vinyl disc play button), chất lượng (lossless/320), gapless playback, scanner thư viện, cover/artwork, Discover page (khám phá, gợi ý).
>
> Hãy đọc code thật: search.go, lastfm.go, music_insight.go, scanner.go, track/album/artist repos, PlayerContext.tsx, PlayerBar.tsx, LyricsView.tsx, SearchPage/ArtistsPage/ArtistPage/AlbumPage/AlbumsPage/TracksPage/MusicStatsPage/DiscoverPage, QueueList.tsx, RadialNav.tsx, VinylDisc.tsx, và các API endpoint liên quan trong routes.go.
>
> Với MỖI tính năng, trình bày: tên + mô tả ngắn; hành vi người dùng / luồng; Yêu cầu chức năng (FR-xxx đánh số) cụ thể, đo được; business rules / ràng buộc / gotchas (vd: yt: prefix cho YouTube, chọn provider, cách tính stats); edge cases đã xử lý trong code; file/endpoint chính (cite path).
>
> Cuối section thêm: các endpoint API của domain (method + path + mô tả), data model touchpoints, và yêu cầu phi chức năng liên quan (performance/reliability) mà code thể hiện.
>
> Hãy CỰC KỲ đầy đủ — liệt kê mọi tính năng nhỏ bạn tìm thấy, không bỏ sót. Đừng ghi ra file; trả về toàn bộ section như final message. Bắt đầu section bằng heading "## X. Domain: Âm nhạc (Music)".

---

## 2. video-engineer — Domain: Phim & Video

> Bạn đang giúp viết một PRD cực chi tiết cho app Cozyroom (homelab media app, single-tenant). Nhiệm vụ: kiểm kê ĐẦY ĐỦ chức năng domain VIDEO/PHIM từ code thật, trả về MỘT SECTION PRD hoàn chỉnh (markdown, tiếng Việt).
>
> Phạm vi: video streaming, HLS, transcode, trickplay/thumbnails, VideosPage, VideoPlayerPage, quản lý thư viện phim, subtitle (nếu có), seek/scrubbing, chất lượng/bitrate, resume progress, poster/artwork.
>
> Đọc code thật: package transcode/*, hls manager, VideoHandlers trong backend, VideosPage.tsx, VideoPlayerPage.tsx, các endpoint /stream-video, /hls trong routes.go, và bất kỳ scanner/library nào liên quan video.
>
> Với MỖI tính năng trình bày: tên + mô tả, user flow, Yêu cầu chức năng (FR-xxx đánh số), business rules/ràng buộc/gotchas, edge cases, file/endpoint chính (cite path).
>
> Cuối section: endpoint API (method+path+mô tả), data model touchpoints, yêu cầu phi chức năng (transcode performance, streaming reliability, storage).
>
> CỰC KỲ đầy đủ, không bỏ sót tính năng nhỏ. Đừng ghi file; trả về section như final message, bắt đầu bằng "## X. Domain: Phim & Video (Video Streaming)". Nếu domain này ít tính năng thì nói rõ phần nào chưa có/placeholder.

---

## 3. reader-engineer — Domain: Sách điện tử & Truyện tranh

> Bạn đang giúp viết một PRD cực chi tiết cho app Cozyroom (homelab media app, single-tenant). Nhiệm vụ: kiểm kê ĐẦY ĐỦ chức năng domain SÁCH ĐIỆN TỬ & TRUYỆN TRANH từ code thật, trả về MỘT SECTION PRD hoàn chỉnh (markdown, tiếng Việt).
>
> Phạm vi: ebook library & reader (EbooksPage, EbookReaderPage — themes, progress, navigation, formats), comics/manga (ComicsPage — browse, download), scraper (scraper.go, headless_eh.go, eh_cached.go), comics downloader, usecase/ebook.go, các endpoint liên quan.
>
> Đọc code thật: usecase/ebook.go, scraper.go, headless_eh.go, eh_cached.go, EbooksPage.tsx, EbookReaderPage.tsx, ComicsPage.tsx, comics downloader, endpoint trong routes.go.
>
> Với MỖI tính năng: tên + mô tả, user flow, Yêu cầu chức năng (FR-xxx đánh số), business rules/ràng buộc/gotchas (vd nguồn scrape, cache, rate limit), edge cases, file/endpoint chính (cite path).
>
> Cuối section: endpoint API (method+path+mô tả), data model touchpoints, yêu cầu phi chức năng (scrape reliability, cache, storage).
>
> CỰC KỲ đầy đủ. Đừng ghi file; trả về section như final message, bắt đầu bằng "## X. Domain: Sách điện tử & Truyện tranh (Reader)".

---

## 4. ai-engineer — Domain: Trợ lý AI & MCP

> Bạn đang giúp viết một PRD cực chi tiết cho app Cozyroom (homelab media app, single-tenant). Nhiệm vụ: kiểm kê ĐẦY ĐỦ chức năng domain AI từ code thật, trả về MỘT SECTION PRD hoàn chỉnh (markdown, tiếng Việt).
>
> Phạm vi: AI chat assistant, MCP tools (registry), multi-provider LLM (Anthropic/Gemini/DeepSeek/OpenRouter), provider selection, AI memory, AI stats/cost, AIAssistantPage, AIStatsPage, ToolsPage, chat sessions/rooms, datetime injection, markdown rendering, web search/browse tools, các tool cho phép AI thao tác (vd bulk download playlist).
>
> Đọc code thật: ai.go, ai_providers.go, mcp/registry.go, AIAssistantPage.tsx, AIStatsPage.tsx, ToolsPage.tsx, endpoint AI trong routes.go.
>
> Lưu ý ràng buộc quan trọng (ghi rõ trong PRD): prod CHỈ có key DeepSeek/OpenRouter, phải dùng h.selectProvider("") chứ không hardcode Anthropic.
>
> Với MỖI tính năng: tên + mô tả, user flow, Yêu cầu chức năng (FR-xxx đánh số), business rules/ràng buộc/gotchas, edge cases, file/endpoint chính (cite path). Liệt kê ĐẦY ĐỦ mọi MCP tool đang đăng ký (tên + chức năng).
>
> Cuối section: endpoint API (method+path+mô tả), data model (chat sessions/memory schema), yêu cầu phi chức năng (cost, latency, fallback provider).
>
> CỰC KỲ đầy đủ. Đừng ghi file; trả về section như final message, bắt đầu bằng "## X. Domain: Trợ lý AI (AI Assistant & MCP)".

---

## 5. social-engineer — Domain: Playlist, Ghi chú & Xu hướng

> Bạn đang giúp viết một PRD cực chi tiết cho app Cozyroom (homelab media app, single-tenant). Nhiệm vụ: kiểm kê ĐẦY ĐỦ chức năng domain SOCIAL từ code thật, trả về MỘT SECTION PRD hoàn chỉnh (markdown, tiếng Việt).
>
> Phạm vi: playlists (tạo/sửa/xóa, owner password, favorites, local vs permanent playlists), notes/kanban (board, cards, modules — kaneo-port roadmap), GitHub trending (trending.go, TrendingPage, TrendingChartMode — chart/grid mode, tier classification, date selector, AI dedup).
>
> Đọc code thật: playlists.go, notes.go, trending.go, PlaylistsPage.tsx, NotesPage.tsx, TrendingPage.tsx, TrendingChartMode.tsx, FavoritePill.tsx, endpoint liên quan trong routes.go.
>
> Lưu ý ràng buộc quan trọng (ghi rõ): verifyOwnerPassword trong playlists.go là bất khả xâm phạm; phân biệt local playlist (localStorage) vs permanent (server + password).
>
> Với MỖI tính năng: tên + mô tả, user flow, Yêu cầu chức năng (FR-xxx đánh số), business rules/ràng buộc/gotchas, edge cases, file/endpoint chính (cite path).
>
> Cuối section: endpoint API (method+path+mô tả), data model touchpoints, yêu cầu phi chức năng.
>
> CỰC KỲ đầy đủ. Đừng ghi file; trả về section như final message, bắt đầu bằng "## X. Domain: Playlist, Ghi chú & Xu hướng (Social)".

---

## 6. infra-engineer — Kiến trúc & Hạ tầng

> Bạn đang giúp viết một PRD cực chi tiết cho app Cozyroom (homelab media app, single-tenant). Nhiệm vụ: kiểm kê ĐẦY ĐỦ phần KIẾN TRÚC & HẠ TẦNG từ code thật, trả về MỘT SECTION PRD hoàn chỉnh (markdown, tiếng Việt).
>
> Phạm vi: kiến trúc tổng thể (monolith Go backend + React frontend, clean-ish architecture), database (schema/migrate() trong db.go — liệt kê ĐẦY ĐỦ các bảng và cột chính), engine DB thực tế ở prod (Postgres — lưu ý k8s/db-adapter.yaml có thể stale), triển khai k8s (k8s/*.yaml: deployments, services, NodePort 30080, replicas), Docker (Dockerfile, Dockerfile.frontend build ra backend/dist), routing framework (routes.go — cấu trúc, RouterDeps, handler struct), cấu hình/secrets, observability (Prometheus/Grafana), CDN/Cloudflare, service worker/PWA caching, khung xác thực (single-tenant, owner password, KHÔNG có user/auth system).
>
> Đọc code thật: db.go (migrate), routes.go, handler.go, main.go wiring, k8s/*.yaml, Dockerfile, Dockerfile.frontend, nginx.conf, vite.config.
>
> Trình bày: tổng quan kiến trúc + sơ đồ dạng text, danh sách bảng DB (tên + cột + mục đích), toàn bộ deployment topology, mô hình xác thực/single-tenant, yêu cầu phi chức năng hệ thống (availability, performance, storage, backup — lưu ý DB path sản xuất tuyệt đối không được đụng), quy trình build/deploy.
>
> Ghi rõ ràng buộc: single-tenant, chỉ owner password bảo vệ ghi playlist; không tracking per-user; stats là aggregate-only.
>
> CỰC KỲ đầy đủ. Đừng ghi file; trả về section như final message, bắt đầu bằng "## X. Kiến trúc & Hạ tầng (Architecture & Infrastructure)".

---

## 7. general-purpose — Frontend, Điều hướng & Trải nghiệm

> Bạn đang giúp viết một PRD cực chi tiết cho app Cozyroom (homelab media app, single-tenant, React + TypeScript frontend). Nhiệm vụ: kiểm kê ĐẦY ĐỦ phần FRONTEND/UX & những chức năng xuyên suốt từ code thật, trả về MỘT SECTION PRD hoàn chỉnh (markdown, tiếng Việt).
>
> Phạm vi: điều hướng & information architecture (AppRoutes.tsx — liệt kê MỌI route; Sidebar.tsx — mọi mục nav; RadialNav.tsx — radial menu bubble draggable, các layer/mode), thanh search context-aware (Header.tsx), player bar & Now Playing overlay tổng thể (chỉ phần UX/layout, không lặp domain music), PWA (manifest, service worker sw3.js, install banner, offline caching strategy trong vite.config), i18n (vi/en — i18n/*.json), theming (dark/light, DESIGN.md tokens — hệ màu monochrome Paper White), responsive/mobile (mobile nav, mobile search island, breakpoint 900px), background sounds (BgSoundsContext, BackgroundSoundsPanel), onboarding tour (nếu có), các component dùng chung.
>
> Đọc code thật: frontend/src/AppRoutes.tsx, Sidebar.tsx, Header.tsx, RadialNav.tsx, các Context (PlayerContext, BgSoundsContext), index.css (cấu trúc layout/theme), DESIGN.md, vite.config.ts, i18n/vi.json + en.json, manifest, và duyệt frontend/src/pages + components để liệt kê đủ.
>
> Trình bày: danh sách route/màn hình (bảng: route → trang → mô tả), IA & navigation model, các pattern UX xuyên suốt (radial nav, search, player, glass/liquid design), PWA & offline, i18n, theming, responsive, và các yêu cầu chức năng (FR-xxx) + phi chức năng (accessibility, performance, a11y) liên quan UI.
>
> CỰC KỲ đầy đủ — liệt kê mọi trang và mọi component đáng kể. Đừng ghi file; trả về section như final message, bắt đầu bằng "## X. Frontend, Điều hướng & Trải nghiệm (UX/UI)".
