import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Track } from './types'
import { fetchSmartQueue, lastfmNowPlaying, lastfmScrobble, recordPlay } from './api'
import { getOfflineObjectURL } from './offlineStore'
import pkg from '../package.json'

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
  playFromQueue: (idx: number) => void
  toggle:        () => void
  seek:          (s: number) => void
  prev:          () => void
  next:          () => void
  setRepeat:     (m: RepeatMode)  => void
  setShuffleMode:(m: ShuffleMode) => void
  setQuality:    (q: Quality)     => void
  setCoverColors:(c: string[])    => void
  playbackError:  { code: number; message: string; trackId: string } | null
  setPlaybackError: (err: { code: number; message: string; trackId: string } | null) => void
  // Shared so the queue toggle button can live in more than one place
  // (NPO controls, the mobile search island) and both open the same panel.
  queueOpen:    boolean
  setQueueOpen: Dispatch<SetStateAction<boolean>>
  // Whether the fullscreen Now Playing overlay is open — also shared so
  // MobileSearchBar (a separate always-mounted component) can tell whether
  // NPO's own queue-panel is already showing, and skip rendering its own
  // duplicate copy of the exact same panel underneath it.
  npoOpen:    boolean
  setNpoOpen: Dispatch<SetStateAction<boolean>>
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

/** Build the stream URL for a track + quality setting.
 * clientId/attemptId are optional correlation IDs (see getClientId/attemptIdRef
 * below) — attached only at the call sites tied to a real user playback
 * attempt (start, network retry, quality fallback), never for preload. */
function streamUrl(trackId: string, q: Quality | 'lossless-clean', clientId?: string, attemptId?: string): string {
  if (trackId.startsWith('yt:')) {
    return `/api/youtube/stream/${trackId.slice(3)}`
  }
  const params = new URLSearchParams()
  if (q === 'lossless-clean' || q === '320') params.set('q', q)
  if (clientId) params.set('client_id', clientId)
  if (attemptId) params.set('attempt_id', attemptId)
  const qs = params.toString()
  return `/stream/${trackId}${qs ? '?' + qs : ''}`
}

// crypto.randomUUID is only defined in secure contexts (HTTPS/localhost) —
// falls back to a non-crypto ID so plain-HTTP access doesn't crash playback.
function safeUUID(): string {
  try { return crypto.randomUUID() } catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}` }
}

// Stable per-device correlation ID, cached in localStorage — lets backend
// logs group requests by the device/browser they came from.
const CLIENT_ID_KEY = 'cozyroom_client_id'
function getClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY)
    if (!id) {
      id = safeUUID()
      localStorage.setItem(CLIENT_ID_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}

// iPadOS reports its UA as "Macintosh" (same as real macOS) unless the site
// specifically asks for the mobile UA — the reliable way to tell them apart is
// a touch-capable "Mac".
function isIOS(): boolean {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

// Per-track quality memory: some library files have corrupt metadata / mixed
// mono-stereo frames that fail lossless decode on any browser (see transcode.go
// comments) — once a track is known to need a lower tier, remember it so future
// plays skip straight there instead of repeating the failed-attempt cascade.
// This also stops one bad file from permanently degrading every OTHER track's
// default quality for the rest of the session.
const QUALITY_OVERRIDE_KEY = 'hs-track-quality-overrides'
const MAX_QUALITY_OVERRIDES = 300

function loadQualityOverrides(): Record<string, Quality | 'lossless-clean'> {
  try { return JSON.parse(localStorage.getItem(QUALITY_OVERRIDE_KEY) ?? '{}') }
  catch { return {} }
}
function saveQualityOverride(trackId: string, q: Quality | 'lossless-clean') {
  try {
    const map = loadQualityOverrides()
    map[trackId] = q
    const keys = Object.keys(map)
    if (keys.length > MAX_QUALITY_OVERRIDES) {
      for (const k of keys.slice(0, keys.length - MAX_QUALITY_OVERRIDES)) delete map[k]
    }
    localStorage.setItem(QUALITY_OVERRIDE_KEY, JSON.stringify(map))
  } catch {}
}
/** Resolve the quality to actually use for a track: its remembered override, else the session default. */
function resolveQuality(trackId: string, fallback: Quality): Quality | 'lossless-clean' {
  return loadQualityOverrides()[trackId] ?? fallback
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
  // Set only once the browser confirms 'canplay' on the standby element — see
  // the two preload effects below. startTrack()'s seamless-swap check reads
  // this, so it must reflect "actually buffered", not just "load() started".
  const preloadedTrackId = useRef<string | null>(null)
  // Set synchronously the instant a preload load() starts, so a re-running
  // effect (e.g. every timeupdate tick in the 30s-lookahead trigger) doesn't
  // restart the same in-flight load. Cleared/overwritten whenever a newer
  // preload target supersedes it — a stale canplay for an old target then
  // fails this check and is correctly ignored instead of marking a
  // never-actually-buffered id as ready.
  const preloadPendingId = useRef<string | null>(null)
  const retriesRef = useRef<Record<string, number>>({})
  // Guards against overlapping network-error retries (see onError) — without this,
  // a burst of MEDIA_ERR_NETWORK events stacks multiple reload-seek-play cycles on
  // top of each other, which is heard as the same short chunk repeating rapidly.
  const retryPendingRef = useRef<Record<string, boolean>>({})
  // Correlation ID for the current real playback attempt — set fresh each time
  // startTrack() starts an actual track (not preload), reused unchanged across
  // that track's network retries and quality-fallback cascade so backend logs
  // can group them as "the same attempt" instead of unrelated one-off requests.
  const attemptIdRef = useRef<string>('')

  const init = useRef(loadSaved())

  const [track,       setTrack]      = useState<Track | null>(init.current?.track      ?? null)
  const [queue,       setQueue]      = useState<Track[]>       (init.current?.queue      ?? [])
  const [queueIdx,    setQueueIdx]   = useState<number>        (init.current?.queueIdx   ?? -1)
  const [isPlaying,   setPlaying]    = useState(false)
  const [progress,    setProgress]   = useState(init.current?.progress ?? 0)
  const [duration,    setDuration]   = useState(init.current?.track?.duration_s ?? 0)
  const [repeat,      setRepeat]     = useState<RepeatMode>    (init.current?.repeat      ?? 'off')
  const [shuffleMode, setShuffleMode]= useState<ShuffleMode>   (init.current?.shuffleMode ?? 'off')
  const [quality,     setQuality]    = useState<Quality>       (init.current?.quality     ?? 'lossless')
  const [analyser,    setAnalyser]   = useState<AnalyserNode | null>(null)
  const [coverColors, setCoverColors] = useState<string[]>(['#1db954', '#191414']) // default palette
  const [playbackError, setPlaybackError] = useState<{ code: number; message: string; trackId: string } | null>(null)
  const [queueOpen, setQueueOpen] = useState(false)
  const [npoOpen, setNpoOpen] = useState(false)

  // Set crossOrigin + preload="auto" so browser buffers ahead aggressively
  useEffect(() => {
    for (const el of [audioA.current, audioB.current, audioYT.current]) {
      el.crossOrigin = 'anonymous'
      el.preload = 'auto'
    }
  }, [])

  // Restore last session — set src, seek, and resume playback
  useEffect(() => {
    const s = init.current
    if (!s?.track) return
    const trackId = s.track.id
    const q = s.quality ?? 'lossless'
    getOfflineObjectURL(trackId).then(offlineUrl => {
      audioA.current.src = offlineUrl ?? streamUrl(trackId, resolveQuality(trackId, q))
      audioA.current.preload = 'auto'
      const seek = () => {
        audioA.current.currentTime = s.progress ?? 0
        audioA.current.play().then(() => setPlaying(true)).catch(() => {})
      }
      audioA.current.addEventListener('loadedmetadata', seek, { once: true })
      audioA.current.load()
    })
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
  //
  // Skipped entirely on iOS: once createMediaElementSource() is called on an
  // <audio> element, its output is routed through the Web Audio graph for the
  // rest of that element's life — there is no way to hand it back to the
  // element's native output later. iOS suspends AudioContext on backgrounding,
  // which would silence playback even though Media Session (see below) is set
  // up correctly and would otherwise let audio keep playing with lock-screen
  // controls. No visualizer on iOS is the trade-off for reliable background
  // playback there; every other platform is unaffected.
  const audioCtxRef = useRef<AudioContext | null>(null)

  const initAudioCtx = useCallback(() => {
    if (isIOS()) return
    if (audioCtxRef.current) { audioCtxRef.current.resume(); return }
    try {
      const ctx = new AudioContext()
      ctx.resume().catch(() => {})  // iOS: context may start suspended
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

  // Browsers/OS can silently reclaim a backgrounded tab's audio decoder to
  // free memory, then restart playback from scratch once the tab is visible
  // again — outside any control this app has. When that happens, React's
  // progress/duration/isPlaying state is left showing whatever it was right
  // before backgrounding, frozen, while the audio element itself has already
  // moved on — the progress bar looks stuck even though sound is playing.
  // Re-reading the real state straight from the active element on every
  // return-to-foreground keeps the UI honest regardless of what happened
  // while the tab was hidden.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      if (!trackRef.current) return
      const el = getActive()
      if (isFinite(el.currentTime)) setProgress(el.currentTime)
      if (isFinite(el.duration) && el.duration > 0) setDuration(el.duration)
      setPlaying(!el.paused)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [getActive])

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
    setPlaybackError(null)
    initAudioCtx()
    const q = qualityRef.current
    // Fresh correlation ID for this real playback attempt — reused unchanged
    // by any network retry / quality fallback that follows for this track.
    attemptIdRef.current = safeUUID()

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

      // Captured synchronously, before the async offline check below — reading
      // preloadedTrackId.current *inside* the callback would always see null,
      // since the synchronous `preloadedTrackId.current = null` further down
      // in this same call runs before that microtask ever gets a chance to fire.
      const wasPreloaded = preloadedTrackId.current === t.id

      // Flip the slot NOW, synchronously, when we already know this will be a
      // seamless swap — not later inside the async callback below. setTrack(t)
      // (further down in this function) triggers the preload-lookahead effect
      // to re-run immediately for "the track after this one", and that effect
      // calls getStandby() to decide where to load it. If the flip hasn't
      // happened yet, getStandby() still resolves to *this* element — the one
      // this call is about to swap into and play — so the lookahead preload
      // overwrites its buffered audio with a different track's stream before
      // .play() below ever runs. Flipping here first means getStandby() always
      // sees the correct (already-updated) slot, so that preload can never
      // land on the element this call is using.
      if (wasPreloaded) {
        activeSlot.current = activeSlot.current === 'A' ? 'B' : 'A'
      }

      // Downloaded-for-offline tracks bypass the network entirely — no
      // preload/quality-fallback cascade applies since there's no network
      // fetch to preload or fall back on.
      getOfflineObjectURL(t.id).then(offlineUrl => {
        // Staleness guard: a newer startTrack() call may have already taken
        // over (e.g. rapid track skips, or switching across the local/YouTube
        // boundary) while this offline lookup was still in flight. Without this
        // check, this orphaned callback would still call .play() on its captured
        // element after a newer track has already started elsewhere — audible
        // as two tracks playing at once.
        if (trackRef.current?.id !== t.id) return

        if (offlineUrl) {
          active.pause()
          active.src = offlineUrl
          active.play().catch(console.error)
          return
        }
        // Check if this track was already preloaded in the standby audio
        if (wasPreloaded) {
          // Seamless swap: standby already has data buffered. The slot was
          // already flipped synchronously above, before this callback ran.
          active.pause()
          active.removeAttribute('src')
          active.load()  // release the old stream
          standby.play().catch(console.error)
        } else {
          // Normal load (no preload available or different track)
          active.src = streamUrl(t.id, resolveQuality(t.id, q), getClientId(), attemptIdRef.current)
          active.play().catch(console.error)
        }
      })
    }

    preloadedTrackId.current = null
    retriesRef.current = {}
    trackRef.current = t  // sync immediately so getActive() is correct before next render
    setTrack(t)
    setQueueIdx(idx)
    setPlaying(true)
    setProgress(0)
    // Seed duration from DB immediately so the progress bar shows a real value even before
    // loadedmetadata fires — critical for live-transcoded streams where el.duration === Infinity
    setDuration(t.duration_s > 0 ? t.duration_s : 0)
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
      if (isFinite(el.duration) && el.duration > 0) setDuration(el.duration)
    }

    const onMeta = (e: Event) => {
      const el = e.target as HTMLAudioElement
      if (el !== getActive()) return
      // Only override if audio element reports a valid finite duration.
      // For live-transcoded streams el.duration === Infinity — don't clobber the DB value.
      if (isFinite(el.duration) && el.duration > 0) setDuration(el.duration)
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
      const errMsg = err?.message || 'Unknown playback error'
      const errCode = err?.code || 0
      
      console.error('Audio error:', {
        code: errCode,
        message: errMsg,
        src: el.src,
        trackId: tId
      })

      // Send error details to backend for tracing!
      fetch('/api/playback/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_id: tId,
          src: el.src,
          error_code: errCode,
          error_message: errMsg,
          user_agent: navigator.userAgent,
          version: pkg.version,
          client_id: getClientId(),
          attempt_id: attemptIdRef.current
        })
      }).catch(console.error)

      // MEDIA_ERR_NETWORK = 2
      if (errCode === 2) {
        // A burst of network errors for the same track fires onError repeatedly
        // before the previous retry has finished — without this guard each one
        // would start its own reload-seek-play cycle, heard as the same short
        // chunk repeating rapidly.
        if (retryPendingRef.current[tId]) return

        const count = retriesRef.current[tId] ?? 0
        if (count < 3) {
          console.warn(`Network error. Retrying (${count + 1}/3)...`)
          retriesRef.current[tId] = count + 1
          retryPendingRef.current[tId] = true

          const currentPos = el.currentTime
          const currentSrc = el.src

          // Wait briefly before retrying so a transient network hiccup has time
          // to clear, instead of hammering the same request again immediately.
          setTimeout(() => {
            if (el !== getActive() || trackRef.current?.id !== tId) {
              retryPendingRef.current[tId] = false
              return
            }

            // Re-load the source to trigger a fresh connection
            el.src = ''
            el.load()
            el.src = currentSrc

            const onReady = () => {
              retryPendingRef.current[tId] = false
              el.currentTime = currentPos
              el.play().catch(console.error)
            }
            el.addEventListener('canplay', onReady, { once: true })
            el.load()
          }, 800)
          return
        } else {
          console.error('Max retries reached for network error.')
        }
      }

      // Code 4 in 320K mode: the original file has an unsupported/corrupt format that ffmpeg
      // couldn't transcode cleanly. Try direct passthrough as a last resort.
      if (errCode === 4 && qualityRef.current === '320' && !tId.startsWith('yt:') && !el.src.includes('q=')) {
        console.warn('[cozyroom] 320K transcode failed (format error). Falling back to lossless passthrough.')
        const currentPos = el.currentTime
        const fallbackSrc = streamUrl(tId, 'lossless', getClientId(), attemptIdRef.current)
        el.src = ''
        el.load()
        el.src = fallbackSrc
        const onReady = () => {
          saveQualityOverride(tId, 'lossless')
          el.currentTime = currentPos
          el.play().catch(console.error)
        }
        el.addEventListener('canplay', onReady, { once: true })
        el.load()
        return
      }

      // If we encounter a source/decode error (Code 3 or 4) on lossless,
      // try to fall back to clean lossless (metadata-stripped copy).
      // If that also fails, fall back to 320kbps MP3 transcode.
      if ((errCode === 3 || errCode === 4) && qualityRef.current === 'lossless' && !tId.startsWith('yt:')) {
        const isCleanAlready = el.src.includes('q=lossless-clean')
        if (!isCleanAlready) {
          console.warn('Lossless playback failed (source/decode error). Falling back to clean lossless (FLAC copy without metadata)...')
          
          const currentPos = el.currentTime
          const fallbackSrc = streamUrl(tId, 'lossless-clean', getClientId(), attemptIdRef.current)
          
          el.src = ''
          el.load()
          el.src = fallbackSrc

          const onReady = () => {
            saveQualityOverride(tId, 'lossless-clean')
            el.currentTime = currentPos
            el.play().catch(console.error)
          }
          el.addEventListener('canplay', onReady, { once: true })
          el.load()
          return
        } else {
          console.warn('Clean lossless playback failed. Falling back to 320K MP3 transcode...')

          const currentPos = el.currentTime
          const fallbackSrc = streamUrl(tId, '320', getClientId(), attemptIdRef.current)

          el.src = ''
          el.load()
          el.src = fallbackSrc

          const onReady = () => {
            saveQualityOverride(tId, '320')
            el.currentTime = currentPos
            el.play().catch(console.error)
          }
          el.addEventListener('canplay', onReady, { once: true })
          el.load()
          return
        }
      }

      // Non-retryable error or retries exhausted: set error state
      setPlaybackError({
        code: errCode,
        message: errMsg,
        trackId: tId
      })
      setPlaying(false)
    }

    // Previously nudged currentTime back ~0.1s and forced play() on 'stalled'
    // (and, before that, also on 'waiting') to try to force the browser to
    // re-request data. Removed entirely: both events fire routinely during
    // ordinary progressive streaming of large lossless files on a variable
    // connection, and the browser already recovers from them on its own —
    // the manual rewind was the actual source of the repeating ~0.1-0.2s
    // "loopback" heard every few phrases, not a fix for it. A genuine dead
    // connection is already handled by onError's MEDIA_ERR_NETWORK retry
    // (with its own backoff + re-entrancy guard) below.

    for (const el of [a, b, yt]) {
      el.addEventListener('timeupdate',     onTime)
      el.addEventListener('loadedmetadata', onMeta)
      el.addEventListener('ended',          onEnd)
      el.addEventListener('pause',          onPause)
      el.addEventListener('error',          onError)
    }
    return () => {
      for (const el of [a, b, yt]) {
        el.removeEventListener('timeupdate',     onTime)
        el.removeEventListener('loadedmetadata', onMeta)
        el.removeEventListener('ended',          onEnd)
        el.removeEventListener('pause',          onPause)
        el.removeEventListener('error',          onError)
      }
    }
  }, [startTrack])

  // ── Preload trigger: immediate on track change ───────────────────────
  useEffect(() => {
    if (!track) return
    const next = peekNextTrack()
    if (!next) return
    if (preloadedTrackId.current === next.track.id) return
    if (preloadPendingId.current === next.track.id) return // already loading, waiting on canplay
    const standby = getStandby()
    const q = qualityRef.current
    const targetId = next.track.id
    preloadPendingId.current = targetId
    standby.src = streamUrl(targetId, resolveQuality(targetId, q))
    standby.preload = 'auto'
    standby.load()
    standby.addEventListener('canplay', () => {
      // Only trust this if no newer preload target has since superseded it —
      // a rapid next/prev before this one finished buffering would have
      // overwritten preloadPendingId, and marking this id ready anyway would
      // let startTrack's seamless-swap play a standby that never actually
      // buffered the track it thinks it did.
      if (preloadPendingId.current === targetId) preloadedTrackId.current = targetId
    }, { once: true })
  }, [track, peekNextTrack, getStandby])

  // ── Preload trigger: 30s look-ahead fallback ──────────────────────────
  useEffect(() => {
    if (!track || duration <= 0) return
    if (duration - progress > PRELOAD_LOOK_AHEAD_S) return

    const next = peekNextTrack()
    if (!next) return
    if (preloadedTrackId.current === next.track.id) return // already preloaded
    if (preloadPendingId.current === next.track.id) return // already loading, waiting on canplay

    const standby = getStandby()
    const q = qualityRef.current
    const targetId = next.track.id
    preloadPendingId.current = targetId
    standby.src = streamUrl(targetId, resolveQuality(targetId, q))
    standby.preload = 'auto'
    standby.load()
    standby.addEventListener('canplay', () => {
      if (preloadPendingId.current === targetId) preloadedTrackId.current = targetId
    }, { once: true })
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

  // Jump to a specific position in the CURRENT queue (Up Next list click).
  // Deliberately bypasses `play()`'s newQueue path — passing the same queue
  // back through there would flip lockedQueueRef.current to true, silently
  // killing smart-radio auto-fill for a queue that was never meant to be
  // locked. startTrack() alone updates track/queueIdx and leaves
  // lockedQueueRef / the queue array untouched, exactly like a natural
  // next()/prev() advance.
  const playFromQueue = useCallback((idx: number) => {
    const q = queueRef.current
    if (idx < 0 || idx >= q.length) return
    startTrack(q[idx], idx)
  }, [startTrack])

  const toggle = () => {
    const active = getActive()
    if (isPlaying) { active.pause(); setPlaying(false) }
    else           { initAudioCtx(); active.play().catch(console.error); setPlaying(true) }
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
    navigator.mediaSession.setActionHandler('play',          () => { active.play().then(() => setPlaying(true)).catch(console.error) })
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
      recordPlay(track.id).catch(() => {})
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
      play, playFromQueue, toggle, seek, prev, next,
      setRepeat, setShuffleMode: handleSetShuffleMode, setQuality, setCoverColors,
      playbackError, setPlaybackError,
      queueOpen, setQueueOpen,
      npoOpen, setNpoOpen,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const usePlayer = () => useContext(Ctx)
