// A single designed placeholder for any music cover that can't load an image
// (missing album_id, or a cover URL that 404s). Used everywhere instead of a
// bare "♪" character so missing covers read as a real, consistent artwork tile.
// Self-contained SVG data-URI — no network, no extra asset file.
const SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#26262a'/>
      <stop offset='1' stop-color='#141416'/>
    </linearGradient>
  </defs>
  <rect width='120' height='120' fill='url(#g)'/>
  <g fill='#4a4a50'>
    <circle cx='46' cy='79' r='9'/>
    <circle cx='79' cy='72' r='9'/>
    <rect x='53' y='39' width='4' height='40' rx='2'/>
    <rect x='86' y='32' width='4' height='40' rx='2'/>
    <path d='M53 39 L90 32 L90 41 L53 48 Z'/>
  </g>
</svg>`

export const MUSIC_FALLBACK_COVER = `data:image/svg+xml,${encodeURIComponent(SVG)}`
