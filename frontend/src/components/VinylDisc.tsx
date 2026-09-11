import { useState, useEffect } from 'react'

// The spinning vinyl visual lifted from RadialNav's nav bubble (grooves +
// centered album label + center hole), but split out as a plain presentational
// component so it can be reused as the desktop player-bar play/pause control
// WITHOUT dragging along the bubble's menu/drag behaviour.
//
// Fixes the old "empty black disc" problem too: when there's no cover (or it
// 404s), the label falls back to a cream audiophile record-label placeholder
// instead of a bare black groove.

type VinylDiscProps = {
  cover?: string | null   // resolved cover URL, or null/undefined for placeholder
  spinning?: boolean      // spin the disc (i.e. currently playing)
  size?: number           // outer diameter in px
  alt?: string
  className?: string
}

export default function VinylDisc({ cover, spinning = false, size = 48, alt = '', className = '' }: VinylDiscProps) {
  const [errored, setErrored] = useState(false)

  // Reset the error flag whenever the cover URL changes so a new track gets a
  // fresh attempt instead of staying stuck on the placeholder.
  useEffect(() => { setErrored(false) }, [cover])

  const showImg = !!cover && !errored
  // Label diameter is 46% of the disc; only large enough discs get the tiny
  // wordmark text — below that it's illegibly small, so show the mark alone.
  const showText = size * 0.46 >= 26

  return (
    <span
      className={`vinyl-disc${spinning ? ' vinyl-disc--spinning' : ''}${className ? ' ' + className : ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="vinyl-disc-label">
        {/* Placeholder always rendered underneath; the cover image sits on top
            and covers it when present. */}
        <span className="vinyl-disc-placeholder">
          <span className="vinyl-disc-mark">♪</span>
          {showText && (
            <>
              <span className="vinyl-disc-wordmark">COZYROOM</span>
              <span className="vinyl-disc-subtext">HI·FI AUDIO</span>
            </>
          )}
        </span>
        {showImg && (
          <img
            key={cover}
            src={cover ?? ''}
            alt={alt}
            draggable={false}
            onError={() => setErrored(true)}
          />
        )}
      </span>
    </span>
  )
}
