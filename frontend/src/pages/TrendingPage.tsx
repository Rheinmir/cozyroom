import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { fetchTrending, fetchTrendingDates, triggerTrendingRefresh } from '../api'
import TrendingChartMode from './TrendingChartMode'
import { RepoCard, getTier } from '../components/TrendingRepoCard'
import Spinner from '../components/Spinner'

export default function TrendingPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [mode, setMode] = useState<'chart' | 'grid'>(
    () => (localStorage.getItem('trending-view-mode') as 'chart' | 'grid') ?? 'chart'
  )

  const { data: dates = [] } = useQuery({
    queryKey: ['trending-dates'],
    queryFn: fetchTrendingDates,
    staleTime: 5 * 60_000,
  })

  // Default to the newest date once the date list is known (mirrors old mount-only default)
  useEffect(() => {
    if (!selectedDate && dates.length > 0) setSelectedDate(dates[0])
  }, [dates, selectedDate])

  const { data: repos = [], isLoading: loading } = useQuery({
    queryKey: ['trending-repos', selectedDate],
    queryFn: () => fetchTrending(selectedDate || undefined),
    staleTime: 5 * 60_000,
  })

  const currentIndex = dates.indexOf(selectedDate || '')
  const prevDate = currentIndex >= 0 && currentIndex + 1 < dates.length ? dates[currentIndex + 1] : null

  const { data: prevRepos = [] } = useQuery({
    queryKey: ['trending-repos', prevDate],
    queryFn: () => fetchTrending(prevDate || undefined),
    enabled: !!prevDate,
    staleTime: 5 * 60_000,
  })

  function switchMode(m: 'chart' | 'grid') {
    setMode(m)
    localStorage.setItem('trending-view-mode', m)
  }

  const handleRefresh = () => {
    if (refreshing) return
    setRefreshing(true)
    triggerTrendingRefresh()
      .then(() => setTimeout(async () => {
        setRefreshing(false)
        await queryClient.invalidateQueries({ queryKey: ['trending-dates'] })
        const newDates = queryClient.getQueryData<string[]>(['trending-dates'])
        if (newDates && newDates.length > 0) setSelectedDate(newDates[0])
        queryClient.invalidateQueries({ queryKey: ['trending-repos'] })
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

  const champion = repos[0] ?? null
  const rest = repos.slice(1)

  return (
    <div className="page">
      <div className="trending-header">
        <h1 className="trending-title">{t('trending.title')}</h1>
      </div>

      {loading ? (
        <div className="loading"><Spinner size={28} label={t('library.loading')} /></div>
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
