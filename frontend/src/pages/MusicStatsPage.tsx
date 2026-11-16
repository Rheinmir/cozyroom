import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import { imgSrc, fetchPlayStats, fetchLastfmStatus, backfillLastfmPlayCounts, fetchLastfmBackfillStatus, fetchMusicInsight } from '../api'
import type { LastfmBackfillStatus } from '../api'
import Spinner from '../components/Spinner'
import { TIP, GRID, AXIS, BAR_H, TICK } from '../chartTheme'

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="stat-panel">
      <div className="stat-panel-title">{title}</div>
      {children}
    </div>
  )
}

// Y-axis label for the top-10 bar chart: ONE line, ellipsised to the axis
// width (recharts' default wraps long Vietnamese titles into 3 cramped lines).
const LABEL_W = 160
let measureCtx: CanvasRenderingContext2D | null = null
function fitText(v: string, maxPx: number): string {
  measureCtx ??= document.createElement('canvas').getContext('2d')
  if (!measureCtx) return v
  measureCtx.font = '500 12px Inter, system-ui, sans-serif'
  if (measureCtx.measureText(v).width <= maxPx) return v
  let lo = 0, hi = v.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (measureCtx.measureText(v.slice(0, mid).trimEnd() + '…').width <= maxPx) lo = mid
    else hi = mid - 1
  }
  return v.slice(0, lo).trimEnd() + '…'
}
function TitleTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const v = payload?.value ?? ''
  const text = fitText(v, LABEL_W - 14)
  return (
    <text x={(x ?? 0) - 8} y={y} dy={4} textAnchor="end" fontSize={12} fill="var(--text)">
      <title>{v}</title>{text}
    </text>
  )
}

export default function MusicStatsPage() {
  // staleTime ngắn (30s) — khác các trang danh sách tĩnh (5 phút) — vì đây là số liệu
  // "lượt nghe" tăng theo thời gian thực khi user đang nghe nhạc; cache dài sẽ làm số liệu
  // bị đứng khi quay lại tab này ngay sau khi vừa nghe xong một bài.
  const statsQuery = useQuery({ queryKey: ['music-play-stats', 30], queryFn: () => fetchPlayStats(30), staleTime: 30_000 })
  const lastfmQuery = useQuery({ queryKey: ['lastfm-status'], queryFn: fetchLastfmStatus, staleTime: 5 * 60_000, retry: false })
  const insightQuery = useQuery({ queryKey: ['music-insight'], queryFn: fetchMusicInsight, staleTime: 5 * 60_000, retry: false })

  const stats = statsQuery.data ?? null
  const lastfmConnected = lastfmQuery.data?.connected ?? false
  const insight = insightQuery.isLoading ? null : (insightQuery.data?.insight ?? '')

  const [backfill, setBackfill] = useState<LastfmBackfillStatus | null>(null)
  const [backfillError, setBackfillError] = useState('')

  // Poll backfill status while a job is running, so progress + final counts update live.
  useEffect(() => {
    if (!backfill?.running) return
    const id = setInterval(() => {
      fetchLastfmBackfillStatus().then(s => {
        setBackfill(s)
        if (!s.running) statsQuery.refetch()
      }).catch(() => {})
    }, 2000)
    return () => clearInterval(id)
  }, [backfill?.running])

  const handleBackfill = () => {
    setBackfillError('')
    backfillLastfmPlayCounts()
      .then(() => fetchLastfmBackfillStatus())
      .then(setBackfill)
      .catch(() => setBackfillError('Không đồng bộ được — kiểm tra đã kết nối Last.fm chưa.'))
  }

  const top = stats?.top ?? []
  const daily = stats?.daily ?? []
  const topTrack = top[0]
  const totalRecent = daily.reduce((s, d) => s + d.plays, 0)

  const peak = daily.reduce((m, d) => Math.max(m, d.plays), 0)
  const avg = daily.length ? Math.round(totalRecent / daily.length) : 0

  return (
    <div className="stats-page-body">
      <div className="stat-head">
        <div>
          <h1 className="stat-title">Số liệu nghe nhạc</h1>
          <p className="stat-sub">30 ngày gần nhất · tính khi bạn nghe đủ 30 giây</p>
        </div>
        <button
          className="btn-secondary"
          onClick={handleBackfill}
          disabled={!lastfmConnected || backfill?.running}
          title={lastfmConnected ? '' : 'Chưa kết nối Last.fm'}
          style={{ height: 36, padding: '0 16px 0 12px', fontSize: 13 }}
        >
          <span className="ms" style={{ fontSize: 18 }} aria-hidden>sync</span>
          {backfill?.running ? `Đang đồng bộ… ${backfill.done}/${backfill.total}` : 'Đồng bộ Last.fm'}
        </button>
      </div>

      {backfillError && <p style={{ color: 'var(--chart-fail)', fontSize: 13, marginBottom: 12 }}>{backfillError}</p>}

      {statsQuery.isLoading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}><Spinner size={18} label="Đang tải…" /></div>
      ) : top.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Chưa có dữ liệu — nghe vài bài (đủ 30s trở lên) rồi quay lại đây.
        </p>
      ) : (
        <>
          {/* Hero: the one headline number, with two supporting figures */}
          <div className="stat-grid-2" style={{ marginBottom: 12 }}>
            <div className="stat-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 18 }}>
              <div>
                <div className="stat-hero-label">Lượt nghe trong 30 ngày qua</div>
                <div className="stat-hero-value">{totalRecent.toLocaleString('vi-VN')}<span className="stat-hero-unit">lượt</span></div>
              </div>
              <div style={{ display: 'flex', gap: 28 }}>
                <div><div className="stat-tile-label">Trung bình / ngày</div><div className="stat-tile-value" style={{ fontSize: 20 }}>{avg.toLocaleString('vi-VN')}</div></div>
                <div><div className="stat-tile-label">Ngày cao nhất</div><div className="stat-tile-value" style={{ fontSize: 20 }}>{peak.toLocaleString('vi-VN')}</div></div>
              </div>
            </div>

            {/* Spotlight — the #1 track, told as a fact rather than buried in the chart */}
            {topTrack && (
              <div className="stat-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div className="stat-panel-title">Bài hát bạn nghe nhiều nhất</div>
                <div className="stat-spot">
                  {topTrack.cover_url
                    ? <img className="stat-spot-cover" src={imgSrc(topTrack.cover_url, 160)} alt={topTrack.album_title} />
                    : <div className="stat-spot-cover" />}
                  <div style={{ minWidth: 0 }}>
                    <div className="stat-spot-title">{topTrack.title}</div>
                    <div className="stat-spot-sub">{topTrack.artist_name}</div>
                  </div>
                  <div className="stat-spot-num"><b>{topTrack.plays}</b><span>lượt nghe</span></div>
                </div>
              </div>
            )}
          </div>

          {/* AI-written narrative — a nice-to-have flourish, never load-bearing */}
          {insight === null ? (
            <p style={{ color: 'var(--text-faint)', fontSize: 13, margin: '4px 0 12px' }}>Đang tạo nhận xét…</p>
          ) : insight ? (
            <div className="stat-panel stat-quote" style={{ marginBottom: 12 }}>
              {insight}
              <span className="stat-quote-by">Nhận xét bởi AI</span>
            </div>
          ) : null}

          <div className="stat-grid-2">
            <ChartCard title="Top 10 bài nghe nhiều nhất">
              <ResponsiveContainer width="100%" height={Math.max(120, top.length * 30)}>
                <BarChart data={top} layout="vertical" margin={{ top: 0, right: 32, left: 0, bottom: 0 }} barCategoryGap={8}>
                  <CartesianGrid {...GRID} horizontal={false} vertical />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="title" axisLine={false} tickLine={false} tick={<TitleTick />} width={LABEL_W} interval={0} />
                  <Tooltip
                    {...TIP}
                    formatter={(val, _name, item) => [`${val} lượt`, item.payload.artist_name]}
                  />
                  <Bar dataKey="plays" fill="var(--chart-1)" radius={BAR_H} barSize={12}>
                    <LabelList dataKey="plays" position="right" style={{ ...TICK, fill: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Lượt nghe theo ngày">
              <ResponsiveContainer width="100%" height={Math.max(220, top.length * 30)}>
                <AreaChart data={daily} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="plays-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="date" {...AXIS} interval="preserveStartEnd" minTickGap={24} tickFormatter={(d: string) => d.slice(5).split('-').reverse().join('/')} />
                  <YAxis {...AXIS} allowDecimals={false} />
                  <Tooltip {...TIP} cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '2 4' }} formatter={(v) => [`${v} lượt`, 'Lượt nghe']} />
                  <Area type="monotone" dataKey="plays" stroke="var(--chart-1)" strokeWidth={2} fill="url(#plays-fill)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--chart-1)' }} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  )
}
