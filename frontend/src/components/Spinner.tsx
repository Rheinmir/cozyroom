import type { CSSProperties } from 'react'

const BARS = 5
// Resting heights shape the row like a small fire: tallest tongue in the middle.
const SHAPE = [0.6, 0.82, 1, 0.82, 0.6]

// Loading indicator: five soft, pill-shaped embers that rise and fall from
// their base like flame tongues — the same calm, symmetric (centre-out) rhythm
// as before, now in the hearth palette (warm gradient + glow from --accent).
export default function Spinner({ size = 20, label }: { size?: number; label?: string }) {
  const barWidth = Math.max(3, size * 0.22)
  const gap = Math.max(3, size * 0.2)

  return (
    <div className="ember-spinner" role="status" aria-label={label || 'Đang tải'}>
      <div className="ember-row" style={{ gap, height: size }}>
        {Array.from({ length: BARS }).map((_, i) => {
          const pair = Math.min(i, BARS - 1 - i)
          return (
            <i
              key={i}
              style={{
                width: barWidth,
                height: `${SHAPE[i] * 100}%`,
                animationDelay: `${(pair / BARS) * 0.9}s`,
              } as CSSProperties}
            />
          )
        })}
      </div>
      {label && <span className="ember-label">{label}</span>}
    </div>
  )
}
