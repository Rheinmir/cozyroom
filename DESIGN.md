---
name: Cozyroom
description: Self-hosted personal media hub — music, video, ebooks, comics, and an AI assistant, run as a glass operator console over a living color field.
colors:
  void-black: "#07070f"
  charcoal-panel: "#0e0e0e"
  raised-charcoal: "#111111"
  surface-hover-wash: "rgba(255,255,255,0.07)"
  signature-blue: "#a9c6ff"
  signature-blue-hover: "#8aacf0"
  signature-violet: "#c3b6ff"
  orb-blue: "rgba(79,140,255,.7)"
  orb-violet: "rgba(139,92,246,.58)"
  orb-teal: "rgba(45,212,191,.4)"
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
    backgroundColor: "{colors.signature-blue}"
    textColor: "#000000"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.signature-blue-hover}"
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

Cozyroom reads as an instrument panel lit from within, not an unlit room: the same operator-console structure as before (sidebar library, persistent player, dense list views) now floats over a living, slow-drifting color field instead of a flat void-black canvas. The sidebar, header, player bar, modals, and cards are frosted glass — `backdrop-filter` blur over three layered ambient blooms (electric blue, violet, teal) — so depth and atmosphere come from real light and color passing through material, not from a second flat brand hue painted on top of black.

This is a deliberate identity replacement, not an incremental tweak: the prior "Midnight Deck" system's absolute monochrome (a single white accent, zero background color) is retired. The console discipline — legible at a glance, low-decoration, confident about what's interactive — is preserved; the color language around it is not. The mica/blur plumbing itself was already mostly built (sidebar/header/player/modals used `backdrop-filter` before this redesign); what changed is giving it something colorful to blur, and one signature accent to replace paper-white.

**Key Characteristics:**
- Glass-first: frosted, blurred panels over a multi-layer ambient color field — not flat opaque rectangles.
- Scoped material: glass applies to floating/elevated surfaces only (sidebar, header, player bar, modals, dropdowns, cards). Dense rows — the track table, list views — stay flat by design, for scan speed and scroll performance.
- One signature accent family (bright periwinkle-blue / soft violet) replaces the old paper-white-only accent; semantic status colors and the chart categorical palette are untouched.
- Operator-console density is unchanged: compact rows, tables, and dashboards over marketing-style whitespace.
- Spotify-shaped chrome, Cozyroom-owned palette: the in-app icon is still a placeholder borrowed from Spotify's mark; unchanged by this redesign, still fair game to replace later.

## Colors

A cool blue/violet/teal ambient field behind frosted glass panels, with one signature accent carrying every interactive/primary/active element. Semantic and chart colors are reserved for meaning and untouched by this redesign.

### Primary
- **Signature Blue** (`#a9c6ff`, token `signature-blue`, CSS var `--green`): the accent — primary buttons (including the player's own play/hero-play controls), active nav state, active/selected chips and badges, focus rings, links. Chosen bright enough to keep the existing `background: var(--green); color: #000` pairing (used at ~65 call sites) legible without touching every site individually.
- **Signature Violet** (`#c3b6ff`, token `signature-violet`, CSS var `--purple`): a secondary tint used where the codebase already had a distinct `--purple` slot (e.g. `.smart-badge--active`) — not a second system accent, a sibling hue from the same family.

### Ambient Field
- **Orb Blue / Orb Violet / Orb Teal** (`--orb-a` / `--orb-b` / `--orb-c`): three large, slow-drifting radial blooms (`body::before`, `body::after`, `html::before`) sized and positioned to reach behind the sidebar, header, and player bar specifically — not decoration confined to empty corners. This is what the glass panels' `backdrop-filter: blur()` actually blurs; without it, the mica reads as tinted black.

### Neutral
- **Void Black** (`#07070f`, token `void-black`): the app's base canvas (`--bg`) — deepened from the old pure `#050505` with a cool undertone so the ambient blooms have something moody to sit on.
- **Charcoal Panel** (`#0e0e0e`, token `charcoal-panel`): resting surfaces that are *not* glass — table rows, plain list items (`--surface`).
- **Raised Charcoal** (`#111111`, token `raised-charcoal`): a slightly lighter tier for elements above a Charcoal Panel surface (`--elevated`).
- **Bright / Dim / Ghost Text**: unchanged three-tier white-opacity text hierarchy (`--text` / `--text-muted` / `--text-faint`).

### Named Rules
**The Signature Accent Rule.** Signature Blue is the one accent that means "selected," "primary," or "on" — it replaces the old One Accent Rule's paper-white in that exact role. Anything that used to reach for white as an interactive signal now reaches for `var(--green)` instead; anything that was genuinely decorative white (text, icons at rest) stays white.

**The Glass-Is-Scoped Rule.** `backdrop-filter` glass applies to floating/elevated surfaces only: sidebar, header, player bar, modals, dropdowns, popovers, cards. Dense list/table rows (the track table, queue rows) stay flat — this was an explicit, deliberate scope decision, not an oversight, made to protect scroll performance and operator-console scan speed. Don't add `backdrop-filter` to a per-row element in a long list.

**The Ambient-Not-Corner Rule.** The three ambient orbs are sized (1100–1300px) and positioned to actually reach the panels that need to refract them (sidebar, header strip, player bar band), not just glow in an empty corner of the viewport. A glass panel with no color reaching it through the blur is a bug, not a subtler look — caught once already during this redesign's own finish review (the first pass shipped orbs too small/faint/off-target and near-opaque panel fills that ate what little color reached them).

**The No-Accent-Token Rule.** There is still no `--accent` CSS variable — referencing it silently resolves to nothing. The real accent token is `var(--green)`.

**The Data Needs Color Rule (unchanged).** Two chart color systems, scoped to data viz and never UI chrome: the categorical palette `--chart-1..8`, and semantic status `--chart-fail/warn/caution/ok`. Untouched by this redesign.

**The Genre Tile Color Rule (unchanged).** The Browse-by-genre grid's rotating duotone palette (SearchPage.tsx) remains its own scoped exception, unrelated to the signature accent or the ambient field.

### Light Theme

`:root[data-theme="light"]` (toggle from the Sidebar, persisted to `localStorage`) also gets the glass treatment — the ambient orbs and the accent hue are the same identity in both themes, only intensities differ:
- `--bg` stays the soft cool-neutral `#eef0f2` from the prior system (unchanged — already correctly reasoned to avoid a stark-white flat canvas).
- Glass panel fills (`--sidebar-glass`/`--header-glass`/`--player-glass`) flip to white-based translucency, at lower opacity than dark mode (`.5`/`.32`/`.55`) so the same ambient blooms still read through on a bright canvas.
- Orb tokens keep the same hue family at reduced alpha (`.4`/`.32`/`.22` vs dark mode's `.7`/`.58`/`.4`) so the color reads as a soft aurora under white cards rather than overpowering them.
- Signature Blue/Violet do not flip between themes (same rationale as the old system: countless buttons hardcode `color: #000` paired with the accent, so a per-theme accent swap would silently make that text illegible in whichever theme darkened the accent).

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

Depth now comes from two sources working together: the pre-existing white ambient-glow-on-hover lift (unchanged — buttons/cards/rows still lift with `box-shadow: 0 8px 20px -8px rgba(...)` plus `1–2px` translateY on hover), and the new glass material itself, where `backdrop-filter: blur()+saturate()` over the colored ambient field gives floating surfaces real visual depth independent of any shadow.

- **Resting:** Charcoal Panel surface (non-glass elements) or frosted glass (floating elements) — hairline inset border, no drop shadow either way.
- **Raised (hover-capable elements):** lift with a soft glow, tinted toward the signature accent family (`rgba(79,140,255,...)` / `rgba(139,92,246,...)`) rather than plain white, plus a `1–2px` translateY.
- **Floating (popovers, modals):** heavier ambient shadow, `box-shadow: 0 6px 20px rgba(0,0,0,0.5)`, since floating surfaces sit above the glass, not directly on the ambient field.

### Named Rules
**The Light-Not-Only-Color Rule.** Superseding the old system's "Light-Not-Color Rule": depth still primarily comes from white ambient glow and lift, but hover/active glows on accent-bearing elements (nav active state, primary buttons, active badges) now tint toward the signature accent instead of staying pure white — the accent's presence in elevation is a feature, not a One-Accent-Rule violation, since it only applies to elements that are already accent-colored at rest.

## Shapes

Unchanged by this redesign. Corner radius scales with intent: `4–8px` for chips/inline controls, `11–20px` for cards/panels/bubbles, `999px`/`50%` for pills. Borders stay hairline `1px`.

## Components

### Buttons
- **Shape:** `8px` radius by default; fully round for icon-only buttons (including `.play-btn` / `.hero-play-btn`, the player's primary controls).
- **Primary:** Signature Blue background, black text, `10px 16px` padding — this now includes the player's own play button and the playlist hero "Phát" CTA, both previously hardcoded paper-white.
- **Hover / Focus:** background steps to Signature Blue Hover (`#8aacf0`); Raised elevation glow, tinted blue.
- **Ghost / Secondary:** transparent background, hairline border, Dim Text — unchanged.

### Cards / Containers
- **Corner Style:** `11–16px`, unchanged.
- **Background:** non-floating cards keep Charcoal Panel; floating cards (the ones already using `--glass-fill`) are frosted glass over the ambient field.
- **Shadow Strategy:** Raised elevation glow on hover, now blue-tinted instead of white on artist/album/video hover cards.
- **Border:** `1px` hairline, unchanged.

### Inputs / Fields
- **Style:** Charcoal Panel background, `8px` radius — unchanged. The header search bar sits inside the header's own glass strip.
- **Focus:** inset hairline brightens — unchanged.

### Navigation
- Sidebar items: Body-weight label text, Dim Text at rest. **Active state now carries the Signature Accent Rule**: active nav link text is Signature Blue (was `--text`/white), with a blue-tinted glow (was hardcoded white) — this closes a gap found during this redesign's finish review, where the sidebar's own active indicator had been missed on the first pass.
- The sidebar itself is frosted glass (`--sidebar-glass`, pre-existing `backdrop-filter: blur(20px)`), now over the ambient field instead of flat black.

### Player Bar (signature surface)
The persistent bottom player bar is frosted glass (`--player-glass`, `backdrop-filter: blur(24px)`) positioned to sit directly over the violet ambient bloom — the single clearest "instrument panel lit from within" moment in the app. Its play button carries the Signature Accent Rule.

## Charts

Unchanged by this redesign — the `--chart-1..8` categorical palette and `--chart-fail/warn/caution/ok` semantic set are explicitly out of scope (see The Data Needs Color Rule). All Chart-Palette Rule and chart-chrome guidance from the prior system stands as-is.

## Do's and Don'ts

### Do:
- **Do** treat Signature Blue (`var(--green)`) as the one accent for "selected/primary/on" — the same discipline as the old One Accent Rule, just with an actual hue instead of white.
- **Do** keep glass (`backdrop-filter`) scoped to floating/elevated surfaces — sidebar, header, player bar, modals, dropdowns, cards. Never add it to individual rows in a dense list.
- **Do** size and position new ambient decoration so it actually reaches the surfaces meant to refract it — verify with a screenshot, not just by reading the token file (this redesign's own finish review caught orbs that existed in CSS but were too small/off-target/behind-too-opaque-a-fill to be visible).
- **Do** tint hover/active glows on already-accent-colored elements toward the signature blue/violet family instead of leaving them hardcoded white.
- **Do** keep the three explicit wide-monitor breakpoints (1920/2560/3840px) for reading-width columns — unchanged.

### Don't:
- **Don't** reference `var(--accent)` — it does not exist; use `var(--green)`.
- **Don't** add `backdrop-filter` blur to dense table/list rows — reserved for floating surfaces only.
- **Don't** hardcode `#fff`/`white` for a primary button or active-state fill or glow — that is the specific bug class this redesign fixed twice (`.play-btn`/`.hero-play-btn`, `.nav-link.active`) and it regresses silently if reintroduced.
- **Don't** touch the chart categorical palette or semantic chart colors as part of any glass/accent work — they are explicitly out of scope.
- **Don't** touch backend/DB/k8s config as part of design work in this project (owner-confirmed constraint, unchanged).

## Origin

- Created by `/impeccable document` (scan mode), 2026-08-26, as the "Midnight Deck" monochrome system.
- Replaced 2026-09-20 via `/impeccable` new-work (brief-pinned, no direction roll — the owner supplied a concrete glassmorphism reference implementation, ingested at `.llmwiki/raw/glassmorphism/`), following an independent finish-review pass that caught two hardcoded-white primary controls and an under-powered ambient field before this document was written. Verification gap disclosed at time of writing: confirmed visually in the loading/empty-state chrome (sidebar, header, player bar, both themes' token math) via Playwright screenshots; **not yet confirmed against real library content** (populated track/album cards, light-theme toggle rendered live) because the local dev backend requires Postgres credentials unavailable in this environment, and this project's hard rule against touching the production database means that gap was not worked around. Recommended before shipping: one more visual pass once real data is reachable.
