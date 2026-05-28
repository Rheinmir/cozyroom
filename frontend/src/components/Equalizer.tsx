import { useEffect, useRef } from 'react'
import { usePlayer } from '../PlayerContext'

const BARS      = 60
const RANGE     = 0.6   // lower 60% of bins (bass + mids)

export default function Equalizer() {
  const { analyser, isPlaying, coverColors } = usePlayer()
  const barsRef    = useRef<(HTMLDivElement | null)[]>(Array(BARS).fill(null))
  const rafRef     = useRef<number>()
  const dataRef    = useRef<Uint8Array<ArrayBuffer>>()
  const isPlayRef  = useRef(isPlaying)
  useEffect(() => { isPlayRef.current = isPlaying }, [isPlaying])

  const colorsRef  = useRef(coverColors)
  useEffect(() => { colorsRef.current = coverColors }, [coverColors])

  useEffect(() => {
    if (!analyser) return

    const binCount = analyser.frequencyBinCount
    dataRef.current = new Uint8Array(binCount) as Uint8Array<ArrayBuffer>
    const usedBins  = Math.floor(binCount * RANGE)

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataRef.current!)

      const palette = colorsRef.current || ['#1db954', '#191414']
      const gradient = `linear-gradient(to bottom, ${palette[0]}, ${palette[1] || palette[0]})`

      for (let i = 0; i < BARS; i++) {
        const bin = Math.floor((i / BARS) * usedBins)
        const raw = dataRef.current![bin] / 255

        const val = raw > 0.001
          ? Math.max(0, (20 * Math.log10(raw) + 60) / 60)
          : 0

        const scale = isPlayRef.current ? Math.max(0.04, val) : 0.04

        const barTop = barsRef.current[i]
        if (!barTop) continue
        
        barTop.style.transform = `scaleY(${scale})`
        const barBottom = barTop.nextElementSibling as HTMLDivElement
        if (barBottom) {
          barBottom.style.transform = `scaleY(${scale})`
        }

        barTop.style.background = gradient
        if (barBottom) {
          // Mirrored gradient for the reflection
          barBottom.style.background = `linear-gradient(to top, ${palette[0]}, ${palette[1] || palette[0]})`
        }
        
        barTop.style.boxShadow = `0 0 15px ${palette[0]}33`
      }
    }

    draw()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [analyser])

  if (!analyser) return null

  return (
    <div className="eq-container">
      <div className="eq-wrap">
        {Array.from({ length: BARS }, (_, i) => (
          <div key={i} className="eq-col">
            <div
              className="eq-bar eq-bar--top"
              ref={el => { barsRef.current[i] = el }}
            />
            <div className="eq-bar eq-bar--bottom" />
          </div>
        ))}
      </div>
    </div>
  )
}
