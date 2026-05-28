import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlayer } from '../PlayerContext'

const BUBBLE_R = 28   // half of 56px bubble
const PETAL_R  = 22   // half of 44px petal
const PETAL_D  = 82   // px from bubble centre to petal centre

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

const IcAI       = () => I('M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2m0 8a5 5 0 0 0-5 5v3h10v-3a5 5 0 0 0-5-5m-2 6a1 1 0 0 1-1-1 1 1 0 0 1 1-1 1 1 0 0 1 1 1 1 1 0 0 1-1 1m4 0a1 1 0 0 1-1-1 1 1 0 0 1 1-1 1 1 0 0 1 1 1 1 1 0 0 1-1 1z')
const IcChart    = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/></svg>
const IcGrid     = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M4 4h7v7H4zm10 0h7v7h-7zM4 14h7v7H4zm10 0h7v7h-7z"/></svg>
const IcRefresh  = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>


// ── Arc math ─────────────────────────────────────────────────────────────────
function calcArc(bx: number, by: number) {
  const xR = bx / window.innerWidth
  const yR = by / window.innerHeight
  const L = xR < 0.30, R = xR > 0.70
  const T = yR < 0.30, B = yR > 0.70
  if (T && L) return { start:   0, span:  90 }
  if (T && R) return { start:  90, span:  90 }
  if (B && R) return { start: 180, span:  90 }
  if (B && L) return { start: 270, span:  90 }
  if (T)      return { start:   0, span: 180 }
  if (B)      return { start: 180, span: 180 }
  if (L)      return { start: 270, span: 180 }
  if (R)      return { start:  90, span: 180 }
  return { start: 315, span: 270 }
}

// ── Sector Path Math (Nightingale Chart) ──────────────────────────────────────
function getSectorPath(cx: number, cy: number, rInner: number, rOuter: number, startDeg: number, endDeg: number) {
  const startRad = (startDeg * Math.PI) / 180
  const endRad = (endDeg * Math.PI) / 180

  const x1_out = cx + rOuter * Math.cos(startRad)
  const y1_out = cy + rOuter * Math.sin(startRad)
  const x2_out = cx + rOuter * Math.cos(endRad)
  const y2_out = cy + rOuter * Math.sin(endRad)

  const x1_in = cx + rInner * Math.cos(startRad)
  const y1_in = cy + rInner * Math.sin(startRad)
  const x2_in = cx + rInner * Math.cos(endRad)
  const y2_in = cy + rInner * Math.sin(endRad)

  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0

  return `M ${x1_out} ${y1_out} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2_out} ${y2_out} L ${x2_in} ${y2_in} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x1_in} ${y1_in} Z`
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RadialNav() {
  const { t, i18n } = useTranslation()
  const navigate  = useNavigate()
  const location  = useLocation()
  const { track, isPlaying, toggle, coverColors } = usePlayer()

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

  // Reset calendar mode when menu is closed
  useEffect(() => {
    if (!open) {
      setCalendarMode(false)
      setIsEditingYear(false)
    }
  }, [open])

  const [pos,  setPos ] = useState<{ x: number; y: number }>(() => {
    try {
      const s = localStorage.getItem('radial-nav-pos')
      if (s) return JSON.parse(s)
    } catch {}
    return { x: window.innerWidth - BUBBLE_R - 20, y: window.innerHeight - BUBBLE_R - 100 }
  })

  const dragStart = useRef<{ px: number; py: number; bx: number; by: number } | null>(null)
  const moved     = useRef(false)
  const bubbleRef = useRef<HTMLButtonElement>(null)

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

  // Handle window resizing and ensure the bubble stays within viewport bounds (Chrome/Edge offscreen bugfix)
  useEffect(() => {
    const handleResize = () => {
      setPos(prev => ({
        x: clamp(prev.x, 0, window.innerWidth),
        y: clamp(prev.y, 0, window.innerHeight)
      }))
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
    setPos({
      x: clamp(dragStart.current.bx + dx, 0, window.innerWidth),
      y: clamp(dragStart.current.by + dy, 0, window.innerHeight),
    })
  }

  const onPointerUp = () => {
    if (!dragStart.current) return
    dragStart.current = null
    if (!moved.current) {
      if (calendarMode) {
        // Tap bubble while in calendar mode → edit year directly (mobile friendly!)
        setIsEditingYear(true)
      } else if (open) {
        // Tap disc while open → play/pause
        if (track) toggle()
        else setOpen(false)
      } else {
        setOpen(true)
      }
    } else {
      localStorage.setItem('radial-nav-pos', JSON.stringify(pos))
    }
  }

  const innerItems = [
    { route: '/',          label: t('nav.artists'),                     icon: <IcHome />,     r: 86 },
    { route: '/search',    label: t('nav.search'),                      icon: <IcSearch />,   r: 80 },
    { route: '/playlists', label: t('nav.playlists', { defaultValue: 'Playlist' }), icon: <IcPlaylist />, r: 92 },
  ]

  const outerItems = [
    { route: '/videos',    label: t('nav.films'),                       icon: <IcVideo />,    r: 146 },
    { route: '/ebooks',    label: t('nav.ebooks', { defaultValue: 'Sách' }), icon: <IcBook />,  r: 136 },
    { route: '/comics',    label: t('nav.comics'),                      icon: <IcComics />,   r: 142 },
    { route: '/trending',  label: t('nav.trending'),                    icon: <IcTrend />,    r: 132 },
    { route: '/ai',        label: t('nav.ai'),                          icon: <IcAI />,       r: 140 },
  ]

  const isTrending = location.pathname.startsWith('/trending')
  const CX = 260
  const CY = 260
  const auraSize = isTrending ? 560 : 300
  const auraOffset = auraSize / 2

  const trendingItems = [
    { route: 'chart', label: t('trending.chart_mode'), icon: <IcChart />, r: 180 },
    { route: 'grid',  label: t('trending.grid_mode'),  icon: <IcGrid />,  r: 172 },
    { route: 'refresh', label: t('trending.refresh'),  icon: <IcRefresh />, r: 185 },
  ]

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return ''
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`
    }
    return dateStr
  }

  const IcPrevDate = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
  const IcNextDate = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>

  const layer4Items = [
    { route: 'tier-transformative', label: t('trending.tiers.transformative'), icon: `🔥 ${trendingData.tierCounts.transformative ?? 0}`, r: 215, tier: 'transformative', disabled: (trendingData.tierCounts.transformative ?? 0) === 0 },
    { route: 'tier-significant',    label: t('trending.tiers.significant'),    icon: `⚡ ${trendingData.tierCounts.significant ?? 0}`,    r: 210, tier: 'significant',    disabled: (trendingData.tierCounts.significant ?? 0) === 0 },
    { route: 'tier-incremental',    label: t('trending.tiers.incremental'),    icon: `📈 ${trendingData.tierCounts.incremental ?? 0}`,    r: 218, tier: 'incremental',    disabled: (trendingData.tierCounts.incremental ?? 0) === 0 },
    { route: 'tier-niche',          label: t('trending.tiers.niche'),          icon: `🔬 ${trendingData.tierCounts.niche ?? 0}`,          r: 208, tier: 'niche',          disabled: (trendingData.tierCounts.niche ?? 0) === 0 },
  ]

  const maxOffset = Math.max(0, trendingData.dates.length - 5)
  const currentOffset = Math.min(dateWindowOffset, maxOffset)
  const visibleDates = trendingData.dates.slice(currentOffset, currentOffset + 5)

  const layer5Items = [
    {
      route: 'prev-date-window',
      label: t('trending.year', { defaultValue: 'Chọn Năm' }),
      icon: `${pickerYear}`,
      r: 242,
      disabled: false,
      onClick: () => {
        setCalendarMode(true)
      },
      onDoubleClick: () => {
        setCalendarMode(true)
        setIsEditingYear(true)
      }
    },
    ...visibleDates.map((d, idx) => {
      const isActive = d === trendingData.selectedDate
      return {
        route: `date-${d}`,
        label: isActive ? t('trending.active', { defaultValue: 'Đang chọn' }) : '',
        icon: formatShortDate(d),
        r: 238 + (idx % 2) * 6,
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
      r: 242,
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
      r: 62 + (i % 2) * 6,
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
      r: 98 + (i % 2) * 6,
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
      r: 144 + (i % 2) * 6,
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
      r: 186 + (i % 2) * 6,
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
      r: 222 + (i % 2) * 6,
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
    { route: 'cal-back', label: t('trending.back', { defaultValue: 'Quay lại' }), icon: '↩', r: 246, disabled: false, onClick: () => setCalendarMode(false) },
    { route: 'cal-status', label: '', icon: `${String(pickerMonth).padStart(2, '0')}/${pickerYear}`, r: 242, disabled: true, onClick: undefined }
  ]

  const MENU_R = 260
  const isDragging = dragStart.current !== null

  // Expand right at its spot! Allow maximum corner-tucking.
  const activeX = pos.x
  const activeY = pos.y

  // Dynamically scale down the menu on small viewports so it never overflows the screen boundaries
  const scale = open ? Math.min(1, (window.innerWidth - 24) / 520) : 1

  const { start, span } = calcArc(activeX, activeY)
  const n1 = innerItems.length
  const n2 = outerItems.length
  const n3 = trendingItems.length
  const n4 = layer4Items.length
  const n5 = layer5Items.length

  const color1 = coverColors && coverColors[0] ? coverColors[0] : '#a855f7'
  const color2 = coverColors && coverColors[1] ? coverColors[1] : '#1DB954'

  return (
    <>
      {/* Click-outside overlay */}
      {open && <div className="radial-overlay" onClick={() => setOpen(false)} />}

      {/* Fluid dynamic positioning and scaling wrapper */}
      <div
        style={{
          position: 'fixed',
          left: activeX,
          top: activeY,
          width: 0,
          height: 0,
          zIndex: 998,
          pointerEvents: 'none',
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
          transition: isDragging
            ? 'none'
            : 'left 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), top 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
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
            background: `radial-gradient(circle at 35% 35%, ${track ? color1 : '#a855f7'}55 0%, ${track ? color2 : '#1DB954'}18 45%, transparent 70%),
                         radial-gradient(circle at 65% 65%, ${track ? color1 : '#a855f7'}25 0%, ${track ? color2 : '#1DB954'}08 50%, transparent 80%)`
          }}
        />

        {/* Petals as a concentric Nightingale Rose chart inside an SVG */}
        <svg
          className={`radial-petals-svg${open ? ' radial-petals-svg--open' : ''}`}
          style={{
            position: 'absolute',
            left: -260,
            top:  -260,
            pointerEvents: open ? 'auto' : 'none',
          }}
        >
        {calendarMode ? (
          <>
            {/* Calendar Ring 1: Months 1 to 5 (Inner Months) */}
            {monthRingA.map((item, i) => {
              const sectorSpan = span / 5
              const startDeg = start + i * sectorSpan + 1.5
              const endDeg = start + (i + 1) * sectorSpan - 1.5
              const midDeg = start + (i + 0.5) * sectorSpan
              const midRad = (midDeg * Math.PI) / 180

              const rInner = 34
              const rMid = (rInner + item.r) / 2
              const mx = CX + rMid * Math.cos(midRad)
              const my = CY + rMid * Math.sin(midRad)

              return (
                <g
                  key={item.route}
                  className={`radial-petal-group${item.isActive ? ' radial-petal-group--active' : ''}`}
                  onClick={item.onClick}
                  style={{
                    transform: open ? 'scale(1)' : 'scale(0)',
                    opacity: open ? 1 : 0,
                    transitionDelay: open ? `${i * 15}ms` : `${(5 - 1 - i) * 10}ms`,
                  }}
                >
                  <path
                    className="radial-sector"
                    d={getSectorPath(CX, CY, rInner, item.r, startDeg, endDeg)}
                  />
                  <foreignObject
                    x={mx - 25}
                    y={my - 20}
                    width={50}
                    height={40}
                    className="radial-petal-fo"
                  >
                    <div className="radial-petal-content">
                      <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: item.isActive ? 'bold' : 'normal' }}>
                        {item.icon}
                      </span>
                    </div>
                  </foreignObject>
                </g>
              )
            })}

            {/* Calendar Ring 2: Months 6 to 12 (Outer Months) */}
            {monthRingB.map((item, i) => {
              const sectorSpan = span / 7
              const startDeg = start + i * sectorSpan + 1.5
              const endDeg = start + (i + 1) * sectorSpan - 1.5
              const midDeg = start + (i + 0.5) * sectorSpan
              const midRad = (midDeg * Math.PI) / 180

              const rInner = 74
              const rMid = (rInner + item.r) / 2
              const mx = CX + rMid * Math.cos(midRad)
              const my = CY + rMid * Math.sin(midRad)

              return (
                <g
                  key={item.route}
                  className={`radial-petal-group${item.isActive ? ' radial-petal-group--active' : ''}`}
                  onClick={item.onClick}
                  style={{
                    transform: open ? 'scale(1)' : 'scale(0)',
                    opacity: open ? 1 : 0,
                    transitionDelay: open ? `${(5 + i) * 15}ms` : `${(7 - 1 - i) * 10}ms`,
                  }}
                >
                  <path
                    className="radial-sector"
                    d={getSectorPath(CX, CY, rInner, item.r, startDeg, endDeg)}
                  />
                  <foreignObject
                    x={mx - 25}
                    y={my - 20}
                    width={50}
                    height={40}
                    className="radial-petal-fo"
                  >
                    <div className="radial-petal-content">
                      <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: item.isActive ? 'bold' : 'normal' }}>
                        {item.icon}
                      </span>
                    </div>
                  </foreignObject>
                </g>
              )
            })}

            {/* Calendar Ring 3: Days 1 to 10 */}
            {daysRingA.map((item, i) => {
              const sectorSpan = span / 10
              const startDeg = start + i * sectorSpan + 1.5
              const endDeg = start + (i + 1) * sectorSpan - 1.5
              const midDeg = start + (i + 0.5) * sectorSpan
              const midRad = (midDeg * Math.PI) / 180

              const rInner = 110
              const rMid = (rInner + item.r) / 2
              const mx = CX + rMid * Math.cos(midRad)
              const my = CY + rMid * Math.sin(midRad)

              return (
                <g
                  key={item.route}
                  className={`radial-petal-group radial-petal-group--optional${item.isActive ? ' radial-petal-group--active' : ''}`}
                  onClick={item.onClick}
                  style={{
                    transform: open ? 'scale(1)' : 'scale(0)',
                    opacity: open ? 1 : 0,
                    transitionDelay: open ? `${(12 + i) * 15}ms` : `${(10 - 1 - i) * 10}ms`,
                  }}
                >
                  <path
                    className="radial-sector radial-sector--optional"
                    d={getSectorPath(CX, CY, rInner, item.r, startDeg, endDeg)}
                  />
                  <foreignObject
                    x={mx - 25}
                    y={my - 20}
                    width={50}
                    height={40}
                    className="radial-petal-fo"
                  >
                    <div className="radial-petal-content">
                      <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: item.isActive ? 'bold' : 'normal' }}>
                        {item.icon}
                      </span>
                    </div>
                  </foreignObject>
                </g>
              )
            })}

            {/* Calendar Ring 4: Days 11 to 20 */}
            {daysRingB.map((item, i) => {
              const sectorSpan = span / 10
              const startDeg = start + i * sectorSpan + 1.5
              const endDeg = start + (i + 1) * sectorSpan - 1.5
              const midDeg = start + (i + 0.5) * sectorSpan
              const midRad = (midDeg * Math.PI) / 180

              const rInner = 156
              const rMid = (rInner + item.r) / 2
              const mx = CX + rMid * Math.cos(midRad)
              const my = CY + rMid * Math.sin(midRad)

              return (
                <g
                  key={item.route}
                  className={`radial-petal-group radial-petal-group--optional${item.isActive ? ' radial-petal-group--active' : ''}`}
                  onClick={item.onClick}
                  style={{
                    transform: open ? 'scale(1)' : 'scale(0)',
                    opacity: open ? 1 : 0,
                    transitionDelay: open ? `${(22 + i) * 15}ms` : `${(10 - 1 - i) * 10}ms`,
                  }}
                >
                  <path
                    className="radial-sector radial-sector--optional"
                    d={getSectorPath(CX, CY, rInner, item.r, startDeg, endDeg)}
                  />
                  <foreignObject
                    x={mx - 25}
                    y={my - 20}
                    width={50}
                    height={40}
                    className="radial-petal-fo"
                  >
                    <div className="radial-petal-content">
                      <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: item.isActive ? 'bold' : 'normal' }}>
                        {item.icon}
                      </span>
                    </div>
                  </foreignObject>
                </g>
              )
            })}

            {/* Calendar Ring 5: Days 21 to 28-31 */}
            {daysRingC.map((item, i) => {
              const divisor = daysCountC > 0 ? daysCountC : 1
              const sectorSpan = span / divisor
              const startDeg = start + i * sectorSpan + 1.5
              const endDeg = start + (i + 1) * sectorSpan - 1.5
              const midDeg = start + (i + 0.5) * sectorSpan
              const midRad = (midDeg * Math.PI) / 180

              const rInner = 198
              const rMid = (rInner + item.r) / 2
              const mx = CX + rMid * Math.cos(midRad)
              const my = CY + rMid * Math.sin(midRad)

              return (
                <g
                  key={item.route}
                  className={`radial-petal-group radial-petal-group--optional${item.isActive ? ' radial-petal-group--active' : ''}`}
                  onClick={item.onClick}
                  style={{
                    transform: open ? 'scale(1)' : 'scale(0)',
                    opacity: open ? 1 : 0,
                    transitionDelay: open ? `${(32 + i) * 15}ms` : `${(daysCountC - 1 - i) * 10}ms`,
                  }}
                >
                  <path
                    className="radial-sector radial-sector--optional radial-sector--tier"
                    d={getSectorPath(CX, CY, rInner, item.r, startDeg, endDeg)}
                  />
                  <foreignObject
                    x={mx - 25}
                    y={my - 20}
                    width={50}
                    height={40}
                    className="radial-petal-fo"
                  >
                    <div className="radial-petal-content">
                      <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: item.isActive ? 'bold' : 'normal' }}>
                        {item.icon}
                      </span>
                    </div>
                  </foreignObject>
                </g>
              )
            })}

            {/* Calendar Ring 6: Controls & Status */}
            {calendarLayer5Items.map((item, i) => {
              const sectorSpan = span / 2
              const startDeg = start + i * sectorSpan + 1.5
              const endDeg = start + (i + 1) * sectorSpan - 1.5
              const midDeg = start + (i + 0.5) * sectorSpan
              const midRad = (midDeg * Math.PI) / 180

              const rInner = 234
              const rMid = (rInner + item.r) / 2
              const mx = CX + rMid * Math.cos(midRad)
              const my = CY + rMid * Math.sin(midRad)

              return (
                <g
                  key={item.route}
                  className={`radial-petal-group radial-petal-group--optional${item.disabled ? ' radial-petal-group--disabled' : ''}`}
                  onClick={item.onClick}
                  style={{
                    transform: open ? 'scale(1)' : 'scale(0)',
                    opacity: open ? (item.disabled ? 0.45 : 1) : 0,
                    transitionDelay: open ? `${(32 + daysCountC + i) * 15}ms` : `${(2 - 1 - i) * 10}ms`,
                  }}
                >
                  <path
                    className="radial-sector radial-sector--optional radial-sector--tier"
                    d={getSectorPath(CX, CY, rInner, item.r, startDeg, endDeg)}
                  />
                  <foreignObject
                    x={mx - 25}
                    y={my - 20}
                    width={50}
                    height={40}
                    className="radial-petal-fo"
                  >
                    <div className="radial-petal-content">
                      <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.icon}
                      </span>
                      <span className="radial-petal-label">{item.label}</span>
                    </div>
                  </foreignObject>
                </g>
              )
            })}
          </>
        ) : (
          <>
            {/* Layer 1: Inner Concentric Ring */}
            {innerItems.map((item, i) => {
              const sectorSpan = span / n1
              const startDeg = start + i * sectorSpan + 1.5
              const endDeg = start + (i + 1) * sectorSpan - 1.5
              const midDeg = start + (i + 0.5) * sectorSpan
              const midRad = (midDeg * Math.PI) / 180

              const rInner = 34
              const rMid = (rInner + item.r) / 2
              const mx = CX + rMid * Math.cos(midRad)
              const my = CY + rMid * Math.sin(midRad)

              const isActive =
                location.pathname === item.route ||
                (item.route !== '/' && location.pathname.startsWith(item.route))

              return (
                <g
                  key={item.route}
                  className={`radial-petal-group${isActive ? ' radial-petal-group--active' : ''}`}
                  onClick={() => {
                    navigate(item.route)
                  }}
                  style={{
                    transform: open ? 'scale(1)' : 'scale(0)',
                    opacity: open ? 1 : 0,
                    transitionDelay: open
                      ? `${i * 28}ms`
                      : `${(n1 + n2 - 1 - i) * 18}ms`,
                  }}
                >
                  <path
                    className="radial-sector"
                    d={getSectorPath(CX, CY, rInner, item.r, startDeg, endDeg)}
                  />
                  <foreignObject
                    x={mx - 25}
                    y={my - 20}
                    width={50}
                    height={40}
                    className="radial-petal-fo"
                  >
                    <div className="radial-petal-content">
                      {item.icon}
                      <span className="radial-petal-label">{item.label}</span>
                    </div>
                  </foreignObject>
                </g>
              )
            })}

            {/* Layer 2: Outer Concentric Ring */}
            {outerItems.map((item, j) => {
              const sectorSpan = span / n2
              const startDeg = start + j * sectorSpan + 1.5
              const endDeg = start + (j + 1) * sectorSpan - 1.5
              const midDeg = start + (j + 0.5) * sectorSpan
              const midRad = (midDeg * Math.PI) / 180

              const rInner = 98 // Leaves a concentric circular gap of 6px from inner items
              const rMid = (rInner + item.r) / 2
              const mx = CX + rMid * Math.cos(midRad)
              const my = CY + rMid * Math.sin(midRad)

              const isActive =
                location.pathname === item.route ||
                (item.route !== '/' && location.pathname.startsWith(item.route))

              return (
                <g
                  key={item.route}
                  className={`radial-petal-group${isActive ? ' radial-petal-group--active' : ''}`}
                  onClick={() => {
                    navigate(item.route)
                  }}
                  style={{
                    transform: open ? 'scale(1)' : 'scale(0)',
                    opacity: open ? 1 : 0,
                    transitionDelay: open
                      ? `${(n1 + j) * 28}ms`
                      : `${(n2 - 1 - j) * 18}ms`,
                  }}
                >
                  <path
                    className="radial-sector"
                    d={getSectorPath(CX, CY, rInner, item.r, startDeg, endDeg)}
                  />
                  <foreignObject
                    x={mx - 25}
                    y={my - 20}
                    width={50}
                    height={40}
                    className="radial-petal-fo"
                  >
                    <div className="radial-petal-content">
                      {item.icon}
                      <span className="radial-petal-label">{item.label}</span>
                    </div>
                  </foreignObject>
                </g>
              )
            })}

            {/* Layer 3: Contextual Outer Concentric Ring (Trending Only) */}
            {isTrending && trendingItems.map((item, k) => {
              const sectorSpan = span / n3
              const startDeg = start + k * sectorSpan + 1.5
              const endDeg = start + (k + 1) * sectorSpan - 1.5
              const midDeg = start + (k + 0.5) * sectorSpan
              const midRad = (midDeg * Math.PI) / 180

              const rInner = 152 // Leaves a concentric circular gap of 6px from Layer 2
              const rMid = (rInner + item.r) / 2
              const mx = CX + rMid * Math.cos(midRad)
              const my = CY + rMid * Math.sin(midRad)

              const isActive =
                item.route === 'chart' ? trendingMode === 'chart' :
                item.route === 'grid' ? trendingMode === 'grid' :
                false

              const handleLayer3Click = () => {
                if (item.route === 'refresh') {
                  window.dispatchEvent(new CustomEvent('trending-refresh-trigger'))
                } else {
                  window.dispatchEvent(new CustomEvent('trending-set-mode', { detail: item.route }))
                }
              }

              return (
                <g
                  key={item.route}
                  className={`radial-petal-group radial-petal-group--optional${isActive ? ' radial-petal-group--active' : ''}`}
                  onClick={handleLayer3Click}
                  style={{
                    transform: open ? 'scale(1)' : 'scale(0)',
                    opacity: open ? 1 : 0,
                    transitionDelay: open
                      ? `${(n1 + n2 + k) * 28}ms`
                      : `${(n3 - 1 - k) * 18}ms`,
                  }}
                >
                  <path
                    className="radial-sector radial-sector--optional"
                    d={getSectorPath(CX, CY, rInner, item.r, startDeg, endDeg)}
                  />
                  <foreignObject
                    x={mx - 25}
                    y={my - 20}
                    width={50}
                    height={40}
                    className="radial-petal-fo"
                  >
                    <div className={`radial-petal-content${item.route === 'refresh' && trendingRefreshing ? ' radial-petal-fo-spin' : ''}`}>
                      {item.icon}
                      <span className="radial-petal-label">{item.label}</span>
                    </div>
                  </foreignObject>
                </g>
              )
            })}

            {/* Layer 4: Concentric Ring 4 (Tiers - Trending Only) */}
            {isTrending && layer4Items.map((item, m) => {
              const sectorSpan = span / n4
              const startDeg = start + m * sectorSpan + 1.5
              const endDeg = start + (m + 1) * sectorSpan - 1.5
              const midDeg = start + (m + 0.5) * sectorSpan
              const midRad = (midDeg * Math.PI) / 180

              const rInner = 191 // Leaves a concentric circular gap of 6px from Layer 3
              const rMid = (rInner + item.r) / 2
              const mx = CX + rMid * Math.cos(midRad)
              const my = CY + rMid * Math.sin(midRad)

              const handleLayer4Click = () => {
                if (item.disabled) return
                window.dispatchEvent(new CustomEvent('trending-click-chip', { detail: item.tier }))
              }

              const tierColor = item.tier === 'transformative' ? '#ea580c' :
                                item.tier === 'significant' ? '#eab308' :
                                item.tier === 'incremental' ? '#2563eb' : '#7c3aed'

              return (
                <g
                  key={item.route}
                  className={`radial-petal-group radial-petal-group--optional${item.disabled ? ' radial-petal-group--disabled' : ''}`}
                  onClick={handleLayer4Click}
                  style={{
                    transform: open ? 'scale(1)' : 'scale(0)',
                    opacity: open ? (item.disabled ? 0.35 : 1) : 0,
                    transitionDelay: open
                      ? `${(n1 + n2 + n3 + m) * 28}ms`
                      : `${(n4 - 1 - m) * 18}ms`,
                  }}
                >
                  <path
                    className="radial-sector radial-sector--optional radial-sector--tier"
                    d={getSectorPath(CX, CY, rInner, item.r, startDeg, endDeg)}
                    style={{
                      stroke: `${tierColor}33`,
                    }}
                  />
                  <foreignObject
                    x={mx - 25}
                    y={my - 20}
                    width={50}
                    height={40}
                    className="radial-petal-fo"
                  >
                    <div className="radial-petal-content">
                      <span className="radial-petal-fo-dot" style={{ background: tierColor }} />
                      <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.icon}
                      </span>
                      <span className="radial-petal-label">{item.label}</span>
                    </div>
                  </foreignObject>
                </g>
              )
            })}

            {/* Layer 5: Concentric Ring 5 (Dates selection - Trending Only) */}
            {isTrending && layer5Items.map((item, p) => {
              const sectorSpan = span / n5
              const startDeg = start + p * sectorSpan + 1.5
              const endDeg = start + (p + 1) * sectorSpan - 1.5
              const midDeg = start + (p + 0.5) * sectorSpan
              const midRad = (midDeg * Math.PI) / 180

              const rInner = 226 // Leaves a concentric circular gap of 6px from Layer 4
              const rMid = (rInner + item.r) / 2
              const mx = CX + rMid * Math.cos(midRad)
              const my = CY + rMid * Math.sin(midRad)

              const handleLayer5Click = () => {
                if (item.disabled) return
                if ('onClick' in item && typeof item.onClick === 'function') {
                  item.onClick()
                }
              }

              const handleLayer5DoubleClick = () => {
                if ('onDoubleClick' in item && typeof item.onDoubleClick === 'function') {
                  item.onDoubleClick()
                }
              }

              const isActive = 'isActive' in item ? item.isActive : false

              return (
                <g
                  key={item.route}
                  className={`radial-petal-group radial-petal-group--optional${isActive ? ' radial-petal-group--active' : ''}${item.disabled ? ' radial-petal-group--disabled' : ''}`}
                  onClick={handleLayer5Click}
                  onDoubleClick={handleLayer5DoubleClick}
                  style={{
                    transform: open ? 'scale(1)' : 'scale(0)',
                    opacity: open ? (item.disabled ? 0.35 : 1) : 0,
                    transitionDelay: open
                      ? `${(n1 + n2 + n3 + n4 + p) * 28}ms`
                      : `${(n5 - 1 - p) * 18}ms`,
                  }}
                >
                  <path
                    className="radial-sector radial-sector--optional radial-sector--tier"
                    d={getSectorPath(CX, CY, rInner, item.r, startDeg, endDeg)}
                    style={{
                      stroke: isActive ? 'rgba(168, 85, 247, 0.44)' : undefined,
                    }}
                  />
                  <foreignObject
                    x={mx - 25}
                    y={my - 20}
                    width={50}
                    height={40}
                    className="radial-petal-fo"
                  >
                    <div className="radial-petal-content">
                      {item.route.startsWith('date-') && (
                        <span className="radial-petal-fo-dot" style={{ background: isActive ? 'var(--purple)' : 'rgba(255, 255, 255, 0.3)' }} />
                      )}
                      <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: isActive ? 'bold' : 'normal' }}>
                        {item.icon}
                      </span>
                      <span className="radial-petal-label">{item.label}</span>
                    </div>
                  </foreignObject>
                </g>
              )
            })}
          </>
        )}
      </svg>

        {/* Bubble */}
        <button
          ref={bubbleRef}
          className={`radial-bubble${isPlaying && track && !calendarMode ? ' radial-bubble--spinning' : ''}${open ? ' radial-bubble--open' : ''}${calendarMode ? ' radial-bubble--calendar' : ''}${track && !calendarMode ? ' radial-bubble--vinyl' : ''}`}
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
            <img src={`/api/covers/${track.album_id}?w=80`} alt={track.title} draggable={false} />
          ) : (
            <img src="/favicon.png" alt="Cozyroom" draggable={false} />
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
