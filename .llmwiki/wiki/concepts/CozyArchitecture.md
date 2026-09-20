# CozyArchitecture
**Type:** concept
**Tags:** architecture, k3s, kubernetes, postgres, citus, cloudflare, go, react

Cozyroom K3s + Citus + Cloudflare Tunnel architecture — replaces the legacy Docker/SQLite design (see [[Architecture]] for the old layout). As of 2026-06 the app runs on a 3-node K3s cluster (WSL2, Tailscale mesh) with Citus distributed Postgres and a Cloudflare Tunnel for public access.

## Request Path

```
Internet
  └── Cloudflare edge (TLS termination, music.giatbh.io.vn)
        └── cloudflared pod (CF Tunnel, localhost:18080 HARDCODED in CF remote config)
              └── nginx sidecar (proxy_buffering off, proxy_request_buffering off, 128Mi)
                    └── frontend.cozyroom-k8s.svc.cluster.local:80
                          ├── Static   /          → React SPA (index.html + hashed assets)
                          └── Proxy    /api/*     → backend.cozyroom-k8s.svc.cluster.local:8080
```

**Invariant:** CF remote config hardcodes `localhost:18080` — the nginx sidecar MUST run in the cloudflared pod. Removing it breaks all traffic. `proxy_buffering off` is required to prevent OOMKill when streaming audio.

## K8s Deployment Map

| Workload | Container | Port | PV / mount |
|----------|-----------|------|-----------|
| `frontend` | nginx + React SPA | 80 | — |
| `backend` | Go binary | 8080 | `/data` (covers, HLS), `/youtube` (yt-dlp), `/music` (read-only NFS) |
| `cloudflared` | cloudflared + nginx | 18080 | — |
| `postgres` | PostgreSQL 16 (primary) | 5432 | `postgres-data` PVC |
| `postgres-standby` | PostgreSQL 16 (replica) | 5432 | `postgres-standby-data` PVC |
| `db-adapter` | HAProxy (Citus coordinator proxy) | 5432 | — |
| Prometheus | prom/prometheus | 9090 | `observability/` |
| Grafana | grafana/grafana | 3000 | — |

## PV Reality

The live PV `k8s-data` has hostPath `/tmp/k8s-cozyroom-data` (immutable after creation — K8s spec.persistentvolumesource is immutable). YAML shows `/mnt/c/Users/olive/orca/k8s-data` but this is NOT the live path. Covers live at `/tmp/k8s-cozyroom-data/covers/` inside the K3s node WSL2 instance.

## Backend Package Map

```
backend/
├── cmd/server/main.go          ← binary entry; wires all deps
└── internal/
    ├── api/                    ← HTTP handlers + router (~60 endpoints)
    │   ├── routes.go           ← metricsMiddleware + panicRecovery + SPA fallback
    │   ├── handler.go          ← artists/albums/tracks/covers/stats/search
    │   ├── youtube.go          ← YT search/stream/download
    │   ├── ai.go               ← agentic loop (12 rounds max)
    │   ├── scan.go             ← manual library scan trigger
    │   └── ...                 ← lyrics, video, ebook, comics, playlist, trending
    ├── cron/                   ← robfig/cron daily enrichment + cleanup
    ├── db/                     ← pgx/v5 pool + query helpers
    ├── discord/                ← Discord slash commands
    ├── domain/                 ← pure interfaces (ArtistRepo, AlbumRepo, TrackRepo...)
    ├── enricher/               ← Deezer, TMDb, GitHub trending scrapers
    ├── hls/                    ← HLS segment manager for video
    ├── lastfm/                 ← Last.fm scrobbling
    ├── library/scanner.go      ← walk + tag + SHA256 IDs + cover + upsert
    ├── mcp/registry.go         ← 23 MCP tools
    ├── metrics/                ← Prometheus counters/histograms
    ├── repository/postgres/    ← SQL implementations of domain interfaces
    ├── teams/                  ← Microsoft Teams webhook bridge
    ├── telegram/               ← Telegram bot
    ├── transcode/              ← ffmpeg → opus transcoding
    └── usecase/                ← search, playlists, stats, trending usecases
```

## Frontend Architecture

```
frontend/src/
├── App.tsx                     ← QueryClientProvider + I18nextProvider + PlayerProvider
├── AppRoutes.tsx               ← SPA routes (React Router v6)
├── PlayerContext.tsx           ← global player state (gapless, queue, YT, localStorage)
├── api.ts                      ← typed fetch wrappers; base URL = VITE_API_URL or same-origin
├── components/
│   ├── PlayerBar.tsx           ← bottom persistent player (progress, volume, like, YT cover retry)
│   ├── RadialNav.tsx           ← Nightingale rose nav (polar segments)
│   └── NowPlayingSheet.tsx     ← mobile bottom sheet (swipe-up for lyrics/queue)
├── pages/                      ← 10+ page components
└── i18n/                       ← EN/VI translations (i18next)
```

PWA: `vite-plugin-pwa` (VitePWA), Workbox NetworkFirst for `/api/(artists|albums|tracks|search|stats)` → `api-data` cache, 4s timeout, 7-day expiry. Service Worker named `sw2.js` (renamed from `sw.js` to force CF re-registration after caching incident).

## ID Derivation

All entity IDs are deterministic SHA-256 based:

```
artistID  = SHA256(lowercase(trim(artistName)))[:8] hex
albumID   = SHA256(lowercase(trim(artistID + albumTitle)))[:8] hex
trackID   = SHA256(lowercase(trim(albumID + filename)))[:8] hex
ytAlbumID = SHA256(lowercase(trim(id8hex(uploader) + title)))[:8] hex
```

YouTube files detected by `len(baseName) == 11` (YT video ID length).

## Related Concepts

- [[Scanner]] — library scanning and ID generation detail
- [[GaplessPlayback]] — dual-audio preloading implementation
- [[YouTubeIntegration]] — YT search/stream/download detail
- [[MCPToolsCheatsheet]] — 23 MCP tools reference

## Origin

- **Source:** `orca-onboard` Phase 1-2 distillation — 2026-06-19
- **Graph:** `.understand-anything/knowledge-graph.json`
- **Domain:** `.orca-onboard/intermediate/domain-graph.json`
- **Commit:** _(filled by verify-before-commit)_
