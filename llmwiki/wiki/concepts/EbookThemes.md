# Proposal: Fix Ebook Blank Screen via Themes & Style Normalization

## 1. Request Understanding
Implement selectable themes (Light, Dark, Sepia) and style normalization (CSS injection) for the ebook reader to fix the issue where content appears blank due to internal book styling conflicts (e.g., hardcoded white text on white background).

## 2. Affected Files
- `frontend/src/pages/EbookReaderPage.tsx`: Implementation of theme state, settings UI, and `epub.js` style injection.
- `frontend/src/index.css`: Addition of reader-specific theme tokens and layout adjustments for the settings menu.
- `wiki/index.md`: Documentation indexing.
- `wiki/log.md`: Operation logging.

## 3. Potential Side Effects
- No existing code affected.

## 4. Implementation Plan
1.  **Define Theme Tokens**: Add CSS variables in `index.css` for the three reader modes:
    - Light: `#000000` text on `#ffffff` background.
    - Dark: `#ffffff` text on `#1a1a1a` background.
    - Sepia: `#433422` text on `#f4ecd8` background.
2.  **State & Persistence**:
    - Add `theme` and `fontSize` state to `EbookReaderPage.tsx`.
    - Use `useEffect` to load/save these settings from `localStorage`.
3.  **Style Normalization**:
    - Create a style object for `epub.js` that overrides internal CSS using `!important`.
    - Targets: `body`, `p`, `span`, `div`, `li`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6`.
4.  **Reader Integration**:
    - Update `getRendition` to register and select the active theme.
    - Synchronize the `.reader-container` background with the active theme to prevent white flashes.
5.  **UI Controls**:
    - Add a "Display Settings" button to the reader header.
    - Implement a small overlay/dropdown for selecting themes and font size (+/-).

## 5. Success Criteria
- Legibility: Books with hardcoded white text are now visible in all themes.
- Interactivity: Themes and font size changes apply instantly without reload.
- Persistence: Settings are remembered across different books and sessions.
- Visuals: No white flashes when loading a book in Dark or Sepia mode.
