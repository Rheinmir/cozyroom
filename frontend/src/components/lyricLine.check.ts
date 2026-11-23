// Run: node --experimental-strip-types lyricLine.check.ts
import { pickLine } from './lyricLine.ts'

const eq = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(JSON.stringify(a) + ' != ' + JSON.stringify(b)) }

const mono = [{ time: 1, text: 'a' }, { time: 5, text: 'b' }]
eq(pickLine(mono, 0), { cur: '♪', next: 'a' })
eq(pickLine(mono, 2), { cur: 'a', next: 'b' })
eq(pickLine(mono, 9), { cur: 'b', next: '' })

// bilingual: (orig, tr) pairs share a timestamp; both sides must show the translation
const bi = [{ time: 1, text: 'a' }, { time: 1, text: 'A-tr' }, { time: 5, text: 'b' }, { time: 5, text: 'B-tr' }]
eq(pickLine(bi, 0), { cur: '♪', next: 'A-tr' })
eq(pickLine(bi, 2), { cur: 'A-tr', next: 'B-tr' })
eq(pickLine(bi, 6), { cur: 'B-tr', next: '' })
console.log('ok')
