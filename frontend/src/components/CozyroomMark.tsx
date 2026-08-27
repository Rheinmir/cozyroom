// Cozyroom's own mark — a lit window/room, monochrome. Replaces the
// borrowed Spotify play-button placeholder per DESIGN.md's explicit Don't.
export default function CozyroomMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="6" stroke="#fff" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.4" fill="#fff" />
    </svg>
  )
}
