import { useTranslation } from 'react-i18next'
import { usePlayer } from '../PlayerContext'
import { imgSrc } from '../api'

// "Up Next" list — shows the current play queue (past + current + upcoming),
// highlights the playing track, and lets the user jump to any entry.
// Deliberately uses playFromQueue() (not play()) so a click here never
// touches lockedQueueRef / re-triggers smart-fill — see the comment on
// playFromQueue in PlayerContext.tsx.
export default function QueueList() {
  const { t } = useTranslation()
  const { queue, queueIdx, playFromQueue } = usePlayer()

  if (queue.length === 0) {
    return <div className="queue-empty text-muted">{t('player.queue_empty')}</div>
  }

  return (
    <div className="queue-list">
      {queue.map((qt, i) => {
        const isYt = qt.album_id?.startsWith('yt:')
        return (
          <div
            key={`${qt.id}-${i}`}
            className={'queue-item' + (i === queueIdx ? ' queue-item--active' : '')}
            onClick={() => playFromQueue(i)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playFromQueue(i) } }}
          >
            <div className="queue-item-cover">
              {!isYt
                ? <img src={imgSrc(`/api/covers/${qt.album_id}`, 80)} alt="" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                : <span className="no-cover" style={{ fontSize: 18 }}>♪</span>
              }
            </div>
            <div className="queue-item-info">
              <span className="queue-item-title">{qt.title}</span>
              <span className="queue-item-artist">{qt.artist_name}</span>
            </div>
            {i === queueIdx && <span className="queue-item-playing">♫</span>}
          </div>
        )
      })}
    </div>
  )
}
