import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react'

export type BgSoundName = string

interface AvailableSound {
  name: BgSoundName
  label: string
}

interface BgState {
  active: BgSoundName | null
  volume: number
}

interface BgSoundsCtx extends BgState {
  sounds: AvailableSound[]
  isPlaying: boolean
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  setActive: (name: BgSoundName | null) => void
  setVolume: (v: number) => void
}

const STORAGE_KEY = 'bg-sounds'

// Noise sounds shown first in the list — served as files from Apple's originals
const NOISE_SOUNDS: AvailableSound[] = [
  { name: 'balanced-noise', label: 'Balanced Noise' },
  { name: 'bright-noise',   label: 'Bright Noise' },
  { name: 'dark-noise',     label: 'Dark Noise' },
]

const NOISE_NAMES = new Set(NOISE_SOUNDS.map(s => s.name))

function loadState(): BgState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return {
        active: p.active ?? null,
        volume: typeof p.volume === 'number' ? Math.max(0, Math.min(1, p.volume)) : 0.3,
      }
    }
  } catch {}
  return { active: null, volume: 0.3 }
}


const Ctx = createContext<BgSoundsCtx | null>(null)

export function BgSoundsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BgState>(loadState)
  const [ambientSounds, setAmbientSounds] = useState<AvailableSound[]>([])
  const [panelOpen, setPanelOpen] = useState(false)

  const audioRef   = useRef<HTMLAudioElement | null>(null)
  const playingRef = useRef<BgSoundName | null>(null)

  useEffect(() => {
    fetch('/api/ambient-sounds')
      .then(r => r.ok ? r.json() : [])
      .then((list: AvailableSound[]) => setAmbientSounds(list))
      .catch(() => {})
  }, [])

  function stopAll() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    playingRef.current = null
  }

  function startSound(name: BgSoundName, volume: number) {
    if (!audioRef.current) audioRef.current = new Audio()
    const audio = audioRef.current
    audio.volume = volume
    audio.loop = true
    audio.src = `/api/ambient-sounds/${encodeURIComponent(name)}`
    // Randomize start position for fresh feel each play — noise files are short so skip
    if (!NOISE_NAMES.has(name)) {
      audio.addEventListener('loadedmetadata', function onMeta() {
        audio.removeEventListener('loadedmetadata', onMeta)
        if (audio.duration > 10) audio.currentTime = Math.random() * audio.duration
      })
    }
    audio.play().catch(() => {})
    playingRef.current = name
  }

  // Handle active sound switch — stop old, start new
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!state.active) { stopAll(); return }
    if (playingRef.current === state.active) return
    stopAll()
    startSound(state.active, state.volume)
  }, [state.active]) // intentionally omit state.volume to avoid restart on volume change

  // Handle volume changes — update in-place, never restart
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = state.volume
  }, [state.volume])

  // Persist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ active: state.active, volume: state.volume }))
  }, [state.active, state.volume])

  const setActive = useCallback((name: BgSoundName | null) => {
    setState(s => ({ ...s, active: name }))
  }, [])

  const setVolume = useCallback((v: number) => {
    setState(s => ({ ...s, volume: Math.max(0, Math.min(1, v)) }))
  }, [])

  const allSounds: AvailableSound[] = [...NOISE_SOUNDS, ...ambientSounds.filter(s => !NOISE_NAMES.has(s.name))]

  return (
    <Ctx.Provider value={{
      active: state.active,
      volume: state.volume,
      sounds: allSounds,
      isPlaying: state.active !== null,
      panelOpen,
      setPanelOpen,
      setActive,
      setVolume,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useBgSounds(): BgSoundsCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useBgSounds must be used inside BgSoundsProvider')
  return ctx
}
