import { useTranslation } from 'react-i18next'
import { usePlayer } from '../PlayerContext'
import { imgSrc } from '../api'
import type { Track } from '../types'
import { MEDIA } from '../endpoints'

const coverOf = (t: Track, w: number) =>
  t.album_id?.startsWith('yt:')
    ? `https://i.ytimg.com/vi/${t.album_id.slice(3)}/hqdefault.jpg`
    : imgSrc(`${MEDIA}/covers/${t.album_id}`, w)

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// Fixed waveform shape (like the reference): 38 bars, played part is orange, rest fades out.
const BARS = [3,6,10,6,14,8,18,10,22,14,30,20,36,24,32,18,26,12,22,10,18,8,16,6,14,6,12,5,10,5,9,4,8,4,7,3,6,3]

type Props = {
  onSkip: () => void        // close the overlay
  onLyrics: () => void      // dot 1 / CTA while playing
  onQueue: () => void       // dot 2 and the "+" tile
}

// Peach "Your music. Your little world." screen. Mounted by PlayerBar as the
// Now Playing tab; fully driven by the current track + queue.
export default function VinylScreen({ onSkip, onLyrics, onQueue }: Props) {
  const { t } = useTranslation()
  const { track, queue, queueIdx, isPlaying, progress, duration, toggle, seek, playFromQueue } = usePlayer()
  if (!track) return null

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

  return (
    <div className="vinyl-screen">
      <div className="vinyl-card">
        <button className="vinyl-skip" onClick={onSkip}>{t('vinyl.skip')}</button>

        <div className="vinyl-stage">
          <div className={'vinyl-disc' + (isPlaying ? ' vinyl-disc--spin' : '')}>
            <div className="vinyl-label">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10v4" />
              </svg>
              <i />
            </div>
          </div>
          <div className="vinyl-tag" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#1b1b1d" strokeWidth="2" strokeLinejoin="round">
              <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.5 2.6c0 5.6-7.5 10.2-7.5 10.2z" />
            </svg>
          </div>
          <div className="vinyl-sleeve">
            <img className="vinyl-sleeve-img" src={coverOf(track, 512)} alt="" onError={e => { (e.target as HTMLImageElement).style.opacity = '0' }} />
            <div className="vinyl-sleeve-shade" />
            <svg className="vinyl-sleeve-edge" viewBox="0 0 288 155" preserveAspectRatio="none" aria-hidden="true"><path d="M0 1H52C92 1 98 51 144 51S196 1 236 1H288" /></svg>
            <div className="vinyl-sleeve-text">
              <small>{t('vinyl.collection')}</small>
              <strong>{track.album_title ?? track.title}</strong>
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
                ? <button key={q.id + i} className="vinyl-thumb" onClick={() => playFromQueue(queueIdx + 1 + i)} aria-label={q.title}>
                    <img src={coverOf(q, 128)} alt="" onError={e => { (e.target as HTMLImageElement).style.opacity = '0' }} />
                  </button>
                : <span key={'e' + i} className="vinyl-thumb vinyl-thumb--empty" />
            })}
            <button className="vinyl-thumb vinyl-thumb--add" onClick={onQueue} aria-label={t('player.queue', 'Queue')}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#1b1b1d" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
        </div>

        <div className="vinyl-bar">
          <button className="vinyl-bar-btn" onClick={toggle} aria-label={isPlaying ? t('player.pause', 'Pause') : t('player.play', 'Play')}>
            {isPlaying
              ? <svg viewBox="0 0 24 24" width="14" height="14" fill="#fff"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              : <svg viewBox="0 0 24 24" width="14" height="14" fill="#fff"><polygon points="7,3 20,12 7,21"/></svg>}
          </button>
          <div className="vinyl-wave" onClick={onWave} onKeyDown={onWaveKey} tabIndex={0} role="slider" aria-label={t('player.now_playing')} aria-valuetext={`${fmt(progress)} / ${fmt(duration)}`} aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(progress)}>
            {BARS.map((h, i) => <i key={i} className={i < playedBars ? 'on' : ''} style={{ height: h, opacity: i < playedBars ? 1 : Math.max(0.28, 1 - i / BARS.length) }} />)}
          </div>
          <span className="vinyl-time">{fmt(duration)}</span>
        </div>

        <h2 className="vinyl-title">{t('vinyl.title1')}<br />{t('vinyl.title2')}</h2>
        <p className="vinyl-sub">{t('vinyl.sub1')}<br />{t('vinyl.sub2')}</p>

        <div className="vinyl-dots">
          <button onClick={onLyrics} aria-label={t('player.lyrics')} />
          <button onClick={onQueue} aria-label={t('vinyl.playlist')} />
          <button className="on" aria-current="true" aria-label={t('player.now_playing')} />
        </div>

        <button className="vinyl-cta" onClick={() => (isPlaying ? onLyrics() : toggle())}>
          {t('vinyl.cta')}
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  )
}
