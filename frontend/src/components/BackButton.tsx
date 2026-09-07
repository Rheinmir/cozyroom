import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type Props = {
  /** Custom back action. Takes precedence over `to`. */
  onClick?: () => void
  /** Route to navigate to (used when no onClick is given). */
  to?: string
  /** Accessible label / tooltip. Not shown as visible text (icon-only button). */
  label?: string
  /**
   * Auto-hide on scroll (default true): the button hides while scrolling down
   * and reveals while scrolling up or near the top, tracking the app's `.main`
   * scroll container. Set false for contexts with their own scroll area
   * (e.g. fullscreen overlays) where it should stay visible.
   */
  autoHide?: boolean
  /**
   * Render for a fullscreen overlay: pins to the true top-left corner
   * (ignoring the desktop sidebar offset) and sits above overlay layers.
   */
  overlay?: boolean
}

export default function BackButton({
  onClick,
  to,
  label = 'Back',
  autoHide = true,
  overlay = false,
}: Props) {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!autoHide) {
      setVisible(true)
      return
    }

    let scroller: HTMLElement | null = null
    let lastY = 0

    // Processed synchronously so the direction check always reflects the latest
    // scroll position (rAF throttling can drop the trailing event and lag the
    // reveal). setVisible is idempotent — React skips the re-render when the
    // value is unchanged, so this stays cheap.
    const onScroll = () => {
      if (!scroller) return
      const y = scroller.scrollTop
      if (y < 40) setVisible(true) // near the top: always show
      else if (y > lastY + 4) setVisible(false) // scrolling down: hide
      else if (y < lastY - 4) setVisible(true) // scrolling up: reveal
      lastY = y
    }

    let tries = 0
    let retry: ReturnType<typeof setTimeout> | undefined
    const attach = () => {
      // AppRoutes owns `.main` (the real scroll container); find it from the DOM
      // rather than a ref so this component stays self-contained.
      scroller = document.querySelector<HTMLElement>('.main')
      if (!scroller) {
        if (tries++ < 20) retry = setTimeout(attach, 50)
        return
      }
      lastY = scroller.scrollTop
      setVisible(true) // always start revealed so users are never stuck
      scroller.addEventListener('scroll', onScroll, { passive: true })
    }
    attach()

    return () => {
      if (retry) clearTimeout(retry)
      if (scroller) scroller.removeEventListener('scroll', onScroll)
    }
  }, [autoHide])

  const handleClick = () => {
    if (onClick) onClick()
    else if (to) navigate(to)
  }

  const cls =
    'app-back-btn' +
    (overlay ? ' app-back-btn--overlay' : '') +
    (visible ? ' app-back-btn--visible' : '')

  return (
    <button type="button" className={cls} onClick={handleClick} aria-label={label} title={label}>
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  )
}
