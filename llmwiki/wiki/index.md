# Wiki Index

| File | Type | Summary |
|------|------|---------|
| [sources/project-requirements.md](sources/project-requirements.md) | source | Business goals, user workflows, and constraints for Cozyroom |
| [sources/tech-stack-decisions.md](sources/tech-stack-decisions.md) | source | Go + React + SQLite + Docker architecture decisions, DB schema, all routes |
| [sources/homelab-music-brainstorm.md](sources/homelab-music-brainstorm.md) | source | Prior-art Navidrome/Grafana homelab reference; WSL2 mount pattern |
| [concepts/Architecture.md](concepts/Architecture.md) | concept | Full system map: backend packages, startup sequence, frontend architecture |
| [concepts/Scanner.md](concepts/Scanner.md) | concept | Library scanner: ID generation, tag reading, cleanTitle, cover art, genre |
| [concepts/SmartRadio.md](concepts/SmartRadio.md) | concept | Weighted random genre-aware queue algorithm; ShuffleMode states |
| [concepts/DeezerEnricher.md](concepts/DeezerEnricher.md) | concept | Background artist image fetcher via Deezer API; incremental design |
| [concepts/MobileUI.md](concepts/MobileUI.md) | concept | Mobile layout: bottom nav, mini player bar, slide-up now-playing sheet (≤640px) |
| [concepts/Lyrics.md](concepts/Lyrics.md) | concept | Multi-source parallel lyrics (sidecar, LRCLIB, NetEase, QQ Music); desktop overlay; save to .lrc |
| [sources/prometheus-standalone-container-infra.md](sources/prometheus-standalone-container-infra.md) | source | Prometheus + Grafana standalone Docker Compose stack in ~/observability/; reusable across projects |
| [sources/music-giatbh-io-vn-evaluation.md](sources/music-giatbh-io-vn-evaluation.md) | source | UI/UX evaluation of live site — 5 issue groups: navigation, data display, aesthetics, search, lastfm API |
| [concepts/CleanArchitecture.md](concepts/CleanArchitecture.md) | concept | Clean Architecture layer map, ACID guarantees, and key design decisions |
| [concepts/GaplessPlayback.md](concepts/GaplessPlayback.md) | concept | Spotify-style gapless playback architecture via dual-audio preloading |
| [concepts/NowPlayingUI.md](concepts/NowPlayingUI.md) | concept | Modernized Now Playing UI for desktop and mobile |
| [concepts/LyricsUI.md](concepts/LyricsUI.md) | concept | Lyrics UI improvements (auto-scroll & fade-out) |
| [concepts/VideoStreaming.md](concepts/VideoStreaming.md) | concept | Video domain: MPEG-TS→HLS on-the-fly transcoding via ffmpeg, hls.js frontend || [concepts/AudioReliability.md](concepts/AudioReliability.md) | concept | Audio reliability: error handling, auto-retry, and backend process management |
| [sources/skill-propose.md](sources/skill-propose.md) | source | Workflow skill: plan-before-code gate — steps, rules, draft creation |
| [sources/skill-verify-before-commit.md](sources/skill-verify-before-commit.md) | source | Workflow skill: pre-commit quality gate — typecheck, lint, test, Docker rebuild |
| [concepts/JellyfinFeatures.md](concepts/JellyfinFeatures.md) | concept | 4 Jellyfin-inspired features: MetadataProvider abstraction, Trickplay sprites, CanDirectPlay, Resume State |
| [concepts/EbookEnhancements.md](concepts/EbookEnhancements.md) | concept | NSFW tagging (owner712002), cover blurring, and PDF cover extraction |
| [concepts/EbookThemes.md](concepts/EbookThemes.md) | concept | Fix Ebook Blank Screen via Themes & Style Normalization |
| [concepts/ComicsDownloader.md](concepts/ComicsDownloader.md) | concept | Comics offline pre-fetch engine: 6h background download, local serving, retry/delete UI |
| [concepts/LyricsReliability.md](concepts/LyricsReliability.md) | concept | Lyrics fixes: silent save reload, empty-cache poisoning, mobile panel overlay |
| [sources/190526-translate-shortcut-overlay.md](sources/190526-translate-shortcut-overlay.md) | source | Translate shortcut + touch-to-reveal overlay buttons — implementation record (commit ab52f60) |
| [concepts/PlayerBugfixes190526.md](concepts/PlayerBugfixes190526.md) | concept | Player bugfixes 2026-05-19: lyrics stale-fetch race, gapless duration 0:00, progress bar fill |
| [concepts/FavoritePlaylistPill.md](concepts/FavoritePlaylistPill.md) | concept | Playlists Management via FavoritePill - local storage (localStorage) and permanent storage (SQLite + owner712002 password verification) |
| [sources/draft/190526-remove-tab-toast-lyrics-back-fe.md](sources/draft/190526-remove-tab-toast-lyrics-back-fe.md) | draft | Proposal: remove tab toast on mobile NPO, replace with left-zone tap to return to Now Playing |
| [sources/draft/230526-4-issues-wiki-search-lyrics-cover-fe.md](sources/draft/230526-4-issues-wiki-search-lyrics-cover-fe.md) | draft | Proposal: wiki migration to llmwiki, restore broken search bar (AppRoutes.tsx missing), lyrics scroll lag, cover image race |
| [concepts/TrendingInsights.md](concepts/TrendingInsights.md) | concept | GitHub Trending tab: AI industry-impact scoring (1-10), visual tiers (transformative/significant/incremental/niche), hero card |
| [concepts/RTK.md](concepts/RTK.md) | concept | RTK (Rust Token Killer): CLI proxy 60-90% token reduction, hook system, 100+ commands, multi-agent support |
| [concepts/LlmwikiSetupFlow.md](concepts/LlmwikiSetupFlow.md) | concept | Two-skill setup flow: new-project-setup (fresh deploy) + join-project (quick orient, read-only) |
| [sources/rtk-ai-rtk.md](sources/rtk-ai-rtk.md) | source | Source record: rtk-ai/rtk v0.40.0 — design principles, supported agents, relevant commands |
| [concepts/TrendingChartMode.md](concepts/TrendingChartMode.md) | concept | Trending Chart Mode: toggle grid/chart, 9 charts from existing data, tier chips + drawer, Recharts |
| [concepts/TrendingRadialMenuControls.md](concepts/TrendingRadialMenuControls.md) | concept | Nightingale Rose Radial Menu Layer 3 - Contextual controls for the Trending page |
| [concepts/I18n.md](concepts/I18n.md) | concept | Bilingual EN/VI i18n via i18next — default VI, toggle in Sidebar, 15 files, 7 namespaces |
| [concepts/UnderstandAnything.md](concepts/UnderstandAnything.md) | concept | Code analysis platform: 6-7 agent pipeline, tree-sitter parsing, knowledge graphs, incremental updates, multi-language |
| [concepts/EccHarness.md](concepts/EccHarness.md) | concept | Agent orchestration harness: 47 agents, 156-181 skills, hook system, continuous learning with confidence scoring |
| [concepts/UnderstandAnything-LlmwikiIntegration.md](concepts/UnderstandAnything-LlmwikiIntegration.md) | concept | Integration roadmap: Phases 1-4 (short/medium/long-term), 15+ integration points, agent distribution |
| [sources/draft/240526-drawer-ai-stardelta-fix-fe-be.md](sources/draft/240526-drawer-ai-stardelta-fix-fe-be.md) | draft | Fix: drawer AI cards, star_delta always 0 (midnight query bug), date picker hidden |
| [sources/draft/240526-youtube-search-stream-download.md](sources/draft/240526-youtube-search-stream-download.md) | draft | Proposal: YouTube Search, Direct Stream, and High-Quality Download using yt-dlp |
| [sources/draft/240526-youtube-downloads-consolidation.md](sources/draft/240526-youtube-downloads-consolidation.md) | draft | Proposal: Group YouTube Downloads under 'YouTube Downloads' per Uploader and Fix Scanner Metadata Overwrite |
| [sources/draft/260525-favorite-playlist-pill.md](sources/draft/260525-favorite-playlist-pill.md) | draft | Proposal: Favorite Playlist Pill (Star + Dropdown) with Local & Permanent Storage (owner712002) |
| [sources/draft/260525-trending-radial-menu-controls-fe.md](sources/draft/260525-trending-radial-menu-controls-fe.md) | draft | Proposal: Moving Trending Page Controls to Nightingale Rose Radial Menu (Layer 3) |
| [sources/draft/260526-mcp-server-ai-chat-tab-be-fe.md](sources/draft/260526-mcp-server-ai-chat-tab-be-fe.md) | draft | Proposal: MCP server (HTTP/SSE + stdio) + AI Chat tab — 14 tools, Claude haiku, player actions |
| [concepts/MCPServer.md](concepts/MCPServer.md) | concept | MCP server + AI chat tab: 14 tools, RTK compression, HTTP/stdio transport, Claude haiku tool use loop |
| [concepts/AIAgentRuntime.md](concepts/AIAgentRuntime.md) | concept | AI Agent Runtime: 5-layer architecture, provider adapters, agentic loop, tool registry, chat logging — template for new apps |
| [sources/draft/260526-ai-agent-upgrade-be-fe.md](sources/draft/260526-ai-agent-upgrade-be-fe.md) | draft | Proposal: AI Agent upgrade — persistent memory (remember/recall/forget tools), token display, fancy async roadmap |
| [concepts/APIReference.md](concepts/APIReference.md) | concept | Toàn bộ HTTP API endpoints của Cozyroom backend — nhóm theo domain |
| [concepts/YouTubeIntegration.md](concepts/YouTubeIntegration.md) | concept | YouTube Search, Stream, Download và Channel Browse trong Search page — via yt-dlp backend |
| [sources/270526-playlist-tool-bugs-postmortem.md](sources/270526-playlist-tool-bugs-postmortem.md) | source | Post-mortem: 2 bugs MCP playlist tool — ID từ tên, thiếu play_playlist tool |
| [concepts/MCPToolsCheatsheet.md](concepts/MCPToolsCheatsheet.md) | concept | Danh sách đầy đủ 23 MCP tools — input/output, frontend actions, known gaps |
| [concepts/AIAnalytics.md](concepts/AIAnalytics.md) | concept | AI Analytics: Recharts dashboard, cost estimation, OCR pricing, daily token+cost chart, dislike labeling, MCP analytics tools |
| [concepts/MCPWebSearch.md](concepts/MCPWebSearch.md) | concept | MCP web_search + browse_url via cloak proxy — DuckDuckGo, HTML stripping, fetchViaCloak helper |
| [concepts/AIChatSessions.md](concepts/AIChatSessions.md) | concept | Chat sessions/rooms — session_id, restoreSession(), sessions API endpoints |
| [concepts/AIMarkdownRendering.md](concepts/AIMarkdownRendering.md) | concept | Markdown + GFM table rendering in AI chat bubbles via react-markdown + remark-gfm |
| [concepts/AIDatetimeInjection.md](concepts/AIDatetimeInjection.md) | concept | UTC+7 datetime injection in AI system prompt so agent knows today's date |
| [concepts/PlayTrackAlbumIDFix.md](concepts/PlayTrackAlbumIDFix.md) | concept | Bug fix — play_track tool album_id SQL join (was LEFT JOIN on missing t.artist_id) |
| [concepts/ProgressRestoreReload.md](concepts/ProgressRestoreReload.md) | concept | beforeunload saves currentTime to localStorage for progress restore on page reload |
| [concepts/QueueLocking.md](concepts/QueueLocking.md) | concept | lockedQueueRef prevents smart radio fillSmartQueue from contaminating explicit playlist queues |
| [sources/draft/280526-hermes-research-distillation.md](sources/draft/280526-hermes-research-distillation.md) | draft | Proposal: Nous Research Hermes Agent research and distillation (self-improving skills, Telegram bot, background task automation) |
| [draft/orca/050626-fix-playback-sql-bugs.md](draft/orca/050626-fix-playback-sql-bugs.md) | draft | Fix playback PIPELINE_ERROR_DECODE (mono/stereo) + trending SQLSTATE 42601 + all ? → $N migration |
| [draft/cave/050626-playlist-play-btn-fix-fe.md](draft/cave/050626-playlist-play-btn-fix-fe.md) | draft | 2026-06-05 |
| [draft/orca/060626-ai-build-jenkins-deploy.md](draft/orca/060626-ai-build-jenkins-deploy.md) | draft | 2026-06-06 |
| [draft/orca/060626-ansible-k8s-cozyroom-deploy.md](draft/orca/060626-ansible-k8s-cozyroom-deploy.md) | draft | 2026-06-06 |
| [sources/draft/070626-k3s-cozyroom-master-control-plane.md](sources/draft/070626-k3s-cozyroom-master-control-plane.md) | draft | 2026-06-07 |
| [sources/080626-wsl2-ssh-autostart.md](sources/080626-wsl2-ssh-autostart.md) | source | WSL2 SSH/Docker/Tailscale auto-start: root causes, boot script, Docker CE migration |
| [sources/080626-k3s-install-best-practices.md](sources/080626-k3s-install-best-practices.md) | source | K3S cluster install: Tailscale networking, WSL2 quirks, cAdvisor, node-exporter, job naming |
| [sources/080626-grafana-dashboard-best-practices.md](sources/080626-grafana-dashboard-best-practices.md) | source | Grafana 11 dashboard: variable gotchas, ds_prometheus, API patterns, no-data root causes |
| [sources/draft/080626-k8s-dashboard-headlamp.md](sources/draft/080626-k8s-dashboard-headlamp.md) | draft | 2026-06-08 |
| [draft/orca/100626-cover-fetch-race-fix.md](draft/orca/100626-cover-fetch-race-fix.md) | draft | Fix cover art race conditions (singleflight), K8s deploy — 10/06/2026 |
| [draft/orca/160626-db-architecture-review.md](draft/orca/160626-db-architecture-review.md) | draft | Phân tích DB architecture: SPOF pattern, adapter layer, 3 pattern options (Patroni / Federated / Docker Compose per node) |
| [sources/draft/170626-ui-theme-consistency-all-pages.md](sources/draft/170626-ui-theme-consistency-all-pages.md) | draft | UI audit 9 màn hình chưa áp theme mới — Videos, Ebooks, Comics, Trending charts, AIStats, Playlists |



| [sources/180626-sw-blank-page-cf-cache.md](sources/180626-sw-blank-page-cf-cache.md) | source | Bug: CF cache override nginx no-store cho sw.js → stale SW precache → blank page; fix: rename sw2.js |
| [sources/180626-k8s-media-images-not-served.md](sources/180626-k8s-media-images-not-served.md) | source | Bug: /data/covers missing sau K8s migrate → covers 404; CoreDNS không resolve external → artist images 0/868 |
| [sources/draft/240526-i18n-en-vi-fe.md](sources/draft/240526-i18n-en-vi-fe.md) | draft | Proposal: Bilingual EN/VI i18n |
| [sources/draft/propose-adk-cozyroom.md](sources/draft/propose-adk-cozyroom.md) | draft | Proposal: Áp dụng ADK Concepts vào Cozyroom |
| [sources/draft/190526-lyrics-stale-fetch-race-fix-fe.md](sources/draft/190526-lyrics-stale-fetch-race-fix-fe.md) | draft | Proposal: Fix Rapid-Skip Bugs (Lyrics Race + Progress Bar) |
| [sources/draft/adk-distill.md](sources/draft/adk-distill.md) | draft | ADK (Agent Development Kit) — Distilled |
| [sources/draft/270526-ai-stats-cost-calculator.md](sources/draft/270526-ai-stats-cost-calculator.md) | draft | Proposal: AI Stats — Cost Calculator + Image OCR Pricing |
| [sources/draft/270526-ai-chat-sessions-rooms.md](sources/draft/270526-ai-chat-sessions-rooms.md) | draft | Proposal: AI Chat Sessions (Rooms) |
| [sources/draft/020626-reliability-fixes-streaming-be.md](sources/draft/020626-reliability-fixes-streaming-be.md) | draft | Proposal: Reliability fixes — streaming backend |
| [sources/draft/280526-mcp-web-search-browse.md](sources/draft/280526-mcp-web-search-browse.md) | draft | Proposal: MCP Web Search + Browse Tools via Cloak Proxy |
| [draft/orca/100626-player-progress-time-stale-fix.md](draft/orca/100626-player-progress-time-stale-fix.md) | draft | Fix player progress time stale display |
| [sources/draft/230526-trending-impact-ui-fe.md](sources/draft/230526-trending-impact-ui-fe.md) | draft | Proposal: Trending — AI Industry Impact Score + Visual Tiers |
| [sources/draft/050626-smart-queue-yt-injection-fe.md](sources/draft/050626-smart-queue-yt-injection-fe.md) | draft | Proposal: Smart queue + YouTube injection |
| [sources/draft/230526-llmwiki-setup-join-skills.md](sources/draft/230526-llmwiki-setup-join-skills.md) | draft | Proposal: llmwiki Setup & Join Skills |
| [sources/draft/240526-ecc-ua-repo-integration.md](sources/draft/240526-ecc-ua-repo-integration.md) | draft | Proposal: Research ECC Harness & Understand-Anything Integration |
| [sources/draft/270526-ai-media-card-playlist-covers.md](sources/draft/270526-ai-media-card-playlist-covers.md) | draft | Proposal: AI Media Cards + Playlist Cover Gallery |
| [sources/draft/050626-yt-discovery-trending-be-fe.md](sources/draft/050626-yt-discovery-trending-be-fe.md) | draft | Proposal: YouTube discovery + trending backend/frontend |
| [sources/draft/240526-survey-downie-youtube-320kbps.md](sources/draft/240526-survey-downie-youtube-320kbps.md) | draft | Khảo sát: Tải nhạc 320kbps từ YouTube bằng Downie |
| [sources/draft/240526-trending-chart-mode-fe.md](sources/draft/240526-trending-chart-mode-fe.md) | draft | Proposal: Trending Chart Mode |
| [sources/draft/280526-sqlite-to-postgres.md](sources/draft/280526-sqlite-to-postgres.md) | draft | Proposal: Migrate SQLite → PostgreSQL (separate container) |
| [sources/draft/190626-search-perf-artists-load.md](sources/draft/190626-search-perf-artists-load.md) | draft | Fix: search debounce + yt-dlp cache + artists page StaleWhileRevalidate — 2026-06-19 |
| [sources/draft/250525-radial-nav-bubble.md](sources/draft/250525-radial-nav-bubble.md) | draft | Proposal: Radial Navigation Bubble |
| [sources/draft/180626-distributed-db-citus.md](sources/draft/180626-distributed-db-citus.md) | draft | Proposal: Distributed DB — Citus trên 3 physical nodes, sharded tables + reference tables, không dùng replica |
| [draft/orca/190626-onboard-cozyroom.md](draft/orca/190626-onboard-cozyroom.md) | draft | Onboard cozyroom — knowledge graph, domain enrichment, wiki, HTML docs |
| [concepts/CozyArchitecture.md](concepts/CozyArchitecture.md) | concept | K3s + Citus + Cloudflare Tunnel architecture — replaces legacy Docker/SQLite layout |
| [concepts/OnboardingTour.md](concepts/OnboardingTour.md) | concept | 11-step guided tour: server entry → HTTP routing → DB → scanner → stream → YT → AI → PlayerContext → pages → K8s |
| [entities/ProjectStructure.md](entities/ProjectStructure.md) | entity | Repository layout, backend packages, frontend structure, K8s manifests, hot files, layer summary |
