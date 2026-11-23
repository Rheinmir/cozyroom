import type { ReactNode } from 'react'

// The app's one icon set: 24px grid, stroke = currentColor, round caps — the same style as the
// inline icons in Sidebar / MobileNav / PlayerBar. Use these instead of emoji or text glyphs.
type P = { size?: number; className?: string }

const Svg = ({ size = 18, className, children, fill }: P & { children: ReactNode; fill?: boolean }) => (
  <svg
    viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" focusable="false"
    fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'}
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flex: 'none' }}
  >
    {children}
  </svg>
)

export const IconGlobe   = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9S14.6 18.5 12 21c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3z" /></Svg>
export const IconBolt    = (p: P) => <Svg {...p}><path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" /></Svg>
export const IconWarning = (p: P) => <Svg {...p}><path d="M12 4l9 16H3z" /><path d="M12 10v4.5M12 17.5v.01" /></Svg>
export const IconClose   = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
export const IconCheck   = (p: P) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>
export const IconNote    = (p: P) => <Svg {...p}><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></Svg>
export const IconSparkle = (p: P) => <Svg {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></Svg>
export const IconStar = ({ filled, ...p }: P & { filled?: boolean }) => <Svg {...p} fill={filled}><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z" /></Svg>
export const IconChevronDown = (p: P) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>
export const IconDisc    = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><path d="M12 3a9 9 0 0 1 7 3.4" /></Svg>
export const IconLyrics  = (p: P) => <Svg {...p}><path d="M4 7h16M4 12h11M4 17h7" /></Svg>
export const IconPrev    = (p: P) => <Svg {...p}><path d="M18 6v12L8.5 12z" /><path d="M5.5 6v12" /></Svg>
export const IconNext    = (p: P) => <Svg {...p}><path d="M6 6v12l9.5-6z" /><path d="M18.5 6v12" /></Svg>
export const IconShuffle = (p: P) => <Svg {...p}><path d="M3 7h3.5c5 0 5 10 10 10H21M3 17h3.5c1.8 0 3-.9 4-2M13.5 9c1-1.2 2.2-2 4-2H21" /><path d="M18.5 4.5L21 7l-2.5 2.5M18.5 14.5L21 17l-2.5 2.5" /></Svg>
export const IconRepeat  = ({ one, ...p }: P & { one?: boolean }) => <Svg {...p}><path d="M4 11V9a3 3 0 0 1 3-3h12M16 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H5M8 21l-3-3 3-3" />{one && <path d="M11.5 10.5L13 9.5v5" />}</Svg>
// "now playing" marker: three bars
export const IconBars    = (p: P) => <Svg {...p}><path d="M6 18v-6M12 18V6M18 18v-9" /></Svg>
