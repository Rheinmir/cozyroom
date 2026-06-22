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

const NOISE_SOUNDS: AvailableSound[] = [
  { name: 'balanced-noise', label: 'Balanced Noise' },
  { name: 'bright-noise',   label: 'Bright Noise' },
  { name: 'dark-noise',     label: 'Dark Noise' },
]

const NOISE_TYPE: Record<string, 'pink' | 'white' | 'brown'> = {
  'balanced-noise': 'pink',
  'bright-noise':   'white',
  'dark-noise':     'brown',
}

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

// 2-second loopable noise buffer using Paul Kellet's approximation for pink noise
function makeNoiseBuffer(ctx: AudioContext, type: 'pink' | 'white' | 'brown'): AudioBuffer {
  const sr = ctx.sampleRate
  const buf = ctx.createBuffer(1, sr * 2, sr)
  const d = buf.getChannelData(0)
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,lastOut=0
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1
    if (type === 'white') {
      d[i] = w * 0.5
    } else if (type === 'pink') {
      b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759
      b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856
      b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980
      d[i] = (b0+b1+b2+b3+b4+b5+w*0.5362) * 0.11
    } else {
      lastOut = (lastOut + 0.02*w) / 1.02
      d[i] = lastOut * 3.5
    }
  }
  return buf
}

const Ctx = createContext<BgSoundsCtx | null>(null)

export function BgSoundsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BgState>(loadState)
  const [ambientSounds, setAmbientSounds] = useState<AvailableSound[]>([])
  const [panelOpen, setPanelOpen] = useState(false)

  const ctxRef   = useRef<AudioContext | null>(null)
  const gainRef  = useRef<GainNode | null>(null)
  const noiseRef = useRef<AudioBufferSourceNode | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playingRef = useRef<BgSoundName | null>(null)

  useEffect(() => {
    fetch('/api/ambient-sounds')
      .then(r => r.ok ? r.json() : [])
      .then((list: AvailableSound[]) => setAmbientSounds(list))
      .catch(() => {})
  }, [])

  function ensureCtx(): [AudioContext, GainNode] {
    if (!ctxRef.current) {
      const ctx = new AudioContext()
      const gain = ctx.createGain()
      gain.gain.value = loadState().volume
      gain.connect(ctx.destination)
      ctxRef.current = ctx
      gainRef.current = gain
    }
    return [ctxRef.current, gainRef.current!]
  }

  function stopAll() {
    if (noiseRef.current) {
      try { noiseRef.current.stop() } catch {}
      noiseRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    playingRef.current = null
  }

  function startSound(name: BgSoundName, volume: number) {
    const noiseType = NOISE_TYPE[name]
    if (noiseType) {
      const [ctx, gain] = ensureCtx()
      if (ctx.state === 'suspended') ctx.resume()
      gain.gain.value = volume
      const buf = makeNoiseBuffer(ctx, noiseType)
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true   // loop forever — only stops on pause or sound change
      src.connect(gain)
      src.start()
      noiseRef.current = src
    } else {
      if (!audioRef.current) audioRef.current = new Audio()
      audioRef.current.volume = volume
      audioRef.current.src = `/api/ambient-sounds/${encodeURIComponent(name)}`
      audioRef.current.loop = true   // loop forever
      audioRef.current.play().catch(() => {})
    }
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
    if (gainRef.current) gainRef.current.gain.value = state.volume
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

  const allSounds: AvailableSound[] = [...NOISE_SOUNDS, ...ambientSounds]

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
