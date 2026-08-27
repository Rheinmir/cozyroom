import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { usePlayer } from '../PlayerContext'
import { useDialogs } from '../DialogContext'
import {
  Playlist,
  fetchPlaylists,
  fetchPlaylistTracks,
  fetchTracks,
  deletePlaylist
} from '../api'
import FavoritePill, { getLocalPlaylists, saveLocalPlaylists } from '../components/FavoritePill'
import { saveOfflineTrack, deleteOfflineTrack, listOfflineTrackIds } from '../offlineStore'
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
      try {
        ctx.drawImage(img, 0, 0, 50, 50)
        const d = ctx.getImageData(0, 0, 50, 50).data
        let r = 0, g = 0, b = 0, n = 0
        for (let i = 0; i < d.length; i += 4) {
          const br = (d[i] + d[i + 1] + d[i + 2]) / 3
          if (br < 15 || br > 235) continue
          r += d[i]; g += d[i + 1]; b += d[i + 2]; n++
        }
        if (n > 0) setRgb(`${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)}`)
      } catch {}
    }
    img.crossOrigin = 'anonymous'
    img.onerror = () => {}
    img.src = src
  }, [src])
  return rgb
}

const PLAYLIST_GRADIENTS = [
  'radial-gradient(140% 140% at 30% 22%, oklch(0.55 0.20 285) 0%, oklch(0.35 0.14 315) 50%, oklch(0.15 0.06 345) 100%)',
  'radial-gradient(140% 140% at 70% 78%, oklch(0.58 0.18 160) 0%, oklch(0.36 0.14 185) 50%, oklch(0.15 0.06 210) 100%)',
  'radial-gradient(140% 140% at 30% 22%, oklch(0.60 0.19 45) 0%, oklch(0.38 0.14 20) 50%, oklch(0.16 0.06 355) 100%)',
  'radial-gradient(140% 140% at 30% 78%, oklch(0.52 0.19 240) 0%, oklch(0.33 0.14 268) 50%, oklch(0.14 0.07 300) 100%)',
  'radial-gradient(140% 140% at 70% 22%, oklch(0.56 0.20 345) 0%, oklch(0.36 0.15 315) 50%, oklch(0.16 0.06 285) 100%)',
  'radial-gradient(140% 140% at 30% 22%, oklch(0.60 0.17 185) 0%, oklch(0.38 0.13 210) 50%, oklch(0.16 0.05 230) 100%)',
]
function playlistGradientFor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0
  return PLAYLIST_GRADIENTS[Math.abs(h) % PLAYLIST_GRADIENTS.length]
}

function PlaylistCoverMosaic({ coverIds, name = '' }: { coverIds?: string[]; name?: string }) {
  if (!coverIds || coverIds.length === 0) {
    return <div className="playlist-cover-placeholder" style={{ background: playlistGradientFor(name) }}>♪</div>
  }
  const uniqueCovers = Array.from(new Set(coverIds.filter(id => id && id.trim() !== '')))
  if (uniqueCovers.length === 0) {
    return <div className="playlist-cover-placeholder" style={{ background: playlistGradientFor(name) }}>♪</div>
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
  const { confirm, toast } = useDialogs()

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)
  const [localLists, setLocalLists] = useState<Playlist[]>([])
  const [permLists, setPermLists] = useState<Playlist[]>([])

  // Password prompt state for deletion
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Offline download state — which tracks are saved locally, which are mid-download
  const [offlineIds, setOfflineIds] = useState<Set<string>>(new Set())
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    listOfflineTrackIds().then(ids => setOfflineIds(new Set(ids)))
  }, [])

  const handleToggleOffline = async (trackId: string) => {
    if (offlineIds.has(trackId)) {
      await deleteOfflineTrack(trackId)
      setOfflineIds(prev => { const next = new Set(prev); next.delete(trackId); return next })
      return
    }
    setDownloadingIds(prev => new Set(prev).add(trackId))
    try {
      const res = await fetch(`/stream/${trackId}?q=320`)
      if (!res.ok) throw new Error('download failed')
      const blob = await res.blob()
      const result = await saveOfflineTrack(trackId, blob, '320')
      if (result.ok) {
        setOfflineIds(prev => new Set(prev).add(trackId))
      } else {
        toast(t('playlist.offline_quota', { defaultValue: 'Không đủ dung lượng lưu trữ để tải bài này' }), 'error')
      }
    } catch (e) {
      console.error('offline download failed', e)
      toast(t('playlist.offline_failed', { defaultValue: 'Tải bài hát để nghe offline thất bại' }), 'error')
    } finally {
      setDownloadingIds(prev => { const next = new Set(prev); next.delete(trackId); return next })
    }
  }

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
  const handleDeleteClick = async (e: React.MouseEvent, id: string, isLocal: boolean) => {
    e.stopPropagation() // Prevent selecting the playlist

    if (isLocal) {
      const confirmDelete = await confirm({
        message: t('playlist.delete_confirm', { defaultValue: 'Bạn có chắc chắn muốn xóa playlist này không?' }),
        danger: true,
      })
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
        toast(e.message || 'Xóa playlist thất bại', 'error')
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
              <PlaylistCoverMosaic coverIds={currentPlaylist.cover_ids} name={currentPlaylist.name} />
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
                <th className="col-offline"></th>
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
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(tTrack, tracks) } }}
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
                    <td className="col-offline" onClick={e => e.stopPropagation()}>
                      {!tTrack.id.startsWith('yt:') && (
                        <button
                          className={'offline-download-btn' + (offlineIds.has(tTrack.id) ? ' offline-download-btn--done' : '')}
                          disabled={downloadingIds.has(tTrack.id)}
                          onClick={() => handleToggleOffline(tTrack.id)}
                          aria-label={offlineIds.has(tTrack.id)
                            ? t('playlist.offline_remove', { defaultValue: 'Xoá khỏi offline' })
                            : t('playlist.offline_download', { defaultValue: 'Tải xuống nghe offline' })}
                          title={offlineIds.has(tTrack.id)
                            ? t('playlist.offline_remove', { defaultValue: 'Xoá khỏi offline' })
                            : t('playlist.offline_download', { defaultValue: 'Tải xuống nghe offline' })}
                        >
                          {downloadingIds.has(tTrack.id) ? '…' : offlineIds.has(tTrack.id) ? '✓' : '⬇'}
                        </button>
                      )}
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
              
              <PlaylistCoverMosaic coverIds={list.cover_ids} name={list.name} />
              
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
              <span className="error-text">{passwordError}</span>
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
