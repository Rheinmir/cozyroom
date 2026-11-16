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
import { useQuery } from '@tanstack/react-query'
import { fetchPlayStats } from '../api'
import { idleInvite } from '../roomVoice'

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// Material Symbols Rounded (FILL 1) transport glyphs — rounded + filled, to
// match Apple Music exactly. The .ms class (index.css) loads the font; size is
// set per button via font-size. Active teal for toggles is applied by the
// `.ctrl-btn--active .ms` rule when the parent button carries ctrl-btn--active.
const Ms = ({ name, size }: { name: string; size: number }) => (
  <span className="ms" style={{ fontSize: size }} aria-hidden>{name}</span>
)
const IconPrev  = () => <Ms name="skip_previous" size={22} />
const IconNext  = () => <Ms name="skip_next"     size={22} />
const IconPlay  = () => <Ms name="play_arrow"     size={22} />
const IconPause = () => <Ms name="pause"          size={22} />

function RepeatIcon({ mode }: { mode: RepeatMode }) {
  return <Ms name={mode === 'one' ? 'repeat_one' : 'repeat'} size={20} />
}

function ShuffleModeIcon({ mode: _mode }: { mode: ShuffleMode }) {
  return <Ms name="shuffle" size={20} />
}

export default function PlayerBar() {
  const { t } = useTranslation()
  const {
    track, isPlaying, progress, duration,
    repeat, shuffleMode, quality, analyser,
    toggle, seek, prev, next, play,
    setRepeat, setShuffleMode, setQuality, coverColors, setCoverColors,
    playbackError, setPlaybackError,
    queueOpen, setQueueOpen,
    npoOpen: open, setNpoOpen: setOpen,
  } = usePlayer()
  // Idle pill speaks to the listener: offers their most-played track, phrased
  // for the time of day (shares the ['stats','plays',90] cache with Discover).
  const { data: playStats } = useQuery({ queryKey: ['stats', 'plays', 90], queryFn: () => fetchPlayStats(90), staleTime: 5 * 60_000, enabled: !track })
  const invite = idleInvite(playStats?.top ?? [])
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
  // Close the NPO's queue panel on any press outside it (or its toggle).
  // The .queue-panel-backdrop catcher only has size inside the ≤900px media
  // query, so on desktop clicking elsewhere in the overlay left it open.
  const npoQueueRef    = useRef<HTMLDivElement>(null)
  const npoQueueBtnRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!(queueOpen && open)) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (npoQueueRef.current?.contains(target) || npoQueueBtnRef.current?.contains(target)) return
      setQueueOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [queueOpen, open])
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
  // Played portion keys off var(--text) so it stays visible in both themes —
  // a hardcoded #fff fill vanished on the light-theme canvas.
  const progressStyle = { background: `linear-gradient(to right, #fff ${pct}%, rgba(255,255,255,.2) ${pct}%)` }
  // The floating-pill LCD uses the teal accent for its played portion (Tidal
  // Wave / Apple-Music chrome spec); NPO keeps the white fill above.
  const lcdProgressStyle = { background: `linear-gradient(to right, var(--green) ${pct}%, var(--fill-track) ${pct}%)` }

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
        invite.track ? (
          <button className="player-idle player-idle--invite" onClick={() => play(invite.track!, [invite.track!])} title={t('player.hint')}>
            <span className="player-idle-disc player-idle-disc--play"><Ms name="play_arrow" size={18} /></span>
            <span className="player-hint">{invite.text}</span>
          </button>
        ) : (
          <div className="player-idle">
            <span className="player-idle-disc"><Ms name="music_note" size={16} /></span>
            <span className="player-hint">{invite.text}</span>
          </div>
        )
      ) : (
        <>
          {/* ── Desktop player bar ── */}
          <div
            className="player-full"
            onClick={e => { if (!(e.target as HTMLElement).closest('button, input, a, .fav-pill-wrapper')) setOpen(true) }}
            title={t('player.now_playing')}
          >
            {/* Left: transport controls (Apple-Music chrome cluster) */}
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

            {/* Center: LCD now-playing (cover + title/artist + thin progress) */}
            <div className="player-lcd">
              <div className="player-lcd-cover">
                <img
                  src={track.album_id?.startsWith('yt:')
                    ? `https://i.ytimg.com/vi/${track.album_id.slice(3)}/hqdefault.jpg`
                    : `/api/covers/${track.album_id}?w=80`}
                  alt=""
                  onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
                />
              </div>
              <div className="player-lcd-text">
                <span className="player-lcd-title">{track.title}</span>
                <span className="player-lcd-artist">{track.artist_name ?? ''}</span>
              </div>
              <input type="range" className="progress-bar player-lcd-range" style={lcdProgressStyle} min={0} max={duration || 1} step={0.5} value={progress} onChange={e => seek(Number(e.target.value))} />
            </div>

            <div className="player-right">
              {/* Add to playlist pill */}
              {track && (
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <FavoritePill trackId={track.id} />
                </span>
              )}
              {/* list icon — opens ONLY the play-queue panel (not the detail view) */}
              <button className={'ctrl-btn' + (queueOpen && !open ? ' ctrl-btn--active' : '')} onClick={() => setQueueOpen(v => !v)} title={t('player.queue')}>
                <Ms name="queue_music" size={20} />
              </button>
              <button className={'smart-badge' + (shuffleMode === 'smart' ? ' smart-badge--active' : '')} onClick={() => setShuffleMode(shuffleMode === 'smart' ? 'off' : 'smart')} title={shuffleMode === 'smart' ? t('player.smart_on') : t('player.smart_off')}>
                SMART
              </button>
              <button className={'quality-btn' + (quality === 'lossless' ? ' quality-btn--lossless' : ' quality-btn--320')} onClick={() => setQuality(quality === 'lossless' ? '320' : 'lossless')}>
                {quality === 'lossless' ? 'LOSSLESS' : '320K'}
              </button>
              <button
                className={'ctrl-btn' + (bgPlaying ? ' ctrl-btn--active' : '')}
                onClick={() => setBgPanelOpen(!bgPanelOpen)}
                title="Background Sounds"
              >
                <Ms name="volume_up" size={20} />
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
                  src={track.album_id?.startsWith('yt:')
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

          {/* Standalone play-queue panel from the player bar (independent of the
              fullscreen overlay). Rendered only when the NPO is closed — the NPO
              has its own copy. Click-outside closes it. */}
          {queueOpen && !open && (
            <>
              <div className="queue-bar-backdrop" onClick={() => setQueueOpen(false)} />
              <div className="queue-panel queue-panel--bar"><QueueList /></div>
            </>
          )}

          {/* ── Unified Now Playing overlay (desktop + mobile) ── */}
          <div className={'npo' + (open ? ' npo--open' : '') + (ctrlsVisible ? ' npo--ctrls-active' : '')} onTouchStart={showCtrls}>
            <div className="npo-bg">
              <img src={track.album_id?.startsWith('yt:') ? `https://i.ytimg.com/vi/${track.album_id.slice(3)}/hqdefault.jpg` : `/api/covers/${track.album_id}?w=512`} alt="" key={track.id} onError={e => { (e.target as HTMLImageElement).style.opacity = '0' }} />
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
                    src={track.album_id?.startsWith('yt:')
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
                      SMART
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
                  <div className="queue-panel" ref={npoQueueRef}>
                    <QueueList />
                  </div>
                </>
              )}
              <div className="npo-icon-row">
                <button
                  ref={npoQueueBtnRef}
                  className={'npo-queue-btn ctrl-btn' + (queueOpen ? ' ctrl-btn--active' : '')}
                  onClick={() => setQueueOpen(v => !v)}
                  title={t('player.queue')}
                >
                  <Ms name="queue_music" size={20} />
                </button>
                <button
                  className={'npo-translate-btn ctrl-btn' + (trActive ? ' ctrl-btn--active' : '')}
                  onClick={() => lyricsRef.current?.toggleTranslation()}
                  title={trActive ? t('player.hide_translation') : t('player.show_translation')}
                ><Ms name="translate" size={20} /></button>
                <button
                  className={'npo-auto-translate-btn ctrl-btn' + (autoTranslate ? ' ctrl-btn--active' : '')}
                  onClick={() => setAutoTranslate(v => !v)}
                  title={autoTranslate ? t('player.auto_translate_on') : t('player.auto_translate_off')}
                ><Ms name="bolt" size={20} /></button>
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
