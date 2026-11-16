// Cozyroom's mark — a fire burning in a hearth. The mantel and stone surround
// say "inside, a room"; the flame glowing in the dark opening says "warm".
// Monochrome via currentColor (surround at half strength so the fire leads);
// the inner flame is a pale ember tint (.cozy-mark-core) so it reads at 16px.
export default function CozyroomMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="cozy-mark" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="2.8" width="20" height="2.9" rx="1.1" fill="currentColor" />
      <path d="M3.8 5.7h16.4v15.8h-3.2v-7.2a5 5 0 0 0-10 0v7.2H3.8z" fill="currentColor" opacity=".5" />
      {/* outer <g> positions the flame; inner one is free for the CSS flicker
          (a CSS transform would override an SVG transform attribute) */}
      <g transform="translate(12 20.9) scale(.7) translate(-12 -14.6)">
      <g className="cozy-mark-flame">
        <path
          d="M12 2.6c.6 2.2 2.4 3.4 3.5 5.2 1.4 2.2.9 5.3-1.3 6.6a4.3 4.3 0 0 1-6.3-2.4c-.6-1.9 0-3.6 1.1-4.9.2 1.1.8 1.9 1.6 2.1-.6-2.2.1-4.6 1.4-6.6z"
          fill="currentColor"
        />
        <path
          d="M12.2 8.6c.4 1.1 1.4 1.8 1.6 3a2 2 0 0 1-3.9.6c-.1-.8.2-1.5.7-2 .1.5.4.8.8.9-.1-.9.2-1.8.8-2.5z"
          fill="currentColor"
          className="cozy-mark-core"
        />
      </g>
      </g>
    </svg>
  )
}
