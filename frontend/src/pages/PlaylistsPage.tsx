import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { usePlayer } from '../PlayerContext'
import {
  Playlist,
  fetchPlaylists,
  fetchPlaylistTracks,
  fetchTracks,
  deletePlaylist
} from '../api'
import FavoritePill, { getLocalPlaylists, saveLocalPlaylists } from '../components/FavoritePill'
import type { Track } from '../types'

function useDominantColor(src: string | undefined): string {
  const [rgb, setRgb] = useState('40, 40, 55')
  useEffect(() => {
    if (!src) return
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = 50
      const ctx = c.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0, 50, 50)
      const d = ctx.getImageData(0, 0, 50, 50).data
      let r = 0, g = 0, b = 0, n = 0
      for (let i = 0; i < d.length; i += 4) {
        const br = (d[i] + d[i + 1] + d[i + 2]) / 3
        if (br < 15 || br > 235) continue
        r += d[i]; g += d[i + 1]; b += d[i + 2]; n++
      }
      if (n > 0) setRgb(`${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)}`)
    }
    img.src = src
  }, [src])
  return rgb
}

function PlaylistCoverMosaic({ coverIds }: { coverIds?: string[] }) {
  if (!coverIds || coverIds.length === 0) {
    return <div className="playlist-cover-placeholder">★</div>
  }
  const uniqueCovers = Array.from(new Set(coverIds.filter(id => id && id.trim() !== '')))
  if (uniqueCovers.length === 0) {
    return <div className="playlist-cover-placeholder">★</div>
  }

  // Less than 4 unique covers: show the first cover full size (items-1)
  if (uniqueCovers.length < 4) {
    return (
      <div className="playlist-cover-mosaic items-1">
        <img src={`/api/covers/${uniqueCovers[0]}`} alt=""
          onError={e => { (e.target as HTMLImageElement).style.opacity = '0' }} />
      </div>
    )
  }

  // 4 or more unique covers: show 2x2 grid (items-4)
  return (
    <div className="playlist-cover-mosaic items-4">
      {uniqueCovers.slice(0, 4).map(aid => (
        <img key={aid} src={`/api/covers/${aid}`} alt=""
          onError={e => { (e.target as HTMLImageElement).style.opacity = '0' }} />
      ))}
    </div>
  )
}


// Helper for session password storage
const getSessionPassword = () => sessionStorage.getItem('cozyroom_owner_password') || ''
const setSessionPassword = (pw: string) => sessionStorage.setItem('cozyroom_owner_password', pw)

const fmt = (s: number) => {
  if (!s) return '--:--'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function PlaylistsPage() {
  const { t } = useTranslation()
  const { play, track: current, isPlaying } = usePlayer()

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)
  const [localLists, setLocalLists] = useState<Playlist[]>([])
  const [permLists, setPermLists] = useState<Playlist[]>([])

  // Password prompt state for deletion
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Load playlists
  const loadLists = async () => {
    setLocalLists(getLocalPlaylists())
    try {
      const serverLists = await fetchPlaylists()
      setPermLists(serverLists)
    } catch (e) {
      console.error('Failed to fetch permanent playlists', e)
    }
  }

  useEffect(() => {
    loadLists()
    // Poll playlists list every 3s to keep everything updated in the background
    const interval = setInterval(loadLists, 3000)
    return () => clearInterval(interval)
  }, [])

  const allLists = [
    ...localLists.map(l => ({ ...l, is_local: true })),
    ...permLists.map(l => ({ ...l, is_local: false }))
  ]

  const isLocalSelected = allLists.find(l => l.id === selectedPlaylistId)?.is_local ?? false

  // Fetch playlist tracks from server (for perm playlists)
  const { data: playlistTracks = [], isLoading: isLoadingPerm } = useQuery({
    queryKey: ['playlist-tracks', selectedPlaylistId],
    queryFn: () => fetchPlaylistTracks(selectedPlaylistId!),
    enabled: !!selectedPlaylistId && !isLocalSelected,
    refetchInterval: 3000,
  })

  // Fetch all tracks from server (for resolving local playlists)
  const { data: allTracks = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ['all-tracks'],
    queryFn: () => fetchTracks(''),
    enabled: !!selectedPlaylistId && isLocalSelected,
  })

  const currentPlaylist = allLists.find(l => l.id === selectedPlaylistId)
  const coverSrc = currentPlaylist?.cover_ids?.[0] ? `/api/covers/${currentPlaylist.cover_ids[0]}` : undefined
  const dominantRgb = useDominantColor(coverSrc)

  // Resolve tracks for local/permanent playlist
  const tracks = isLocalSelected
    ? (currentPlaylist?.track_ids
        .map(id => allTracks.find(t => t.id === id))
        .filter((t): t is Track => !!t) ?? [])
    : playlistTracks

  const isLoadingTracks = isLocalSelected ? isLoadingAll : isLoadingPerm

  // Delete playlist handler
  const handleDeleteClick = (e: React.MouseEvent, id: string, isLocal: boolean) => {
    e.stopPropagation() // Prevent selecting the playlist
    
    if (isLocal) {
      const confirmDelete = window.confirm(
        t('playlist.delete_confirm', { defaultValue: 'Bạn có chắc chắn muốn xóa playlist này không?' })
      )
      if (confirmDelete) {
        const updated = localLists.filter(l => l.id !== id)
        setLocalLists(updated)
        saveLocalPlaylists(updated)
        if (selectedPlaylistId === id) {
          setSelectedPlaylistId(null)
        }
      }
    } else {
      const pw = getSessionPassword()
      if (pw) {
        proceedDelete(id, pw)
      } else {
        setDeletingId(id)
        setPasswordInput('')
        setPasswordError('')
        setShowPasswordModal(true)
      }
    }
  }

  const proceedDelete = async (id: string, pw: string) => {
    try {
      await deletePlaylist(id, pw)
      setSessionPassword(pw)
      setShowPasswordModal(false)
      setDeletingId(null)
      if (selectedPlaylistId === id) {
        setSelectedPlaylistId(null)
      }
      loadLists()
    } catch (e: any) {
      console.error(e)
      if (e.message?.includes('412') || e.message?.includes('401') || e.message?.includes('unauthorized')) {
        sessionStorage.removeItem('cozyroom_owner_password')
        setPasswordError('Mật khẩu sai!')
      } else {
        alert(e.message || 'Xóa playlist thất bại')
        setShowPasswordModal(false)
        setDeletingId(null)
      }
    }
  }

  const handlePasswordSubmit = () => {
    const trimmed = passwordInput.trim()
    if (!trimmed) return
    if (deletingId) {
      proceedDelete(deletingId, trimmed)
    }
  }

  // Play entire playlist
  const handlePlayPlaylist = () => {
    if (tracks.length > 0) {
      play(tracks[0], tracks)
    }
  }

  if (selectedPlaylistId && currentPlaylist) {
    return (
      <div className="page" style={{ paddingTop: 0 }}>
        <div
          className="playlist-hero-wrapper"
          style={{ background: `linear-gradient(180deg, rgba(${dominantRgb}, 0.65) 0%, rgba(${dominantRgb}, 0.2) 70%, transparent 100%)` }}
        >
          <button className="back-btn" onClick={() => setSelectedPlaylistId(null)}>
            {t('library.back', { defaultValue: '← Quay lại' })}
          </button>

          <div className="album-hero">
            <div style={{ width: 230, height: 230, borderRadius: 8, overflow: 'hidden', boxShadow: '0 20px 48px rgba(0,0,0,0.7)', flexShrink: 0 }}>
              <PlaylistCoverMosaic coverIds={currentPlaylist.cover_ids} />
            </div>
            <div className="album-hero-info">
              <p className="hero-type">
                {currentPlaylist.is_local
                  ? t('playlist.local', { defaultValue: 'Local Playlist' })
                  : t('playlist.permanent', { defaultValue: 'Permanent Playlist' })}
              </p>
              <h1 className="hero-title">{currentPlaylist.name}</h1>
              <p className="hero-meta">
                {t('library.tracks_count', { n: tracks.length })}
              </p>
              {tracks.length > 0 && (
                <button className="hero-play-btn" onClick={handlePlayPlaylist} style={{ marginTop: 12 }} aria-label={t('playlist.play', { defaultValue: 'Phát' })}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {isLoadingTracks ? (
          <div className="loading">{t('library.loading', { defaultValue: 'Đang tải...' })}</div>
        ) : tracks.length === 0 ? (
          <p className="text-muted" style={{ marginTop: 24 }}>
            {t('playlist.no_tracks', { defaultValue: 'Chưa có bài hát nào trong playlist này.' })}
          </p>
        ) : (
          <table className="track-table" style={{ marginTop: 24 }}>
            <thead>
              <tr>
                <th className="col-num">#</th>
                <th>{t('search.title_col')}</th>
                <th className="col-fav"></th>
                <th className="col-dur">{t('search.duration_col')}</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((tTrack, i) => {
                const isCurrent = current?.id === tTrack.id
                return (
                  <tr
                    key={tTrack.id}
                    className={'track-row' + (isCurrent ? ' track-row--active' : '')}
                    onClick={() => play(tTrack, tracks)}
                  >
                    <td className="col-num">
                      {isCurrent && isPlaying ? (
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="var(--green)">
                          <rect x="6" y="4" width="4" height="16" />
                          <rect x="14" y="4" width="4" height="16" />
                        </svg>
                      ) : (
                        <span className="track-num-text">{i + 1}</span>
                      )}
                    </td>
                    <td className={'track-title' + (isCurrent ? ' track-title--active' : '')}>
                      <div className="track-info">
                        <span>{tTrack.title}</span>
                        {tTrack.artist_name && <span className="track-artist">{tTrack.artist_name}</span>}
                      </div>
                    </td>
                    <td className="col-fav" onClick={e => e.stopPropagation()}>
                      <FavoritePill trackId={tTrack.id} />
                    </td>
                    <td className="col-dur">{fmt(tTrack.duration_s)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="page-title">{t('nav.playlists', { defaultValue: 'Playlists' })}</h1>
      
      {allLists.length === 0 ? (
        <p className="text-muted">
          {t('playlist.no_playlists_yet', { defaultValue: 'Chưa có playlist nào. Hãy thêm một bài hát vào playlist để tạo mới!' })}
        </p>
      ) : (
        <div className="playlist-grid">
          {allLists.map(list => (
            <div
              key={list.id}
              className="playlist-card"
              onClick={() => setSelectedPlaylistId(list.id)}
            >
              <button
                className="playlist-delete-btn"
                onClick={(e) => handleDeleteClick(e, list.id, list.is_local)}
                title={t('playlist.delete', { defaultValue: 'Xóa Playlist' })}
              >
                ✕
              </button>
              
              <PlaylistCoverMosaic coverIds={list.cover_ids} />
              
              <div className="playlist-info">
                <div className="playlist-title">{list.name}</div>
                <div className="playlist-meta">
                  <span>{t('library.tracks_count', { n: list.track_ids.length })}</span>
                  <span className={`playlist-badge ${list.is_local ? 'playlist-badge--local' : 'playlist-badge--perm'}`}>
                    {list.is_local 
                      ? t('playlist.badge_local', { defaultValue: 'Local' }) 
                      : t('playlist.badge_perm', { defaultValue: 'Perm' })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Password Modal for Deletion */}
      {showPasswordModal && (
        <div className="password-modal-overlay" onClick={e => e.stopPropagation()}>
          <div className="password-modal">
            <h3>{t('playlist.password_required', { defaultValue: 'Yêu cầu Mật khẩu' })}</h3>
            <p>{t('playlist.password_desc', { defaultValue: 'Vui lòng nhập mật khẩu chủ sở hữu để chỉnh sửa dữ liệu vĩnh viễn.' })}</p>
            <input
              className="dropdown-input"
              type="password"
              placeholder="Nhập mật khẩu..."
              value={passwordInput}
              onChange={e => { setPasswordInput(e.target.value); setPasswordError(''); }}
              onKeyDown={e => {
                if (e.key === 'Enter') handlePasswordSubmit()
              }}
              autoFocus
            />
            {passwordError && (
              <span style={{ color: '#ef4444', fontSize: 12 }}>{passwordError}</span>
            )}
            <div className="password-modal-actions">
              <button
                type="button"
                className="modal-btn modal-btn--cancel"
                onClick={() => { setShowPasswordModal(false); setDeletingId(null); }}
              >
                {t('playlist.cancel', { defaultValue: 'Hủy' })}
              </button>
              <button
                type="button"
                className="modal-btn modal-btn--confirm"
                onClick={handlePasswordSubmit}
              >
                {t('playlist.confirm', { defaultValue: 'Xác nhận' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
