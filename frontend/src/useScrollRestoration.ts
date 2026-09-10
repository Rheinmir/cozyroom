import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

// Module-level so it survives across route changes without living in React state.
const scrollPositions = new Map<string, number>()

/**
 * `.main` is an internally-scrolling div (overflow-y: auto), not the window —
 * the browser's native back/forward scroll restoration only tracks
 * window.scrollY, so it does nothing here. Every route also passes through a
 * brief `.loading` state with short content, which clamps scrollTop toward 0;
 * once the real (taller) content mounts, nothing restores it — hence "always
 * back to top" even though the container itself never unmounts.
 *
 * This re-applies the saved position for the target route on every content
 * height change (via ResizeObserver) until it sticks or the user starts
 * scrolling themselves, so it works regardless of how long a page's data
 * takes to load.
 */
export function useScrollRestoration(mainRef: React.RefObject<HTMLElement>) {
  const location = useLocation()
  const pendingTarget = useRef<number | null>(null)

  // Continuously remember where the user is on the CURRENT route.
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const onScroll = () => scrollPositions.set(location.pathname, el.scrollTop)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [location.pathname, mainRef])

  // On route change, restore the saved position for the NEW route, retrying
  // as its content grows in (e.g. after a loading spinner resolves).
  useEffect(() => {
    const el = mainRef.current
    if (!el) return

    const target = scrollPositions.get(location.pathname) ?? 0
    pendingTarget.current = target
    el.scrollTop = target

    const ro = new ResizeObserver(() => {
      if (pendingTarget.current != null) el.scrollTop = pendingTarget.current
    })
    ro.observe(el)

    // A direct user gesture means they've taken over — stop fighting them.
    const giveUp = () => { pendingTarget.current = null }
    el.addEventListener('wheel', giveUp, { passive: true, once: true })
    el.addEventListener('touchmove', giveUp, { passive: true, once: true })

    // Most pages finish loading well within this window; stop retrying after.
    const stopRetrying = setTimeout(giveUp, 1500)

    return () => {
      ro.disconnect()
      clearTimeout(stopRetrying)
      el.removeEventListener('wheel', giveUp)
      el.removeEventListener('touchmove', giveUp)
    }
  }, [location.pathname, mainRef])
}
