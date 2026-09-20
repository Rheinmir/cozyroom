---
name: 230526-4-issues-wiki-search-lyrics-cover-fe
description: Proposal covering 4 issues — wiki/llmwiki structure migration, missing mobile search bar (broken build), lyrics sync lag, cover image race
type: draft
date: 2026-05-23
---

# Proposal: 4 Issues — Wiki Migration, Search Bar, Lyrics Sync, Cover Image

## 1. Request (one sentence each)

1. **Wiki structure**: Rename `wiki/` → `llmwiki/wiki/` and `skills/` → `llmwiki/skills/` to match the `rheinmir/setup#orca` template so all Orca orchestration tools find files at expected paths.
2. **Mobile search bar**: The search bar disappeared because commit `6a6e8cd` extracted `App.tsx` routing into `AppRoutes.tsx` but never committed that file — the build is currently broken and `<Header />` is gone.
3. **Lyrics sync**: Lyrics occasionally appear out of sync — `behavior: 'smooth'` on the auto-scroll causes up to 500 ms visual lag after seek or a large jump, making the highlighted line appear late.
4. **Cover image**: Album cover sometimes doesn't appear even though audio is already playing — race between audio start and the first CDN fetch/cache on the backend proxy; `SearchPage` also uses raw `cover_url` which may be a direct external URL.

---

## 2. Files affected

### Issue 1 — Wiki structure
| File / path | Change |
|---|---|
| `wiki/` directory | Rename to `llmwiki/wiki/` |
| `skills/` directory | Move to `llmwiki/skills/` |
| `raw/` directory | Move to `llmwiki/raw/` |
| `CLAUDE.md` | Update all `wiki/` path references to `llmwiki/wiki/`, update Skills table |
| `AGENT.md` | Update all `wiki/` and `skills/` path references |
| `.template-manifest.json` | Update template paths if present |

### Issue 2 — Missing search bar / broken build
| File | Change |
|---|---|
| `frontend/src/AppRoutes.tsx` | **Create** — shell layout with all routes, `<Header />`, `<PlayerProvider>`, `<Sidebar>`, `<PlayerBar>`, `<MobileNav>` |
| `frontend/src/App.tsx` | No change needed (already imports `AppRoutes`) |

### Issue 3 — Lyrics sync
| File | Change |
|---|---|
| `frontend/src/components/LyricsView.tsx` | Auto-scroll: use instant scroll when jumped > 1 screenful, smooth only for single-line advance |

### Issue 4 — Cover image
| File | Change |
|---|---|
| `frontend/src/components/PlayerBar.tsx` | Add `onError` + CSS skeleton on the mini-player cover `<img>`; read more of file to confirm |
| `frontend/src/pages/SearchPage.tsx` | Replace raw `cover_url` with `/api/covers/{id}` endpoint |
| `frontend/src/pages/AlbumPage.tsx` | Same cover URL audit |

---

## 3. Risk of breakage

| Issue | Risk |
|---|---|
| Wiki rename | Path references in CLAUDE.md skills table, orca-workflow skill, propose skill all hardcode `llmwiki/wiki/`. Renaming `wiki/` without updating these breaks future drafts. Low code risk; only config. |
| AppRoutes creation | **Critical** — build is currently broken. Creating `AppRoutes.tsx` re-enables the build and restores the search bar. Must include all new pages added since `f703b53`: `VideosPage`, `VideoPlayerPage`, `TrendingPage`, `EbooksPage`, `EbookReaderPage`, `ComicsPage`, `ComicsPageMobile`. Missing a route = 404 for that page. |
| Lyrics scroll | Changing `behavior: 'smooth'` to conditional instant/smooth changes the feel. Smooth scroll on single-line advance should still be kept for the karaoke aesthetic. |
| Cover image | Changing `cover_url` → `/api/covers/{id}` in SearchPage requires the backend to serve covers by ID from the search result; currently `SearchPage` passes `album.id`. Verify endpoint signature matches. |

---

## 4. Implementation plan

### Issue 2 (highest priority — build is broken)

1. Create `frontend/src/AppRoutes.tsx`:
   ```tsx
   import { Routes, Route } from 'react-router-dom'
   import { PlayerProvider } from './PlayerContext'
   import Sidebar from './components/Sidebar'
   import Header from './components/Header'
   import PlayerBar from './components/PlayerBar'
   import MobileNav from './components/MobileNav'
   import InstallBanner from './components/InstallBanner'
   import ArtistsPage from './pages/ArtistsPage'
   import ArtistPage from './pages/ArtistPage'
   import AlbumPage from './pages/AlbumPage'
   import SearchPage from './pages/SearchPage'
   import VideosPage from './pages/VideosPage'
   import VideoPlayerPage from './pages/VideoPlayerPage'
   import TrendingPage from './pages/TrendingPage'
   import EbooksPage from './pages/EbooksPage'
   import EbookReaderPage from './pages/EbookReaderPage'
   import ComicsPage from './pages/ComicsPage'
   import ComicsPageMobile from './pages/ComicsPageMobile'

   export default function AppRoutes() {
     return (
       <PlayerProvider>
         <div className="shell">
           <Sidebar />
           <div className="main-wrapper">
             <InstallBanner />
             <Header />
             <main className="main">
               <Routes>
                 <Route path="/" element={<ArtistsPage />} />
                 <Route path="/artist/:id" element={<ArtistPage />} />
                 <Route path="/album/:id" element={<AlbumPage />} />
                 <Route path="/search" element={<SearchPage />} />
                 <Route path="/videos" element={<VideosPage />} />
                 <Route path="/video/:id" element={<VideoPlayerPage />} />
                 <Route path="/trending" element={<TrendingPage />} />
                 <Route path="/ebooks" element={<EbooksPage />} />
                 <Route path="/ebook/:id" element={<EbookReaderPage />} />
                 <Route path="/comics" element={<ComicsPage />} />
                 <Route path="/comics-mobile" element={<ComicsPageMobile />} />
               </Routes>
             </main>
           </div>
           <PlayerBar />
           <MobileNav />
         </div>
       </PlayerProvider>
     )
   }
   ```
   → verify: `npm run build` passes, search bar visible on mobile `/search`

### Issue 3 (lyrics sync)

2. Add `const prevIdxRef = useRef(-1)` near other refs.
3. In the existing `useEffect([trackId])` block, add `prevIdxRef.current = -1` at the top to reset on track change — without this, `prevIdxRef` retains the last line index of the previous song, causing smooth scroll to run cross-song (e.g. song A ends at index 1, song B starts at index 0, diff = 1 → smooth scroll from song A's position).
4. In `useEffect([currentPairIdx])` scroll effect, replace unconditional smooth scroll:
   ```ts
   const prevIdx = prevIdxRef.current
   prevIdxRef.current = currentPairIdx
   const isSmallStep = prevIdx !== -1 && Math.abs(currentPairIdx - prevIdx) <= 1
   container.scrollTo({ top: Math.max(0, target), behavior: isSmallStep ? 'smooth' : 'auto' })
   ```
   → verify: seek to middle of song — lyrics jump instantly; normal play — lines scroll smoothly; track change — instant jump to line 0.

### Issue 4 (cover image)

5. In `SearchPage.tsx`, replace raw `al.cover_url` with `imgSrc(al.cover_url, 200)` (import `imgSrc` from `'../api'`). This ensures the optimized proxy endpoint is used with proper sizing.
6. In `PlayerBar.tsx`, fix the two `onError` handlers that call `style.display = 'none'` — this collapses the element. Instead, let the parent element's `background: var(--elevated)` show through by just hiding the broken img: `(e.target as HTMLImageElement).style.opacity = '0'`.
   - mini-player vinyl button (line ~207): `<img ... onError={e => { (e.target as HTMLImageElement).style.opacity = '0' }} />`
   - npo cover (line ~250): same
   - Don't prefetch before audio — progressive loading via w=80 fast → w=512 background is out of scope for this fix; skeleton + opacity-0-on-error is sufficient.

### Issue 1 (wiki migration)

6. Rename `wiki/` → `llmwiki/wiki/` using `git mv`.
7. Move `skills/` → `llmwiki/skills/` using `git mv`.
8. Move `raw/` → `llmwiki/raw/` using `git mv`.
9. Update `CLAUDE.md` — all `wiki/` refs → `llmwiki/wiki/`, skills table path.
10. Update `llmwiki/wiki/index.md` header/intro if present.
11. Check `commands/` usage — move to `llmwiki/commands/` if it belongs to the template.
    → verify: `CLAUDE.md` lint passes, all linked files resolve.

---

## 5. Success criteria

| Issue | Verifiable condition |
|---|---|
| Search bar | `npm run build` exits 0; `/search` on mobile ≤640px shows the search input |
| Wiki migration | All paths in CLAUDE.md resolve; `llmwiki/wiki/index.md` exists; old `wiki/` gone |
| Lyrics sync | Seek to track mid-point; active lyric line appears at correct timestamp within 100ms; no 500ms visual lag |
| Cover image | First play of an uncached track: cover placeholder visible immediately, actual cover loads within 3s; no blank space on retry |

---

## Origin

- **Draft date:** 2026-05-23
- **Status:** awaiting approval
