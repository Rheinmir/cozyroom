import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { Track } from './types'
import { fetchSmartQueue, lastfmNowPlaying, lastfmScrobble } from './api'

export type RepeatMode  = 'off' | 'one' | 'all'
export type ShuffleMode = 'off' | 'shuffle' | 'smart'
export type Quality     = 'lossless' | '320'

type PlayerCtx = {
  track:       Track | null
  queue:       Track[]
  queueIdx:    number
  isPlaying:   boolean
  progress:    number
  duration:    number
  repeat:      RepeatMode
  shuffleMode: ShuffleMode
  quality:     Quality
  analyser:    AnalyserNode | null
  coverColors: string[]
  play:          (t: Track, queue?: Track[]) => void
  toggle:        () => void
  seek:          (s: number) => void
  prev:          () => void
  next:          () => void
  setRepeat:     (m: RepeatMode)  => void
  setShuffleMode:(m: ShuffleMode) => void
  setQuality:    (q: Quality)     => void
  setCoverColors:(c: string[])    => void
}

const Ctx = createContext<PlayerCtx>({} as PlayerCtx)

const STORAGE_KEY = 'hs-player'
const PRELOAD_LOOK_AHEAD_S = 30  // Spotify-standard look-ahead window

type SavedState = {
  track: Track | null
  queue: Track[]
  queueIdx: number
  progress: number
  repeat: RepeatMode
  shuffleMode: ShuffleMode
  quality: Quality
}

function loadSaved(): SavedState | null {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') }
  catch { return null }
}

/** Build the stream URL for a track + quality setting. */
function streamUrl(trackId: string, q: Quality): string {
  if (trackId.startsWith('yt:')) {
    return `/api/youtube/stream/${trackId.slice(3)}`
  }
  return `/stream/${trackId}${q === '320' ? '?q=320' : ''}`
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  // ── Dual-Audio objects ────────────────────────────────────────────────
  const audioA = useRef(new Audio())
  const audioB = useRef(new Audio())
  const audioYT = useRef(new Audio()) // Dedicated element for YouTube streams to bypass Web Audio API CORS
  const activeSlot = useRef<'A' | 'B'>('A')

  /** Return the currently active Audio element. */
  const getActive = useCallback(() => {
    if (trackRef.current?.id?.startsWith('yt:')) {
      return audioYT.current
    }
    return activeSlot.current === 'A' ? audioA.current : audioB.current
  }, [])
  /** Return the standby Audio element (used for preloading). */
  const getStandby = useCallback(() => activeSlot.current === 'A' ? audioB.current : audioA.current, [])

  // ── Preload tracking ─────────────────────────────────────────────────
  const preloadedTrackId = useRef<string | null>(null)
  const retriesRef = useRef<Record<string, number>>({})

  const init = useRef(loadSaved())

  const [track,       setTrack]      = useState<Track | null>(init.current?.track      ?? null)
  const [queue,       setQueue]      = useState<Track[]>       (init.current?.queue      ?? [])
  const [queueIdx,    setQueueIdx]   = useState<number>        (init.current?.queueIdx   ?? -1)
  const [isPlaying,   setPlaying]    = useState(false)
  const [progress,    setProgress]   = useState(init.current?.progress ?? 0)
  const [duration,    setDuration]   = useState(0)
  const [repeat,      setRepeat]     = useState<RepeatMode>    (init.current?.repeat      ?? 'off')
  const [shuffleMode, setShuffleMode]= useState<ShuffleMode>   (init.current?.shuffleMode ?? 'off')
  const [quality,     setQuality]    = useState<Quality>       (init.current?.quality     ?? 'lossless')
  const [analyser,    setAnalyser]   = useState<AnalyserNode | null>(null)
  const [coverColors, setCoverColors] = useState<string[]>(['#1db954', '#191414']) // default palette

  // Set crossOrigin + preload="auto" so browser buffers ahead aggressively
  useEffect(() => {
    for (const el of [audioA.current, audioB.current, audioYT.current]) {
      el.crossOrigin = 'anonymous'
      el.preload = 'auto'
    }
  }, [])

  // Restore last session — set src + seek on audioA, but don't autoplay
  useEffect(() => {
    const s = init.current
    if (!s?.track) return
    const q = s.quality ?? 'lossless'
    audioA.current.src = streamUrl(s.track.id, q)
    audioA.current.preload = 'metadata'
    const seek = () => { audioA.current.currentTime = s.progress ?? 0 }
    audioA.current.addEventListener('loadedmetadata', seek, { once: true })
    audioA.current.load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist state to localStorage (progress saved separately on pause)
  useEffect(() => {
    if (!track) return
    try {
      const prev: Partial<SavedState> = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...prev, track, queue, queueIdx, repeat, shuffleMode, quality,
      }))
    } catch {}
  }, [track, queue, queueIdx, repeat, shuffleMode, quality])

  // Save progress on tab close so position is restored after reload
  useEffect(() => {
    const handler = () => {
      try {
        const cur = getActive().currentTime
        if (cur > 0) {
          const prev: Partial<SavedState> = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, progress: cur }))
        }
      } catch {}
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [getActive])

  // ── Web Audio API — created once on first user-initiated play ─────
  // Both audioA and audioB get their own MediaElementSource routed through
  // the same AnalyserNode → destination. Whichever is playing produces sound;
  // the paused/standby one contributes silence — no disconnect needed.
  const audioCtxRef = useRef<AudioContext | null>(null)

  const initAudioCtx = useCallback(() => {
    if (audioCtxRef.current) { audioCtxRef.current.resume(); return }
    try {
      const ctx = new AudioContext()
      const an  = ctx.createAnalyser()
      an.fftSize = 256
      an.smoothingTimeConstant = 0.8

      // Connect both audio elements to the same analyser → destination
      const srcA = ctx.createMediaElementSource(audioA.current)
      srcA.connect(an)

      const srcB = ctx.createMediaElementSource(audioB.current)
      srcB.connect(an)

      an.connect(ctx.destination)
      audioCtxRef.current = ctx
      setAnalyser(an)
    } catch (e) { console.warn('AudioContext init failed', e) }
  }, [])

  useEffect(() => {
    return () => { audioCtxRef.current?.close() }
  }, [])

  // mutable refs so audio event handlers always see current values
  const repeatRef      = useRef(repeat)
  const shuffleModeRef = useRef(shuffleMode)
  const qualityRef     = useRef(quality)
  const queueRef       = useRef(queue)
  const idxRef         = useRef(queueIdx)
  const trackRef       = useRef(track)
  // Set when play(t, queue.length>1) — prevents smart fill from contaminating explicit playlists
  const lockedQueueRef = useRef(false)
  useEffect(() => { repeatRef.current      = repeat      }, [repeat])
  useEffect(() => { shuffleModeRef.current = shuffleMode }, [shuffleMode])
  useEffect(() => { qualityRef.current     = quality     }, [quality])
  useEffect(() => { queueRef.current       = queue       }, [queue])
  useEffect(() => { idxRef.current         = queueIdx    }, [queueIdx])
  useEffect(() => { trackRef.current       = track       }, [track])

  // Smart queue: fetch and INSERT right after current position (not at end)
  const fetchingSmartRef = useRef(false)
  const fillSmartQueue = useCallback(async (fromTrackId: string) => {
    if (fetchingSmartRef.current) return
    fetchingSmartRef.current = true
    try {
      const tracks = await fetchSmartQueue(fromTrackId)
      setQueue(prev => {
        const idx  = idxRef.current
        const head = prev.slice(0, idx + 1)          // history + current track
        const seen = new Set(head.map(t => t.id))
        const fresh = tracks.filter(t => !seen.has(t.id))
        const next = [...head, ...fresh]
        queueRef.current = next                       // sync ref immediately
        return next
      })
    } catch (e) {
      console.error('smart-queue fetch', e)
    } finally {
      fetchingSmartRef.current = false
    }
  }, [])
  const fillSmartRef = useRef(fillSmartQueue)
  useEffect(() => { fillSmartRef.current = fillSmartQueue }, [fillSmartQueue])

  // ── Determine next track based on current state (for preloading) ──
  const peekNextTrack = useCallback((): { track: Track; idx: number } | null => {
    const q    = queueRef.current
    const idx  = idxRef.current
    const rep  = repeatRef.current
    const shuf = shuffleModeRef.current

    // repeat-one: same track, browser already has it cached — no preload needed
    if (rep === 'one') return null
    // shuffle: random target, unpredictable — skip preloading
    if (shuf === 'shuffle') return null

    // smart or normal sequential
    if (idx < q.length - 1) return { track: q[idx + 1], idx: idx + 1 }
    if (rep === 'all' && q.length > 0) return { track: q[0], idx: 0 }
    return null
  }, [])

  const startTrack = useCallback((t: Track, idx: number) => {
    initAudioCtx()
    const q = qualityRef.current

    if (t.id.startsWith('yt:')) {
      // Pause dual-audio local elements
      audioA.current.pause()
      audioB.current.pause()

      // Play YouTube element directly
      audioYT.current.src = streamUrl(t.id, q)
      audioYT.current.play().catch(console.error)
    } else {
      // Pause YouTube element
      audioYT.current.pause()
      audioYT.current.removeAttribute('src')
      audioYT.current.load()

      const active  = activeSlot.current === 'A' ? audioA.current : audioB.current
      const standby = activeSlot.current === 'A' ? audioB.current : audioA.current

      // Check if this track is already preloaded in the standby audio
      if (preloadedTrackId.current === t.id) {
        // Seamless swap: standby already has data buffered
        active.pause()
        active.removeAttribute('src')
        active.load()  // release the old stream

        // Flip the slot
        activeSlot.current = activeSlot.current === 'A' ? 'B' : 'A'
        standby.play().catch(console.error)
      } else {
        // Normal load (no preload available or different track)
        active.src = streamUrl(t.id, q)
        active.play().catch(console.error)
      }
    }

    preloadedTrackId.current = null
    retriesRef.current = {}
    setTrack(t)
    setQueueIdx(idx)
    setPlaying(true)
    setProgress(0)
    setDuration(0)
    // Preloaded track: metadata already loaded on standby — loadedmetadata won't fire again
    const d = getActive().duration
    if (isFinite(d) && d > 0) setDuration(d)
  }, [initAudioCtx, getActive, getStandby])

  // ── Audio event listeners — attached to BOTH elements ────────────────
  // Handlers check activeSlot to only act on the currently active element.
  useEffect(() => {
    const a = audioA.current
    const b = audioB.current
    const yt = audioYT.current

    const onTime = (e: Event) => {
      const el = e.target as HTMLAudioElement
      if (el !== getActive()) return
      setProgress(el.currentTime)
    }

    const onMeta = (e: Event) => {
      const el = e.target as HTMLAudioElement
      if (el !== getActive()) return
      setDuration(isFinite(el.duration) ? el.duration : 0)
    }

    const onEnd = (e: Event) => {
      const el = e.target as HTMLAudioElement
      if (el !== getActive()) return

      const q    = queueRef.current
      const idx  = idxRef.current
      const rep  = repeatRef.current
      const shuf = shuffleModeRef.current

      if (rep === 'one') {
        el.currentTime = 0
        el.play().catch(console.error)
        return
      }

      if (shuf === 'smart') {
        const nextIdx = idx + 1
        if (nextIdx < q.length) {
          startTrack(q[nextIdx], nextIdx)
          if (q.length - nextIdx < 10 && !lockedQueueRef.current) {
            fillSmartRef.current(q[nextIdx].id)
          }
        } else {
          setPlaying(false)
        }
        return
      }

      let next = -1
      if (shuf === 'shuffle' && q.length > 1) {
        do { next = Math.floor(Math.random() * q.length) } while (next === idx)
      } else if (idx < q.length - 1) {
        next = idx + 1
      } else if (rep === 'all') {
        next = 0
      }
      if (next >= 0) startTrack(q[next], next)
      else setPlaying(false)
    }

    const onPause = (e: Event) => {
      const el = e.target as HTMLAudioElement
      if (el !== getActive()) return
      try {
        const prev: Partial<SavedState> = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, progress: el.currentTime }))
      } catch {}
    }

    const onError = (e: Event) => {
      const el = e.target as HTMLAudioElement
      if (el !== getActive()) return
      const err = el.error
      const tId = trackRef.current?.id ?? 'unknown'
      
      console.error('Audio error:', {
        code: err?.code,
        message: err?.message,
        src: el.src,
        trackId: tId
      })

      // MEDIA_ERR_NETWORK = 2
      if (err?.code === 2) {
        const count = retriesRef.current[tId] ?? 0
        if (count < 3) {
          console.warn(`Network error. Retrying (${count + 1}/3)...`)
          retriesRef.current[tId] = count + 1
          
          const currentPos = el.currentTime
          const currentSrc = el.src
          
          // Re-load the source to trigger a fresh connection
          el.src = ''
          el.load()
          el.src = currentSrc
          
          const onReady = () => {
            el.currentTime = currentPos
            el.play().catch(console.error)
          }
          el.addEventListener('canplay', onReady, { once: true })
          el.load()
        } else {
          console.error('Max retries reached for network error.')
        }
      }
    }

    // When stalled (no data for 3s), nudge currentTime to force browser to re-request
    const onStalled = (e: Event) => {
      const el = e.target as HTMLAudioElement
      if (el !== getActive() || !el.src) return
      const pos = el.currentTime
      el.currentTime = Math.max(0, pos - 0.1)
      el.play().catch(() => {})
    }

    for (const el of [a, b, yt]) {
      el.addEventListener('timeupdate',     onTime)
      el.addEventListener('loadedmetadata', onMeta)
      el.addEventListener('ended',          onEnd)
      el.addEventListener('pause',          onPause)
      el.addEventListener('error',          onError)
      el.addEventListener('stalled',        onStalled)
      el.addEventListener('waiting',        onStalled)
    }
    return () => {
      for (const el of [a, b, yt]) {
        el.removeEventListener('timeupdate',     onTime)
        el.removeEventListener('loadedmetadata', onMeta)
        el.removeEventListener('ended',          onEnd)
        el.removeEventListener('pause',          onPause)
        el.removeEventListener('error',          onError)
        el.removeEventListener('stalled',        onStalled)
        el.removeEventListener('waiting',        onStalled)
      }
    }
  }, [startTrack])

  // ── Preload trigger: immediate on track change ───────────────────────
  useEffect(() => {
    if (!track) return
    const next = peekNextTrack()
    if (!next) return
    if (preloadedTrackId.current === next.track.id) return
    const standby = getStandby()
    const q = qualityRef.current
    standby.src = streamUrl(next.track.id, q)
    standby.preload = 'auto'
    standby.load()
    preloadedTrackId.current = next.track.id
  }, [track, peekNextTrack, getStandby])

  // ── Preload trigger: 30s look-ahead fallback ──────────────────────────
  useEffect(() => {
    if (!track || duration <= 0) return
    if (duration - progress > PRELOAD_LOOK_AHEAD_S) return

    const next = peekNextTrack()
    if (!next) return
    if (preloadedTrackId.current === next.track.id) return // already preloaded

    const standby = getStandby()
    const q = qualityRef.current
    standby.src = streamUrl(next.track.id, q)
    standby.preload = 'auto'
    standby.load()
    preloadedTrackId.current = next.track.id
  }, [progress, duration, track, peekNextTrack, getStandby])

  const play = useCallback((t: Track, newQueue?: Track[]) => {
    if (newQueue) {
      setQueue(newQueue)
      queueRef.current = newQueue
      const idx = newQueue.findIndex(x => x.id === t.id)
      idxRef.current = idx
      startTrack(t, idx)
    } else {
      startTrack(t, idxRef.current)
    }
    if (newQueue && newQueue.length > 1) {
      lockedQueueRef.current = true   // explicit playlist — block smart fill
    } else if (shuffleModeRef.current === 'smart') {
      lockedQueueRef.current = false
      fillSmartRef.current(t.id)
    }
  }, [startTrack])

  const toggle = () => {
    const active = getActive()
    if (isPlaying) { active.pause(); setPlaying(false) }
    else           { active.play().catch(console.error); setPlaying(true) }
  }

  const seek = (s: number) => { getActive().currentTime = s; setProgress(s) }

  const prev = () => {
    const active = getActive()
    if (active.currentTime > 3) {
      active.currentTime = 0
      return
    }
    const idx = idxRef.current
    const q   = queueRef.current
    const target = idx > 0 ? idx - 1 : (repeat === 'all' ? q.length - 1 : 0)
    if (q[target]) startTrack(q[target], target)
  }

  const next = () => {
    const idx  = idxRef.current
    const q    = queueRef.current
    const shuf = shuffleModeRef.current

    if (shuf === 'smart') {
      const nextIdx = idx + 1
      if (nextIdx < q.length) {
        startTrack(q[nextIdx], nextIdx)
        if (q.length - nextIdx < 10) fillSmartRef.current(q[nextIdx].id)
      }
      return
    }

    let target: number
    if (shuf === 'shuffle' && q.length > 1) {
      do { target = Math.floor(Math.random() * q.length) } while (target === idx)
    } else {
      target = idx < q.length - 1 ? idx + 1 : (repeatRef.current === 'all' ? 0 : idx)
    }
    if (q[target]) startTrack(q[target], target)
  }

  // Media Session API — OS lock screen / notification controls
  const prevRef   = useRef(prev)
  const nextRef   = useRef(next)
  useEffect(() => { prevRef.current = prev }, [prev])
  useEffect(() => { nextRef.current = next }, [next])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    if (!track) {
      navigator.mediaSession.metadata = null
      return
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title:   track.title,
      artwork: [
        { src: `${window.location.origin}/api/covers/${track.album_id}`, sizes: '512x512', type: 'image/jpeg' },
      ],
    })

    const active = getActive()
    navigator.mediaSession.setActionHandler('play',          () => { active.play();  setPlaying(true)  })
    navigator.mediaSession.setActionHandler('pause',         () => { active.pause(); setPlaying(false) })
    navigator.mediaSession.setActionHandler('nexttrack',     () => nextRef.current())
    navigator.mediaSession.setActionHandler('previoustrack', () => prevRef.current())
    navigator.mediaSession.setActionHandler('seekto',        d  => { if (d.seekTime != null) { active.currentTime = d.seekTime; setProgress(d.seekTime) } })

    return () => {
      for (const action of ['play', 'pause', 'nexttrack', 'previoustrack', 'seekto'] as const) {
        try { navigator.mediaSession.setActionHandler(action, null) } catch {}
      }
    }
  }, [track, getActive])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
  }, [isPlaying])

  // Last.fm scrobbling
  const scrobbledRef = useRef<string | null>(null)  // track id that was scrobbled this play
  const scrobbleStartRef = useRef<number>(0)         // unix timestamp when track started

  useEffect(() => {
    if (!track) return
    scrobbledRef.current = null
    scrobbleStartRef.current = Math.floor(Date.now() / 1000)
    lastfmNowPlaying(track.artist_name ?? '', track.title, track.album_title ?? '').catch(() => {})
  }, [track])

  useEffect(() => {
    if (!track || !isPlaying) return
    if (duration < 30) return
    if (scrobbledRef.current === track.id) return
    const threshold = Math.min(duration * 0.5, 240)
    if (progress >= threshold && progress >= 30) {
      scrobbledRef.current = track.id
      lastfmScrobble(
        track.artist_name ?? '', track.title, track.album_title ?? '',
        scrobbleStartRef.current,
      ).catch(() => {})
    }
  }, [progress, track, duration, isPlaying])

  // When switching to smart mode, pre-fill queue from current track
  const handleSetShuffleMode = (mode: ShuffleMode) => {
    setShuffleMode(mode)
    if (mode === 'smart' && trackRef.current) {
      lockedQueueRef.current = false  // user explicitly wants smart radio
      fillSmartRef.current(trackRef.current.id)
    }
  }

  return (
    <Ctx.Provider value={{
      track, queue, queueIdx, isPlaying, progress, duration,
      repeat, shuffleMode, quality, analyser, coverColors,
      play, toggle, seek, prev, next,
      setRepeat, setShuffleMode: handleSetShuffleMode, setQuality, setCoverColors,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const usePlayer = () => useContext(Ctx)
