import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlayer } from '../PlayerContext'
import { imgSrc } from '../api'
import type { Track } from '../types'
import { IconPrev, IconNext, IconShuffle, IconRepeat, IconSparkle } from './Icons'
import { MEDIA } from '../endpoints'
import { useLyricsLine } from './useLyricsLine'
import { synthLevel } from './eqSynth'
import { labelColors } from './vinylLabel'
import { noteFor } from './noteBag'
import FavoritePill from './FavoritePill'

const coverOf = (t: Track, w: number) =>
  t.album_id?.startsWith('yt:')
    ? `https://i.ytimg.com/vi/${t.album_id.slice(3)}/hqdefault.jpg`
    : imgSrc(`${MEDIA}/covers/${t.album_id}`, w)

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// Fixed waveform shape (like the reference): 38 bars, played part is orange, rest fades out.
const BARS = [3,6,10,6,14,8,18,10,22,14,30,20,36,24,32,18,26,12,22,10,18,8,16,6,14,6,12,5,10,5,9,4,8,4,7,3,6,3]

type Props = {
  onClose: () => void       // close the overlay (tap on empty space outside the content, wide screens)
  onLyrics: () => void      // tap on the lyric line
  onQueue: () => void       // the "+" tile and the playlist chevron
}

// Peach "Your music. Your little world." screen. Mounted by PlayerBar as the
// Now Playing tab; fully driven by the current track + queue.
export default function VinylScreen({ onClose, onLyrics, onQueue }: Props) {
  const { t } = useTranslation()
  const { track, queue, queueIdx, isPlaying, progress, duration, toggle, seek, playFromQueue, prev, next, shuffleMode, setShuffleMode, repeat, setRepeat, analyser, coverColors } = usePlayer()
  const barEls = useRef<(HTMLElement | null)[]>([])

  // Bars dance while playing: live analyser data (same formula as the fireplace), else a synthetic wave.
  // Heights go straight to the DOM (no React state, 60 fps) and rest at the static shape when paused or reduced-motion.
  useEffect(() => {
    if (!isPlaying || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
    const used = data ? Math.floor(data.length * 0.6) : 0
    const cur = BARS.map(() => 1)
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      if (analyser && data) analyser.getByteFrequencyData(data)
      const live = !!data && data.some(v => v > 0)
      const now = performance.now()
      BARS.forEach((h, i) => {
        let v: number
        if (live) { const raw = data![Math.floor((i / BARS.length) * used)] / 255; v = raw > 0.001 ? Math.max(0, (20 * Math.log10(raw) + 60) / 60) : 0 }
        else v = synthLevel(now, i)
        const target = (3 + v * 33 * (0.45 + 0.55 * h / 36)) / h   // keep the bar shape as the envelope
        cur[i] += (target - cur[i]) * 0.35
        const el = barEls.current[i]
        if (el) el.style.transform = `scaleY(${cur[i].toFixed(3)})`
      })
    }
    draw()
    return () => { cancelAnimationFrame(raf); barEls.current.forEach(el => { if (el) el.style.transform = '' }) }
  }, [isPlaying, analyser])
  const line = useLyricsLine(track)
  if (!track) return null

  const cycleRepeat = () => setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off')
  const repeatLabel = t('player.repeat', { defaultValue: 'Repeat' }) + ': ' + t(`player.repeat_${repeat}`, { defaultValue: repeat === 'off' ? 'off' : repeat === 'all' ? 'all' : 'one' })

  const next3 = queue.slice(queueIdx + 1, queueIdx + 4)
  const pct = duration > 0 ? Math.min(1, progress / duration) : 0
  const playedBars = Math.round(pct * BARS.length)

  const onWave = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    if (duration > 0) seek(((e.clientX - r.left) / r.width) * duration)
  }

  const onWaveKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0
    if (!step || duration <= 0) return
    e.preventDefault()
    seek(Math.max(0, Math.min(duration, progress + step)))
  }

  // coverColors is the app-wide default green until the cover is read: use the faded orange for it
  const [labelA, labelB] = coverColors[0] === '#1db954' ? labelColors(undefined) : labelColors(coverColors[0])

  // Tap on empty space = close. Phone width: never (mistaps). 641-999px: only outside the phone card. 1000px+: the card is the full canvas.
  const onBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    const wide = window.matchMedia('(min-width: 1000px)').matches
    const medium = window.matchMedia('(min-width: 641px)').matches
    const el = e.target as HTMLElement
    if (e.target === e.currentTarget ? medium : wide && el.classList.contains('vinyl-card')) onClose()
  }

  return (
    <div className="vinyl-screen" onClick={onBackdrop}>
      <div className="vinyl-card">

        <div className="vinyl-stage">
          <div className={'vinyl-disc' + (isPlaying ? ' vinyl-disc--spin' : '')}>
            <div className="vinyl-label" style={{ '--label-a': labelA, '--label-b': labelB } as React.CSSProperties}>
              <span>{track.artist_name}</span>
              <b aria-hidden="true">{noteFor(track.id)}</b>
            </div>
          </div>
          <FavoritePill key={track.id} trackId={track.id} variant="heart" className="vinyl-tag" />
          <div className="vinyl-sleeve">
            <img className="vinyl-sleeve-img" src={coverOf(track, 512)} alt="" onError={e => { (e.target as HTMLImageElement).style.opacity = '0' }} />
            <div className="vinyl-sleeve-shade" />
            <svg className="vinyl-sleeve-edge" viewBox="0 0 288 155" preserveAspectRatio="none" aria-hidden="true"><path d="M0 1H52C92 1 98 51 144 51S196 1 236 1H288" /></svg>
            <div className="vinyl-sleeve-text">
              <small>{t('vinyl.collection')}</small>
              <strong>{track.album_title ?? track.title}</strong>
              {track.album_title && track.album_title !== track.title && <em>{track.title}</em>}
            </div>
            <button className="vinyl-sleeve-play" onClick={toggle} aria-label={isPlaying ? t('player.pause', 'Pause') : t('player.play', 'Play')}>
              {isPlaying
                ? <svg viewBox="0 0 24 24" width="12" height="12" fill="#1b1b1d"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                : <svg viewBox="0 0 24 24" width="12" height="12" fill="#1b1b1d"><polygon points="7,3 20,12 7,21"/></svg>}
            </button>
          </div>
        </div>

        <div className="vinyl-playlist">
          <div className="vinyl-playlist-head">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#1b1b1d" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M3 6h12M3 11h12M3 16h6" /><circle cx="17" cy="17" r="2.5" /><path d="M19.5 17V8l3 1.5" />
            </svg>
            <span>{t('vinyl.playlist')}</span>
            <button className="vinyl-chev" onClick={onQueue} aria-label={t('vinyl.playlist')}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#1b1b1d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18" /></svg>
            </button>
          </div>
          <div className="vinyl-thumbs">
            {[0, 1, 2].map(i => {
              const q = next3[i]
              return q
                ? <span key={q.id + i} className="vinyl-thumb-wrap">
                    <button className="vinyl-thumb" onClick={() => playFromQueue(queueIdx + 1 + i)} aria-label={q.title}>
                      <img src={coverOf(q, 128)} alt="" onError={e => { (e.target as HTMLImageElement).style.opacity = '0' }} />
                    </button>
                    <span className="vinyl-thumb-tip" aria-hidden="true">{q.title}</span>
                  </span>
                : <span key={'e' + i} className="vinyl-thumb vinyl-thumb--empty" />
            })}
            <button className="vinyl-thumb vinyl-thumb--add" onClick={onQueue} aria-label={t('player.queue', 'Queue')}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#1b1b1d" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
        </div>

        <div className="vinyl-bar">
          <span className="vinyl-elapsed" aria-hidden="true">{fmt(progress)}</span>
          <div className="vinyl-wave" onClick={onWave} onKeyDown={onWaveKey} tabIndex={0} role="slider" aria-label={t('player.now_playing')} aria-valuetext={`${fmt(progress)} / ${fmt(duration)}`} aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(progress)}>
            {BARS.map((h, i) => <i key={i} ref={el => { barEls.current[i] = el }} className={i < playedBars ? 'on' : ''} style={{ height: h, opacity: i < playedBars ? 1 : Math.max(0.28, 1 - i / BARS.length) }} />)}
          </div>
          <span className="vinyl-time">{fmt(duration)}</span>
        </div>

        <h2 className="vinyl-title"><button className="vinyl-lyric" onClick={onLyrics} title={t('player.lyrics')}>{line.cur}</button></h2>
        <p className="vinyl-sub" aria-hidden="true" onClick={onLyrics}>{line.next}</p>

        <div className="vinyl-transport" role="group" aria-label={t('player.now_playing')}>
          {/* Shuffle and Smart are two buttons: one cycling icon hid Smart (owner 25/11) */}
          <button className={shuffleMode === 'shuffle' ? 'on' : ''} onClick={() => setShuffleMode(shuffleMode === 'shuffle' ? 'off' : 'shuffle')} aria-pressed={shuffleMode === 'shuffle'} aria-label={t('player.shuffle_active')} title={t('player.shuffle_active')}>
            <IconShuffle size={22} />
          </button>
          <button className={shuffleMode === 'smart' ? 'on' : ''} onClick={() => setShuffleMode(shuffleMode === 'smart' ? 'off' : 'smart')} aria-pressed={shuffleMode === 'smart'} aria-label={shuffleMode === 'smart' ? t('player.smart_radio_active') : t('player.smart_radio_hint')} title={shuffleMode === 'smart' ? t('player.smart_radio_active') : t('player.smart_radio_hint')}>
            <IconSparkle size={22} />
          </button>
          <button onClick={prev} aria-label={t('player.previous')} title={t('player.previous')}><IconPrev size={26} /></button>
          <button onClick={next} aria-label={t('player.next')} title={t('player.next')}><IconNext size={26} /></button>
          <button className={repeat !== 'off' ? 'on' : ''} onClick={cycleRepeat} aria-pressed={repeat !== 'off'} aria-label={repeatLabel} title={repeatLabel}>
            <IconRepeat size={22} one={repeat === 'one'} />
          </button>
        </div>
      </div>
    </div>
  )
}
