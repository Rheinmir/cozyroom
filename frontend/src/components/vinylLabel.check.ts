// Run: node --experimental-strip-types vinylLabel.check.ts
// Dark ink (#1b1b19) must keep >= 4.5:1 on both label colours for every hue.
import { labelColors } from './vinylLabel.ts'

const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const INK = lum(0x1b / 255, 0x1b / 255, 0x19 / 255)
function hslLum(css: string) {
  const [h, s, l] = (css.match(/[\d.]+/g) as string[]).map(Number)
  const S = s / 100, L = l / 100, a = S * Math.min(L, 1 - L)
  const f = (n: number) => L - a * Math.max(-1, Math.min((n + h / 30) % 12 - 3, 9 - (n + h / 30) % 12, 1))
  return lum(f(0), f(8), f(4))
}
const hex = (h: number) => { // a fully saturated cover colour of hue h
  const k = (n: number) => 1 - Math.max(0, Math.min((n + h / 60) % 6, 4 - (n + h / 60) % 6, 1))
  return '#' + [k(5), k(3), k(1)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
}
let worst = 99
for (let h = 0; h < 360; h += 3) for (const css of labelColors(hex(h))) {
  const L = hslLum(css), ratio = (L + 0.05) / (INK + 0.05)
  worst = Math.min(worst, ratio)
}
if (worst < 4.5) throw new Error('contrast too low: ' + worst.toFixed(2))
if (labelColors('#808080')[0] !== '#f59463') throw new Error('grey must keep the orange')
if (labelColors(undefined)[1] !== '#e87a4a') throw new Error('missing colour must keep the orange')
console.log('ok, worst contrast', worst.toFixed(2))
