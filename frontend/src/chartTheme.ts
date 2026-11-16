// One recharts look for every dashboard (MusicStats, AIStats, Trending):
// raised tooltip, dashed hairline grid, quiet axis labels with no axis line or
// tick marks, small round legend dots. Spread these instead of hand-writing
// inline styles per chart so the dashboards read as one system.
import type { CSSProperties } from 'react'

export const TT: CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  boxShadow: '0 12px 32px -8px rgba(0,0,0,.6)',
  color: 'var(--text)',
  fontSize: 12,
  padding: '8px 12px',
}
export const TT_LABEL: CSSProperties = { color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }
export const TT_ITEM: CSSProperties = { color: 'var(--text)', padding: 0 }
/** Spread on <Tooltip>: `<Tooltip {...TIP} />` */
export const TIP = { contentStyle: TT, labelStyle: TT_LABEL, itemStyle: TT_ITEM, cursor: { fill: 'var(--surface-hover)' } }

/** Spread on <CartesianGrid>; pass horizontal={false} vertical for layout="vertical" bars. */
export const GRID = { strokeDasharray: '2 4', stroke: 'var(--border)', vertical: false }

export const TICK = { fontSize: 11, fill: 'var(--text-muted)' }
/** Spread on <XAxis>/<YAxis>: `<YAxis {...AXIS} />` */
export const AXIS = { axisLine: false, tickLine: false, tick: TICK } as const

export const LEGEND = {
  iconType: 'circle' as const,
  iconSize: 7,
  wrapperStyle: { fontSize: 11, color: 'var(--text-muted)', paddingTop: 6 } as CSSProperties,
}

/** Thin, gently squared bars (not fully-round pills). */
export const BAR_H: [number, number, number, number] = [0, 3, 3, 0] // horizontal (layout="vertical")
export const BAR_V: [number, number, number, number] = [3, 3, 0, 0] // vertical columns
