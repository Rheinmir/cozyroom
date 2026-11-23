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
    // No analyser (iOS keeps plain audio for background playback; or no gesture yet): animate the bars
    // with smooth synthetic motion while playing. Reduced motion: they rest.
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const binCount = analyser ? analyser.frequencyBinCount : 0
    dataRef.current = new Uint8Array(binCount) as Uint8Array<ArrayBuffer>
    const usedBins  = Math.floor(binCount * RANGE)

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      if (analyser) analyser.getByteFrequencyData(dataRef.current!)
      const t = performance.now()

      const palette = colorsRef.current || ['#1db954', '#191414']
      const gradient = `linear-gradient(to bottom, ${palette[0]}, ${palette[1] || palette[0]})`

      for (let i = 0; i < BARS; i++) {
        let val: number
        if (analyser) {
          const bin = Math.floor((i / BARS) * usedBins)
          const raw = dataRef.current![bin] / 255
          val = raw > 0.001 ? Math.max(0, (20 * Math.log10(raw) + 60) / 60) : 0
        } else {
          val = calm ? 0 : Math.max(0, Math.min(1, 0.4 + 0.3 * Math.sin(t * 0.004 + i * 0.55) * Math.sin(t * 0.0013 + i * 0.21) + 0.2 * Math.sin(t * 0.009 + i * 1.7)))
        }

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
