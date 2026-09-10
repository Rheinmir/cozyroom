import { useLayoutEffect, useState, RefObject } from 'react'

// Measures space above/below `anchorRef` against the viewport and returns
// true when the menu should flip to the opposite side to avoid being clipped.
export function useFlipUp(
  anchorRef: RefObject<HTMLElement>,
  menuRef: RefObject<HTMLElement>,
  isOpen: boolean
): boolean {
  const [flipUp, setFlipUp] = useState(false)

  useLayoutEffect(() => {
    if (!isOpen) return
    const anchor = anchorRef.current
    const menu = menuRef.current
    if (!anchor || !menu) return
    const anchorRect = anchor.getBoundingClientRect()
    const menuHeight = menu.getBoundingClientRect().height
    const spaceBelow = window.innerHeight - anchorRect.bottom
    const spaceAbove = anchorRect.top
    setFlipUp(spaceBelow < menuHeight && spaceAbove > spaceBelow)
  }, [isOpen, anchorRef, menuRef])

  return flipUp
}
