# Proposal: Lyrics UI Improvements (Auto-scroll & Fade-out)

## 1. Restatement
Improve the lyrics interface on mobile/desktop by hiding the scrollbar, adding a fade-out (opacity) effect at the top and bottom edges, and implementing an auto-scroll mechanism for plain text lyrics based on track progress.

## 2. Affected Files
- `frontend/src/index.css` (Styling for `.lyrics-plain`, `.lyrics-scroll`)
- `frontend/src/components/LyricsView.tsx` (Auto-scroll logic for plain text)

## 3. Side Effects & Breakage Risks
- **CSS Compatibility:** The `mask-image` property for the fade-out effect requires `-webkit-` prefixes to work reliably across older browsers (especially iOS Safari).
- **Auto-scroll UX conflict:** Forcibly setting `scrollTop` on the plain text container might fight against a user trying to manually scroll up to read previous lines.
- **Scrollbar Hiding:** Using `::-webkit-scrollbar { display: none; }` and `scrollbar-width: none;` will remove visual cues for scrollability, though users are accustomed to dragging on mobile.

## 4. Implementation Plan
1. **Hide Scrollbars:** Update `index.css` to ensure `.lyrics-plain` has `scrollbar-width: none;` and `::-webkit-scrollbar { display: none; }`.
2. **Fade-out Effect:** Apply `-webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);` (and standard `mask-image`) to `.lyrics-scroll` and `.lyrics-plain`.
3. **Plain Text Auto-scroll:**
   - In `LyricsView.tsx`, grab `duration` from `usePlayer()`.
   - Add a `useRef` to the `<pre className="lyrics-plain">` element.
   - Add a `useEffect` dependent on `progress`. For plain text (`synced.length === 0`), calculate the scroll percentage: `const ratio = duration > 0 ? progress / duration : 0`.
   - Apply the scroll: `ref.current.scrollTop = ratio * (ref.current.scrollHeight - ref.current.clientHeight)`.

## 5. Success Criteria
- Scrollbars are completely hidden on both desktop and mobile, yet the user can still swipe/scroll.
- The top and bottom edges of the lyrics view smoothly fade out the text into the background.
- Plain text lyrics automatically and smoothly scroll from top to bottom over the exact duration of the track.

## Origin
- **Draft:** `wiki/sources/draft/100526-lyrics-ui-improvements-fe.md`
- **Commit:** `238bae4 — feat(ui): enhance lyrics view with auto-scroll and fade-out`
- **Date promoted:** 2026-05-11
