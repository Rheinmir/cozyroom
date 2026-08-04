import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlayer } from '../PlayerContext'
import { fetchLyrics, saveLyrics, bustLyricsCache, fetchLyricsTranslation } from '../api'
import type { LyricsData, SourceInfo } from '../api'

const AUTH_KEY = 'hs-lyrics-auth'
const isAuthed  = () => localStorage.getItem(AUTH_KEY) === '1'
const grantAuth = () => localStorage.setItem(AUTH_KEY, '1')

const SS = 'lyr:'
type CacheEntry = { results: LyricsData[]; sources: SourceInfo[]; beCached: boolean }
const cache = {
  has: (id: string) => sessionStorage.getItem(SS + id) !== null,
  get: (id: string): CacheEntry => {
    try {
      const e: CacheEntry = JSON.parse(sessionStorage.getItem(SS + id)!)
      if (!Array.isArray(e.results)) throw new Error()
      return e
    } catch { sessionStorage.removeItem(SS + id); return { results: [], sources: [], beCached: false } }
  },
  set: (id: string, results: LyricsData[], sources: SourceInfo[], beCached: boolean) => {
    try {
      // Evict oldest entry if at limit to prevent unbounded sessionStorage growth
      const keys = Object.keys(sessionStorage).filter(k => k.startsWith(SS))
      if (keys.length >= 200) sessionStorage.removeItem(keys[0])
      sessionStorage.setItem(SS + id, JSON.stringify({ results, sources, beCached }))
    } catch {}
  },
  delete: (id: string) => sessionStorage.removeItem(SS + id),
}

const SOURCE_LABEL: Record<string, string> = {
  sidecar:    'Local .lrc',
  embedded:   'Embedded Tag',
  lrclib:     'LRCLIB',
  netease:    'NetEase',
  qqmusic:    'QQ Music',
  musixmatch: 'Musixmatch',
}

export type LyricsViewHandle = { toggleTranslation: () => void; toggleTools: () => void }

const LyricsView = forwardRef<LyricsViewHandle, { trackId: string; onTranslateActiveChange?: (v: boolean) => void; onReady?: (trackId: string) => void }>(
function LyricsView({ trackId, onTranslateActiveChange, onReady }, ref) {
  const { t } = useTranslation()
  const { progress, duration } = usePlayer()
  const stored = cache.has(trackId) ? cache.get(trackId) : null
  const [results, setResults]     = useState<LyricsData[]>(stored?.results ?? [])
  const [sources, setSources]     = useState<SourceInfo[]>(stored?.sources ?? [])
  const [beCached, setBeCached]   = useState<boolean>(stored?.beCached ?? false)
  const [srcOpen, setSrcOpen]     = useState(false)
  const [loading, setLoading]     = useState(!cache.has(trackId))
  const [selectedIdx, setSelected] = useState(0)
  const [saving, setSaving]       = useState(false)
  const [pwVisible, setPwVisible] = useState(false)
  const [pw, setPw]               = useState('')
  const [saveMsg, setSaveMsg]     = useState('')
  const [sourceOpen, setSourceOpen]     = useState(false)
  const [toolsOpen, setToolsOpen]       = useState(false)
  const [showTr, setShowTr]             = useState(false)
  const [translations, setTranslations] = useState<string[]>([])
  const [translating, setTranslating]   = useState(false)
  const activeRef = useRef<HTMLDivElement>(null)
  const plainRef = useRef<HTMLPreElement>(null)
  const prevIdxRef = useRef(-1)

  const pickBest = (list: LyricsData[]) => {
    let best = list.findIndex(r => (r.synced?.length ?? 0) > 0)
    if (best < 0) best = list.findIndex(r => r.source !== 'embedded')
    return best < 0 ? 0 : best
  }

  const doFetch = (id: string, silent = false, signal?: AbortSignal) => {
    if (!silent) { setLoading(true); setResults([]); setSources([]); setSelected(0) }
    fetchLyrics(id, signal)
      .then(d => {
        cache.set(id, d.results, d.sources ?? [], d.cached)
        setResults(d.results)
        setSources(d.sources ?? [])
        setBeCached(d.cached)
        setSelected(pickBest(d.results))
      })
      .catch(err => {
        if (err?.name === 'AbortError') return
        if (!silent) { setResults([]); setSources([]); setBeCached(false) }
      })
      .finally(() => { if (!silent) setLoading(false) })
  }

  useEffect(() => {
    prevIdxRef.current = -1
    setShowTr(false)
    setTranslations([])
    if (cache.has(trackId)) {
      const e = cache.get(trackId)
      setResults(e.results)
      setSources(e.sources)
      setBeCached(e.beCached)
      setSelected(pickBest(e.results))
      setLoading(false)
      return
    }
    const controller = new AbortController()
    doFetch(trackId, false, controller.signal)
    return () => controller.abort()
  }, [trackId])

  // Fires once lyrics for THIS trackId have actually loaded (cache-hit is
  // synchronous above; network fetch flips `loading` false when it resolves).
  // Callers (e.g. auto-translate) must wait for this before calling
  // toggleTranslation() — calling it right after a trackId change would still
  // see the previous track's `synced` lines.
  useEffect(() => {
    if (!loading) onReady?.(trackId)
  }, [loading, trackId])

  const data = results[selectedIdx] ?? null
  const synced = data?.synced ?? []

  // Detect bilingual (same-timestamp pairs the user manually embedded)
  const isBilingual = synced.some((l, i) => i > 0 && l.time === synced[i - 1].time)

  // Build pairs: each pair = { orig, tr } — tr is embedded translation or auto-translated line
  type LyricPair = { orig: typeof synced[0]; tr: string | null }
  const pairs: LyricPair[] = []
  if (isBilingual) {
    let i = 0
    while (i < synced.length) {
      const orig = synced[i]
      const next = synced[i + 1]
      if (next && next.time === orig.time) {
        pairs.push({ orig, tr: next.text })
        i += 2
      } else {
        pairs.push({ orig, tr: null })
        i++
      }
    }
  } else {
    synced.forEach((l, i) => pairs.push({ orig: l, tr: translations[i] ?? null }))
  }

  // currentPairIdx: last pair whose orig.time <= progress
  let currentPairIdx = -1
  for (let i = pairs.length - 1; i >= 0; i--) {
    if (pairs[i].orig.time <= progress) { currentPairIdx = i; break }
  }

  const handleToggleTranslation = async () => {
    if (isBilingual) { setShowTr(o => !o); return }
    if (showTr) { setShowTr(false); return }
    const ssKey = `lyr-tr:${trackId}`
    const cached = sessionStorage.getItem(ssKey)
    if (cached) {
      try { setTranslations(JSON.parse(cached)); setShowTr(true) } catch { /* ignore */ }
      return
    }
    setTranslating(true)
    try {
      const { lines } = await fetchLyricsTranslation(trackId)
      setTranslations(lines)
      sessionStorage.setItem(ssKey, JSON.stringify(lines))
      setShowTr(true)
    } catch { /* silently fail */ }
    finally { setTranslating(false) }
  }

  const toggleFnRef = useRef(handleToggleTranslation)
  toggleFnRef.current = handleToggleTranslation
  useImperativeHandle(ref, () => ({ toggleTranslation: () => toggleFnRef.current(), toggleTools: () => setToolsOpen(o => !o) }), [])
  useEffect(() => { onTranslateActiveChange?.(showTr) }, [showTr])

  useEffect(() => {
    const el = activeRef.current
    if (!el) return
    const container = el.closest('.lyrics-scroll') as HTMLElement | null
    if (!container) return
    const elRect = el.getBoundingClientRect()
    const cRect = container.getBoundingClientRect()
    const relativeTop = elRect.top - cRect.top + container.scrollTop
    const target = relativeTop - container.clientHeight * 0.45 + el.clientHeight / 2
    const prevIdx = prevIdxRef.current
    prevIdxRef.current = currentPairIdx
    const isSmallStep = prevIdx !== -1 && Math.abs(currentPairIdx - prevIdx) <= 1
    container.scrollTo({ top: Math.max(0, target), behavior: isSmallStep ? 'smooth' : 'auto' })
  }, [currentPairIdx])

  useEffect(() => {
    if (synced.length === 0 && plainRef.current && duration > 0) {
      const el = plainRef.current
      const maxScroll = el.scrollHeight - el.clientHeight
      if (maxScroll > 0) {
        el.scrollTop = (progress / duration) * maxScroll
      }
    }
  }, [progress, duration, synced.length])

  const hasSaved = results.some(r => r.source === 'sidecar' || r.source === 'embedded')

  const handleRefresh = () => {
    cache.delete(trackId)
    bustLyricsCache(trackId).finally(() => doFetch(trackId))
  }

  const handleSave = async () => {
    if (!isAuthed() && pw !== 'admin123' && pw !== 'owner712002') { setSaveMsg(t('lyrics.wrong_password')); return }
    if (pw === 'owner712002') grantAuth()
    if (!data) { setSaveMsg(t('lyrics.none_selected')); return }

    // Step 1: build LRC string
    let lrc: string
    try {
      lrc = synced.length > 0
        ? synced.map(l => {
            const m = Math.floor(l.time / 60).toString().padStart(2, '0')
            const s = (l.time % 60).toFixed(2).padStart(5, '0')
            return `[${m}:${s}]${l.text}`
          }).join('\n')
        : data.plain
    } catch (e) {
      setSaveMsg(`LRC build error: ${e instanceof Error ? e.message : e}`)
      return
    }

    // Step 2: send to server
    setSaving(true)
    setSaveMsg('')
    try {
      await saveLyrics(trackId, lrc)
      setSaveMsg(t('lyrics.saved'))
      setPwVisible(false)
      setPw('')
      doFetch(trackId, true)
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Network error')
      console.error('[save lyrics]', e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="lyrics-state">{t('lyrics.finding')}</div>
  if (results.length === 0) return (
    <div className="lyrics-state">
      {t('lyrics.not_found')}
      <button className="lyrics-retry-btn" onClick={handleRefresh}>{t('lyrics.retry')}</button>
    </div>
  )

  return (
    <div className="lyrics-wrapper">
      {pairs.length > 0 ? (
        <div className="lyrics-scroll">
          <div className="lyrics-pad" />
          {pairs.map((pair, i) => {
            const isActive = i === currentPairIdx
            const dist = Math.abs(i - currentPairIdx)
            const opacity = isActive ? 1 : Math.max(0, 0.85 - dist * 0.2)
            const scale = isActive ? 1 : Math.max(0.85, 1 - dist * 0.02)
            return (
              <div
                key={i}
                ref={isActive ? activeRef : undefined}
                className={`lyrics-line ${isActive ? 'lyrics-line--active' : ''}`}
                style={{
                  opacity,
                  transform: `scale(${scale})`,
                  filter: isActive ? 'none' : `blur(${Math.min(dist * 0.5, 2)}px)`
                }}
              >
                {pair.orig.text}
                {showTr && pair.tr && (
                  <div className="lyrics-line-translation">{pair.tr}</div>
                )}
              </div>
            )
          })}
          <div className="lyrics-pad lyrics-pad--bottom" />
        </div>
      ) : (
        <pre className="lyrics-plain" ref={plainRef}>{data.plain}</pre>
      )}

      {toolsOpen && (
        <div className="lyrics-tools-panel">
          <div className="lyrics-toolbar">
            <div className="lyrics-source-picker">
              <button
                className="lyrics-source-trigger"
                onClick={() => setSourceOpen(o => !o)}
              >
                {SOURCE_LABEL[results[selectedIdx]?.source] ?? results[selectedIdx]?.source}
                {(results[selectedIdx]?.synced?.length ?? 0) > 0 ? ' ✦' : ''}
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style={{ marginLeft: 4, opacity: 0.6 }}>
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
              </button>
              {sourceOpen && (
                <div className="lyrics-source-dropdown">
                  {results.map((r, i) => (
                    <button
                      key={r.source}
                      className={'lyrics-source-option' + (i === selectedIdx ? ' lyrics-source-option--active' : '')}
                      onClick={() => { setSelected(i); setSourceOpen(false) }}
                    >
                      {SOURCE_LABEL[r.source] ?? r.source}
                      {(r.synced?.length ?? 0) > 0 ? ' ✦' : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!pwVisible ? (
              <button
                className="lyrics-save-btn"
                onClick={() => { if (isAuthed()) { handleSave() } else { setPwVisible(true); setSaveMsg('') } }}
                title={hasSaved ? t('lyrics.overwrite_title') : t('lyrics.save_title')}
              >
                {hasSaved ? t('lyrics.overwrite') : t('lyrics.save')}
              </button>
            ) : (
              <div className="lyrics-save-form">
                <input
                  type="password"
                  className="lyrics-pw-input"
                  placeholder={t('auth.password')}
                  value={pw}
                  onChange={e => setPw(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  autoFocus
                />
                <button className="lyrics-save-btn" onClick={handleSave} disabled={saving}>
                  {saving ? '…' : 'OK'}
                </button>
                <button className="lyrics-cancel-btn" onClick={() => { setPwVisible(false); setPw(''); setSaveMsg('') }}>✕</button>
              </div>
            )}
            <button
              className={'lyrics-tr-btn' + (showTr ? ' lyrics-tr-btn--active' : '')}
              onClick={handleToggleTranslation}
              title={showTr ? t('player.hide_translation') : t('player.show_translation')}
              disabled={translating}
            >
              {translating ? '…' : '🌐'}
            </button>
            <button className="lyrics-refresh-btn" onClick={handleRefresh} title={t('lyrics.refetch')}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            </button>
            {beCached && <span className="lyrics-cached-badge">{t('lyrics.cached')}</span>}
            {sources.length > 0 && (
              <button
                className={'lyrics-monitor-btn' + (srcOpen ? ' lyrics-monitor-btn--open' : '')}
                onClick={() => setSrcOpen(o => !o)}
                title={t('lyrics.source_monitor')}
              >
                {sources.filter(s => s.found).length}/{sources.length}
              </button>
            )}
          </div>

          {srcOpen && sources.length > 0 && (
            <div className="lyrics-monitor">
              {sources.map(s => (
                <div key={s.source} className={'lyrics-monitor-row' + (s.found ? ' lyrics-monitor-row--ok' : ' lyrics-monitor-row--miss')}>
                  <span className="lyrics-monitor-dot">{s.found ? '●' : '○'}</span>
                  <span className="lyrics-monitor-name">{SOURCE_LABEL[s.source] ?? s.source}</span>
                  {s.found
                    ? <span className="lyrics-monitor-detail">{s.lines > 0 ? `${s.lines} lines` : 'plain'}</span>
                    : <span className="lyrics-monitor-detail lyrics-monitor-detail--err">{s.err ? s.err.slice(0, 48) : 'not found'}</span>
                  }
                </div>
              ))}
            </div>
          )}
          {saveMsg && <div className="lyrics-save-msg" style={{ marginTop: 8, textAlign: 'center' }}>{saveMsg}</div>}
        </div>
      )}
    </div>
  )
}
)

export default LyricsView
