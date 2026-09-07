const BARS = 5

export default function Spinner({ size = 20, label }: { size?: number; label?: string }) {
  const barWidth = Math.max(3, size * 0.22)
  const gap = Math.max(3, size * 0.22)

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap, height: size, flexShrink: 0 }}>
        {Array.from({ length: BARS }).map((_, i) => {
          const pair = Math.min(i, BARS - 1 - i)
          const delay = (pair / BARS) * 0.9
          return (
            <div
              key={i}
              style={{
                width: barWidth,
                height: '100%',
                borderRadius: '50%',
                background: 'var(--text)',
                animation: `eq-pulse 0.9s ease-in-out ${delay}s infinite`,
              }}
            />
          )
        })}
      </div>
      {label && <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{label}</span>}
    </div>
  )
}
