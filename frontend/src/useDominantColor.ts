import { useState, useEffect } from 'react'

// Samples a cover image via canvas and returns its dominant colour as an
// "r, g, b" string. CORS-safe: cross-origin covers that block getImageData
// fall back to the neutral default. Lifted from PlaylistsPage so album/artist
// detail heroes can reuse the exact same extraction (Apple Music .am-tint wash).
export function useDominantColor(src: string | undefined): string {
  const [rgb, setRgb] = useState('40, 40, 55')
  useEffect(() => {
    if (!src) return
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = 50
      const ctx = c.getContext('2d')
      if (!ctx) return
      try {
        ctx.drawImage(img, 0, 0, 50, 50)
        const d = ctx.getImageData(0, 0, 50, 50).data
        let r = 0, g = 0, b = 0, n = 0
        for (let i = 0; i < d.length; i += 4) {
          const br = (d[i] + d[i + 1] + d[i + 2]) / 3
          if (br < 15 || br > 235) continue
          r += d[i]; g += d[i + 1]; b += d[i + 2]; n++
        }
        if (n > 0) setRgb(`${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)}`)
      } catch {}
    }
    img.crossOrigin = 'anonymous'
    img.onerror = () => {}
    img.src = src
  }, [src])
  return rgb
}

// Mixes an "r, g, b" string toward black by `amount` (0..1), yielding a muted,
// low-lightness tint the way Apple Music darkens the cover colour so white hero
// text stays legible over the wash.
export function darkenTint(rgb: string, amount = 0.5): string {
  const parts = rgb.split(',').map(n => parseInt(n.trim(), 10))
  const [r, g, b] = parts
  const mix = (c: number) => Math.round((Number.isFinite(c) ? c : 0) * (1 - amount))
  return `${mix(r)}, ${mix(g)}, ${mix(b)}`
}
