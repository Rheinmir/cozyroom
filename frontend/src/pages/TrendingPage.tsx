import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchTrending, fetchTrendingDates, triggerTrendingRefresh } from '../api'
import type { TrendingRepo } from '../api'
import TrendingChartMode from './TrendingChartMode'
import { RepoCard, getTier } from '../components/TrendingRepoCard'

export default function TrendingPage() {
  const { t } = useTranslation()
  const [dates, setDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [repos, setRepos] = useState<TrendingRepo[]>([])
  const [prevRepos, setPrevRepos] = useState<TrendingRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [mode, setMode] = useState<'chart' | 'grid'>(
    () => (localStorage.getItem('trending-view-mode') as 'chart' | 'grid') ?? 'chart'
  )

  function switchMode(m: 'chart' | 'grid') {
    setMode(m)
    localStorage.setItem('trending-view-mode', m)
  }

  const handleRefresh = () => {
    if (refreshing) return
    setRefreshing(true)
    triggerTrendingRefresh()
      .then(() => setTimeout(() => {
        setRefreshing(false)
        fetchTrending(selectedDate || undefined).then(setRepos).catch(() => {})
        fetchTrendingDates().then(d => { setDates(d); if (d.length > 0) setSelectedDate(d[0]) }).catch(() => {})
      }, 8000))
      .catch(() => setRefreshing(false))
  }

  // Synchronize state down to RadialNav
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('trending-mode-changed', { detail: mode }))
  }, [mode])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('trending-refresh-status', { detail: refreshing }))
  }, [refreshing])

  // Listen to events from RadialNav
  useEffect(() => {
    const handleSetMode = (e: Event) => {
      const customEvent = e as CustomEvent
      switchMode(customEvent.detail)
    }
    const handleRefreshTrigger = () => {
      handleRefresh()
    }
    const handleSetDate = (e: Event) => {
      const customEvent = e as CustomEvent
      setSelectedDate(customEvent.detail)
    }

    window.addEventListener('trending-set-mode', handleSetMode)
    window.addEventListener('trending-refresh-trigger', handleRefreshTrigger)
    window.addEventListener('trending-set-date', handleSetDate)

    return () => {
      window.removeEventListener('trending-set-mode', handleSetMode)
      window.removeEventListener('trending-refresh-trigger', handleRefreshTrigger)
      window.removeEventListener('trending-set-date', handleSetDate)
    }
  }, [selectedDate, refreshing])

  // Compute tier counts and dispatch data to RadialNav
  useEffect(() => {
    const c = { transformative: 0, significant: 0, incremental: 0, niche: 0 }
    repos.forEach(r => {
      const tier = getTier(r)
      if (tier && tier in c) {
        c[tier as keyof typeof c]++
      }
    })

    window.dispatchEvent(
      new CustomEvent('trending-data-loaded', {
        detail: {
          dates,
          selectedDate,
          tierCounts: c,
        },
      })
    )
  }, [dates, selectedDate, repos])

  useEffect(() => {
    fetchTrendingDates()
      .then(d => {
        setDates(d)
        if (d.length > 0) setSelectedDate(d[0])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchTrending(selectedDate || undefined)
      .then(current => {
        setRepos(current)
        const currentIndex = dates.indexOf(selectedDate || '')
        const prevDate = currentIndex >= 0 && currentIndex + 1 < dates.length ? dates[currentIndex + 1] : null
        if (prevDate) {
          fetchTrending(prevDate)
            .then(setPrevRepos)
            .catch(() => setPrevRepos([]))
        } else {
          setPrevRepos([])
        }
      })
      .catch(() => {
        setRepos([])
        setPrevRepos([])
      })
      .finally(() => setLoading(false))
  }, [selectedDate, dates])

  const champion = repos[0] ?? null
  const rest = repos.slice(1)

  return (
    <div className="page">
      <div className="trending-header">
        <h1 className="trending-title">{t('trending.title')}</h1>
      </div>

      {loading ? (
        <div className="loading">{t('library.loading')}</div>
      ) : repos.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', marginTop: 40, textAlign: 'center' }}>
          {t('trending.no_data')}
        </p>
      ) : mode === 'chart' ? (
        <TrendingChartMode repos={repos} prevRepos={prevRepos} />
      ) : (
        <div className="trending-grid">
          {champion && <RepoCard repo={champion} hero />}
          {rest.map(r => <RepoCard key={r.id} repo={r} />)}
        </div>
      )}
    </div>
  )
}
