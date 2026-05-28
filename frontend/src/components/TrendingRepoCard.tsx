import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchTrendingHistory } from '../api'
import type { TrendingRepo, StarPoint } from '../api'

type Tier = 'transformative' | 'significant' | 'incremental' | 'niche' | ''

export function getTier(repo: TrendingRepo): Tier {
  if (repo.impact_label === 'transformative' || repo.impact_label === 'significant' ||
      repo.impact_label === 'incremental'    || repo.impact_label === 'niche') {
    return repo.impact_label as Tier
  }
  if (repo.impact_score >= 8) return 'transformative'
  if (repo.impact_score >= 6) return 'significant'
  if (repo.impact_score >= 4) return 'incremental'
  if (repo.impact_score >= 1) return 'niche'
  return ''
}

export const TIER_META: Record<string, { badge: string; label: string }> = {
  transformative: { badge: '🔥', label: 'Transformative' },
  significant:    { badge: '⚡', label: 'Significant' },
  incremental:    { badge: '📈', label: 'Incremental' },
  niche:          { badge: '🔬', label: 'Niche' },
}

export function Sparkline({ repoId, large }: { repoId: string; large?: boolean }) {
  const [points, setPoints] = useState<StarPoint[]>([])

  useEffect(() => {
    fetchTrendingHistory(repoId).then(setPoints).catch(() => {})
  }, [repoId])

  if (points.length < 2) return null

  const stars = points.map(p => p.stars)
  const min = Math.min(...stars)
  const max = Math.max(...stars)
  const range = max - min || 1
  const W = large ? 140 : 80
  const H = large ? 40 : 24

  const pts = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * W
      const y = H - ((p.stars - min) / range) * (H - 2) - 1
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg width={W} height={H} style={{ overflow: 'visible', flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke="var(--green)" strokeWidth={large ? 2 : 1.5} strokeLinejoin="round" />
    </svg>
  )
}

export function RepoCard({ repo, hero }: { repo: TrendingRepo; hero?: boolean }) {
  const { t } = useTranslation()
  const slash = repo.name.indexOf('/')
  const owner = slash >= 0 ? repo.name.slice(0, slash) : ''
  const repoName = slash >= 0 ? repo.name.slice(slash + 1) : repo.name
  const hasAI = repo.problem_solved || repo.tech_used || repo.simple_flow
  const tier = getTier(repo)
  const tierMeta = tier ? TIER_META[tier] : null

  return (
    <div
      className={`trending-card${hero ? ' trending-card--hero' : ''}`}
      data-tier={tier || undefined}
    >
      <div className="trending-card-header">
        <div className="trending-card-name">
          {owner && <span className="trending-card-owner">{owner}/</span>}
          <span>{repoName}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {tierMeta && (
            <span className={`tier-badge tier--${tier}`}>
              {tierMeta.badge} {tierMeta.label}
              {repo.impact_score > 0 && <span style={{ opacity: .6, marginLeft: 3 }}>{repo.impact_score}/10</span>}
            </span>
          )}
          <div className="trending-card-stars">
            ★ {repo.stars.toLocaleString()}
            {repo.star_delta > 0 && (
              <span className="trending-card-delta">+{repo.star_delta.toLocaleString()}</span>
            )}
          </div>
        </div>
      </div>

      <div className="trending-card-meta">
        {repo.language && <span className="trending-card-lang">{repo.language}</span>}
        {repo.topics.slice(0, 4).map(t2 => (
          <span key={t2} className="trending-card-topic">{t2}</span>
        ))}
      </div>

      <div className="trending-card-ai">
        {hasAI ? (
          <>
            {repo.problem_solved && (
              <div className="trending-card-ai-row">
                <span className="trending-card-ai-label">{t('trending.solved')}</span>
                <span>{repo.problem_solved}</span>
              </div>
            )}
            {repo.tech_used && (
              <div className="trending-card-ai-row">
                <span className="trending-card-ai-label">{t('trending.technology')}</span>
                <span>{repo.tech_used}</span>
              </div>
            )}
            {repo.simple_flow && (
              <div className="trending-card-ai-row">
                <span className="trending-card-ai-label">{t('trending.flow')}</span>
                <span>{repo.simple_flow}</span>
              </div>
            )}
          </>
        ) : (
          <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>{t('trending.ai_pending')}</span>
        )}
      </div>

      <div className="trending-card-footer">
        <Sparkline repoId={repo.id} large={hero} />
        <a href={repo.url} target="_blank" rel="noopener noreferrer" className="trending-card-link">
          github.com ↗
        </a>
      </div>
    </div>
  )
}
