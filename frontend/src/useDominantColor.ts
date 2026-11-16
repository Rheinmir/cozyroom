import { useState, useEffect } from 'react'

// Samples a cover image via canvas and returns its most characteristic colour
// as an "r, g, b" string. A plain average of every pixel turns a yellow+blue
// cover into mud-grey, so instead pixels are bucketed by hue and weighted by
// saturation: the winning bucket is the colour the eye actually reads as "the
// cover's colour". The result is then normalised to a rich-but-dark tone so a
// wash built from it always keeps white text legible. CORS-safe: covers that
// block getImageData fall back to the neutral default.
const FALLBACK = '40, 40, 55'

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v] }
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)].map(v => Math.round(v * 255)) as [number, number, number]
}

export function pickCoverColor(d: Uint8ClampedArray): string | null {
  const BINS = 24
  const weight = new Array(BINS).fill(0)
  const sum = Array.from({ length: BINS }, () => [0, 0, 0, 0]) // r, g, b, n
  let greyL = 0, greyN = 0
  for (let i = 0; i < d.length; i += 4) {
    const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2])
    if (l < 0.08 || l > 0.94) continue
    if (s < 0.18) { greyL += l; greyN++; continue }
    const bin = Math.min(BINS - 1, Math.floor(h * BINS))
    // favour saturated mid-tones; near-white/near-black pixels count less
    const w = s * s * (1 - Math.abs(l - 0.5) * 1.2)
    weight[bin] += w
    const acc = sum[bin]
    acc[0] += d[i]; acc[1] += d[i + 1]; acc[2] += d[i + 2]; acc[3]++
  }
  let best = -1, bestW = 0
  for (let b = 0; b < BINS; b++) if (weight[b] > bestW) { bestW = weight[b]; best = b }
  // A cover that is essentially monochrome gets a neutral, slightly cool wash.
  if (best < 0 || bestW < 1.5) {
    if (!greyN) return null
    const v = Math.round(Math.min(0.32, greyL / greyN) * 255)
    return `${v}, ${v}, ${Math.min(255, v + 8)}`
  }
  const [r, g, b, n] = sum[best]
  const [h, s] = rgbToHsl(r / n, g / n, b / n)
  // Normalise: keep the hue, guarantee some colour, cap lightness so the wash
  // reads as a deep tint rather than a bright flood.
  const [nr, ng, nb] = hslToRgb(h, Math.min(0.75, Math.max(0.42, s)), 0.36)
  return `${nr}, ${ng}, ${nb}`
}

export function useDominantColor(src: string | undefined): string {
  const [rgb, setRgb] = useState(FALLBACK)
  useEffect(() => {
    if (!src) return
    let alive = true
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = 48
      const ctx = c.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      try {
        ctx.drawImage(img, 0, 0, 48, 48)
        const picked = pickCoverColor(ctx.getImageData(0, 0, 48, 48).data)
        if (alive && picked) setRgb(picked)
      } catch {}
    }
    img.crossOrigin = 'anonymous'
    img.onerror = () => {}
    img.src = src
    return () => { alive = false }
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
