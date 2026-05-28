import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  Playlist, 
  fetchPlaylists, 
  createPlaylist, 
  addTrackToPlaylist, 
  removeTrackFromPlaylist 
} from '../api'

// Helper for session password storage
const getSessionPassword = () => sessionStorage.getItem('cozyroom_owner_password') || ''
const setSessionPassword = (pw: string) => sessionStorage.setItem('cozyroom_owner_password', pw)

// Local storage key
const LOCAL_PLAYLISTS_KEY = 'cozyroom_local_playlists'

export const getLocalPlaylists = (): Playlist[] => {
  try {
    const raw = localStorage.getItem(LOCAL_PLAYLISTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const saveLocalPlaylists = (lists: Playlist[]) => {
  try {
    localStorage.setItem(LOCAL_PLAYLISTS_KEY, JSON.stringify(lists))
  } catch (e) {
    console.error('Failed to save local playlists', e)
  }
}

type FavoritePillProps = {
  trackId: string
}

export default function FavoritePill({ trackId }: FavoritePillProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  
  const [localLists, setLocalLists] = useState<Playlist[]>([])
  const [permLists, setPermLists] = useState<Playlist[]>([])
  
  // Creation form state
  const [newName, setNewName] = useState('')
  const [isPerm, setIsPerm] = useState(false)
  const [creating, setCreating] = useState(false)
  
  // Password prompt state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [onPasswordSuccess, setOnPasswordSuccess] = useState<((pw: string) => void) | null>(null)
  
  const dropdownRef = useRef<HTMLDivElement>(null)

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
    
    // Close dropdown on click outside
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  // Find all playlists containing this track
  const allLists = [
    ...localLists.map(l => ({ ...l, is_local: true })),
    ...permLists.map(l => ({ ...l, is_local: false }))
  ]
  
  const activeLists = allLists.filter(l => l.track_ids.includes(trackId))
  const isStarred = activeLists.some(l => l.name === 'Favorites')

  // Star toggle: target the "Favorites" playlist
  const handleStarClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Find if "Favorites" playlist exists
    const favList = allLists.find(l => l.name === 'Favorites')
    
    if (favList) {
      const inFav = favList.track_ids.includes(trackId)
      if (inFav) {
        // Remove track
        await toggleTrack(favList.id, favList.is_local!, false)
      } else {
        // Add track
        await toggleTrack(favList.id, favList.is_local!, true)
      }
    } else {
      // Create local Favorites playlist and add track
      const newList: Playlist = {
        id: 'local_favs_' + Date.now(),
        name: 'Favorites',
        track_ids: [trackId]
      }
      const updated = [...localLists, newList]
      setLocalLists(updated)
      saveLocalPlaylists(updated)
    }
  }

  // Toggle track in/out of a playlist
  const toggleTrack = async (listId: string, isLocal: boolean, add: boolean, overridePw?: string) => {
    if (isLocal) {
      const updated = localLists.map(l => {
        if (l.id === listId) {
          const tids = add 
            ? [...l.track_ids.filter(id => id !== trackId), trackId]
            : l.track_ids.filter(id => id !== trackId)
          return { ...l, track_ids: tids }
        }
        return l
      })
      setLocalLists(updated)
      saveLocalPlaylists(updated)
    } else {
      const pw = overridePw || getSessionPassword()
      
      const proceed = async (validPw: string) => {
        try {
          if (add) {
            await addTrackToPlaylist(listId, trackId, validPw)
          } else {
            await removeTrackFromPlaylist(listId, trackId, validPw)
          }
          // Refresh server list
          const serverLists = await fetchPlaylists()
          setPermLists(serverLists)
        } catch (e: any) {
          console.error(e)
          // If unauthorized, clear password and ask again
          if (e.message?.includes('412') || e.message?.includes('401') || e.message?.includes('unauthorized')) {
            sessionStorage.removeItem('cozyroom_owner_password')
            promptPassword((newPw) => toggleTrack(listId, false, add, newPw))
          } else {
            alert(e.message || 'Operation failed')
          }
        }
      }

      if (!pw) {
        promptPassword(proceed)
      } else {
        await proceed(pw)
      }
    }
  }

  // Prompt for owner password
  const promptPassword = (onSuccess: (pw: string) => void) => {
    setPasswordInput('')
    setPasswordError('')
    setOnPasswordSuccess(() => onSuccess)
    setShowPasswordModal(true)
  }

  const handlePasswordSubmit = () => {
    const trimmed = passwordInput.trim()
    if (trimmed !== 'owner712002') {
      setPasswordError('Mật khẩu sai!')
      return
    }
    setSessionPassword(trimmed)
    setShowPasswordModal(false)
    if (onPasswordSuccess) {
      onPasswordSuccess(trimmed)
    }
  }

  // Create playlist
  const handleCreatePlaylist = async (overridePw?: string) => {
    const trimmedName = newName.trim()
    if (!trimmedName) return
    
    if (isPerm) {
      const pw = overridePw || getSessionPassword()
      if (!pw) {
        promptPassword((validPw) => handleCreatePlaylist(validPw))
        return
      }
      
      setCreating(true)
      try {
        await createPlaylist(trimmedName, pw)
        setNewName('')
        // Refresh server list
        const serverLists = await fetchPlaylists()
        setPermLists(serverLists)
      } catch (e: any) {
        console.error(e)
        if (e.message?.includes('412') || e.message?.includes('401') || e.message?.includes('unauthorized')) {
          sessionStorage.removeItem('cozyroom_owner_password')
          promptPassword((validPw) => handleCreatePlaylist(validPw))
        } else {
          alert(e.message || 'Tạo playlist thất bại')
        }
      } finally {
        setCreating(false)
      }
    } else {
      // Local playlist
      const newList: Playlist = {
        id: 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        name: trimmedName,
        track_ids: []
      }
      const updated = [...localLists, newList]
      setLocalLists(updated)
      saveLocalPlaylists(updated)
      setNewName('')
    }
  }

  return (
    <div className="fav-pill-wrapper" style={{ display: 'inline-block' }} ref={dropdownRef}>
      <div className="fav-pill" onClick={e => e.stopPropagation()}>
        <button 
          className={'fav-star' + (isStarred ? ' fav-star--active' : '')} 
          onClick={handleStarClick}
          title={isStarred ? t('playlist.remove_star', { defaultValue: 'Starred' }) : t('playlist.add_star', { defaultValue: 'Star' })}
        >
          {isStarred ? '★' : '☆'}
        </button>
        <div className="fav-sep" />
        <button 
          className="fav-arrow" 
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); if (!isOpen) loadLists(); }}
          title={t('playlist.add_to_playlist', { defaultValue: 'Add to playlist' })}
        >
          ▾
        </button>
        
        {isOpen && (
          <div className="fav-dropdown">
            <div className="dropdown-header">{t('playlist.my_playlists', { defaultValue: 'Playlists' })}</div>
            
            <div className="dropdown-list">
              {allLists.length === 0 ? (
                <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                  {t('playlist.no_playlists', { defaultValue: 'Chưa có playlist nào' })}
                </div>
              ) : (
                allLists.map(list => {
                  const inList = list.track_ids.includes(trackId)
                  return (
                    <label key={list.id} className="dropdown-item" onClick={e => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={inList} 
                        onChange={() => toggleTrack(list.id, list.is_local!, !inList)}
                      />
                      <span>{list.name}</span>
                      <span className="dropdown-item-type">
                        {list.is_local ? 'Local' : 'Perm'}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
            
            <div className="dropdown-create-form" onClick={e => e.stopPropagation()}>
              <input 
                className="dropdown-input" 
                type="text" 
                placeholder={t('playlist.create_placeholder', { defaultValue: 'Tên danh sách mới...' })}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreatePlaylist()
                }}
              />
              <div className="dropdown-type-toggle">
                <button 
                  type="button"
                  className={'dropdown-type-btn' + (!isPerm ? ' dropdown-type-btn--active' : '')}
                  onClick={() => setIsPerm(false)}
                >
                  Cục bộ
                </button>
                <button 
                  type="button"
                  className={'dropdown-type-btn' + (isPerm ? ' dropdown-type-btn--active' : '')}
                  onClick={() => setIsPerm(true)}
                >
                  Vĩnh viễn
                </button>
              </div>
              <button 
                type="button" 
                className="dropdown-create-btn"
                onClick={() => handleCreatePlaylist()}
                disabled={creating || !newName.trim()}
              >
                {creating ? '...' : t('playlist.create_btn', { defaultValue: 'Tạo' })}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Password prompt Modal */}
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
                onClick={() => setShowPasswordModal(false)}
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
