import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { RepoCard } from '../components/TrendingRepoCard'
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid,
  PieChart, Pie, Sector,
  ScatterChart, Scatter, ZAxis,
  LineChart, Line, Legend,
  Treemap,
} from 'recharts'
import { fetchTrendingHistory } from '../api'
import type { TrendingRepo, StarPoint } from '../api'

type Tier = 'transformative' | 'significant' | 'incremental' | 'niche'
type OnFilter = (title: string, repos: TrendingRepo[]) => void
type DrawerState = { title: string; repos: TrendingRepo[] }

const TIER_ORDER: Tier[] = ['transformative', 'significant', 'incremental', 'niche']
const TIER_COLORS: Record<Tier, string> = {
  transformative: '#f59e0b',
  significant:    '#10b981',
  incremental:    '#0ea5e9',
  niche:          '#64748b',
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6', Python: '#3572a5', Rust: '#ce422b',
  Go: '#00acd7', JavaScript: '#f1e05a', 'C++': '#f34b7d',
  Java: '#b07219', C: '#6a737d', 'C#': '#178600', Ruby: '#701516',
  Swift: '#f05138', Kotlin: '#a97bff', PHP: '#4f5d95', Zig: '#f7a41d',
  Lua: '#000080', Haskell: '#5e5086', Elixir: '#6e4a7e', Shell: '#89e051',
}
function langColor(l: string) { return LANG_COLORS[l] ?? '#6b7280' }

function getTier(repo: TrendingRepo): Tier | '' {
  if ((TIER_ORDER as string[]).includes(repo.impact_label)) return repo.impact_label as Tier
  if (repo.impact_score >= 8) return 'transformative'
  if (repo.impact_score >= 6) return 'significant'
  if (repo.impact_score >= 4) return 'incremental'
  if (repo.impact_score >= 1) return 'niche'
  return ''
}

function fmtK(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'm'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

const TT = { background: '#1e1e2e', border: '1px solid rgba(255,255,255,.1)', fontSize: 12, borderRadius: 8 }
const GR = { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,.07)' }

const isMobile = () => window.innerWidth <= 767
function ch(desktop: number, mobile: number) { return isMobile() ? mobile : desktop }

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, children, full }: { title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`tc-section${full ? ' tc-section--full' : ''}`}>
      <div className="tc-section-title">{title}</div>
      {children}
    </div>
  )
}

// ── Charts ────────────────────────────────────────────────────────────────────

const CustomCrosshairCursor = (props: any) => {
  // Recharts v3 ScatterChart passes x/y directly (not as a points array)
  const { x, y, width, height, top, left, payload } = props
  const cx = x
  const cy = y
  if (cx === undefined || cy === undefined) return null

  // Estimate active bubble radius from its impact score (0 to 10)
  const score = payload?.[0]?.payload?.score ?? 5
  const r = 4 + (score / 10) * 4
  const padding = 1
  const d = r + padding           // half-side of the square
  const cl = (2 * d) / 3         // corner arm length = 1/3 of full side

  const chartLeft = left ?? 0
  const chartTop = top ?? 0
  const chartWidth = width ?? 0
  const chartHeight = height ?? 0

  const s = 'rgba(248,250,252,0.65)'
  const sw = 1.2

  return (
    <g>
      {/* Corner brackets — only the outer-third of each side */}
      {/* Top-left */}
      <polyline points={`${cx - d + cl},${cy - d} ${cx - d},${cy - d} ${cx - d},${cy - d + cl}`}
        fill="none" stroke={s} strokeWidth={sw} />
      {/* Top-right */}
      <polyline points={`${cx + d - cl},${cy - d} ${cx + d},${cy - d} ${cx + d},${cy - d + cl}`}
        fill="none" stroke={s} strokeWidth={sw} />
      {/* Bottom-left */}
      <polyline points={`${cx - d + cl},${cy + d} ${cx - d},${cy + d} ${cx - d},${cy + d - cl}`}
        fill="none" stroke={s} strokeWidth={sw} />
      {/* Bottom-right */}
      <polyline points={`${cx + d - cl},${cy + d} ${cx + d},${cy + d} ${cx + d},${cy + d - cl}`}
        fill="none" stroke={s} strokeWidth={sw} />
      {/* Crosshair lines from mid-sides outwards */}
      <line x1={cx} y1={cy - d} x2={cx} y2={chartTop}               stroke={s} strokeWidth={sw} strokeDasharray="3 3" />
      <line x1={cx} y1={cy + d} x2={cx} y2={chartTop + chartHeight}  stroke={s} strokeWidth={sw} strokeDasharray="3 3" />
      <line x1={cx - d} y1={cy} x2={chartLeft}              y2={cy}  stroke={s} strokeWidth={sw} strokeDasharray="3 3" />
      <line x1={cx + d} y1={cy} x2={chartLeft + chartWidth} y2={cy}  stroke={s} strokeWidth={sw} strokeDasharray="3 3" />
    </g>
  )
}

// ── Momentum Bubble: X = star delta, Y = total stars (log), size = impact score ───
function ChartMomentum({ repos, onFilter }: { repos: TrendingRepo[]; onFilter: OnFilter }) {
  const data = repos
    .filter(r => r.stars > 0 && r.star_delta > 0)
    .map(r => ({
      x:     r.star_delta,
      y:     r.stars,
      z:     Math.max(r.impact_score * 12, 30),
      name:  r.name,
      lang:  r.language,
      delta: r.star_delta,
      stars: r.stars,
      score: r.impact_score,
    }))

  return (
    <ResponsiveContainer width="100%" height={ch(340, 240)}>
      <ScatterChart margin={{ top: 16, right: 20, bottom: ch(40, 28), left: ch(56, 36) }}>
        <CartesianGrid {...GR} />
        <XAxis
          dataKey="x" type="number" name="+Stars this week"
          tickFormatter={fmtK} tick={{ fill: '#888', fontSize: 11 }}
          label={{ value: '＋Stars this week', position: 'insideBottom', offset: -16, fill: '#666', fontSize: 11 }}
        />
        <YAxis
          dataKey="y" type="number" name="Total Stars" scale="log" domain={['auto', 'auto']}
          tickFormatter={fmtK} tick={{ fill: '#888', fontSize: 11 }}
          label={{ value: 'Total Stars (log)', angle: -90, position: 'insideLeft', offset: 14, fill: '#666', fontSize: 11 }}
        />
        <ZAxis dataKey="z" range={[30, 500]} />
        <Tooltip cursor={<CustomCrosshairCursor />}
          content={({ payload }) => {
            if (!payload?.length || isMobile()) return null
            const repo = repos.find(r => r.name === payload[0].payload.name)
            if (!repo) return null
            return (
              <div style={{ width: 300, pointerEvents: 'none' }}>
                <RepoCard repo={repo} />
              </div>
            )
          }}
        />
        <Scatter data={data}
          shape={(props: any) => {
            const { cx, cy, lang, name } = props
            const r = Math.sqrt(props.r ?? 14)
            const color = langColor(lang ?? '')
            return (
              <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.75}
                stroke={color} strokeOpacity={1} strokeWidth={1.5}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  const found = repos.filter(repo => repo.name === name)
                  if (found.length) onFilter(name, found)
                }}
              />
            )
          }}
        />
      </ScatterChart>
    </ResponsiveContainer>
  )
}


function ChartBar({ repos, onFilter }: { repos: TrendingRepo[]; onFilter: OnFilter }) {
  const { t } = useTranslation()
  const data = [...repos]
    .sort((a, b) => b.star_delta - a.star_delta)
    .slice(0, 12)
    .map(r => ({ name: r.name.split('/')[1] ?? r.name, fullName: r.name, delta: r.star_delta, tier: getTier(r) }))
    .reverse()
  return (
    <ResponsiveContainer width="100%" height={ch(300, 220)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid {...GR} horizontal={false} />
        <XAxis type="number" tickFormatter={fmtK} tick={{ fill: '#888', fontSize: 11 }} />
        <YAxis type="category" dataKey="name" tick={{ fill: '#ccc', fontSize: 11 }} width={168} />
        <Tooltip formatter={(v: any) => [`+${fmtK(Number(v))}`, 'Star Delta']} contentStyle={TT} cursor={false} />
        <Bar dataKey="delta" radius={[0, 4, 4, 0]} style={{ cursor: 'pointer' }}
          onClick={(d: any) => {
            const found = repos.filter(r => r.name === d.fullName)
            if (found.length) onFilter(d.fullName, found)
          }}>
          {data.map((d, i) => <Cell key={i} fill={d.tier ? TIER_COLORS[d.tier as Tier] : '#4b5563'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function ChartDonut({ repos, onFilter }: { repos: TrendingRepo[]; onFilter: OnFilter }) {
  const { t } = useTranslation()
  const buckets = [
    { name: '<100',    min: 0,    max: 99,       color: '#64748b' },
    { name: '100–500', min: 100,  max: 499,      color: '#0ea5e9' },
    { name: '500–2k',  min: 500,  max: 1999,     color: '#10b981' },
    { name: '2k+',     min: 2000, max: Infinity, color: '#f59e0b' },
  ]
  
  const data = buckets.map(b => {
    const bucketRepos = repos.filter(r => r.star_delta >= b.min && r.star_delta <= b.max)
    return {
      ...b,
      count: bucketRepos.length,
      starDeltaSum: bucketRepos.reduce((sum, r) => sum + r.star_delta, 0),
      starsSum: bucketRepos.reduce((sum, r) => sum + r.stars, 0),
    }
  }).filter(d => d.count > 0)

  const totalCount = data.reduce((sum, d) => sum + d.count, 0)
  const totalStars = data.reduce((sum, d) => sum + d.starsSum, 0)
  const maxStarDelta = Math.max(...data.map(d => d.starDeltaSum), 1)
  const maxStars = Math.max(...data.map(d => d.starsSum), 1)

  // Format data for Standard Donut (Angle = Repos count)
  const donutData = data.map(d => ({
    ...d,
    name: `${d.name} (${((d.count / totalCount) * 100).toFixed(0)}%)`
  }))

  // Format data for Nightingale Rose (Radius = Stars)
  const roseData = data.map(d => ({
    ...d,
    name: `${d.name} (★${fmtK(d.starsSum)} - ${((d.starsSum / totalStars) * 100).toFixed(0)}%)`
  }))

  // Nightingale parameters (stacked radially)
  const innerR1 = ch(25, 10)
  const maxOuterR1 = ch(65, 30) // Inner layer max outer radius
  const maxOuterR2 = ch(105, 48) // Outer layer max outer radius

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    if (percent < 0.05) return null
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  const renderInnerRose = (props: any) => {
    const { cx, cy, startAngle, endAngle, fill, payload } = props
    const outerR = innerR1 + Math.sqrt(payload.starDeltaSum / maxStarDelta) * (maxOuterR1 - innerR1)
    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerR1}
        outerRadius={outerR}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        fillOpacity={0.85}
        stroke="none"
      />
    )
  }

  const renderOuterRose = (props: any) => {
    const { cx, cy, startAngle, endAngle, fill, payload } = props
    // Starts exactly at the end of the inner rose (no gap)
    const outerR1 = innerR1 + Math.sqrt(payload.starDeltaSum / maxStarDelta) * (maxOuterR1 - innerR1)
    const outerR2 = outerR1 + Math.sqrt(payload.starsSum / maxStars) * (maxOuterR2 - outerR1)
    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerR1}
        outerRadius={outerR2}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        fillOpacity={0.4}
        stroke="none"
      />
    )
  }

  const chartHeight = ch(270, 200)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
      {/* 1. Standard Donut (Angle = Repos count) */}
      <div style={{ flex: '1 1 280px', minWidth: 0 }}>
        <div style={{ fontSize: 11, color: '#888', textAlign: 'center', marginBottom: 4 }}>
          Tỷ lệ số lượng Repositories (theo góc)
        </div>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Pie
              data={donutData}
              cx="50%"
              cy={isMobile() ? "40%" : "45%"}
              innerRadius={0}
              outerRadius={ch(75, 42)}
              paddingAngle={0}
              stroke="none"
              dataKey="count"
              label={renderCustomLabel}
              labelLine={false}
              style={{ cursor: 'pointer' }}
              onClick={(d: any) => {
                const found = repos.filter(r => r.star_delta >= d.min && r.star_delta <= d.max)
                onFilter(`+${d.name} stars`, found)
              }}
            >
              {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip
              formatter={(v: any) => [`${v} repos`, 'Volume']}
              contentStyle={TT}
              cursor={false}
            />
            <Legend
              iconSize={8}
              iconType="circle"
              verticalAlign="bottom"
              height={36}
              wrapperStyle={{ fontSize: isMobile() ? 9 : 11, color: '#aaa' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 2. Nightingale Rose (Radii = Star Delta / Total Stars) */}
      <div style={{ flex: '1 1 280px', minWidth: 0 }}>

        <div style={{ fontSize: 11, color: '#888', textAlign: 'center', marginBottom: 4 }}>
          Tăng trưởng & Tích lũy Stars (độ dài cánh hoa)
        </div>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            {/* Outer: Total Stars */}
            <Pie
              data={roseData.map(d => ({ ...d, value: 1 }))}
              cx="50%"
              cy={isMobile() ? "40%" : "45%"}
              dataKey="value"
              shape={renderOuterRose}
              style={{ cursor: 'pointer' }}
              onClick={(d: any) => {
                const found = repos.filter(r => r.star_delta >= d.min && r.star_delta <= d.max)
                onFilter(`+${d.name} stars`, found)
              }}
            >
              {roseData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>

            {/* Inner: Weekly Star Delta */}
            <Pie
              data={roseData.map(d => ({ ...d, value: 1 }))}
              cx="50%"
              cy={isMobile() ? "40%" : "45%"}
              dataKey="value"
              shape={renderInnerRose}
              legendType="none"
              style={{ cursor: 'pointer' }}
              onClick={(d: any) => {
                const found = repos.filter(r => r.star_delta >= d.min && r.star_delta <= d.max)
                onFilter(`+${d.name} stars`, found)
              }}
            >
              {roseData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                return (
                  <div style={{ ...TT, padding: '8px 12px', lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 700, color: d.color, marginBottom: 4 }}>Nhóm {d.name} stars/tuần</div>
                    <div>Tăng thêm (Inner): <span style={{ color: '#cccccc', fontWeight: 600 }}>+{fmtK(d.starDeltaSum)} ★</span></div>
                    <div>Tích lũy (Outer): <span style={{ color: '#aaaaaa', fontWeight: 600 }}>{fmtK(d.starsSum)} ★</span></div>
                  </div>
                )
              }}
            />
            <Legend
              iconSize={8}
              iconType="circle"
              verticalAlign="bottom"
              height={36}
              wrapperStyle={{ fontSize: isMobile() ? 9 : 11, color: '#aaa' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ChartHistogram({ repos, onFilter }: { repos: TrendingRepo[]; onFilter: OnFilter }) {
  const { t } = useTranslation()
  const buckets = [
    { name: '1–3',     min: 1, max: 3,  filter: (r: TrendingRepo) => r.impact_score >= 1 && r.impact_score <= 3,  color: '#64748b' },
    { name: '4–6',     min: 4, max: 6,  filter: (r: TrendingRepo) => r.impact_score >= 4 && r.impact_score <= 6,  color: '#0ea5e9' },
    { name: '7–8',     min: 7, max: 8,  filter: (r: TrendingRepo) => r.impact_score >= 7 && r.impact_score <= 8,  color: '#10b981' },
    { name: '9–10',    min: 9, max: 10, filter: (r: TrendingRepo) => r.impact_score >= 9,                          color: '#f59e0b' },
    { name: 'Pending', min: 0, max: 0,  filter: (r: TrendingRepo) => r.impact_score === 0,                         color: '#374151' },
  ]
  const data = buckets.map(b => ({ name: b.name, color: b.color, count: repos.filter(b.filter).length, filter: b.filter }))
  return (
    <ResponsiveContainer width="100%" height={ch(260, 200)}>
      <BarChart data={data} margin={{ top: 12, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid {...GR} />
        <XAxis dataKey="name" tick={{ fill: '#ccc', fontSize: 12 }} />
        <YAxis tick={{ fill: '#888', fontSize: 11 }} />
        <Tooltip formatter={(v: any) => [v, 'Repos']} contentStyle={TT} cursor={false} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} style={{ cursor: 'pointer' }}
          onClick={(d: any) => {
            const found = repos.filter(d.filter)
            onFilter(`${t('charts.impact_dist')} ${d.name}`, found)
          }}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function ChartLang({ repos, onFilter }: { repos: TrendingRepo[]; onFilter: OnFilter }) {
  const map = new Map<string, { count: number; total: number }>()
  repos.forEach(r => {
    if (!r.language) return
    const e = map.get(r.language) ?? { count: 0, total: 0 }
    e.count++; e.total += r.impact_score
    map.set(r.language, e)
  })
  const data = [...map.entries()]
    .map(([lang, { count, total }]) => ({ lang, count, avg: +(total / count).toFixed(1) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .reverse()
  return (
    <ResponsiveContainer width="100%" height={ch(300, 220)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: ch(76, 60) }}>
        <CartesianGrid {...GR} horizontal={false} />
        <XAxis type="number" tick={{ fill: '#888', fontSize: 11 }} />
        <YAxis type="category" dataKey="lang" tick={{ fill: '#ccc', fontSize: 11 }} width={72} />
        <Tooltip contentStyle={TT} cursor={false}
          formatter={(v: any, name: any) => [name === 'count' ? `${v} repos` : `${v}/10`, name === 'count' ? 'Repos' : 'Avg Impact']} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} style={{ cursor: 'pointer' }}
          onClick={(d: any) => onFilter(d.lang, repos.filter(r => r.language === d.lang))}>
          {data.map((d, i) => <Cell key={i} fill={langColor(d.lang)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function ChartLines({ repos, history, loading, onFilter }: { repos: TrendingRepo[]; history: Map<string, StarPoint[]>; loading: boolean; onFilter: OnFilter }) {
  const top = useMemo(() => [...repos].sort((a, b) => b.star_delta - a.star_delta).slice(0, 5), [repos])
  const allDates = useMemo(() => {
    const s = new Set<string>()
    top.forEach(r => (history.get(r.id) ?? []).forEach(p => s.add(p.sampled_at.slice(0, 10))))
    return [...s].sort()
  }, [top, history])

  // Normalize: show star gain since first recorded snapshot per repo
  const baseline = useMemo(() => {
    const b: Record<string, number> = {}
    top.forEach(r => {
      const pts = (history.get(r.id) ?? []).sort((a, b2) => a.sampled_at.localeCompare(b2.sampled_at))
      if (pts.length) b[r.name] = pts[0].stars
    })
    return b
  }, [top, history])

  const { t } = useTranslation()
  if (loading) return <div className="tc-empty">{t('charts.loading_history')}</div>
  if (!allDates.length) return <div className="tc-empty">{t('charts.no_history')}</div>

  const data = allDates.map(d => {
    const row: Record<string, any> = { date: d }
    top.forEach(r => {
      const pt = (history.get(r.id) ?? []).find(p => p.sampled_at.slice(0, 10) === d)
      const base = baseline[r.name] ?? 0
      if (pt) row[r.name] = pt.stars - base
    })
    return row
  })
  const COLORS = ['#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#f43f5e']
  return (
    <ResponsiveContainer width="100%" height={ch(300, 200)}>
      <LineChart data={data} margin={{ top: 10, right: 8, bottom: 16, left: ch(40, 28) }}>
        <CartesianGrid {...GR} />
        <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 10 }} />
        <YAxis tickFormatter={fmtK} tick={{ fill: '#888', fontSize: 11 }} />
        <Tooltip contentStyle={TT} formatter={(v: any) => [`+${fmtK(Number(v))} stars`, '']} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#aaa' }} />
        {top.map((r, i) => (
          <Line key={r.id} type="monotone" dataKey={r.name}
            stroke={COLORS[i]} strokeWidth={2} dot={false} connectNulls
            activeDot={{ r: 5, style: { cursor: 'pointer' }, onClick: () => onFilter(r.name, [r]) } as any}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function ChartSlope({ repos, history, loading, onFilter }: { repos: TrendingRepo[]; history: Map<string, StarPoint[]>; loading: boolean; onFilter: OnFilter }) {
  const data = useMemo(() => {
    return [...repos]
      .sort((a, b) => b.star_delta - a.star_delta)
      .slice(0, 12)
      .map(r => {
        const pts = [...(history.get(r.id) ?? [])].sort((a, b) => a.sampled_at.localeCompare(b.sampled_at))
        if (pts.length < 2) return null
        return { name: r.name.split('/')[1] ?? r.name, fullName: r.name, delta: pts[pts.length - 1].stars - pts[0].stars }
      })
      .filter((x): x is { name: string; fullName: string; delta: number } => x !== null)
      .sort((a, b) => b.delta - a.delta)
  }, [repos, history])

  const { t } = useTranslation()
  if (loading) return <div className="tc-empty">{t('charts.loading_history')}</div>
  if (!data.length) return <div className="tc-empty">{t('charts.no_history')}</div>

  return (
    <ResponsiveContainer width="100%" height={ch(300, 220)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: ch(48, 16), bottom: 4, left: 4 }}>
        <CartesianGrid {...GR} horizontal={false} />
        <XAxis type="number" tickFormatter={fmtK} tick={{ fill: '#888', fontSize: 11 }} />
        <YAxis type="category" dataKey="name" tick={{ fill: '#ccc', fontSize: 11 }} width={168} />
        <Tooltip formatter={(v: any) => [`+${fmtK(Number(v))}`, 'Net Growth']} contentStyle={TT} cursor={false} />
        <Bar dataKey="delta" radius={[0, 4, 4, 0]} style={{ cursor: 'pointer' }}
          onClick={(d: any) => {
            const found = repos.filter(r => r.name === d.fullName)
            if (found.length) onFilter(d.fullName, found)
          }}>
          {data.map((d, i) => <Cell key={i} fill={d.delta >= 0 ? '#cccccc' : '#555555'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function ChartTopics({ repos, prevRepos = [], onFilter }: { repos: TrendingRepo[]; prevRepos?: TrendingRepo[]; onFilter: OnFilter }) {
  const [hovered, setHovered] = useState<number | null>(null)

  const data = useMemo(() => {
    const freq = new Map<string, number>()
    repos.forEach(r => r.topics.forEach(t => freq.set(t, (freq.get(t) ?? 0) + 1)))
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([name, size]) => ({ name, size }))
  }, [repos])

  const total = useMemo(() => data.reduce((s, d) => s + d.size, 0), [data])

  const prevFreq = useMemo(() => {
    const freq = new Map<string, number>()
    prevRepos.forEach(r => r.topics.forEach(t => freq.set(t, (freq.get(t) ?? 0) + 1)))
    return freq
  }, [prevRepos])

  const prevTotal = useMemo(() => Array.from(prevFreq.values()).reduce((s, v) => s + v, 0), [prevFreq])

  const { t } = useTranslation()
  if (data.length < 5) return <div className="tc-empty">{t('charts.no_topics')}</div>

  const COLORS = ['#0ea5e9', '#10b981', '#8b5cf6', '#f59e0b', '#f43f5e', '#64748b', '#94a3b8', '#475569']
  return (
    <ResponsiveContainer width="100%" height={ch(280, 220)}>
      <Treemap data={data} dataKey="size" aspectRatio={isMobile() ? 4 / 3 : 16 / 5}
        content={(props: any) => {
          const { x, y, width, height, name, size, index, depth } = props
          if (depth !== 1 || !name || !width || !height || width < 4 || height < 4) return null
          
          const pctVal = total > 0 ? (size / total) * 100 : 0
          const pct = `${pctVal.toFixed(0)}%`
          
          const hasDelta = prevRepos && prevRepos.length > 0
          let deltaSize = 0
          let deltaPct = 0
          if (hasDelta) {
            const prevSize = prevFreq.get(name) ?? 0
            deltaSize = size - prevSize
            const prevPctVal = prevTotal > 0 ? (prevSize / prevTotal) * 100 : 0
            deltaPct = pctVal - prevPctVal
          }

          const color = COLORS[index % COLORS.length]

          const isHovered = hovered === index
          const nameFontSize = Math.min(12, Math.floor(width / Math.max(name.length, 1) * 1.5))
          const canShow = width > 45 && height > 18 && nameFontSize >= 8

          return (
            <g
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onFilter(`#${name}`, repos.filter(r => r.topics.includes(name)))}
              style={{ cursor: 'pointer' }}
            >
              <rect x={x} y={y} width={width} height={height}
                fill={color}
                fillOpacity={isHovered ? 0.85 : 0.65}
                stroke="rgba(0,0,0,.25)" strokeWidth={1}
                style={{ transition: 'fill-opacity 0.2s' }}
              />
              {canShow && (
                <>
                  <text
                    x={x + width / 2} y={y + height / 2 - (height > 36 ? 7 : 0)}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={nameFontSize} fontWeight={700} fill="#fff" fillOpacity={0.9}
                    style={{ pointerEvents: 'none' }}
                  >{name}</text>
                  
                  {height > 36 && (
                    <>
                      <text className="tc-flip-text"
                        x={x + width / 2} y={y + height / 2 + 10}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize={10} fill="#fff"
                        style={{ opacity: isHovered ? 0 : 0.75, transform: isHovered ? 'scaleX(0)' : 'scaleX(1)' }}
                      >
                        <tspan fill="#fff">{pct}</tspan>
                        {hasDelta && (
                          <tspan fill={deltaPct > 0 ? '#cccccc' : (deltaPct < 0 ? '#666666' : '#aaaaaa')} dx={4} fontWeight="bold">
                            ({deltaPct > 0 ? '+' : (deltaPct < 0 ? '' : '+')}{deltaPct.toFixed(0)}%)
                          </tspan>
                        )}
                      </text>
                      
                      <text className="tc-flip-text"
                        x={x + width / 2} y={y + height / 2 + 10}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize={10} fill="#fff"
                        style={{ opacity: isHovered ? 0.85 : 0, transform: isHovered ? 'scaleX(1)' : 'scaleX(0)' }}
                      >
                        <tspan fill="#fff">{size} repos</tspan>
                        {hasDelta && (
                          <tspan fill={deltaSize > 0 ? '#cccccc' : (deltaSize < 0 ? '#666666' : '#aaaaaa')} dx={4} fontWeight="bold">
                            ({deltaSize > 0 ? '+' : (deltaSize < 0 ? '' : '+')}{deltaSize})
                          </tspan>
                        )}
                      </text>
                    </>
                  )}
                </>
              )}
            </g>
          )
        }}
      />
    </ResponsiveContainer>
  )
}

function ChartHeatmap({ repos, onFilter }: { repos: TrendingRepo[]; onFilter: OnFilter }) {
  const tiers: Tier[] = ['transformative', 'significant', 'incremental', 'niche']
  const langMap = useMemo(() => {
    const m = new Map<string, number>()
    repos.forEach(r => { if (r.language) m.set(r.language, (m.get(r.language) ?? 0) + 1) })
    return m
  }, [repos])
  const langs = [...langMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([l]) => l)

  const grid = useMemo(() => {
    const g: Record<string, Record<string, number>> = {}
    langs.forEach(l => { g[l] = {} })
    repos.forEach(r => {
      const tier = getTier(r)
      if (!tier || !r.language || !g[r.language]) return
      g[r.language][tier] = (g[r.language][tier] ?? 0) + 1
    })
    return g
  }, [repos, langs])

  const maxVal = Math.max(1, ...langs.flatMap(l => tiers.map(tier => grid[l]?.[tier] ?? 0)))
  const { t } = useTranslation()
  if (!langs.length) return <div className="tc-empty">{t('charts.not_enough_data')}</div>

  return (
    <div className="tc-heatmap">
      <table>
        <thead>
          <tr>
            <th />
            {tiers.map(tier => <th key={tier} style={{ color: TIER_COLORS[tier] }}>{t(`trending.tiers.${tier}`)}</th>)}
          </tr>
        </thead>
        <tbody>
          {langs.map(lang => (
            <tr key={lang}>
              <td className="tc-heatmap-lang" style={{ color: langColor(lang), cursor: 'pointer' }}
                onClick={() => onFilter(lang, repos.filter(r => r.language === lang))}>
                {lang}
              </td>
              {tiers.map(tier => {
                const v = grid[lang]?.[tier] ?? 0
                const alpha = v === 0 ? 0 : Math.round((0.12 + (v / maxVal) * 0.75) * 255).toString(16).padStart(2, '0')
                return (
                  <td key={tier} style={{
                    background: v === 0 ? 'rgba(255,255,255,.03)' : `${TIER_COLORS[tier]}${alpha}`,
                    color: v === 0 ? '#3a3a3a' : '#fff',
                    cursor: v > 0 ? 'pointer' : 'default',
                  }}
                    onClick={() => {
                      if (v > 0) onFilter(
                        `${lang} × ${t(`trending.tiers.${tier}`)}`,
                        repos.filter(r => r.language === lang && getTier(r) === tier)
                      )
                    }}
                  >{v || '—'}</td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Single-repo popup ─────────────────────────────────────────────────────────

function RepoPopup({ repo, onClose }: { repo: TrendingRepo; onClose: () => void }) {
  return (
    <>
      <div className="tc-backdrop" onClick={onClose} />
      <div className="tc-repo-popup">
        <button className="tc-drawer-close" onClick={onClose}>✕</button>
        <RepoCard repo={repo} />
      </div>
    </>
  )
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function RepoDrawer({ title, filtered, onClose }: { title: string; filtered: TrendingRepo[]; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <div className="tc-backdrop" onClick={onClose} />
      <div className="tc-drawer">
        <div className="tc-drawer-header">
          <span style={{ fontWeight: 700 }}>{filtered.length} repos · {title}</span>
          <button className="tc-drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="tc-drawer-list">
          {filtered.map(r => <RepoCard key={r.id} repo={r} />)}
        </div>
        <div className="tc-drawer-footer">{t('trending.ai_disclaimer')}</div>
      </div>
    </>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function TrendingChartMode({ repos, prevRepos = [] }: { repos: TrendingRepo[]; prevRepos?: TrendingRepo[] }) {
  const { t } = useTranslation()
  const [drawer, setDrawer] = useState<DrawerState | null>(null)
  const [selectedRepo, setSelectedRepo] = useState<TrendingRepo | null>(null)
  const [history, setHistory] = useState<Map<string, StarPoint[]>>(new Map())
  const [historyLoading, setHistoryLoading] = useState(false)

  const openDrawer: OnFilter = (title, repos) => {
    if (repos.length === 1) { setSelectedRepo(repos[0]); return }
    setDrawer({ title, repos })
  }

  const tierCounts = useMemo(() => {
    const c = { transformative: 0, significant: 0, incremental: 0, niche: 0 } as Record<Tier, number>
    repos.forEach(r => { const tier = getTier(r); if (tier) c[tier]++ })
    return c
  }, [repos])

  useEffect(() => {
    if (!repos.length) return
    const top = [...repos].sort((a, b) => b.star_delta - a.star_delta).slice(0, 5)
    const missing = top.filter(r => !history.has(r.id))
    if (!missing.length) return
    setHistoryLoading(true)
    Promise.all(missing.map(r => fetchTrendingHistory(r.id).then(pts => [r.id, pts] as [string, StarPoint[]])))
      .then(results => setHistory(prev => {
        const next = new Map(prev)
        results.forEach(([id, pts]) => next.set(id, pts))
        return next
      }))
      .finally(() => setHistoryLoading(false))
  }, [repos])

  useEffect(() => {
    const handleClickChip = (e: Event) => {
      const customEvent = e as CustomEvent
      const tier = customEvent.detail
      openDrawer(t(`trending.tiers.${tier}`), repos.filter(r => getTier(r) === tier))
    }
    window.addEventListener('trending-click-chip', handleClickChip)
    return () => {
      window.removeEventListener('trending-click-chip', handleClickChip)
    }
  }, [repos])

  return (
    <div className="tc-root">
      {/* Dashboard grid */}
      <div className="tc-dashboard">
        <Section title="Momentum Bubble · ＋Stars vs Total Stars" full>
          <ChartMomentum repos={repos} onFilter={openDrawer} />
        </Section>

        <Section title={t('charts.top_star_gains')}>
          <ChartBar repos={repos} onFilter={openDrawer} />
        </Section>

        <Section title={t('charts.languages')}>
          <ChartLang repos={repos} onFilter={openDrawer} />
        </Section>

        <Section title={t('charts.star_delta_dist')} full>
          <ChartDonut repos={repos} onFilter={openDrawer} />
        </Section>

        <Section title={t('charts.impact_dist')} full>
          <ChartHistogram repos={repos} onFilter={openDrawer} />
        </Section>

        <Section title={t('charts.growth_lines')} full>
          <ChartLines repos={repos} history={history} loading={historyLoading} onFilter={openDrawer} />
        </Section>

        <Section title={t('charts.net_velocity')}>
          <ChartSlope repos={repos} history={history} loading={historyLoading} onFilter={openDrawer} />
        </Section>

        <Section title={t('charts.topics')}>
          <ChartTopics repos={repos} prevRepos={prevRepos} onFilter={openDrawer} />
        </Section>

        <Section title={t('charts.impact_lang')} full>
          <ChartHeatmap repos={repos} onFilter={openDrawer} />
        </Section>
      </div>

      {drawer && (
        <RepoDrawer title={drawer.title} filtered={drawer.repos} onClose={() => setDrawer(null)} />
      )}
      {selectedRepo && (
        <RepoPopup repo={selectedRepo} onClose={() => setSelectedRepo(null)} />
      )}
    </div>
  )
}
