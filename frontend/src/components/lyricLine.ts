type Line = { time: number; text: string }

// Current + next line for `progress`. Bilingual files repeat a timestamp (original, translation):
// both cur and next take the LAST line of their group, so they stay in the same language.
export function pickLine(synced: Line[], progress: number): { cur: string; next: string } {
  const lastOfGroup = (k: number) => { while (k + 1 < synced.length && synced[k + 1].time === synced[k].time) k++; return k }
  let i = synced.length - 1
  while (i >= 0 && synced[i].time > progress) i--
  if (i < 0) return { cur: '♪', next: synced[lastOfGroup(0)].text }
  const j = lastOfGroup(i) + 1
  return { cur: synced[i].text, next: j < synced.length ? synced[lastOfGroup(j)].text : '' }
}
