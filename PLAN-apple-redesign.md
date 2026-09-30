# PLAN — Apple-surface redesign (full-app)

Branch: `feat/apple-design-system` (from `origin/main`)
Design lock: `DESIGN.md` (Apple studied-DNA). Old system archived at `DESIGN.midnight-deck.archived.md`.
Scope: `frontend/src` only. Backend/DB/k8s untouched.

## Dependency graph (topo layers — dispatch order)

```
            ┌─────────────────────────────────────────────┐
   L-A  →   │ FOUNDATION  (single-writer of index.css)     │   in-degree 0
            │ • index.css: token layer + ALL class restyle │   → everything depends on it
            │ • index.html: font links + theme default=light│
            └───────────────────────┬─────────────────────┘
                                     │ (LOCK index.css after A)
            ┌────────────────────────▼────────────────────┐
   L-B  →   │ SHELL .tsx  (chrome/nav — .tsx only, no CSS) │   depends on A
            │ Sidebar Header PlayerBar+cluster MobileNav    │
            │ MobileSearchBar RadialNav CozyroomMark        │
            │ Spinner BackButton LibraryStatsBar FavoritePill│
            │ InstallBanner AppRoutes(layout shell)         │
            └───────────────────────┬─────────────────────┘
                                     │ (LOCK shell after B)
   L-C  →   ┌──────────┬──────────┬─▼────────┬───────────┬──────────┐   depend on A+B
  (parallel)│ music    │ video    │ reader   │ ai        │ social   │   disjoint file sets
            │ 8 pages  │ 2 pages  │ 3 pages  │ 4 pages   │ 4 pages  │
            └──────────┴──────────┴──────────┴───────────┴──────────┘
```

### Node ownership (collision-free)
| Owner | Files (exclusive) |
|---|---|
| **A · foundation** (infra-engineer) | `frontend/src/index.css`, `frontend/index.html` |
| **B · shell** (infra/music mix) | Sidebar, Header, PlayerBar, Equalizer, LyricsView, QueueList, BackgroundSoundsPanel, MobileNav, MobileSearchBar, RadialNav, CozyroomMark, Spinner, BackButton, LibraryStatsBar, FavoritePill, InstallBanner, AppRoutes `.tsx` |
| **C-music** (music-engineer) | ArtistsPage, ArtistPage, AlbumsPage, AlbumPage, TracksPage, SearchPage, DiscoverPage, MusicStatsPage |
| **C-video** (video-engineer) | VideosPage, VideoPlayerPage |
| **C-reader** (reader-engineer) | EbooksPage, EbookReaderPage, ComicsPage |
| **C-ai** (ai-engineer) | AIAssistantPage, AIStatsPage, ToolsPage, RequestLogPage |
| **C-social** (social-engineer) | PlaylistsPage, NotesPage, TrendingPage, TrendingChartMode |

### Hard constraints (from CLAUDE.md + collision analysis)
- **Only A edits `index.css`.** B and C never touch it (single-writer). If B/C need a class that doesn't exist, they flag it — A adds it, they don't.
- **Only B edits shell components + `AppRoutes.tsx`.** C never touches these.
- **Nobody edits** `api.ts`, `PlayerContext.tsx`, `types.ts`, `offlineStore.ts` (logic/data — no visual surface).
- **Every agent obeys `DESIGN.md`** including § Inherited Invariants (focus ring→accent, touch-action, wide-monitor breakpoints, theme boot, currentColor logos).
- **social-engineer must NOT touch** `playlists.go`'s `verifyOwnerPassword` (unrelated backend; FE-only work here anyway).

### Verify gate per layer
- A: `cd frontend && npx tsc --noEmit` + `npx vite build` green; app boots light; focus ring visible.
- B: build green; sidebar/header/player/nav render Apple-light; no hardcoded `#fff` fills.
- C: build green; each page renders on light canvas, no void-black remnants, no `var(--green)+#000` interactive pairs left.
- Final: live verify on NodePort 30080 (per deploy rule) before any deploy.

## Origin
Graph derived from `llmwiki/wiki/concepts/frontend-component-map.md` (used-by/imports) + `DESIGN.md`.
