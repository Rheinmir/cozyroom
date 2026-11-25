// Run: node --experimental-strip-types beatSpring.check.ts
// A kick every 30 frames over a loud steady level must move the bar far more than the old formula.
import { beatInit, beatStep } from './beatSpring.ts'

const h = 30, frames = 240
const level = (f: number) => (f % 30 < 3 ? 0.95 : 0.7)
// old: 60 dB log scale + 0.35 lerp
let cur = 1; const oldS: number[] = []
for (let f = 0; f < frames; f++) {
  const raw = level(f), v = Math.max(0, (20 * Math.log10(raw) + 60) / 60)
  cur += ((3 + v * 33 * (0.45 + 0.55 * h / 36)) / h - cur) * 0.35; if (f > 60) oldS.push(cur)
}
const s = beatInit(1); const newS: number[] = []
for (let f = 0; f < frames; f++) { const [c] = beatStep(s, [level(f)], [h]); if (f > 60) newS.push(c) }
const range = (a: number[]) => Math.max(...a) - Math.min(...a)
const ro = range(oldS), rn = range(newS)
console.log(`swing old=${ro.toFixed(3)} new=${rn.toFixed(3)} (${(rn / ro).toFixed(1)}x)`)
if (!(rn > 3 * ro)) throw new Error('beat swing not stronger')
// silence settles: no runaway oscillation
const q = beatInit(1); let last = 0
for (let f = 0; f < 200; f++) last = beatStep(q, [0], [h])[0]
if (Math.abs(q.vel[0]) > 1e-3) throw new Error('spring does not settle')
console.log('ok settle', last.toFixed(3))
