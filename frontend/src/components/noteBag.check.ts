// Run: node --experimental-strip-types noteBag.check.ts
import { makeNoteBag, NOTES } from './noteBag.ts'

const next = makeNoteBag()
const seq: string[] = []
for (let i = 0; i < 4000; i++) seq.push(next())
for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i - 1]) throw new Error('repeat at ' + i)
for (const n of NOTES) { const c = seq.filter(x => x === n).length; if (c !== 1000) throw new Error(n + ' used ' + c + ' times') }
for (let i = 0; i < seq.length; i += 4) if (new Set(seq.slice(i, i + 4)).size !== 4) throw new Error('bag ' + i / 4 + ' is not a full round')
const orders = new Set(Array.from({ length: 1000 }, (_, k) => seq.slice(k * 4, k * 4 + 4).join('')))
if (orders.size < 10) throw new Error('order is not random enough: ' + orders.size)
console.log('ok, 4000 draws, orders seen:', orders.size)
