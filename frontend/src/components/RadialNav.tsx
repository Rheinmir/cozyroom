import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlayer } from '../PlayerContext'
import { useBgSounds } from '../BgSoundsContext'
import type { Playlist } from '../api'
import { fetchPlaylists, addTrackToPlaylist, removeTrackFromPlaylist } from '../api'
import { getLocalPlaylists, saveLocalPlaylists } from './FavoritePill'
import CozyroomMark from './CozyroomMark'

// Was exactly 56px — the same height as the media-control pill next to it,
// which read as coincidental/unintentional rather than a deliberate size
// relationship. Sized down so the two are visibly different at a glance.
const BUBBLE_R = 24   // half of 48px bubble

// ── Icons ─────────────────────────────────────────────────────────────────────
const I = (d: string) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d={d}/></svg>
)
const IcHome     = () => I('M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z')
const IcSearch   = () => I('M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z')
const IcVideo    = () => I('M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z')
const IcBook     = () => I('M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z')
const IcComics   = () => I('M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z')
const IcTrend    = () => I('M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z')
const IcPlaylist = () => I('M4 10h12v2H4zm0-4h12v2H4zm0 8h8v2H4zm10 0v6l5-3z')

const IcAI       = () => I('M12 2L13.09 9.26L20 12L13.09 14.74L12 22L10.91 14.74L4 12L10.91 9.26Z M19 3L19.5 5.5L22 6L19.5 6.5L19 9L18.5 6.5L16 6L18.5 5.5Z')
const IcChart    = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/></svg>
const IcGrid     = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M4 4h7v7H4zm10 0h7v7h-7zM4 14h7v7H4zm10 0h7v7h-7z"/></svg>
const IcRefresh     = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
const IcStar        = () => I('M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z')
const IcStarBorder  = () => I('M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zm-10 6.73l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 7.1l1.71 3.61 4.38.38-3.32 2.88 1 4.28L12 15.97z')
const IcPlaylistAdd = () => I('M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z')
const IcSounds = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>


type RadialItem = { route: string; label: string; icon: JSX.Element; onAction?: () => void }

// A menu item as rendered in the grid — flattened from whichever mode's item
// list is active (main menu / trending / calendar / playlist picker) so they
// can all share one square-grid layout instead of separate concentric rings.
type MenuCell = {
  key: string
  icon: React.ReactNode
  label?: string
  active?: boolean
  disabled?: boolean
  dotColor?: string
  spinning?: boolean
  onClick?: () => void
  onDoubleClick?: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RadialNav() {
  const { t, i18n } = useTranslation()
  const navigate  = useNavigate()
  const location  = useLocation()
  const { track, isPlaying, toggle, coverColors } = usePlayer()
  const { isPlaying: bgPlaying, setPanelOpen: setBgPanelOpen } = useBgSounds()

  const [open, setOpen] = useState(false)
  const [trendingMode, setTrendingMode] = useState<'chart' | 'grid'>(() => {
    return (localStorage.getItem('trending-view-mode') as 'chart' | 'grid') ?? 'chart'
  })
  const [trendingRefreshing, setTrendingRefreshing] = useState(false)

  useEffect(() => {
    const handleModeChange = (e: Event) => {
      const customEvent = e as CustomEvent
      setTrendingMode(customEvent.detail)
    }
    const handleRefreshStatus = (e: Event) => {
      const customEvent = e as CustomEvent
      setTrendingRefreshing(customEvent.detail)
    }

    window.addEventListener('trending-mode-changed', handleModeChange)
    window.addEventListener('trending-refresh-status', handleRefreshStatus)

    return () => {
      window.removeEventListener('trending-mode-changed', handleModeChange)
      window.removeEventListener('trending-refresh-status', handleRefreshStatus)
    }
  }, [])

  const [trendingData, setTrendingData] = useState<{
    dates: string[]
    selectedDate: string
    tierCounts: Record<string, number>
  }>(() => {
    return {
      dates: [],
      selectedDate: '',
      tierCounts: { transformative: 0, significant: 0, incremental: 0, niche: 0 }
    }
  })

  useEffect(() => {
    const handleDataLoaded = (e: Event) => {
      const customEvent = e as CustomEvent
      setTrendingData(customEvent.detail)
    }
    window.addEventListener('trending-data-loaded', handleDataLoaded)
    return () => {
      window.removeEventListener('trending-data-loaded', handleDataLoaded)
    }
  }, [])

  const [dateWindowOffset, setDateWindowOffset] = useState(0)

  // Auto-page the outer date selector so the selected date is always visible
  useEffect(() => {
    if (!trendingData.selectedDate || trendingData.dates.length === 0) return
    const idx = trendingData.dates.indexOf(trendingData.selectedDate)
    if (idx !== -1) {
      if (idx < dateWindowOffset) {
        setDateWindowOffset(idx)
      } else if (idx >= dateWindowOffset + 5) {
        setDateWindowOffset(Math.max(0, idx - 4))
      }
    }
  }, [trendingData.selectedDate, trendingData.dates])

  const [calendarMode, setCalendarMode] = useState(false)
  const [pickerYear, setPickerYear] = useState(2026)
  const [isEditingYear, setIsEditingYear] = useState(false)
  const [pickerMonth, setPickerMonth] = useState(5)
  const [yearInputVal, setYearInputVal] = useState('2026')

  // Keep picker date state in sync with selectedDate
  useEffect(() => {
    if (trendingData.selectedDate) {
      const parts = trendingData.selectedDate.split('-')
      if (parts.length === 3) {
        setPickerYear(parseInt(parts[0]))
        setPickerMonth(parseInt(parts[1]))
        setYearInputVal(parts[0])
      }
    }
  }, [trendingData.selectedDate])

  const [playlistPickerMode, setPlaylistPickerMode] = useState(false)
  const [localLists, setLocalLists] = useState<Playlist[]>(() => getLocalPlaylists())
  const [permLists,  setPermLists]  = useState<Playlist[]>([])

  // Reset contextual modes when menu is closed; fetch fresh data when it opens
  useEffect(() => {
    if (!open) {
      setCalendarMode(false)
      setIsEditingYear(false)
      setPlaylistPickerMode(false)
    } else {
      setLocalLists(getLocalPlaylists())
      fetchPlaylists().then(setPermLists).catch(() => {})
    }
  }, [open])

  const [pos,  setPos ] = useState<{ x: number; y: number }>(() => {
    try {
      const s = localStorage.getItem('radial-nav-pos')
      if (s) return JSON.parse(s)
    } catch {}
    // 100px clearance was tuned for the old full-width player bar. The
    // mobile bottom stack is now two floating pills (media control ~64px +
    // the search island below it, ~64px + safe-area), so the old default
    // let the bubble's resting spot physically overlap the top of the
    // upper pill — and since the pill uses backdrop-filter (a real glass
    // blur, not just a dark tint), whatever sits behind it gets sampled
    // and blurred/darkened, which read as the bubble being "clipped." Not
    // touching the magnet-snap feature itself, only where it rests when
    // nothing has been dragged yet.
    return { x: window.innerWidth - BUBBLE_R - 20, y: window.innerHeight - BUBBLE_R - 190 }
  })

  const [snappedSelector, setSnappedSelector] = useState<string | null>(() => {
    try {
      return localStorage.getItem('radial-nav-snapped-selector')
    } catch {}
    return null
  })

  const dragStart = useRef<{ px: number; py: number; bx: number; by: number } | null>(null)
  const moved     = useRef(false)
  const bubbleRef = useRef<HTMLButtonElement>(null)

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

  // Find nearby magnet elements to snap to
  const getSnappedPos = (rawX: number, rawY: number) => {
    const selectors = ['.player-mini-play-btn', '.npo-play-btn']
    const SNAP_THRESHOLD = 50 // px

    const npo = document.querySelector('.npo')
    const isNpoOpen = npo && npo.classList.contains('npo--open')

    for (const selector of selectors) {
      if (selector === '.npo-play-btn' && !isNpoOpen) continue
      if (selector === '.player-mini-play-btn' && isNpoOpen) continue

      const magnet = document.querySelector(selector)
      if (!magnet) continue
      const rect = magnet.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue

      const mx = rect.left + rect.width / 2
      const my = rect.top + rect.height / 2

      const dist = Math.hypot(rawX - mx, rawY - my)
      if (dist < SNAP_THRESHOLD) {
        return { x: mx, y: my, snapped: true, selector }
      }
    }

    return { x: rawX, y: rawY, snapped: false, selector: null }
  }

  // Handle window resizing and ensure the bubble stays within viewport bounds
  useEffect(() => {
    const handleResize = () => {
      if (snappedSelector) return // Position is handled by tracking effect
      setPos(prev => ({
        x: clamp(prev.x, 0, window.innerWidth),
        y: clamp(prev.y, 0, window.innerHeight)
      }))
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [snappedSelector])

  // Actively track snapped element position to keep centered
  useEffect(() => {
    if (!snappedSelector) return

    const updateSnappedPos = () => {
      let activeSelector = snappedSelector

      // Auto-snap between mini play button and NPO play button depending on which one is active/visible
      const npo = document.querySelector('.npo')
      const isNpoOpen = npo && npo.classList.contains('npo--open')

      if (isNpoOpen) {
        activeSelector = '.npo-play-btn'
      } else {
        activeSelector = '.player-mini-play-btn'
      }

      if (activeSelector !== snappedSelector) {
        setSnappedSelector(activeSelector)
        localStorage.setItem('radial-nav-snapped-selector', activeSelector)
      }

      const magnet = document.querySelector(activeSelector)
      if (!magnet) return
      const rect = magnet.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const mx = rect.left + rect.width / 2
      const my = rect.top + rect.height / 2

      setPos({ x: mx, y: my })
    }

    updateSnappedPos()

    window.addEventListener('resize', updateSnappedPos)
    window.addEventListener('scroll', updateSnappedPos, { capture: true })

    let frameId: number
    const tick = () => {
      updateSnappedPos()
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('resize', updateSnappedPos)
      window.removeEventListener('scroll', updateSnappedPos, { capture: true })
      cancelAnimationFrame(frameId)
    }
  }, [snappedSelector])

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    bubbleRef.current?.setPointerCapture(e.pointerId)
    dragStart.current = { px: e.clientX, py: e.clientY, bx: pos.x, by: pos.y }
    moved.current = false
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return
    const dx = e.clientX - dragStart.current.px
    const dy = e.clientY - dragStart.current.py
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved.current = true
    if (!moved.current) return

    const rawX = dragStart.current.bx + dx
    const rawY = dragStart.current.by + dy

    const snapped = getSnappedPos(rawX, rawY)

    if (snapped.snapped && snapped.selector) {
      setSnappedSelector(snapped.selector)
    } else {
      setSnappedSelector(null)
    }

    setPos({
      x: clamp(snapped.x, 0, window.innerWidth),
      y: clamp(snapped.y, 0, window.innerHeight),
    })
  }

  const onPointerUp = () => {
    if (!dragStart.current) return
    dragStart.current = null
    if (!moved.current) {
      if (calendarMode) {
        setIsEditingYear(true)
      } else if (playlistPickerMode) {
        setPlaylistPickerMode(false)
      } else if (open) {
        if (track) toggle()
        else setOpen(false)
      } else {
        setOpen(true)
      }
    } else {
      localStorage.setItem('radial-nav-pos', JSON.stringify(pos))
      if (snappedSelector) {
        localStorage.setItem('radial-nav-snapped-selector', snappedSelector)
      } else {
        localStorage.removeItem('radial-nav-snapped-selector')
      }
    }
  }

  const allLists: (Playlist & { is_local: boolean })[] = [
    ...localLists.map(l => ({ ...l, is_local: true  as const })),
    ...permLists.map( l => ({ ...l, is_local: false as const })),
  ]
  const isStarred = track
    ? allLists.some(l => l.name === 'Favorites' && l.track_ids.includes(track.id))
    : false

  const handleStarToggle = () => {
    if (!track) return
    const favList = allLists.find(l => l.name === 'Favorites')
    if (favList) {
      if (!favList.is_local) return // perm favorites require password — use FavoritePill instead
      const inFav = favList.track_ids.includes(track.id)
      const updated = localLists.map(l =>
        l.id !== favList.id ? l : {
          ...l,
          track_ids: inFav
            ? l.track_ids.filter(id => id !== track.id)
            : [...l.track_ids, track.id],
        }
      )
      setLocalLists(updated)
      saveLocalPlaylists(updated)
    } else {
      const newList: Playlist = { id: 'local_favs_' + Date.now(), name: 'Favorites', track_ids: [track.id] }
      const updated = [...localLists, newList]
      setLocalLists(updated)
      saveLocalPlaylists(updated)
    }
  }

  const handlePlaylistToggle = (list: Playlist & { is_local: boolean }) => {
    if (!track) return
    const inList = list.track_ids.includes(track.id)
    if (list.is_local) {
      const updated = localLists.map(l =>
        l.id !== list.id ? l : {
          ...l,
          track_ids: inList
            ? l.track_ids.filter(id => id !== track.id)
            : [...l.track_ids, track.id],
        }
      )
      setLocalLists(updated)
      saveLocalPlaylists(updated)
    } else {
      const pw = sessionStorage.getItem('cozyroom_owner_password') || ''
      const optimistic = () =>
        setPermLists(prev => prev.map(l =>
          l.id !== list.id ? l : {
            ...l,
            track_ids: inList
              ? l.track_ids.filter(id => id !== track.id)
              : [...l.track_ids, track.id],
          }
        ))
      if (inList) {
        removeTrackFromPlaylist(list.id, track.id, pw).then(optimistic).catch(() => {})
      } else {
        addTrackToPlaylist(list.id, track.id, pw).then(optimistic).catch(() => {})
      }
    }
  }

  const innerItems: RadialItem[] = [
    { route: '/',          label: t('nav.artists'),                     icon: <IcHome /> },
    { route: '/ai',        label: 'AI',                                 icon: <IcAI /> },
    { route: '/playlists', label: t('nav.playlists', { defaultValue: 'Playlist' }), icon: <IcPlaylist /> },
    { route: 'bg-sounds',  label: 'Sounds', icon: <IcSounds />, onAction: () => { setBgPanelOpen(true); setOpen(false) } },
    ...(track ? [
      { route: 'star-track',   label: isStarred ? t('nav.unstar', { defaultValue: 'Bỏ sao' }) : t('nav.star', { defaultValue: 'Yêu thích' }), icon: isStarred ? <IcStar /> : <IcStarBorder />, onAction: handleStarToggle },
      { route: 'playlist-add', label: t('nav.add_to_playlist', { defaultValue: 'Thêm vào' }), icon: <IcPlaylistAdd />, onAction: () => setPlaylistPickerMode(true) },
    ] as RadialItem[] : []),
  ]

  const outerItems: RadialItem[] = [
    { route: '/videos',    label: t('nav.films'),                       icon: <IcVideo /> },
    { route: '/ebooks',    label: t('nav.ebooks', { defaultValue: 'Sách' }), icon: <IcBook /> },
    { route: '/comics',    label: t('nav.comics'),                      icon: <IcComics /> },
    { route: '/trending',  label: t('nav.trending'),                    icon: <IcTrend /> },
    { route: '/search',    label: t('nav.search'),                      icon: <IcSearch /> },
  ]

  const isTrending = location.pathname.startsWith('/trending')
  const auraSize = isTrending ? 560 : 300
  const auraOffset = auraSize / 2

  const trendingItems = [
    { route: 'chart', label: t('trending.chart_mode'), icon: <IcChart /> },
    { route: 'grid',  label: t('trending.grid_mode'),  icon: <IcGrid /> },
    { route: 'refresh', label: t('trending.refresh'),  icon: <IcRefresh /> },
  ]

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return ''
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`
    }
    return dateStr
  }

  const layer4Items = [
    { route: 'tier-transformative', label: t('trending.tiers.transformative'), icon: `🔥 ${trendingData.tierCounts.transformative ?? 0}`, tier: 'transformative', disabled: (trendingData.tierCounts.transformative ?? 0) === 0 },
    { route: 'tier-significant',    label: t('trending.tiers.significant'),    icon: `⚡ ${trendingData.tierCounts.significant ?? 0}`,    tier: 'significant',    disabled: (trendingData.tierCounts.significant ?? 0) === 0 },
    { route: 'tier-incremental',    label: t('trending.tiers.incremental'),    icon: `📈 ${trendingData.tierCounts.incremental ?? 0}`,    tier: 'incremental',    disabled: (trendingData.tierCounts.incremental ?? 0) === 0 },
    { route: 'tier-niche',          label: t('trending.tiers.niche'),          icon: `🔬 ${trendingData.tierCounts.niche ?? 0}`,          tier: 'niche',          disabled: (trendingData.tierCounts.niche ?? 0) === 0 },
  ]

  const maxOffset = Math.max(0, trendingData.dates.length - 5)
  const currentOffset = Math.min(dateWindowOffset, maxOffset)
  const visibleDates = trendingData.dates.slice(currentOffset, currentOffset + 5)

  const layer5Items = [
    {
      route: 'prev-date-window',
      label: t('trending.year', { defaultValue: 'Chọn Năm' }),
      icon: `${pickerYear}`,
      disabled: false,
      onClick: () => {
        setCalendarMode(true)
      },
      onDoubleClick: () => {
        setCalendarMode(true)
        setIsEditingYear(true)
      }
    },
    ...visibleDates.map((d) => {
      const isActive = d === trendingData.selectedDate
      return {
        route: `date-${d}`,
        label: isActive ? t('trending.active', { defaultValue: 'Đang chọn' }) : '',
        icon: formatShortDate(d),
        disabled: false,
        isActive: isActive,
        onClick: () => {
          if (isActive) {
            setCalendarMode(true)
          } else {
            window.dispatchEvent(new CustomEvent('trending-set-date', { detail: d }))
          }
        },
        onDoubleClick: () => {
          setCalendarMode(true)
          setIsEditingYear(true)
        }
      }
    }),
    {
      route: 'next-date-window',
      label: t('trending.calendar', { defaultValue: 'Chọn Lịch' }),
      icon: '📅',
      disabled: false,
      onClick: () => {
        setCalendarMode(true)
      }
    },
  ]

  const selParts = trendingData.selectedDate.split('-')
  const selYear = selParts.length === 3 ? parseInt(selParts[0]) : 2026
  const selMonth = selParts.length === 3 ? parseInt(selParts[1]) : 5
  const selDay = selParts.length === 3 ? parseInt(selParts[2]) : 25

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate()
  }

  const totalDays = getDaysInMonth(pickerYear, pickerMonth)

  const isEn = i18n.language?.startsWith('en')
  const monthLabels = isEn
    ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    : ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12']

  const monthRingA = Array.from({ length: 5 }, (_, i) => {
    const m = i + 1
    return {
      route: `month-${m}`,
      label: '',
      icon: monthLabels[m - 1],
      isActive: m === pickerMonth,
      onClick: () => setPickerMonth(m)
    }
  })

  const monthRingB = Array.from({ length: 7 }, (_, i) => {
    const m = i + 6
    return {
      route: `month-${m}`,
      label: '',
      icon: monthLabels[m - 1],
      isActive: m === pickerMonth,
      onClick: () => setPickerMonth(m)
    }
  })

  const daysRingA = Array.from({ length: 10 }, (_, i) => {
    const d = i + 1
    return {
      route: `day-${d}`,
      label: '',
      icon: `${d}`,
      isActive: d === selDay && pickerMonth === selMonth && pickerYear === selYear,
      onClick: () => {
        const formattedMonth = String(pickerMonth).padStart(2, '0')
        const formattedDay = String(d).padStart(2, '0')
        const targetDate = `${pickerYear}-${formattedMonth}-${formattedDay}`
        window.dispatchEvent(new CustomEvent('trending-set-date', { detail: targetDate }))
        setCalendarMode(false)
      }
    }
  })

  const daysRingB = Array.from({ length: 10 }, (_, i) => {
    const d = i + 11
    return {
      route: `day-${d}`,
      label: '',
      icon: `${d}`,
      isActive: d === selDay && pickerMonth === selMonth && pickerYear === selYear,
      onClick: () => {
        const formattedMonth = String(pickerMonth).padStart(2, '0')
        const formattedDay = String(d).padStart(2, '0')
        const targetDate = `${pickerYear}-${formattedMonth}-${formattedDay}`
        window.dispatchEvent(new CustomEvent('trending-set-date', { detail: targetDate }))
        setCalendarMode(false)
      }
    }
  })

  const daysCountC = totalDays - 20
  const daysRingC = Array.from({ length: Math.max(0, daysCountC) }, (_, i) => {
    const d = i + 21
    return {
      route: `day-${d}`,
      label: '',
      icon: `${d}`,
      isActive: d === selDay && pickerMonth === selMonth && pickerYear === selYear,
      onClick: () => {
        const formattedMonth = String(pickerMonth).padStart(2, '0')
        const formattedDay = String(d).padStart(2, '0')
        const targetDate = `${pickerYear}-${formattedMonth}-${formattedDay}`
        window.dispatchEvent(new CustomEvent('trending-set-date', { detail: targetDate }))
        setCalendarMode(false)
      }
    }
  })

  const calendarLayer5Items = [
    { route: 'cal-back', label: t('trending.back', { defaultValue: 'Quay lại' }), icon: '↩', disabled: false, onClick: () => setCalendarMode(false) },
    { route: 'cal-status', label: '', icon: `${String(pickerMonth).padStart(2, '0')}/${pickerYear}`, disabled: true, onClick: undefined }
  ]

  const playlistPickerItems: (Playlist & { is_local: boolean; isBack?: boolean })[] = [
    { id: '__back__', name: '↩ Quay lại', track_ids: [], is_local: true, isBack: true },
    ...allLists,
  ]

  const isDragging = dragStart.current !== null

  // Expand right at its spot! Allow maximum corner-tucking.
  const activeX = pos.x
  const activeY = pos.y

  // ── Square grid layout ──────────────────────────────────────────────────
  // Replaces the old arc-math (calcArc/getSectorPath) sector layout: menu
  // items are laid out as a plain CSS grid of rounded squares, anchored to
  // whichever side of the bubble has the most room so the grid grows into
  // the viewport instead of off the edge of it.
  const GRID_CELL = 56
  const GRID_GAP = 8
  const GRID_MARGIN = 12

  const growRight = activeX < window.innerWidth / 2
  const growDown  = activeY < window.innerHeight / 2

  const availW = growRight
    ? window.innerWidth  - activeX - BUBBLE_R - GRID_GAP - GRID_MARGIN
    : activeX - BUBBLE_R - GRID_GAP - GRID_MARGIN
  const availH = growDown
    ? window.innerHeight - activeY - BUBBLE_R - GRID_GAP - GRID_MARGIN
    : activeY - BUBBLE_R - GRID_GAP - GRID_MARGIN

  // Cap at 4 columns / 5 visible rows for a compact, thumb-reachable grid;
  // anything beyond that (e.g. the calendar's day cells) scrolls inside the
  // panel rather than shrinking cells below the 56px touch target.
  // `width` (not just `maxWidth`) is required here: CSS Grid's
  // `repeat(auto-fill, 56px)` needs a definite container width to know how
  // many columns fit — inside a shrink-to-fit (auto-width) absolutely
  // positioned box it collapses to a single column instead of wrapping.
  const panelWidth     = Math.max(GRID_CELL, Math.min(availW, GRID_CELL * 4 + GRID_GAP * 3))
  const panelMaxHeight = Math.max(GRID_CELL, Math.min(availH, GRID_CELL * 5 + GRID_GAP * 4))

  const mainCells: MenuCell[] = [
    ...innerItems.map((item): MenuCell => ({
      key: item.route,
      icon: item.icon,
      label: item.label,
      active: item.route === 'star-track'
        ? isStarred
        : location.pathname === item.route || (item.route !== '/' && location.pathname.startsWith(item.route)),
      onClick: () => { if (item.onAction) item.onAction(); else navigate(item.route) },
    })),
    ...outerItems.map((item): MenuCell => ({
      key: item.route,
      icon: item.icon,
      label: item.label,
      active: location.pathname === item.route || (item.route !== '/' && location.pathname.startsWith(item.route)),
      onClick: () => navigate(item.route),
    })),
  ]

  const trendingCells: MenuCell[] = isTrending ? [
    ...trendingItems.map((item): MenuCell => ({
      key: item.route,
      icon: item.icon,
      label: item.label,
      active: item.route === 'chart' ? trendingMode === 'chart' : item.route === 'grid' ? trendingMode === 'grid' : false,
      spinning: item.route === 'refresh' && trendingRefreshing,
      onClick: () => {
        if (item.route === 'refresh') window.dispatchEvent(new CustomEvent('trending-refresh-trigger'))
        else window.dispatchEvent(new CustomEvent('trending-set-mode', { detail: item.route }))
      },
    })),
    ...layer4Items.map((item): MenuCell => {
      const tierColor = item.tier === 'transformative' ? '#ea580c' :
                         item.tier === 'significant'    ? '#eab308' :
                         item.tier === 'incremental'    ? '#2563eb' : '#7c3aed'
      return {
        key: item.route,
        icon: item.icon,
        label: item.label,
        disabled: item.disabled,
        dotColor: tierColor,
        onClick: () => { if (!item.disabled) window.dispatchEvent(new CustomEvent('trending-click-chip', { detail: item.tier })) },
      }
    }),
    ...layer5Items.map((item): MenuCell => {
      const isActive = 'isActive' in item ? !!item.isActive : false
      return {
        key: item.route,
        icon: item.icon,
        label: item.label,
        active: isActive,
        disabled: !!item.disabled,
        dotColor: item.route.startsWith('date-') ? (isActive ? 'var(--purple)' : 'rgba(255,255,255,0.3)') : undefined,
        onClick: () => { if (!item.disabled && 'onClick' in item && typeof item.onClick === 'function') item.onClick() },
        onDoubleClick: () => { if ('onDoubleClick' in item && typeof item.onDoubleClick === 'function') item.onDoubleClick() },
      }
    }),
  ] : []

  const calendarCells: MenuCell[] = [
    ...monthRingA.map((item): MenuCell => ({ key: item.route, icon: item.icon, active: item.isActive, onClick: item.onClick })),
    ...monthRingB.map((item): MenuCell => ({ key: item.route, icon: item.icon, active: item.isActive, onClick: item.onClick })),
    ...daysRingA.map((item): MenuCell => ({ key: item.route, icon: item.icon, active: item.isActive, onClick: item.onClick })),
    ...daysRingB.map((item): MenuCell => ({ key: item.route, icon: item.icon, active: item.isActive, onClick: item.onClick })),
    ...daysRingC.map((item): MenuCell => ({ key: item.route, icon: item.icon, active: item.isActive, onClick: item.onClick })),
    ...calendarLayer5Items.map((item): MenuCell => ({ key: item.route, icon: item.icon, label: item.label, disabled: item.disabled, onClick: item.onClick })),
  ]

  const playlistCells: MenuCell[] = playlistPickerItems.map((item): MenuCell => {
    const inList = !item.isBack && track ? item.track_ids.includes(track.id) : false
    return {
      key: item.id,
      icon: item.isBack ? '↩' : inList ? '✓' : '+',
      label: item.name,
      active: inList,
      dotColor: item.isBack ? undefined : (inList ? 'var(--purple)' : 'rgba(255,255,255,0.3)'),
      onClick: () => {
        if (item.isBack) setPlaylistPickerMode(false)
        else if (track) handlePlaylistToggle(item)
      },
    }
  })

  const activeCells: MenuCell[] = calendarMode
    ? calendarCells
    : playlistPickerMode
    ? playlistCells
    : [...mainCells, ...trendingCells]

  const color1 = coverColors && coverColors[0] ? coverColors[0] : '#ffffff'
  const color2 = coverColors && coverColors[1] ? coverColors[1] : '#aaaaaa'

  return (
    <>
      {/* Click-outside overlay */}
      {open && <div className="radial-overlay" onClick={() => setOpen(false)} />}

      {/* Fluid dynamic positioning wrapper */}
      <div
        style={{
          position: 'fixed',
          left: activeX,
          top: activeY,
          width: 0,
          height: 0,
          zIndex: 99999,
          pointerEvents: 'none',
          transition: (isDragging || snappedSelector)
            ? 'none'
            : 'left 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), top 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
        }}
      >
        {/* Aura Blur Glow (Liquidglass effect) */}
        <div
          className={`radial-menu-aura${open ? ' radial-menu-aura--open' : ''}`}
          style={{
            position: 'absolute',
            left: -auraOffset,
            top:  -auraOffset,
            width: auraSize,
            height: auraSize,
            background: `radial-gradient(circle at 35% 35%, ${track ? color1 : '#ffffff'}40 0%, ${track ? color2 : '#aaaaaa'}14 45%, transparent 70%),
                         radial-gradient(circle at 65% 65%, ${track ? color1 : '#ffffff'}20 0%, ${track ? color2 : '#aaaaaa'}08 50%, transparent 80%)`
          }}
        />

        {/* Menu items — symmetric rounded-square grid, anchored to whichever
            side of the bubble has room so it never overflows the viewport. */}
        <div
          className={`radial-menu-panel${open ? ' radial-menu-panel--open' : ''}`}
          style={{
            position: 'absolute',
            ...(growRight ? { left: BUBBLE_R + GRID_GAP } : { right: BUBBLE_R + GRID_GAP }),
            ...(growDown  ? { top:  BUBBLE_R + GRID_GAP } : { bottom: BUBBLE_R + GRID_GAP }),
            width: panelWidth,
            maxHeight: panelMaxHeight,
            pointerEvents: open ? 'auto' : 'none',
          }}
        >
          <div className="radial-menu-grid">
            {activeCells.map((cell, i) => (
              <button
                key={cell.key}
                type="button"
                className={`radial-menu-cell${cell.active ? ' radial-menu-cell--active' : ''}${cell.disabled ? ' radial-menu-cell--disabled' : ''}`}
                disabled={cell.disabled}
                onClick={cell.onClick}
                onDoubleClick={cell.onDoubleClick}
                style={{
                  transform: open ? 'scale(1)' : 'scale(0)',
                  opacity: open ? (cell.disabled ? 0.4 : 1) : 0,
                  transitionDelay: open ? `${i * 22}ms` : `${(activeCells.length - 1 - i) * 14}ms`,
                }}
              >
                {cell.dotColor && <span className="radial-menu-cell-dot" style={{ background: cell.dotColor }} />}
                <span className={`radial-menu-cell-icon${cell.spinning ? ' radial-menu-cell-icon--spin' : ''}`}>
                  {cell.icon}
                </span>
                {cell.label && <span className="radial-menu-cell-label">{cell.label}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Bubble */}
        <button
          ref={bubbleRef}
          className={`radial-bubble${isPlaying && track && !calendarMode ? ' radial-bubble--spinning' : ''}${open ? ' radial-bubble--open' : ''}${calendarMode ? ' radial-bubble--calendar' : ''}${track && !calendarMode ? ' radial-bubble--vinyl' : ''}${snappedSelector ? ' radial-bubble--snapped' : ''}`}
          aria-label={open ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
          style={{
            position: 'absolute',
            left: -BUBBLE_R,
            top:  -BUBBLE_R,
            pointerEvents: 'auto',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={() => {
            if (calendarMode) {
              setIsEditingYear(true)
            }
          }}
        >
          {calendarMode ? (
            <div className="radial-bubble-calendar-year">
              <span style={{ fontSize: '9px', opacity: 0.5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Năm</span>
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{pickerYear}</span>
            </div>
          ) : track && track.album_id ? (
            <img
              key={track.id}
              src={track.album_id.startsWith('yt:')
                ? `https://i.ytimg.com/vi/${track.album_id.slice(3)}/mqdefault.jpg`
                : `/api/covers/${track.album_id}?w=80`}
              alt={track.title}
              draggable={false}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          ) : track ? (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" style={{ opacity: 0.7 }}>
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
            </svg>
          ) : (
            <CozyroomMark size={24} />
          )}
        </button>

        {/* Year input editor */}
        {isEditingYear && (
          <div
            className="radial-year-editor"
            style={{
              position: 'absolute',
              left: -45,
              top:  -18,
              width: 90,
              height: 36,
              zIndex: 1001,
              pointerEvents: 'auto',
            }}
          >
            <input
              type="number"
              value={yearInputVal}
              onChange={(e) => setYearInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const y = parseInt(yearInputVal)
                  if (y > 1900 && y < 2100) {
                    setPickerYear(y)
                    setIsEditingYear(false)
                  }
                } else if (e.key === 'Escape') {
                  setIsEditingYear(false)
                }
              }}
              className="radial-year-input"
              autoFocus
              onBlur={() => {
                const y = parseInt(yearInputVal)
                if (y > 1900 && y < 2100) {
                  setPickerYear(y)
                }
                setIsEditingYear(false)
              }}
            />
          </div>
        )}
      </div>
    </>
  )
}
