import json, datetime
from pathlib import Path

ROOT = Path('/mnt/c/Users/olive/orca/cozyroom')
TMP = ROOT / '.orca-onboard/tmp'
UA = ROOT / '.understand-anything'

with open(TMP / 'assembled-graph.json') as f:
    g = json.load(f)

nodes = g['nodes']

def nids(prefixes):
    return [n['id'] for n in nodes if any(n.get('filePath','').startswith(p) for p in prefixes)]

layers = [
    {
        'id': 'layer:infrastructure',
        'name': 'Infrastructure & Deployment',
        'description': 'K8s manifests, Docker Compose, nginx, Cloudflare tunnel, Prometheus/Grafana, cloak-proxy, build config.',
        'nodeIds': nids(['k8s/','observability/','cloak-proxy/','docker-compose','nginx.conf','Dockerfile'])
    },
    {
        'id': 'layer:backend-core',
        'name': 'Backend Core & DB',
        'description': 'Go server entry, DB pool, Postgres repositories, domain interfaces, UoW factory.',
        'nodeIds': nids(['backend/cmd/','backend/internal/db/','backend/internal/repository/','backend/internal/domain/'])
    },
    {
        'id': 'layer:backend-api',
        'name': 'Backend HTTP API',
        'description': 'HTTP router (~60 endpoints), all handlers (library, AI, YouTube, lyrics, video, ebook, comics, playlists, trending, scraper), middleware, SPA fallback.',
        'nodeIds': nids(['backend/internal/api/'])
    },
    {
        'id': 'layer:backend-domain',
        'name': 'Backend Domain Logic',
        'description': 'Library scanner (SHA-256 IDs, tag reading, cover extraction), usecases, audio transcoding, HLS, enrichers (Deezer, TMDb, GitHub trending), Last.fm.',
        'nodeIds': nids(['backend/internal/library/','backend/internal/usecase/','backend/internal/transcode/','backend/internal/hls/','backend/internal/enricher/','backend/internal/lastfm/'])
    },
    {
        'id': 'layer:backend-services',
        'name': 'Backend Background Services',
        'description': 'Cron scheduler, MCP tool registry (23 tools), Telegram/Discord/Teams bots, Prometheus metrics.',
        'nodeIds': nids(['backend/internal/cron/','backend/internal/mcp/','backend/internal/telegram/','backend/internal/discord/','backend/internal/teams/','backend/internal/metrics/'])
    },
    {
        'id': 'layer:frontend-core',
        'name': 'Frontend Core',
        'description': 'React entry (App.tsx, AppRoutes.tsx), global player state (PlayerContext.tsx), API client (api.ts), i18n, PWA/ServiceWorker config.',
        'nodeIds': [n['id'] for n in nodes if n.get('filePath','') in [
            'frontend/src/App.tsx','frontend/src/AppRoutes.tsx','frontend/src/PlayerContext.tsx',
            'frontend/src/api.ts','frontend/index.html','frontend/package.json','frontend/vite.config.ts'
        ] or n.get('filePath','').startswith('frontend/src/i18n')]
    },
    {
        'id': 'layer:frontend-pages',
        'name': 'Frontend Pages',
        'description': '10+ page components: Artists, AlbumDetail, VideoPlayer, AIAssistant, AIStats, TrendingChart, Playlists, ComicsReader, EbookReader, Search.',
        'nodeIds': nids(['frontend/src/pages/'])
    },
    {
        'id': 'layer:frontend-components',
        'name': 'Frontend Components',
        'description': 'Shared UI: PlayerBar, RadialNav (Nightingale rose), NowPlayingSheet (mobile), Equalizer, FavoritePill, cover/image components.',
        'nodeIds': nids(['frontend/src/components/'])
    },
    {
        'id': 'layer:config-docs',
        'name': 'Config, Docs & Wiki',
        'description': 'CLAUDE.md, README, llmwiki knowledge wiki with harness hooks, harness validators, skill definitions, .claude settings.',
        'nodeIds': nids(['llmwiki/','harness/','.claude/','CLAUDE.md','README','commands/','docs/'])
    },
    {
        'id': 'layer:archive',
        'name': 'Archive',
        'description': 'Deprecated SQLite repository implementations kept after PostgreSQL migration.',
        'nodeIds': nids(['_archive/'])
    },
]

# Assign unassigned nodes to config-docs
all_assigned = set(nid for l in layers for nid in l['nodeIds'])
unassigned = [n['id'] for n in nodes if n['id'] not in all_assigned]
layers[-2]['nodeIds'].extend(unassigned)

for l in layers:
    print(f"  {l['name']}: {len(l['nodeIds'])} nodes")

tour = [
    {'order': 1, 'title': 'Project Overview', 'description': 'Cozyroom is a self-hosted personal media server: music with gapless playback, AI assistant via MCP, YouTube stream/download, HLS video, ebooks/comics. React frontend with Spotify-like UI. Deployed on K3s (3 WSL2 nodes) with Citus distributed Postgres.', 'nodeIds': ['file:README.md','file:CLAUDE.md','file:docker-compose.yml']},
    {'order': 2, 'title': 'Server Entry Point', 'description': 'backend/cmd/server/main.go wires all deps: opens Postgres, creates repo/usecase layers, registers HTTP router, launches background goroutines (scan, enrichers, trending), starts cron + bots.', 'nodeIds': ['file:backend/cmd/server/main.go']},
    {'order': 3, 'title': 'HTTP Routing & Middleware', 'description': 'routes.go registers ~60 endpoints by domain. metricsMiddleware + panicRecovery wrap all handlers. SPA handler serves React dist for non-API routes.', 'nodeIds': ['file:backend/internal/api/routes.go','file:backend/internal/api/handler.go']},
    {'order': 4, 'title': 'Database & Repository Layer', 'description': 'backend/internal/db/db.go wraps sqlx with Postgres placeholder rebinding. Postgres repositories in backend/internal/repository/postgres/ implement domain interfaces. Handlers never touch SQL.', 'nodeIds': ['file:backend/internal/db/db.go']},
    {'order': 5, 'title': 'Library Scanner', 'description': 'scanner.go walks musicPath, reads audio tags, derives 8-byte SHA-256 IDs for artist/album/track, extracts cover art, upserts to Postgres. YouTube files (11-char basenames) trigger async thumbnail downloads from YouTube CDN.', 'nodeIds': ['file:backend/internal/library/scanner.go']},
    {'order': 6, 'title': 'Audio Streaming & Transcoding', 'description': 'GET /stream/{id} serves byte-range audio. transcode.go converts lossless formats (FLAC/WAV) to opus via ffmpeg. hls/ manages video HLS segments. Cover art uses singleflight dedup + JPEG resize.', 'nodeIds': ['file:backend/internal/transcode/transcode.go']},
    {'order': 7, 'title': 'YouTube Integration', 'description': 'youtube.go: search via yt-dlp flat-playlist dump, stream proxy with 4h signed-URL cache, download to /youtube PVC with metadata indexing. Thumbnails copied to coversDir on download.', 'nodeIds': ['file:backend/internal/api/youtube.go']},
    {'order': 8, 'title': 'AI Agent & MCP Tools', 'description': 'mcp/registry.go defines 23 tools (play_track, search_library, web_search, browse_url, etc.). ai.go runs the agentic loop: user message -> Claude/OpenRouter -> tool calls -> results (up to 12 rounds). Persistent key-value memory.', 'nodeIds': ['file:backend/internal/mcp/registry.go','file:backend/internal/api/ai.go']},
    {'order': 9, 'title': 'Frontend Player State', 'description': 'PlayerContext.tsx holds active track, queue (smart radio or playlist), gapless dual-Audio preloading, YouTube stream URL, volume/progress, and localStorage persistence. All pages consume this context.', 'nodeIds': ['file:frontend/src/PlayerContext.tsx']},
    {'order': 10, 'title': 'Frontend Pages & Components', 'description': 'ArtistsPage/AlbumDetailPage for library browsing. AIAssistantPage for chat. TrendingChartMode for GitHub trending with AI scores. PlayerBar + RadialNav (Nightingale rose) + NowPlayingSheet (mobile) are primary nav/playback components.', 'nodeIds': ['file:frontend/src/pages/AIAssistantPage.tsx','file:frontend/src/components/PlayerBar.tsx','file:frontend/src/components/RadialNav.tsx']},
    {'order': 11, 'title': 'K8s Deployment', 'description': 'k8s/ manifests: backend (Go, multiple PV mounts), frontend (nginx+SW), Citus via HAProxy db-adapter, cloudflared (CF tunnel -> nginx sidecar -> frontend service). Prometheus+Grafana in observability/.', 'nodeIds': ['file:k8s/backend.yaml','file:k8s/cloudflared.yaml']},
]

print(f"\nTour: {len(tour)} steps")

commit = ''
try:
    commit = open(TMP / 'commit.txt').read().strip()
except:
    pass

kg = {
    'version': '1.0',
    'project': {
        'name': 'cozyroom',
        'languages': ['Go', 'TypeScript', 'Python'],
        'frameworks': ['React', 'Vite', 'K3s', 'PostgreSQL/Citus', 'yt-dlp', 'ffmpeg', 'MCP'],
        'description': 'Self-hosted personal media server: music, video, ebooks, comics, AI assistant, YouTube, GitHub trending',
        'analyzedAt': '2026-06-19',
        'gitCommitHash': commit,
    },
    'nodes': g['nodes'],
    'edges': g['edges'],
    'layers': layers,
    'tour': tour,
}

with open(UA / 'knowledge-graph.json', 'w') as f:
    json.dump(kg, f, indent=2)
print(f"\nknowledge-graph.json: {len(nodes)} nodes, {len(g['edges'])} edges, {len(layers)} layers, {len(tour)} tour steps")

meta = {
    'lastAnalyzedAt': datetime.datetime.now().isoformat(),
    'gitCommitHash': commit,
    'analyzedFiles': len(nodes),
}
with open(UA / 'meta.json', 'w') as f:
    json.dump(meta, f, indent=2)
print("meta.json written")
