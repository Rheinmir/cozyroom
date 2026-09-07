import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import { imgSrc, fetchPlayStats, fetchLastfmStatus, backfillLastfmPlayCounts, fetchLastfmBackfillStatus, fetchMusicInsight } from '../api'
import type { LastfmBackfillStatus } from '../api'
import Spinner from '../components/Spinner'

const ACCENT = 'var(--green)'

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.6, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      {children}
    </div>
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

  return (
    <div className="stats-page-body">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, margin: 0 }}>Số liệu nghe nhạc</h2>
        <button
          onClick={handleBackfill}
          disabled={!lastfmConnected || backfill?.running}
          title={lastfmConnected ? '' : 'Chưa kết nối Last.fm'}
          style={{
            marginLeft: 'auto', padding: '4px 14px', borderRadius: 6, border: 'none', cursor: lastfmConnected ? 'pointer' : 'not-allowed',
            fontSize: 12, background: ACCENT, color: '#000', fontWeight: 600,
            opacity: !lastfmConnected || backfill?.running ? 0.5 : 1,
          }}
        >
          {backfill?.running ? `Đang đồng bộ… ${backfill.done}/${backfill.total}` : 'Đồng bộ Last.fm'}
        </button>
      </div>

      {backfillError && <p style={{ color: 'var(--chart-fail)', fontSize: 12, marginBottom: 12 }}>{backfillError}</p>}

      {statsQuery.isLoading ? (
        <div style={{ opacity: 0.5, fontSize: 13 }}><Spinner size={18} label="Đang tải…" /></div>
      ) : top.length === 0 ? (
        <p style={{ opacity: 0.5, fontSize: 13 }}>
          Chưa có dữ liệu — nghe vài bài (đủ 30s trở lên) rồi quay lại đây.
        </p>
      ) : (
        <>
          {/* Hero figure — the one headline number this page leads with */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 2 }}>Lượt nghe trong 30 ngày qua</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 700, fontVariantNumeric: 'proportional-nums', lineHeight: 1.1 }}>
              {totalRecent.toLocaleString('vi-VN')}
            </div>
          </div>

          {/* AI-written narrative — a nice-to-have flourish, never load-bearing */}
          {insight === null ? (
            <p style={{ opacity: 0.35, fontSize: 13, marginBottom: 20 }}>Đang tạo nhận xét…</p>
          ) : insight ? (
            <p style={{
              fontSize: 14, fontStyle: 'italic', opacity: 0.85, marginBottom: 20,
              borderLeft: `2px solid ${ACCENT}`, paddingLeft: 12,
            }}>
              "{insight}"
            </p>
          ) : null}

          {/* Spotlight — the #1 track, told as a fact rather than buried in the chart */}
          {topTrack && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)',
              borderRadius: 10, padding: '14px 16px', marginBottom: 20,
            }}>
              {topTrack.cover_url ? (
                <img src={imgSrc(topTrack.cover_url, 80)} alt={topTrack.album_title}
                  style={{ width: 56, height: 56, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 6, background: 'var(--elevated)', flexShrink: 0 }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bài hát bạn nghe nhiều nhất</div>
                <div style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{topTrack.title}</div>
                <div style={{ fontSize: 13, opacity: 0.6 }}>{topTrack.artist_name}</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, fontVariantNumeric: 'proportional-nums', color: ACCENT }}>{topTrack.plays}</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>lượt nghe</div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(400px, 100%), 1fr))', gap: 14 }}>
            <ChartCard title="Top 10 bài nghe nhiều nhất">
              <ResponsiveContainer width="100%" height={Math.max(120, top.length * 32)}>
                <BarChart data={top} layout="vertical" margin={{ top: 0, right: 28, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="title" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip
                    cursor={{ fill: 'var(--surface-hover)' }}
                    contentStyle={{ background: 'var(--elevated)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}
                    formatter={(val, _name, item) => [`${val} lượt`, item.payload.artist_name]}
                  />
                  <Bar dataKey="plays" fill="var(--chart-1)" radius={[0, 999, 999, 0]} barSize={14} maxBarSize={24}>
                    <LabelList dataKey="plays" position="right" style={{ fontSize: 10, fill: 'var(--text)', opacity: 0.7 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Lượt nghe theo ngày (30 ngày, local)">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={daily} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'var(--elevated)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }} />
                  <Line type="monotone" dataKey="plays" stroke="var(--chart-1)" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  )
}
