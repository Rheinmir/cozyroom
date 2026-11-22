import { useRef } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useScrollRestoration } from './useScrollRestoration'
import { PlayerProvider } from './PlayerContext'
import { BgSoundsProvider } from './BgSoundsContext'
import { DialogProvider } from './DialogContext'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import MobileSearchBar from './components/MobileSearchBar'
import PlayerBar from './components/PlayerBar'
import MobileNav from './components/MobileNav'
import RadialNav from './components/RadialNav'
import InstallBanner from './components/InstallBanner'
import ArtistsPage from './pages/ArtistsPage'
import DiscoverPage from './pages/DiscoverPage'
import ArtistPage from './pages/ArtistPage'
import AlbumPage from './pages/AlbumPage'
import AlbumsPage from './pages/AlbumsPage'
import TracksPage from './pages/TracksPage'
import SearchPage from './pages/SearchPage'
import VideosPage from './pages/VideosPage'
import VideoPlayerPage from './pages/VideoPlayerPage'
import TrendingPage from './pages/TrendingPage'
import EbooksPage from './pages/EbooksPage'
import EbookReaderPage from './pages/EbookReaderPage'
import ComicsPage from './pages/ComicsPage'
import PlaylistsPage from './pages/PlaylistsPage'
import NotesPage from './pages/NotesPage'
import AIAssistantPage from './pages/AIAssistantPage'
import AIStatsPage from './pages/AIStatsPage'
import MusicStatsPage from './pages/MusicStatsPage'
import ToolsPage from './pages/ToolsPage'
import RequestLogPage from './pages/RequestLogPage'
import { ROUTES } from './routes'

export default function AppRoutes() {
  const mainRef = useRef<HTMLElement>(null)
  useScrollRestoration(mainRef)

  return (
    <DialogProvider>
    <BgSoundsProvider>
    <PlayerProvider>
      <div className="shell">
        <Sidebar />
        <div className="main-wrapper">
          <InstallBanner />
          <Header />
          <main className="main" ref={mainRef}>
            <Routes>
              <Route path={ROUTES.home}            element={<ArtistsPage />} />
              <Route path={ROUTES.discover}    element={<DiscoverPage />} />
              <Route path={ROUTES.artist}  element={<ArtistPage />} />
              <Route path={ROUTES.album}   element={<AlbumPage />} />
              <Route path={ROUTES.albums}      element={<AlbumsPage />} />
              <Route path={ROUTES.tracks}      element={<TracksPage />} />
              <Route path={ROUTES.search}      element={<SearchPage />} />
              <Route path={ROUTES.videos}      element={<VideosPage />} />
              <Route path={ROUTES.video}   element={<VideoPlayerPage />} />
              <Route path={ROUTES.trending}    element={<TrendingPage />} />
              <Route path={ROUTES.ebooks}      element={<EbooksPage />} />
              <Route path={ROUTES.ebook}   element={<EbookReaderPage />} />
              <Route path={ROUTES.comics}      element={<ComicsPage />} />
              <Route path={ROUTES.playlists}   element={<PlaylistsPage />} />
              <Route path={ROUTES.notes}       element={<NotesPage />} />
              <Route path={ROUTES.ai}          element={<AIAssistantPage />} />
              <Route path={ROUTES.aiStats}    element={<AIStatsPage />} />
              <Route path={ROUTES.musicStats} element={<MusicStatsPage />} />
              <Route path={ROUTES.tools}       element={<ToolsPage />} />
              <Route path={ROUTES.debug}       element={<RequestLogPage />} />
            </Routes>
          </main>
        </div>
        <PlayerBar />
        <MobileSearchBar />
        <MobileNav />
        <RadialNav />
      </div>
    </PlayerProvider>
    </BgSoundsProvider>
    </DialogProvider>
  )
}
