---
name: Cozyroom
description: Self-hosted media hub reskinned as a full TIDAL-style dark music surface — Tidal's colour set, typography, controls, cards, track grid and shelves.
themeDefault: dark
studiedDNA:
  source: "ui-kits/tidal-com (TIDAL web player) — measured --td-* CSS vars + component classes (.td-*)"
  attribution: "Colours, type and component metrics studied from the kit; no TIDAL images, logos, or copy reproduced. Square Sans is TIDAL's proprietary font — we use its declared fallback (Inter)."
colors:
  bg: "#000000"                 # page background (--td-bg / --td-surface-fill)
  surface-5: "#080808"          # deepest surface (--td-surface-5)
  surface: "#141414"            # rows / hover surface (--td-surface-10)
  surface-2: "#1c1c1c"          # raised (--td-surface-20)
  surface-3: "#2d2d2d"          # elevated / brightest base (--td-surface-30)
  card: "#0e0e10"               # media card bg (--td-card)
  img: "#242429"                # cover placeholder (--td-img)
  text: "rgba(255,255,255,.95)" # primary (--td-text-10 #fffffff2)
  text-muted: "rgba(255,255,255,.55)"  # secondary (--td-text-20 #ffffff8c)
  text-faint: "rgba(255,255,255,.30)"  # tertiary (--td-text-30 #ffffff4d)
  accent: "#33ffee"             # TIDAL Wave cyan — accent/link/focus/eyebrow (--td-accent)
  accent-link: "#33ffee"        # text link (--td-wave-color-text-link #3fe)
  fill-10: "rgba(255,255,255,.95)"  # primary-button fill (white) (--td-fill-10)
  fill-20: "rgba(255,255,255,.35)"  # (--td-fill-20)
  fill-30: "rgba(255,255,255,.15)"  # secondary fill / active nav (--td-fill-30)
  fill-40: "rgba(255,255,255,.08)"  # round-button / chip fill (--td-fill-40)
  on-fill: "#101010"            # dark glyph on white primary (--td-on-fill-10)
  divider: "rgba(255,255,255,.08)"  # hairline (--td-divider-20 #ffffff14)
  divider-strong: "rgba(255,255,255,.30)"  # (--td-divider-10 #ffffff4d)
  floating: "rgba(40,40,40,.75)"  # floating button (--td-floating #282828bf)
  critical: "#ff5a76"           # (--td-critical-text)
  success: "#16d956"            # (--td-success-text)
  warning: "#ff9f40"            # (--td-warning-text)
charts:
  palette: ["#33ffee", "#33a7ff", "#ffd432", "#ff4242", "#8f00ff", "#33ffa9", "#ffbf80", "#ff668f"]
  fail: "#ff4242"
  warn: "#ff9f40"
  caution: "#ffd432"
  ok: "#16d956"
typography:
  # TIDAL: "Square Sans" (proprietary) with Inter as the declared web fallback.
  display:
    fontFamily: "Inter, 'Square Sans Display', Helvetica, Arial, sans-serif"
    fontSize: "19px"            # shelf heading _heading20 (Display 19/26 700)
    fontWeight: 700
    lineHeight: "26px"
  body:
    fontFamily: "Inter, 'Square Sans Text', Helvetica, Arial, sans-serif"
    fontSize: "14px"           # TIDAL base 14/20–22
    fontWeight: 400
    lineHeight: "22px"
  label:
    fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 600
rounded:
  cover: "2px"      # album/track cover (--td-r-cover) — TIDAL's signature near-square art
  xs: "4px"
  sm: "8px"
  menuitem: "9px"
  md: "12px"        # nav item, buttons pill fallback
  panel: "16px"     # floating panels / play queue (--td-r-panel)
  tabbar: "20px"
  search: "36px"    # search input (--td-r-search)
  full: "1000px"    # pills, round buttons (--td-r-full)
motion:
  transition: "0.1s"          # button/control transition
  fav: "transform .1s"        # fav scale
shadows:
  play: "0 2.2px 5.5px 0 rgba(0,0,0,.1)"    # play-button (--td-shadow-play)
  menu: "0 4px 20px 0 rgba(0,0,0,.3)"       # dropdowns (--td-shadow-menu)
  panel: "0 10px 12px 0 rgba(0,0,0,.15), 0 0 2px 0 rgba(255,255,255,.08)"  # floating panels
components:
  nav-item:            # .td-nav-item 208×40 r12
    height: "40px"
    rounded: "{rounded.md}"
    padding: "8px"
    text: "{colors.text-muted}"       # rest; hover → text + surface, active → text + fill-30
  button-primary:      # .td-btn--primary (WHITE on dark)
    backgroundColor: "{colors.fill-10}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.full}"
    padding: "9px 16px"
    height: "40px"
  button-secondary:    # .td-btn--secondary
    backgroundColor: "{colors.fill-40}"
    textColor: "{colors.text}"
    rounded: "{rounded.full}"
  round-button:        # .td-round 32
    size: "32px"
    backgroundColor: "{colors.fill-40}"
    rounded: "{rounded.full}"
  play-button:         # .td-play-mini — white circle, dark glyph, play shadow
    backgroundColor: "{colors.fill-10}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.full}"
    shadow: "{shadows.play}"
  card:                # .td-card
    coverRounded: "{rounded.cover}"
    titleWeight: 500   # medium, NOT bold
    subColor: "{colors.text-muted}"
  input:               # search
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.search}"
---

<!-- design: theme=TIDAL (full) -->

# Design System: Cozyroom — TIDAL

> **Full TIDAL reskin.** Supersedes the Tidal×Apple-Music hybrid and the
> interim apple.com-light pass; Midnight Deck archived at
> [`DESIGN.midnight-deck.archived.md`](DESIGN.midnight-deck.archived.md).
> Everything — colour, type, controls, cards, track grid, shelves — follows
> TIDAL's web player. The behavioural fixes in [§ Inherited Invariants](#inherited-invariants) still hold.

## Overview

**Creative North Star: "TIDAL web player."**

A pure-black, Wave-cyan music surface built entirely from TIDAL's system:
`#000` canvas with four charcoal surface tiers, a white-on-dark primary button,
TIDAL's teal **Wave** accent (`#33ffee`) reserved for links / focus / eyebrows /
badges, near-square album art (2px radius), a 208px nav with `r12` items, dense
3-column track grids, and horizontal shelves with "View all" links. Type is Inter
(TIDAL's declared fallback for its proprietary Square Sans), 14/22 base.

**Key characteristics:**
- **Pure black canvas**, four surface tiers `#080808/#141414/#1c1c1c/#2d2d2d`.
- **White primary, teal accent.** Primary/play buttons are white fill + dark glyph;
  teal `#33ffee` is links/focus/eyebrows/badges only — never a large button fill.
- **Near-square art** (`2px` radius) — TIDAL's signature cover shape.
- **Inter** 14/22, tight dense layout; shelf headings 19/26 700.
- **3-column track grids**, horizontal card shelves, 208px nav.

## Colours (TIDAL set)

| Role | Token | Value |
|---|---|---|
| Canvas | `--bg` | `#000000` |
| Surface / row | `--surface` | `#141414` |
| Raised | `--surface-2` | `#1c1c1c` |
| Elevated / hover | `--surface-3` | `#2d2d2d` |
| Media card | `--card` | `#0e0e10` |
| Cover placeholder | `--img` | `#242429` |
| Text primary | `--text` | `rgba(255,255,255,.95)` |
| Text secondary | `--text-muted` | `rgba(255,255,255,.55)` |
| Text tertiary | `--text-faint` | `rgba(255,255,255,.30)` |
| **Accent (Wave teal)** | `--accent` | `#33ffee` |
| Primary-button fill | `--fill-10` | `rgba(255,255,255,.95)` |
| Glyph on white | `--on-fill` | `#101010` |
| Round/chip fill | `--fill-40` | `rgba(255,255,255,.08)` |
| Active-nav fill | `--fill-30` | `rgba(255,255,255,.15)` |
| Hairline | `--border` | `rgba(255,255,255,.08)` |

### Named Rules
- **The Wave-Accent Rule.** `#33ffee` (TIDAL Wave cyan) is the ONE accent — links,
  focus rings, eyebrows, badges, active marks, single-series charts. **Never a
  large button fill.** No second hue.
- **The White-Primary Rule.** Primary + play buttons are white fill (`--fill-10`)
  + dark glyph (`--on-fill`). Any `background: var(--accent)` on a big CTA is wrong.
- **The Near-Square-Art Rule.** Album/track/artist covers use `2px` radius (round
  only for artist-avatar variants). No large rounded covers.
- **Data Needs Colour (retained).** Charts keep `--chart-1..8` + semantic status on
  black; single series = teal `--chart-1`.
- **Genre Tile exception (retained).** SearchPage `.genre-tile` duotone stays scoped.

## Typography (TIDAL / Inter)

Inter for display + body (TIDAL's declared fallback for Square Sans); JetBrains
Mono for data readouts. Base **14/22 400**. Shelf/section headings **19/26 700**
(display). Card title **14/22 500** (medium, NOT bold). Card subtitle **14/22 400**
`--text-muted`. Small labels 12. `letter-spacing` near-0 (TIDAL is tight but not negative).

### Named Rule
- **Card titles are medium (500), not bold (700).** A frequent tell — TIDAL card
  titles are `500`; only shelf/section headings are `700`.

## Layout & structure (TIDAL)

- **Shell:** ~208px left nav + fluid main. Nav items `.td-nav-item`: 40px tall,
  `r12`, `8px` padding, 14/22 600, icon 20; rest `--text-muted`, hover `--surface`
  + `--text`, active `--fill-30` + `--text`.
- **Shelves:** a `h2` heading (19/26 700) + optional "View all" (`--text-muted` →
  `--text` on hover), then a horizontal scroll of cards.
- **Cards** (`.td-card`): near-square cover (`2px`), `.td-play-mini` bottom-left +
  `.td-fav` bottom-right on hover, title 14/22 500, sub 14/22 400 muted; round
  variant centres its title.
- **Track rows** (`.td-tracks`): a **3-column grid** (`repeat(3, minmax(0,1fr))`,
  gap `16px 32px`), each row 56px with a 56px cover; hover reveals `.td-play-row`.
- **Search input:** `--surface` fill, `r36` (pill).
- **Floating panels** (play queue): `r16`, `1px` hairline, `--shadow-panel`.

## Controls (TIDAL primitives)

- **Primary** (`.td-btn--primary`): white fill, dark glyph, pill, `9px 16px`, 40px
  (compact 32px). Hover → `--fill-20`.
- **Secondary** (`.td-btn--secondary`): `--fill-40`, white text, pill.
- **Round icon** (`.td-round`): 32px, `--fill-40`, full-round.
- **Play** (`.td-play-mini`): 14px **white** circle + dark glyph + `--shadow-play`;
  `.td-play-row` 40px transparent white for row hover.
- **Tab** (`.td-tab`): text + 2px underline on active (`--text`); teal dotted focus.
- **Fav** (`.td-fav` 36 round, hover scale 1.1) / **More** (`.td-more` 32 ghost).
- **Focus:** `1px dotted var(--accent)` (teal) on controls; teal ring elsewhere.

## Elevation

Surface tiers + black shadows. Cards lift to `--surface-3` on hover; dropdowns use
`--shadow-menu`; floating panels `--shadow-panel`. No white-glow, no coloured
drop-shadow.

## Charts

Retained, tuned for `#000`. Grid hairline `var(--border)` dashed; axis
`var(--text-muted)`; tooltip `var(--surface)` + `1px var(--border)` + `var(--text)`;
single-series teal `var(--chart-1)`; multi `--chart-1..8`.

## Inherited Invariants

Behavioural/a11y — do NOT regress:
1. **Visible keyboard focus** on every interactive element — teal (`1px dotted
   var(--accent)` on controls; teal ring on cards/nav). Keep `.ai-input` /
   `.artist-filter-input` opt-outs.
2. **iOS tap:** `touch-action: manipulation` verbatim.
3. **Wide-monitor reading widths:** 1920/2560/3840 breakpoints for reading columns.
4. **Anti-flash theme boot** via `index.html` inline script + `localStorage`
   (`cozyroom-theme`), default **dark**.
5. **`currentColor` for brand/loading marks** (`CozyroomMark`, `Spinner`).
6. **Scrollbars hidden globally.**
7. **`index.css` is the single entry stylesheet, append/edit-in-place**; fonts
   `@import` at the very top.
8. **Service worker versioned filename** (`sw4.js`) — bump on each design ship so
   CF/browser fetch a fresh SW and users get the new bundle (SW-cache postmortem).

## Do's and Don'ts

### Do
- Use the flat TIDAL black palette everywhere; teal only for links/focus/eyebrows/badges.
- White primary + play buttons; near-square 2px covers; card titles medium (500).
- Lay content out as TIDAL: 208px nav, shelves + "View all", 3-column track grids.

### Don't
- Don't use teal as a large button fill or add a second hue.
- Don't use large rounded covers or bold (700) card titles.
- Don't reintroduce the apple.com light canvas / blue accent, or the Apple-Music
  cover-gradient page-wash (removed — TIDAL detail pages stay on the flat canvas).
- Don't touch backend/DB/k8s as part of design (`frontend/src` only).
- Don't break any Inherited Invariant.

## Origin

- Created 2026-09-30 by studying `ui-kits/tidal-com` (TIDAL web player) measured
  `--td-*` vars + `.td-*` component classes, per owner direction to make the whole
  spec match TIDAL. Colours/type/metrics studied only; no TIDAL images/logos/copy
  reproduced. Supersedes the Tidal×Apple-Music hybrid; Midnight Deck archived at
  [`DESIGN.midnight-deck.archived.md`](DESIGN.midnight-deck.archived.md).
