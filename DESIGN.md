---
name: Cozyroom
description: Self-hosted media hub reskinned as a dark, teal-accented music surface — Tidal's colour set on Apple Music's structure and cover-gradient method, with Tidal control primitives.
themeDefault: dark
studiedDNA:
  structure_and_gradient: "ui-kits/music-apple-com (Apple Music web app) — shell/nav/shelf/song-row structure + .am-tint cover-derived gradient wash"
  palette_and_controls: "ui-kits/tidal-com (Tidal web) — dark colour set (--td-*), teal accent, and control primitives (.td-round/.td-btn/.td-play-mini/.td-tab)"
  attribution: "Structure/colours studied from measured CSS vars of both kits; no vendor images, logos, or copy reproduced."
colors:
  # PALETTE = Tidal (dark). Accent = Tidal teal. Primary button = Tidal white-on-dark.
  bg: "#000000"                 # page background (--td-bg)
  surface: "#141414"            # cards / rows (--td-surface-10)
  surface-2: "#1c1c1c"          # raised (--td-surface-20)
  surface-3: "#2d2d2d"          # hover / elevated (--td-surface-30)
  surface-5: "#080808"          # deepest (--td-surface-5)
  card: "#0e0e10"               # media card bg (--td-card)
  img-placeholder: "#242429"    # cover placeholder (--td-img)
  text: "rgba(255,255,255,.95)" # primary (--td-text-10 = #fffffff2)
  text-muted: "rgba(255,255,255,.55)"  # secondary (--td-text-20 = #ffffff8c)
  text-faint: "rgba(255,255,255,.30)"  # tertiary (--td-text-30 = #ffffff4d)
  accent: "#33ffee"             # teal — links, focus, eyebrows, badges (--td-accent)
  accent-text: "#3fe"           # link text (--td-wave-color-text-link)
  on-fill: "#101010"            # dark glyph on white primary (--td-on-fill-10)
  fill-10: "rgba(255,255,255,.95)"  # primary-button fill (white) (--td-fill-10)
  fill-20: "rgba(255,255,255,.35)"  # (--td-fill-20)
  fill-30: "rgba(255,255,255,.15)"  # secondary-button fill (--td-fill-30)
  fill-40: "rgba(255,255,255,.08)"  # round-button / chip fill (--td-fill-40)
  divider: "rgba(255,255,255,.09)"  # hairline (--td-divider-20 = #ffffff14)
  divider-strong: "rgba(255,255,255,.30)"  # (--td-divider-10)
  critical: "#ff5a76"           # danger text (--td-critical-text)
  success: "#16d956"            # (--td-success-text)
  warning: "#ff9f40"            # (--td-warning-text)
charts:
  # Categorical palette re-tuned to sit on Tidal black; single-series keys off teal accent.
  palette: ["#33ffee", "#33a7ff", "#ffd432", "#ff4242", "#8f00ff", "#33ffa9", "#ffbf80", "#ff668f"]
  fail: "#ff4242"
  warn: "#ff9f40"
  caution: "#ffd432"
  ok: "#16d956"
typography:
  display:
    fontFamily: "Inter, 'Square Sans Display', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif"
    fontSize: "clamp(22px, 4vw, 34px)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, 'Square Sans Text', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "22px"
  label:
    fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 500
rounded:
  cover: "2px"      # album/track cover (--td-r-cover) — Tidal's signature near-square art
  xs: "4px"
  sm: "8px"
  md: "12px"        # nav item, cards
  panel: "16px"     # floating panels / queue
  full: "1000px"    # pills, round buttons
  tabbar: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
motion:
  transition: "0.1s ease-in"       # Apple Music --global-transition (opacity .1s)
  control: "0.1s"                  # Tidal button transition
  blur-nav: "saturate(1.8) blur(20px)"
  blur-glass: "saturate(2) blur(60px)"   # Apple Music sidebar glass
shadows:
  play: "0 2.2px 5.5px 0 rgba(0,0,0,.1)"    # Tidal play-button (--td-shadow-play)
  menu: "0 4px 20px 0 rgba(0,0,0,.3)"       # dropdowns (--td-shadow-menu)
  panel: "0 10px 12px 0 rgba(0,0,0,.15), 0 0 2px 0 rgba(255,255,255,.08)"  # floating panels
gradient_method:
  # Apple Music's cover-derived tint. On album/artist/playlist detail pages, derive a
  # dominant dark colour from the cover art and pour it as the page background wash;
  # tint secondary text + dividers to match. Sample tokens (real value = per-cover):
  tint-bg: "derived-dark (e.g. #370c18)"     # page wash behind hero + first shelf
  tint-sec: "derived-mid (e.g. rgb(216,173,190))"  # secondary text on the tint
  tint-div: "derived-line (e.g. rgb(136,56,78))"   # dividers on the tint
components:
  button-primary:      # Tidal .td-btn--primary (WHITE on dark)
    backgroundColor: "{colors.fill-10}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.full}"
    padding: "9px 16px"
    height: "40px"
  button-secondary:    # Tidal .td-btn--secondary
    backgroundColor: "{colors.fill-40}"
    textColor: "{colors.text}"
    rounded: "{rounded.full}"
  button-round:        # Tidal .td-round (32 icon)
    size: "32px"
    backgroundColor: "{colors.fill-40}"
    rounded: "{rounded.full}"
  play-button:         # Tidal .td-play-mini — white circle, dark glyph, play shadow
    backgroundColor: "{colors.fill-10}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.full}"
    shadow: "{shadows.play}"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.search}"
---

<!-- design: theme=Tidal-palette × Apple-Music-structure -->

# Design System: Cozyroom — Tidal × Apple Music

> **Supersedes the apple.com-light system** (which superseded the Midnight Deck,
> archived at [`DESIGN.midnight-deck.archived.md`](DESIGN.midnight-deck.archived.md)).
> **Colour set = Tidal. Structure + cover-gradient method = Apple Music. Controls = Tidal.**
> The behavioural fixes in [§ Inherited Invariants](#inherited-invariants) still hold.

## Overview

**Creative North Star: "Tidal booth, Apple Music floorplan."**

A dark, near-black music surface built from **Tidal's colour set** — void-black
canvas, three charcoal surface tiers, a single **teal `#33ffee`** accent reserved
for links / focus / eyebrows, and Tidal's white-on-dark primary buttons — laid
out on **Apple Music's structure**: a translucent glass sidebar, horizontal
content shelves, dense song-rows, and a segmented control. Detail pages
(album / artist / playlist) use **Apple Music's cover-gradient method**: a
dominant colour pulled from the cover art washes the page background and tints
the secondary text, exactly as Apple Music does.

**Key characteristics:**
- **Dark-first, Tidal palette.** `#000` canvas; `#141414 / #1c1c1c / #2d2d2d`
  surface tiers; white-alpha text ladder (`.95 / .55 / .30`).
- **Teal is the accent, white is the primary.** `#33ffee` marks links, focus
  rings, eyebrows, and badges. The primary button and play button are **white
  fill with dark glyph** (Tidal's actual scheme — teal is NOT a button fill).
- **Apple Music structure.** 232px glass sidebar (`saturate(2) blur(60px)`),
  `section.block` horizontal shelves, song-rows, `.seg` segmented control (r9).
- **Cover-gradient method.** Detail pages derive a dark tint from the cover and
  pour it as a background wash + tint the secondary text/dividers.
- **Tidal controls.** `.td-round` (32 round), `.td-btn` primary/secondary/floating,
  `.td-play-mini` (white 14px circle + play shadow), `.td-tab` (2px underline),
  `.td-more`, `.td-fav`.

## Colours (Tidal set)

| Role | Token | Value |
|---|---|---|
| Canvas | `--bg` | `#000000` |
| Surface / row | `--surface` | `#141414` |
| Raised | `--surface-2` | `#1c1c1c` |
| Hover / elevated | `--surface-3` | `#2d2d2d` |
| Media card | `--card` | `#0e0e10` |
| Cover placeholder | `--img` | `#242429` |
| Text primary | `--text` | `rgba(255,255,255,.95)` |
| Text secondary | `--text-muted` | `rgba(255,255,255,.55)` |
| Text tertiary | `--text-faint` | `rgba(255,255,255,.30)` |
| **Accent (teal)** | `--accent` | `#33ffee` |
| Primary-button fill (white) | `--fill-10` | `rgba(255,255,255,.95)` |
| Glyph on white | `--on-fill` | `#101010` |
| Round/chip fill | `--fill-40` | `rgba(255,255,255,.08)` |
| Hairline | `--border` | `rgba(255,255,255,.09)` |

### Named Rules
- **The Teal-Accent Rule.** `#33ffee` is the ONE chromatic accent — links, focus
  rings, eyebrows, badges, active-nav marks, single-series chart marks. It is
  **never a large button fill** (that stays white, Tidal-style). No second hue.
- **The White-Primary Rule.** Primary buttons and play buttons are white fill
  (`--fill-10`) + dark glyph (`--on-fill`). Any `background: var(--accent)` on a
  large CTA is wrong — repoint to `--fill-10`.
- **The Cover-Gradient Rule.** Only album/artist/playlist **detail** pages get the
  Apple-Music tint wash (derived from cover). Library grids and system pages stay
  on the flat `#000` canvas. Never invent a tint where there's no cover.
- **Data Needs Colour (retained).** Charts keep `--chart-1..8` + semantic status,
  re-tuned for the black canvas; single series uses teal `--chart-1`.
- **Genre Tile exception (retained).** SearchPage `.genre-tile` duotone stays scoped.

## Structure (Apple Music)

- **Shell:** ~232px glass sidebar + fluid main (`0 32px` gutters). Sidebar is
  `saturate(2) blur(60px)` glass over the dark canvas, `.5px` divider.
- **Sidebar nav:** 28–36px rows, 14px text, icon in the accent, active row = a
  faint `rgba(255,255,255,.08)` fill (no glow).
- **Shelves:** `section.block` sections with a `h2` (26–30 / 700) header + optional
  "View all", horizontal scroll of cards.
- **Song-rows:** dense list rows, cover 56 (r `cover` = 2px), title/artist stacked,
  hover reveals the play control.
- **Segmented control:** `.seg` track r9, selected segment gets a raised fill +
  small shadow.
- **Header/search:** sticky, `saturate(1.8) blur(20px)`, `.5px` bottom divider.

## Gradient method (Apple Music `.am-tint`)

On a detail page with a cover:
1. Derive a dominant **dark** colour from the cover (client-side; a muted, low-L
   version so text stays legible).
2. Set it as the page background wash behind the hero + first shelf (fade to `#000`).
3. Tint secondary text → a lighter derivative; tint dividers → a mid derivative.
4. Primary text stays near-white; the accent stays teal.

This is the one place colour is data-derived. Everywhere else uses the flat Tidal
palette. Implement as a `.tinted` container + CSS custom props set inline from the
extracted colour (like the app's existing playlist/artist hero gradient, extended
to the full Apple-Music page-wash treatment).

## Controls (Tidal primitives)

- **Primary button** (`.td-btn--primary`): white fill, dark glyph, pill, `9px 16px`,
  40px tall (compact 32px). Hover → `--fill-20`.
- **Secondary** (`.td-btn--secondary`): `--fill-40` fill, white text, pill.
- **Round icon** (`.td-round`): 32px, `--fill-40` fill, full-round.
- **Play** (`.td-play-mini`): 14px **white** circle, dark glyph, `play` shadow;
  `.td-play-row` 40px transparent white for row hover.
- **Tab** (`.td-tab`): text + 2px underline on active (`--text`), teal dotted focus.
- **Fav / More** (`.td-fav` 36 round, `.td-more` 32 ghost).
- **Focus:** Tidal uses `1px dotted var(--accent)` (teal) on controls; keep the
  visible-focus invariant with the teal ring.

## Elevation & Depth

Dark surfaces + real black shadows for floating layers (`shadows.menu` for
dropdowns, `shadows.panel` for the queue/floating panels). Cards lift on hover
with `--surface-3` fill + a subtle `scale(1.01)`. No white-glow (that was Midnight
Deck); depth here is surface-tier + shadow, Tidal-style.

## Charts

Retained system, re-tuned for `#000`. Grid hairline `var(--border)` dashed; axis
`var(--text-muted)`; tooltip `var(--surface)` + `1px var(--border)` + `var(--text)`;
single-series marks teal `var(--chart-1)`; multi-series `--chart-1..8`.

## Inherited Invariants

Carried verbatim (behavioural/a11y — do NOT regress):
1. **Visible keyboard focus** on every interactive element — now the teal ring
   (`1px dotted var(--accent)` on controls; `3px` teal on cards/nav). Keep the
   `.ai-input`/`.artist-filter-input` opt-outs.
2. **iOS tap:** `touch-action: manipulation` verbatim.
3. **Wide-monitor reading widths:** 1920/2560/3840 breakpoints for reading columns.
4. **Anti-flash theme boot** via `index.html` inline script + `localStorage`
   (`cozyroom-theme`). Default is now **dark**; respect a stored value.
5. **`currentColor` for brand/loading marks** (`CozyroomMark`, `Spinner`).
6. **Scrollbars hidden globally.**
7. **`index.css` is the single entry stylesheet, append/edit-in-place** — fonts
   `@import` stays at the very top.

## Do's and Don'ts

### Do
- Use the flat Tidal dark palette everywhere except detail-page cover washes.
- Reserve teal `#33ffee` for links/focus/eyebrows/badges/active marks + single-series charts.
- Make primary + play buttons WHITE fill with dark glyph (Tidal).
- Lay pages out on Apple Music structure (glass sidebar, shelves, song-rows, seg).
- Use the cover-gradient method only on album/artist/playlist detail pages.

### Don't
- Don't use teal as a large button fill, and don't add a second accent hue.
- Don't put the cover-tint wash on library grids or system pages.
- Don't reintroduce the apple.com light canvas or the blue `#0071E3` accent.
- Don't touch backend/DB/k8s as part of design work (`frontend/src` only).
- Don't break any Inherited Invariant.

## Origin

- Created 2026-09-29 by studying `ui-kits/music-apple-com` (structure + cover-gradient
  method) and `ui-kits/tidal-com` (colour set + control primitives), per owner
  direction to take Apple Music's structure/gradient and Tidal's palette/buttons.
  Structure/colours studied only; no vendor images/logos/copy reproduced. Supersedes
  the interim apple.com-light system; Midnight Deck preserved at
  [`DESIGN.midnight-deck.archived.md`](DESIGN.midnight-deck.archived.md).
