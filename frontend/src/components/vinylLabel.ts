// Aged (faded print) label colours for the vinyl disc, from the cover's main colour: light, low saturation.
// Grey/unknown covers get a faded orange.
const ORANGE: [string, string] = ['hsl(20 42% 78%)', 'hsl(18 38% 70%)']

export function labelColors(hex: string | undefined): [string, string] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex ?? '')
  if (!m) return ORANGE
  const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (d < 0.08) return ORANGE   // grey cover: no usable hue
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [`hsl(${Math.round(h * 60)} 38% 78%)`, `hsl(${Math.round(h * 60)} 34% 70%)`]
}
