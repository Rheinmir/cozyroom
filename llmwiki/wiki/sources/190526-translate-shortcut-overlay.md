---
title: Translate Shortcut + Hide Corner Header Buttons (Mobile)
date: 2026-05-19
type: draft
status: implemented
module: frontend
---

## Request

Add a 🌐 translate shortcut accessible from the mobile now-playing overlay without opening the lyrics tools panel. Hide the two corner header buttons (back chevron + lyrics 3-dot) by default — show all three on touch, auto-fade after 3 s.

---

## What was built

### Unified touch-to-reveal system

All three overlay buttons share one class-based show/hide mechanism:

- `.npo-btn-back` (chevron ↓, top-left)
- `.lyrics-tools-toggle` (⋮, top-right, `position: fixed` inside LyricsView)
- `.npo-translate-btn` (🌐, floating bottom-right of controls)

**Trigger**: `onTouchStart` on the `.npo` root div → `showCtrls()` in PlayerBar:
1. Sets `ctrlsVisible = true` → adds class `.npo--ctrls-active` to `.npo`
2. Resets a 3 s `setTimeout` → after timeout, `ctrlsVisible = false`, class removed

**CSS pattern** (all three buttons):
```css
/* default: invisible, non-interactive */
opacity: 0; pointer-events: none; transition: opacity 0.3s;
/* on touch */
.npo--ctrls-active .npo-btn-back    { opacity: 1; pointer-events: auto; }
.npo--ctrls-active .lyrics-tools-toggle { opacity: 1; pointer-events: auto; }
.npo--ctrls-active .npo-translate-btn   { opacity: 1; pointer-events: auto; }
```

The `position: fixed` on `.lyrics-tools-toggle` does not break descendant-selector matching — CSS ancestry is DOM-based, not visual.

### Translate button placement

`.npo-translate-btn` is `position: absolute` within `.npo-controls` (which got `position: relative`):
- `right: 16px; bottom: 50px` — floats beside the button row, right side
- Does not alter the 5-button row's flex layout or symmetry

### State architecture (LyricsView → imperative handle)

`showTr` and all translation state remain **inside LyricsView** — no state lift needed.

LyricsView was refactored to `forwardRef`:
```tsx
export type LyricsViewHandle = { toggleTranslation: () => void }
const LyricsView = forwardRef<LyricsViewHandle, Props>(function LyricsView(..., ref) {
  ...
  const toggleFnRef = useRef(handleToggleTranslation)
  toggleFnRef.current = handleToggleTranslation           // always fresh closure
  useImperativeHandle(ref, () => ({ toggleTranslation: () => toggleFnRef.current() }), [])
  useEffect(() => { onTranslateActiveChange?.(showTr) }, [showTr])
})
```

PlayerBar holds:
- `lyricsRef = useRef<LyricsViewHandle>(null)` — to call `toggleTranslation()`
- `trActive` state — mirror of LyricsView's `showTr` via `onTranslateActiveChange` callback, used only for the external button's active CSS class

---

## Files changed

| File | Change |
|------|--------|
| `frontend/src/components/LyricsView.tsx` | `forwardRef`, `useImperativeHandle` exposing `toggleTranslation`; `onTranslateActiveChange` callback prop |
| `frontend/src/components/PlayerBar.tsx` | `ctrlsVisible` + `showCtrls()` touch handler; `lyricsRef`; `trActive` mirror state; `.npo-translate-btn` button; `.npo--ctrls-active` class |
| `frontend/src/index.css` | Hide/show rules for all 3 buttons; `.npo-translate-btn` absolute position; `.npo-controls { position: relative }` |

---

## Success Criteria (verified ✓)

1. TypeScript compiles without errors (`npx tsc --noEmit` clean in WSL)
2. Touching the now-playing overlay reveals all 3 buttons; they fade after 3 s
3. 🌐 button in controls toggles translation identically to the one in the lyrics tools panel, both reflect the same state
4. 5-button control row layout unchanged
5. Desktop layout unaffected (changes scoped to `@media (max-width: 640px)`)

---

## Origin

- **Draft:** `wiki/sources/draft/190526-translate-shortcut-hide-header-fe.md`
- **Commit:** `ab52f60 — feat: translate shortcut + touch-to-reveal corner buttons (mobile overlay)`
- **Date promoted:** 2026-05-19
- **Context:** Translate button deeply buried in lyrics panel; corner header buttons add visual noise when not needed.
