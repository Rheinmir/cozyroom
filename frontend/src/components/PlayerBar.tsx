import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlayer } from '../PlayerContext'
import { useBgSounds } from '../BgSoundsContext'
import BackgroundSoundsPanel from './BackgroundSoundsPanel'
import type { RepeatMode, ShuffleMode } from '../PlayerContext'
import { fetchArtistDetail, detectLyricsLanguage } from '../api'
import type { ArtistDetail } from '../api'
import Equalizer from './Equalizer'
import LyricsView from './LyricsView'
import type { LyricsViewHandle } from './LyricsView'
import FavoritePill from './FavoritePill'
import QueueList from './QueueList'

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

const IconPrev = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
    <polygon points="19,20 9,12 19,4"/><rect x="5" y="4" width="2" height="16"/>
  </svg>
)
const IconNext = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
    <polygon points="5,4 15,12 5,20"/><rect x="17" y="4" width="2" height="16"/>
  </svg>
)
const IconPlay = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
    <polygon points="5,3 19,12 5,21"/>
  </svg>
)
const IconPause = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
  </svg>
)

function RepeatIcon({ mode }: { mode: RepeatMode }) {
  const active = mode !== 'off'
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill={active ? 'var(--green)' : 'currentColor'} stroke={active ? 'var(--green)' : 'currentColor'} strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
      {mode === 'one'
        ? <><path d="M7 7H17V10L21 6L17 2V5H5V13H7V7Z"/><path d="M17 17H7V14L3 18L7 22V19H19V11H17V17Z"/><text x="10" y="14" fontSize="7" stroke="none" fill={active ? 'var(--green)' : 'currentColor'}>1</text></>
        : <><path d="M7 7H17V10L21 6L17 2V5H5V13H7V7Z"/><path d="M17 17H7V14L3 18L7 22V19H19V11H17V17Z"/></>
      }
    </svg>
  )
}

function ShuffleModeIcon({ mode }: { mode: ShuffleMode }) {
  if (mode === 'smart') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--purple, #ffffff)" stroke="var(--purple, #ffffff)" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
        <path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z"/>
        <circle cx="19" cy="4"  r="1.2"/>
        <circle cx="5"  cy="18" r="1.2"/>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill={mode === 'shuffle' ? 'var(--green)' : 'currentColor'} stroke={mode === 'shuffle' ? 'var(--green)' : 'currentColor'} strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
      <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
    </svg>
  )
}

export default function PlayerBar() {
  const { t } = useTranslation()
  const {
    track, isPlaying, progress, duration,
    repeat, shuffleMode, quality, analyser,
    toggle, seek, prev, next,
    setRepeat, setShuffleMode, setQuality, coverColors, setCoverColors,
    playbackError, setPlaybackError,
    queueOpen, setQueueOpen,
    npoOpen: open, setNpoOpen: setOpen,
  } = usePlayer()
  const { isPlaying: bgPlaying, panelOpen: bgPanelOpen, setPanelOpen: setBgPanelOpen } = useBgSounds()

  const [mobileTab,    setMobileTab]    = useState<'player' | 'lyrics'>('player')
  const [artistInfo,   setArtistInfo]   = useState<ArtistDetail | null>(null)
  const [trActive,     setTrActive]     = useState(false)
  const [autoTranslate, setAutoTranslate] = useState(() => localStorage.getItem('lyrics-auto-translate') !== '0')
  const [ctrlsVisible, setCtrlsVisible] = useState(false)
  const ctrlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lyricsRef     = useRef<LyricsViewHandle>(null)

  useEffect(() => {
    if (!track?.artist_id) { setArtistInfo(null); return }
    fetchArtistDetail(track.artist_id).then(setArtistInfo).catch(() => setArtistInfo(null))
  }, [track?.artist_id])

  useEffect(() => { setTrActive(false) }, [track?.id])
  useEffect(() => () => { if (ctrlsTimerRef.current) clearTimeout(ctrlsTimerRef.current) }, [])
  useEffect(() => { localStorage.setItem('lyrics-auto-translate', autoTranslate ? '1' : '0') }, [autoTranslate])
  // Esc closes the fullscreen Now Playing overlay (desktop expectation).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  // Called by LyricsView once lyrics for the given trackId have actually
  // loaded — only then is it safe to auto-trigger translation (see the
  // comment on LyricsView's own `onReady` effect for why).
  const handleLyricsReady = (readyTrackId: string) => {
    if (!autoTranslate || trActive || readyTrackId !== track?.id) return
    // A cached translation already proves this track is foreign — skip the
    // fallible detect-language round trip and render it directly instead of
    // letting a flaky detect call block an already-known answer.
    if (sessionStorage.getItem(`lyr-tr:${readyTrackId}`)) { lyricsRef.current?.showTranslation(); return }
    // Use the track's own artist_name/album_title (synchronous, on the track
    // object already) rather than the separately-fetched `artistInfo` — that
    // fetch may still be in flight when lyrics finish loading, silently
    // degrading detection to title-only.
    const text = `${track.title} ${track.artist_name ?? ''} ${track.album_title ?? ''}`.trim()
    if (!text) return
    // detect-language hits an unofficial Google endpoint — retry once on
    // failure instead of silently giving up. Result is always exactly one of
    // two outcomes: translate on (foreign) or leave it off (Vietnamese / still
    // unknown after retry) — never left hanging.
    detectLyricsLanguage(text)
      .catch(() => new Promise(r => setTimeout(r, 1000)).then(() => detectLyricsLanguage(text)))
      .then(({ lang }) => { if (lang && lang !== 'vi') lyricsRef.current?.showTranslation() })
      .catch(err => console.warn('[auto-translate] language detect failed after retry', err))
  }

  const showCtrls = () => {
    setCtrlsVisible(true)
    if (ctrlsTimerRef.current) clearTimeout(ctrlsTimerRef.current)
    ctrlsTimerRef.current = setTimeout(() => setCtrlsVisible(false), 3000)
  }

  // ── Extract dominant colors from cover for gradient ────────────────
  useEffect(() => {
    if (!track) return
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.src = `/api/covers/${track.album_id}?w=80`
    img.onload = () => {
      if (cancelled) return
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      // Sample top and bottom to get a vertical gradient palette
      canvas.width = 1; canvas.height = 2
      ctx.drawImage(img, 0, 0, 1, 2)
      const data = ctx.getImageData(0, 0, 1, 2).data

      const colors = []
      for (let i = 0; i < 2; i++) {
        let r = data[i * 4]
        let g = data[i * 4 + 1]
        let b = data[i * 4 + 2]

        // Boost brightness if the color is too dark
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
        if (luminance < 60) {
          const factor = 1.5 + (60 - luminance) / 60
          r = Math.min(255, r * factor)
          g = Math.min(255, g * factor)
          b = Math.min(255, b * factor)
          // Also boost saturation slightly
          const avg = (r + g + b) / 3
          r = Math.min(255, r + (r - avg) * 0.5)
          g = Math.min(255, g + (g - avg) * 0.5)
          b = Math.min(255, b + (b - avg) * 0.5)
        }

        colors.push('#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1))
      }
      setCoverColors(colors)
    }
    return () => {
      cancelled = true
      img.src = ''
    }
  }, [track, setCoverColors])

  const pct = duration > 0 ? (progress / duration) * 100 : 0
  const progressStyle = { background: `linear-gradient(to right, #fff ${pct}%, #535353 ${pct}%)` }

  const cycleRepeat = () => {
    const n: RepeatMode = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off'
    setRepeat(n)
  }
  const cycleShuffle = () => {
    const n: ShuffleMode = shuffleMode === 'off' ? 'smart' : shuffleMode === 'smart' ? 'shuffle' : 'off'
    setShuffleMode(n)
  }
  const shuffleTitle =
    shuffleMode === 'off'   ? t('player.smart_radio_hint') :
    shuffleMode === 'smart' ? t('player.smart_radio_active') :
                              t('player.shuffle_active')

  return (
    <div className={'player-bar' + (!track ? ' player-bar--empty' : '')} onDoubleClick={() => open && setOpen(false)}>
      {!track ? (
        <span className="player-hint">{t('player.hint')}</span>
      ) : (
        <>
          {/* ── Desktop player bar ── */}
          <div className="player-full">
            <div className="player-left">
              <span className="player-title">{track.title}</span>
            </div>

            <div className="player-center">
              <div className="player-controls">
                <button className={'ctrl-btn' + (shuffleMode !== 'off' ? ' ctrl-btn--active' : '')} onClick={cycleShuffle} title={shuffleTitle}>
                  <ShuffleModeIcon mode={shuffleMode} />
                </button>
                <button className="ctrl-btn" onClick={prev} title="Previous"><IconPrev /></button>
                <button className="play-btn" onClick={toggle} aria-label={isPlaying ? 'Pause' : 'Play'}>
                  {isPlaying ? <IconPause /> : <IconPlay />}
                </button>
                <button className="ctrl-btn" onClick={next} title="Next"><IconNext /></button>
                <button className={'ctrl-btn' + (repeat !== 'off' ? ' ctrl-btn--active' : '')} onClick={cycleRepeat} title={`Repeat: ${repeat}`}>
                  <RepeatIcon mode={repeat} />
                </button>
              </div>
              <div className="player-progress">
                <span className="player-time">{fmt(progress)}</span>
                <input type="range" className="progress-bar" style={progressStyle} min={0} max={duration || 1} step={0.5} value={progress} onChange={e => seek(Number(e.target.value))} />
                <span className="player-time">{fmt(duration)}</span>
              </div>
            </div>

            <div className="player-right">
              {/* Add to playlist pill */}
              {track && (
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <FavoritePill trackId={track.id} />
                </span>
              )}
              {/* hamburger — opens unified now-playing overlay */}
              <button className={'ctrl-btn' + (open ? ' ctrl-btn--active' : '')} onClick={() => setOpen(o => !o)} title={t('player.now_playing')}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <rect x="3" y="6"  width="18" height="2" rx="1"/>
                  <rect x="3" y="11" width="14" height="2" rx="1"/>
                  <rect x="3" y="16" width="10" height="2" rx="1"/>
                </svg>
              </button>
              <button className={'smart-badge' + (shuffleMode === 'smart' ? ' smart-badge--active' : '')} onClick={() => setShuffleMode(shuffleMode === 'smart' ? 'off' : 'smart')} title={shuffleMode === 'smart' ? t('player.smart_on') : t('player.smart_off')}>
                ✦ SMART
              </button>
              <button className={'quality-btn' + (quality === 'lossless' ? ' quality-btn--lossless' : ' quality-btn--320')} onClick={() => setQuality(quality === 'lossless' ? '320' : 'lossless')}>
                {quality === 'lossless' ? 'LOSSLESS' : '320K'}
              </button>
              <button
                className={'ctrl-btn' + (bgPlaying ? ' ctrl-btn--active' : '')}
                onClick={() => setBgPanelOpen(!bgPanelOpen)}
                title="Background Sounds"
              >
                <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
                  <path d="M11 5.5a.5.5 0 0 0-.8-.4L6.5 8H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.5l3.7 2.9a.5.5 0 0 0 .8-.4V5.5zm3.2 2a.75.75 0 0 1 1.06.06A6 6 0 0 1 17 12a6 6 0 0 1-1.74 4.44.75.75 0 1 1-1.12-1A4.5 4.5 0 0 0 15.5 12a4.5 4.5 0 0 0-1.36-3.44.75.75 0 0 1 .06-1.06zm2.5-2.5a.75.75 0 0 1 1.06.05A9.5 9.5 0 0 1 20.5 12a9.5 9.5 0 0 1-2.74 6.95.75.75 0 1 1-1.06-1.06A8 8 0 0 0 19 12a8 8 0 0 0-2.3-5.89.75.75 0 0 1 .02-1.11z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* ── Mobile mini bar (floating pill) — hidden while NPO is open ──
               Layout matches Apple Music's mini-player: cover thumbnail +
               title/artist stacked left (hugs content, no forced-width
               column), play + skip-forward flush right. No prev button here
               — full transport lives one tap away in the NPO. */}
          {!open && (
            <div className="player-mini" onClick={() => setOpen(true)}>
              <div className="player-mini-progress">
                <div className="player-mini-progress-fill" style={{ '--pct': `${pct}%` } as CSSProperties} />
                <div className="water-shimmer" style={{ '--pct': `${pct}%` } as CSSProperties}>
                  <div className="water-shimmer-layer water-shimmer-a" />
                  <div className="water-shimmer-layer water-shimmer-b" />
                </div>
              </div>
              <div className="player-mini-cover">
                <img
                  src={track.album_id.startsWith('yt:')
                    ? `https://i.ytimg.com/vi/${track.album_id.slice(3)}/hqdefault.jpg`
                    : `/api/covers/${track.album_id}?w=80`}
                  alt=""
                  onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
                />
              </div>
              <div className="player-mini-info">
                <span className="player-mini-track">{track.title}</span>
                <span className="player-mini-artist">{track.artist_name ?? ''}</span>
              </div>
              <div className="player-mini-controls">
                <button className="play-btn player-mini-play-btn" onClick={e => { e.stopPropagation(); toggle() }} aria-label={isPlaying ? 'Pause' : 'Play'}>
                  {isPlaying ? <IconPause /> : <IconPlay />}
                </button>
                <button className="ctrl-btn" onClick={e => { e.stopPropagation(); next() }} aria-label="Next"><IconNext /></button>
              </div>
            </div>
          )}

          {/* ── Unified Now Playing overlay (desktop + mobile) ── */}
          <div className={'npo' + (open ? ' npo--open' : '') + (ctrlsVisible ? ' npo--ctrls-active' : '')} onTouchStart={showCtrls}>
            <div className="npo-bg">
              <img src={track.album_id.startsWith('yt:') ? `https://i.ytimg.com/vi/${track.album_id.slice(3)}/hqdefault.jpg` : `/api/covers/${track.album_id}?w=512`} alt="" key={track.id} onError={e => { (e.target as HTMLImageElement).style.opacity = '0' }} />
              <div 
                className="npo-bg-overlay" 
                style={{ background: `linear-gradient(160deg, ${coverColors[0]}66 0%, #121212f2 80%)` }} 
              />
            </div>

            {/* header */}
            <div className="npo-header">
              {/* mobile: chevron back */}
              <button className="npo-btn-back" onClick={() => setOpen(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {/* Mobile Tab Switcher */}
              <div className="npo-tabs-mobile">
                <button 
                  className={`npo-tab-btn ${mobileTab === 'player' ? 'npo-tab-btn--active' : ''}`} 
                  onClick={() => setMobileTab('player')}
                >
                  {t('player.now_playing')}
                </button>
                <button 
                  className={`npo-tab-btn ${mobileTab === 'lyrics' ? 'npo-tab-btn--active' : ''}`} 
                  onClick={() => setMobileTab('lyrics')}
                >
                  {t('player.lyrics')}
                </button>
              </div>

              {/* lyrics settings — 3 dots, no circle */}
              <button className="npo-btn-dots" onClick={() => lyricsRef.current?.toggleTools()} title="Lyric settings">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
              </button>
            </div>

            {/* body: left col on desktop / tab content on mobile */}
            <div className="npo-body">

              {/* tap zones for mobile tab switching */}
              {mobileTab === 'lyrics' && (
                <div className="npo-back-zone" onClick={() => setMobileTab('player')} aria-label="Back to Now Playing"
                />
              )}
              <div className={'npo-info' + (mobileTab === 'lyrics' ? ' npo-panel--hidden' : '')}>
                <div className="npo-cover">
                  <img
                    src={track.album_id.startsWith('yt:')
                      ? `https://i.ytimg.com/vi/${track.album_id.slice(3)}/hqdefault.jpg`
                      : `/api/covers/${track.album_id}?w=512`}
                    alt={track.title}
                    style={{ opacity: 0 }}
                    onLoad={e => { (e.target as HTMLImageElement).style.opacity = '1' }}
                    onError={e => { (e.target as HTMLImageElement).style.opacity = '0' }}
                  />
                </div>
                <div className="npo-info-text">
                  <div className="npo-info-title">{track.title}</div>
                  {artistInfo && <div className="npo-info-artist">{artistInfo.name}</div>}
                  <div className="npo-info-badges">
                    <button className={'smart-badge' + (shuffleMode === 'smart' ? ' smart-badge--active' : '')} onClick={() => setShuffleMode(shuffleMode === 'smart' ? 'off' : 'smart')} title={shuffleMode === 'smart' ? t('player.smart_on') : t('player.smart_off')}>
                      ✦ SMART
                    </button>
                    <button className={'quality-btn' + (quality === 'lossless' ? ' quality-btn--lossless' : ' quality-btn--320')} onClick={() => setQuality(quality === 'lossless' ? '320' : 'lossless')}>
                      {quality === 'lossless' ? 'LOSSLESS' : '320K'}
                    </button>
                  </div>
                </div>
                <Equalizer />
              </div>

              {/* Tab 2 / right col: track title + lyrics */}
              <div className={'npo-content' + (mobileTab === 'player' ? ' npo-panel--hidden' : '')}>
                <div className="npo-lyrics-wrap">
                  <LyricsView
                    ref={lyricsRef}
                    trackId={track.id}
                    onTranslateActiveChange={setTrActive}
                    onReady={handleLyricsReady}
                    autoTranslate={autoTranslate}
                    onToggleAutoTranslate={() => setAutoTranslate(v => !v)}
                  />
                </div>
              </div>
            </div>


            {/* playback controls – hidden on desktop (in player bar), always visible on mobile */}
            <div className="npo-controls">
              {/* Gated on `open` too, not just queueOpen — .npo always
                  exists in the DOM (only its opacity/pointer-events toggle
                  when closed), so without this a second, "invisible" copy
                  of the same panel MobileSearchBar renders would sit here
                  regardless of NPO's visibility and intercept clicks. */}
              {queueOpen && open && (
                <>
                  <div className="queue-panel-backdrop" onClick={() => setQueueOpen(false)} />
                  <div className="queue-panel">
                    <QueueList />
                  </div>
                </>
              )}
              <div className="npo-icon-row">
                <button
                  className={'npo-queue-btn ctrl-btn' + (queueOpen ? ' ctrl-btn--active' : '')}
                  onClick={() => setQueueOpen(v => !v)}
                  title={t('player.queue')}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M4 6h13v2H4V6zm0 5h13v2H4v-2zm0 5h9v2H4v-2zm16-8v10l-5-5 5-5z"/>
                  </svg>
                </button>
                <button
                  className={'npo-translate-btn ctrl-btn' + (trActive ? ' ctrl-btn--active' : '')}
                  onClick={() => lyricsRef.current?.toggleTranslation()}
                  title={trActive ? t('player.hide_translation') : t('player.show_translation')}
                >🌐</button>
                <button
                  className={'npo-auto-translate-btn ctrl-btn' + (autoTranslate ? ' ctrl-btn--active' : '')}
                  onClick={() => setAutoTranslate(v => !v)}
                  title={autoTranslate ? t('player.auto_translate_on') : t('player.auto_translate_off')}
                >⚡</button>
              </div>
              <div className="npo-progress">
                <input type="range" className="progress-bar" style={progressStyle} min={0} max={duration || 1} step={0.5} value={progress} onChange={e => seek(Number(e.target.value))} />
                <div className="npo-times">
                  <span className="player-time">{fmt(progress)}</span>
                  <span className="player-time">{fmt(duration)}</span>
                </div>
              </div>
              <div className="npo-btns">
                <button className={'ctrl-btn' + (shuffleMode !== 'off' ? ' ctrl-btn--active' : '')} onClick={cycleShuffle} title={shuffleTitle}>
                  <ShuffleModeIcon mode={shuffleMode} />
                </button>
                <button className="ctrl-btn" onClick={prev}><IconPrev /></button>
                <button className="play-btn npo-play-btn" onClick={toggle} aria-label={isPlaying ? 'Pause' : 'Play'}>
                  {isPlaying ? <IconPause /> : <IconPlay />}
                </button>
                <button className="ctrl-btn" onClick={next}><IconNext /></button>
                <button className={'ctrl-btn' + (repeat !== 'off' ? ' ctrl-btn--active' : '')} onClick={cycleRepeat}>
                  <RepeatIcon mode={repeat} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {playbackError && (
        <div className="playback-error-toast">
          <div className="playback-error-icon">⚠️</div>
          <div className="playback-error-content">
            <div className="playback-error-title">{t('player.playback_failed')}</div>
            <div className="playback-error-msg">
              {t('player.playback_error', { message: playbackError.message, code: playbackError.code })}
            </div>
          </div>
          <button className="playback-error-close" onClick={() => setPlaybackError(null)}>✕</button>
        </div>
      )}
      <BackgroundSoundsPanel />
    </div>
  )
}
