---
name: Cozyroom
description: Self-hosted personal media hub — music, video, ebooks, comics, and an AI assistant, run as a monochrome glass operator console.
colors:
  void-black: "#07070f"
  charcoal-panel: "#0e0e0e"
  raised-charcoal: "#111111"
  surface-hover-wash: "rgba(255,255,255,0.07)"
  paper-white: "#ffffff"
  paper-white-hover: "#e0e0e0"
  text-bright: "rgba(255,255,255,0.92)"
  text-dim: "rgba(255,255,255,0.55)"
  text-ghost: "rgba(255,255,255,0.32)"
charts:
  # Unchanged by the glassmorphism redesign — one cohesive, muted categorical
  # palette (--chart-1..8) applied to EVERY chart. Scoped to data viz, never
  # UI chrome. See "## Charts".
  palette: ["#6f8fd6", "#5cb8a0", "#d8a862", "#d3798f", "#9a8fd0", "#7f8c9e", "#c98f6a", "#8bb37a"]
  fail: "#f87171"
  warn: "#fb923c"
  caution: "#facc15"
  ok: "#4ade80"
typography:
  display:
    fontFamily: "'Space Grotesk', 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "clamp(24px, 5vw, 52px)"
    fontWeight: 900
    lineHeight: 1.1
  body:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Geist Mono', 'SFMono-Regular', monospace"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.08em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "13px"
  xl: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.paper-white}"
    textColor: "#000000"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.paper-white-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-dim}"
    rounded: "{rounded.sm}"
    padding: "3px 8px"
  input-field:
    backgroundColor: "{colors.charcoal-panel}"
    textColor: "{colors.text-bright}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

# Design System: Cozyroom

## Overview

**Creative North Star: "The Instrument Panel"**

Cozyroom reads as an instrument panel lit from within, not an unlit room: the same operator-console structure as before (sidebar library, persistent player, dense list views) now floats over a soft, slow-drifting atmosphere instead of a flat void-black canvas. The sidebar, header, player bar, modals, and cards are frosted glass — `backdrop-filter` blur over layered white ambient blooms — so depth comes from real light passing through material, not from a flat brand hue painted on top of black.

This is a material change, not a color change: the owner's palette stays exactly what it was — white and black/gray only, no hue anywhere in the system. An earlier pass during this same redesign tried a colored blue/violet/teal ambient field; it read fine on the dark canvas but turned into a harsh, hard-edged color band against the light theme's white surfaces, and was reverted the same day. What's genuinely new versus the prior "Midnight Deck" system is the *material*: panels that visibly refract light through blur instead of sitting as opaque flat rectangles, and a stronger, better-tuned white ambient field behind them (the mica/blur plumbing itself mostly already existed — sidebar/header/player/modals used `backdrop-filter` before this redesign; what changed is giving that blur a real atmosphere to catch, and fixing the two spots that had regressed to a solid accent fill or a hardcoded white glow instead of true glass).

**Key Characteristics:**
- Glass-first: frosted, blurred panels over a multi-layer white ambient field — not flat opaque rectangles.
- Scoped material: glass applies to floating/elevated surfaces only (sidebar, header, player bar, modals, dropdowns, cards, and the two single non-repeating play buttons). Dense rows — the track table, list views — stay flat by design, for scan speed and scroll performance.
- Monochrome-first, unchanged: void-black background, white the only accent, three text-opacity tiers for hierarchy. This redesign never touched the palette — only the material.
- Operator-console density is unchanged: compact rows, tables, and dashboards over marketing-style whitespace.
- Spotify-shaped chrome, Cozyroom-owned palette: the in-app icon is still a placeholder borrowed from Spotify's mark; unchanged by this redesign, still fair game to replace later.

## Colors

A single accent (paper-white) against three densities of near-black, now expressed partly as real glass instead of flat panels. No hue exists anywhere in the base system — this was true before the glassmorphism redesign and stays true after it; a colored ambient field was tried and reverted (see Origin).

### Primary
- **Paper White** (`#ffffff`, token `paper-white`, CSS var `--green`/`--purple`): the only accent. Used for primary buttons, active/selected states, the single interactive underline/highlight, and — new in this redesign — the fill of the two glass play buttons' icon. Always paired with black or near-black foreground text/icon on top of it.

### Ambient Field
- **Orb A / Orb B / Orb C** (`--orb-a` / `--orb-b` / `--orb-c`): three large, slow-drifting white (dark theme) or black (light theme) radial blooms (`body::before`, `body::after`, `html::before`) sized and positioned to reach behind the sidebar, header, and player bar specifically — not decoration confined to empty corners. This is what the glass panels' `backdrop-filter: blur()` actually blurs; without it, the mica reads as tinted-flat-black rather than true glass. Depth between the three blooms comes from varying *intensity* (`.55`/`.4`/`.25` alpha), not hue.

### Neutral
- **Void Black** (`#07070f`, token `void-black`): the app's base canvas (`--bg`) — deepened slightly from the old pure `#050505` so the ambient blooms have more room to read as depth, still functionally black.
- **Charcoal Panel** (`#0e0e0e`, token `charcoal-panel`): resting surfaces that are *not* glass — table rows, plain list items (`--surface`).
- **Raised Charcoal** (`#111111`, token `raised-charcoal`): a slightly lighter tier for elements above a Charcoal Panel surface (`--elevated`).
- **Bright / Dim / Ghost Text**: unchanged three-tier white-opacity text hierarchy (`--text` / `--text-muted` / `--text-faint`).

### Named Rules
**The One Accent Rule (reaffirmed).** Paper White is the only accent color in the system. Anything that wants to look "selected," "primary," or "on" reaches for it — never a hue. This redesign's material change never gets to spend this rule; a same-day attempt to introduce a signature blue/violet accent alongside the glass material was reverted in full once it became clear the owner's intent was glass material, not a palette change.

**The Glass-Is-Scoped Rule.** `backdrop-filter` glass applies to floating/elevated surfaces only: sidebar, header, player bar, modals, dropdowns, popovers, cards, and the two single, non-repeating signature buttons (`.play-btn`, `.hero-play-btn`). Dense list/table rows (the track table, queue rows) stay flat — an explicit, deliberate scope decision made to protect scroll performance and operator-console scan speed. Don't add `backdrop-filter` to a per-row element in a long list, including a button that repeats per row.

**The Ambient-Not-Corner Rule.** The three ambient orbs are sized (1100–1300px) and positioned to actually reach the panels that need to refract them (sidebar, header strip, player bar band), not just glow in an empty corner of the viewport. A glass panel with no light reaching it through the blur is a bug, not a subtler look — caught during this redesign's own finish review, twice: once for coverage (orbs too small/off-target, panels too opaque), once for the accent-color attempt that made the same field harsh on light backgrounds.

**The No-Accent-Token Rule.** There is no `--accent` CSS variable — referencing it silently resolves to nothing. The real accent token is `var(--green)`, which is literally white.

**The Data Needs Color Rule (unchanged).** Two chart color systems, scoped to data viz and never UI chrome: the categorical palette `--chart-1..8`, and semantic status `--chart-fail/warn/caution/ok`. Untouched by this redesign — these are the only sanctioned hue in the entire system, and they were true before glassmorphism too.

**The Genre Tile Color Rule (unchanged).** The Browse-by-genre grid's rotating duotone palette (SearchPage.tsx) remains its own scoped exception, unrelated to the accent or the ambient field.

### Light Theme

`:root[data-theme="light"]` (toggle from the Sidebar, persisted to `localStorage`) also gets the glass treatment — same monochrome identity in both themes, only polarity and intensity differ:
- `--bg` stays the soft cool-neutral `#eef0f2` from the prior system (unchanged).
- Glass panel fills (`--sidebar-glass`/`--header-glass`/`--player-glass`) flip to white-based translucency, at lower opacity than dark mode so the same ambient blooms still read through on a bright canvas.
- Orb tokens flip polarity — **black**-based (`rgba(0,0,0,.06–.14)`), not white, matching the same dark-alpha flip `--glass-fill` already uses in light mode. A white-on-white orb is invisible; this was the exact bug class that produced the hard-edged color band before the colored-field attempt was reverted, so the monochrome version keeps the same "flip polarity per theme" discipline.
- Paper White does not flip between themes (buttons hardcode `color: #000` paired with the accent; a per-theme accent swap would silently make that text illegible in whichever theme darkened the accent).

## Typography

Unchanged by this redesign. **Display Font:** Space Grotesk (falling back to Geist). **Body Font:** Geist. **Label/Mono Font:** Geist Mono.

### Hierarchy
- **Display** (900, `clamp(24px, 5vw, 52px)`, line-height 1.1): page titles.
- **Title** (700, 18px): section headers, card titles.
- **Body** (400, 14px, line-height 1.5): default reading and UI text.
- **Label** (600, 11px, letter-spacing 0.08em): table headers, small buttons, badges — often Geist Mono.

### Named Rules
**The Mono-Means-Machine Rule (unchanged).** Geist Mono only for content that is literally data or system output.

## Layout

Unchanged by this redesign. Persistent sidebar (`--sidebar-w: 220px`, collapsible to `56px`) plus persistent bottom player bar (`--player-h: 72px`, `56px` mobile), routed page filling the remainder. Reading-focused surfaces (AI chat column, Now Playing overlay, ebook reader) cap to a centered column scaling at 1920px/2560px/3840px. Mobile breakpoint `900px`.

## Elevation & Depth

Depth comes from two sources working together: the pre-existing white ambient-glow-on-hover lift (unchanged — buttons/cards/rows still lift with `box-shadow: 0 8px 20px -8px rgba(255,255,255,...)` plus `1–2px` translateY on hover), and the glass material itself, where `backdrop-filter: blur()+saturate()` over the ambient field gives floating surfaces real visual depth independent of any shadow.

- **Resting:** Charcoal Panel surface (non-glass elements) or frosted glass (floating elements) — hairline inset border, no drop shadow either way.
- **Raised (hover-capable elements):** lift with a soft white glow, plus a `1–2px` translateY.
- **Floating (popovers, modals):** heavier ambient shadow, `box-shadow: 0 6px 20px rgba(0,0,0,0.5)`, since floating surfaces sit above the glass, not directly on the ambient field.

### Named Rules
**The Light-Not-Color Rule (reaffirmed).** Depth is expressed with white ambient glow and subtle lift, never with a second color or a dark drop-shadow. A same-day attempt to tint elevation glows toward a signature hue was reverted along with the rest of the colored-accent attempt — every glow in the system is white/black only, exactly as before this redesign.

## Shapes

Unchanged by this redesign. Corner radius scales with intent: `4–8px` for chips/inline controls, `11–20px` for cards/panels/bubbles, `999px`/`50%` for pills. Borders stay hairline `1px`.

## Components

### Buttons
- **Shape:** `8px` radius by default; fully round for icon-only buttons.
- **Primary (opaque):** Paper White background, black text, `10px 16px` padding — most primary/CTA buttons (`.confirm-btn--primary`, tab-active pills, etc.).
- **Primary (glass) — the two single, non-repeating signature controls:** `.play-btn` (player bar) and `.hero-play-btn` (playlist hero "Phát") are real frosted glass, not opaque fill — `--accent-glass-fill` (white-based translucent) + `backdrop-filter: blur(16px) saturate(1.8)` + a white hairline border, icon in Paper White (`color: var(--green)`, SVG `fill="currentColor"`) so it glows against the translucent disc instead of sitting on a solid one. Reserved for buttons that appear once on screen at a time — never applied to a button that repeats per row in a list (backdrop-filter cost).
- **Hover / Focus:** opaque buttons step to `#e0e0e0`; glass buttons step to a stronger white fill + border brightens to full Paper White — both add the Raised elevation glow.
- **Ghost / Secondary:** transparent background, hairline border, Dim Text — unchanged.

### Cards / Containers
- **Corner Style:** `11–16px`, unchanged.
- **Background:** non-floating cards keep Charcoal Panel; floating cards (the ones already using `--glass-fill`) are frosted glass over the ambient field.
- **Shadow Strategy:** Raised elevation glow on hover, white — unchanged.
- **Border:** `1px` hairline, unchanged.

### Inputs / Fields
- **Style:** Charcoal Panel background, `8px` radius — unchanged. The header search bar sits inside the header's own glass strip.
- **Focus:** inset hairline brightens — unchanged.

### Navigation
- Sidebar items: Body-weight label text, Dim Text at rest, Bright Text + Surface Hover Wash background when active/hovered — unchanged from the prior system.
- The sidebar itself is frosted glass (`--sidebar-glass`, pre-existing `backdrop-filter: blur(20px)`), now over the ambient field instead of flat black — the material change, not a color change.

### Player Bar (signature surface)
The persistent bottom player bar is frosted glass (`--player-glass`, `backdrop-filter: blur(24px)`) positioned to sit directly over one of the ambient blooms — the clearest "instrument panel lit from within" moment in the app. Its play button is glass too (see Buttons above).

## Charts

Unchanged by this redesign — the `--chart-1..8` categorical palette and `--chart-fail/warn/caution/ok` semantic set are explicitly out of scope (see The Data Needs Color Rule). All Chart-Palette Rule and chart-chrome guidance from the prior system stands as-is. These remain the only sanctioned hue anywhere in Cozyroom.

## Do's and Don'ts

### Do:
- **Do** treat Paper White as the only accent in any new surface — resist the urge to add a second color for "variety," even in service of a material change like glass.
- **Do** keep glass (`backdrop-filter`) scoped to floating/elevated surfaces — sidebar, header, player bar, modals, dropdowns, cards, and the two signature play buttons. Never add it to individual rows in a dense list.
- **Do** size and position ambient decoration so it actually reaches the surfaces meant to refract it, and verify with a screenshot in *both* themes — not just by reading the token file. This redesign shipped two visible bugs from skipping that check: orbs too small/off-target on the first pass, and a colored field that looked fine in dark mode but became a harsh color band in light mode on the second.
- **Do** flip ambient/glass tokens' polarity per theme (white-based in dark mode, black-based in light mode) — a same-hue token that isn't polarity-aware vanishes or overpowers depending on the canvas.

### Don't:
- **Don't** reference `var(--accent)` — it does not exist; use `var(--green)`.
- **Don't** add `backdrop-filter` blur to dense table/list rows — reserved for floating surfaces only.
- **Don't** hardcode `#fff`/`white` for a primary button or active-state fill or glow *as a literal* — use the tokens (`var(--green)`, `--accent-glass-fill`, etc.) so a future material change doesn't require re-hunting every hardcoded value across the file.
- **Don't** introduce a second hue anywhere in the base system, including as part of a material/glass change — glass is a texture decision, not license to also change the palette. Confirmed twice with the owner on this redesign.
- **Don't** touch the chart categorical palette or semantic chart colors as part of any glass work — they are explicitly out of scope.
- **Don't** touch backend/DB/k8s config as part of design work in this project (owner-confirmed constraint, unchanged).

## Origin

- Created by `/impeccable document` (scan mode), 2026-08-26, as the "Midnight Deck" monochrome system.
- Replaced 2026-09-20 via `/impeccable` new-work (brief-pinned, no direction roll — the owner supplied a concrete glassmorphism reference implementation, ingested at `.llmwiki/raw/glassmorphism/`): recolored the existing backdrop-filter mica to refract an ambient field instead of flat black, fixed two hardcoded-white primary controls found by an independent finish review, then converted the two signature play buttons from opaque accent fill to real frosted glass.
- Same day, a colored (blue/violet/teal) accent and ambient field was tried, shipped, and then fully reverted after the owner flagged both that it wasn't an approved palette change and that it produced a harsh hard-edged color band against the light theme's white surfaces. The system returned to monochrome (white/black/gray only) while keeping every material gain (the glass panels, the multi-layer ambient field, the two glass play buttons) — the net change from the pre-redesign system is texture, not color.
