import { Routes, Route } from 'react-router-dom'
import { PlayerProvider } from './PlayerContext'
import { BgSoundsProvider } from './BgSoundsContext'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import PlayerBar from './components/PlayerBar'
import MobileNav from './components/MobileNav'
import RadialNav from './components/RadialNav'
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
import PlaylistsPage from './pages/PlaylistsPage'
import AIAssistantPage from './pages/AIAssistantPage'
import AIStatsPage from './pages/AIStatsPage'
import ToolsPage from './pages/ToolsPage'

export default function AppRoutes() {
  return (
    <BgSoundsProvider>
    <PlayerProvider>
      <div className="shell">
        <Sidebar />
        <div className="main-wrapper">
          <InstallBanner />
          <Header />
          <main className="main">
            <Routes>
              <Route path="/"            element={<ArtistsPage />} />
              <Route path="/artist/:id"  element={<ArtistPage />} />
              <Route path="/album/:id"   element={<AlbumPage />} />
              <Route path="/search"      element={<SearchPage />} />
              <Route path="/videos"      element={<VideosPage />} />
              <Route path="/video/:id"   element={<VideoPlayerPage />} />
              <Route path="/trending"    element={<TrendingPage />} />
              <Route path="/ebooks"      element={<EbooksPage />} />
              <Route path="/ebook/:id"   element={<EbookReaderPage />} />
              <Route path="/comics"      element={<ComicsPage />} />
              <Route path="/comics-mobile" element={<ComicsPageMobile />} />
              <Route path="/playlists"   element={<PlaylistsPage />} />
              <Route path="/ai"          element={<AIAssistantPage />} />
              <Route path="/ai/stats"    element={<AIStatsPage />} />
              <Route path="/tools"       element={<ToolsPage />} />
            </Routes>
          </main>
        </div>
        <PlayerBar />
        <MobileNav />
        <RadialNav />
      </div>
    </PlayerProvider>
    </BgSoundsProvider>
  )
}
