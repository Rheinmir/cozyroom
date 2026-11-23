// Note glyph for the disc label. A shuffled "bag": every glyph is used once before any repeats (even, round robin
// but in random order), and the next glyph never equals the previous one, also across a bag boundary.
export const NOTES = ['♩', '♪', '♫', '♬']

export function makeNoteBag(rand: () => number = Math.random) {
  let bag: string[] = []
  let last = ''
  return () => {
    if (bag.length === 0) {
      bag = [...NOTES]
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]] }
      if (bag[bag.length - 1] === last) [bag[bag.length - 1], bag[0]] = [bag[0], bag[bag.length - 1]]  // we pop from the end
    }
    last = bag.pop()!
    return last
  }
}

// One glyph per track change; asking again for the same track returns the same glyph (safe to call during render).
const draw = makeNoteBag()
let lastId = '', lastNote = ''
export function noteFor(trackId: string): string {
  if (trackId !== lastId) { lastId = trackId; lastNote = draw() }
  return lastNote
}
