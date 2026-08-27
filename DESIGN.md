---
name: Cozyroom
description: Self-hosted personal media hub — music, video, ebooks, comics, and an AI assistant, run as a monochrome operator console.
colors:
  void-black: "#050505"
  charcoal-panel: "#0e0e0e"
  raised-charcoal: "#111111"
  surface-hover-wash: "rgba(255,255,255,0.07)"
  paper-white: "#ffffff"
  text-bright: "rgba(255,255,255,0.92)"
  text-dim: "rgba(255,255,255,0.55)"
  text-ghost: "rgba(255,255,255,0.32)"
typography:
  display:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
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
    backgroundColor: "#e0e0e0"
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

**Creative North Star: "The Midnight Deck"**

Cozyroom reads as a DJ booth after hours: a near-black operator surface built to be lived in for hours at a time, not glanced at. It borrows the *structure* of a familiar dark music app (sidebar library, persistent player, dense list views) but rejects that app's color language entirely — there is no brand hue, no gradient wash, no colorful badge system. The only "color" is paper-white against void-black, used sparingly as the single interactive signal in a field of near-black surfaces and three tiers of white-on-black text.

This restraint is deliberate, not a placeholder: the owner runs Cozyroom as both a daily media console and a live testbed for scaling real infrastructure, so the interface should feel closer to an instrument panel than a consumer entertainment app — legible at a glance, low-decoration, confident about what's interactive.

**Key Characteristics:**
- Monochrome-first: void-black background, white the only accent, three text-opacity tiers for hierarchy.
- Operator-console density: compact rows, tables, and dashboards over marketing-style whitespace.
- Tactile, not flat: interactive elements lift and glow on hover/press rather than sitting inert (see Elevation & Depth — this is a deliberate evolution from the incumbent purely-flat system).
- Spotify-shaped chrome, Cozyroom-owned palette: the current in-app icon is a placeholder borrowed from Spotify's mark; it is not a binding brand asset and should be replaced with a Cozyroom-original mark during polish/new-work passes.

## Colors

A single accent (paper-white) against three densities of near-black. No hue exists anywhere in the base system — any color that appears (status reds/greens/blues on charts, provider badges) is local to that one context, never promoted to a system color.

### Primary
- **Paper White** (`#ffffff`, token `paper-white`): the only accent. Used for primary buttons, active/selected states, the single interactive underline/highlight. Always paired with black or near-black foreground text on top of it — never white text over it.

### Neutral
- **Void Black** (`#050505`, token `void-black`): the app background (`--bg`).
- **Charcoal Panel** (`#0e0e0e`, token `charcoal-panel`): resting surfaces — cards, inputs, dropdowns (`--surface`).
- **Raised Charcoal** (`#111111`, token `raised-charcoal`): a slightly lighter tier for elements that sit above a Charcoal Panel surface (`--elevated`).
- **Surface Hover Wash** (`rgba(255,255,255,0.07)`, token `surface-hover-wash`): the hover/pressed state for rows and panels (`--surface-hover`).
- **Bright Text** (`rgba(255,255,255,0.92)`): primary reading text (`--text`).
- **Dim Text** (`rgba(255,255,255,0.55)`): secondary/meta text — timestamps, labels, muted rows (`--text-muted`).
- **Ghost Text** (`rgba(255,255,255,0.32)`): tertiary/disabled-weight text (`--text-faint`).

### Named Rules
**The One Accent Rule.** Paper White is the only accent color in the system. Anything that wants to look "selected," "primary," or "on" reaches for it — never a second brand hue.

**The No-Accent-Token Rule.** There is no `--accent` CSS variable in the codebase — referencing it silently resolves to nothing (a confirmed, previously-shipped bug class). The real accent token is `var(--green)`, which is literally white, always paired with `color: #000` for legible text/icons on top of it. `--purple` is currently also white and should be treated as an unused legacy alias, not a second hue — don't build new work assuming it is distinct from `--green`.

**The Data Needs Color Rule.** Status/semantic indicators (success vs. failure, error text) and multi-series chart data (recharts lines/bars distinguishing simultaneous data series, e.g. AIStatsPage/MusicStatsPage) are the one sanctioned exception to the One Accent Rule — monochrome cannot express "this failed" or separate two overlapping series. These colors stay local to their chart/status context (`#f87171` fail-red, `#4ade80` success-green, and a small categorical chart palette are already in use) and must never be promoted into a system-wide token or reused as a second brand accent outside data/status contexts.

## Typography

**Display Font:** Geist (with -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif fallback)
**Body Font:** Geist (same stack)
**Label/Mono Font:** Geist Mono (falling back to 'SFMono-Regular', monospace)

**Character:** A single humanist grotesque (Geist) carries almost everything — display, body, and UI chrome all read as one calm voice. Geist Mono is reserved for anything that wants to feel like raw data or a technical readout (chat model names, provider badges, chart ranks, log timestamps), which is what actually creates hierarchy in a system with only one color.

### Hierarchy
- **Display** (900, `clamp(24px, 5vw, 52px)`, line-height 1.1): page titles (`.page-title`, hero titles).
- **Title** (700, 18px): section headers, card titles.
- **Body** (400, 14px, line-height 1.5): default reading and UI text.
- **Label** (600, 11px, letter-spacing 0.08em, uppercase where used): table headers, small buttons, badges — frequently set in Geist Mono instead of Geist to read as "system" text.

### Named Rules
**The Mono-Means-Machine Rule.** Switch to Geist Mono only for content that is literally data or system output (model names, token counts, timestamps, ranks) — never for prose or UI copy. Mono is how this system signals "this is a readout," not a decorative typographic accent.

## Layout

Two-tier structure: a persistent app sidebar (`--sidebar-w: 220px`, collapsible to `--sidebar-collapsed-w: 56px`) plus a persistent bottom player bar (`--player-h: 72px`, `56px` on mobile), with the routed page filling the remainder. Content pages default to full-width with `32px` padding (`.page`); a small number of reading-focused surfaces (the AI chat column, the Now Playing overlay, the ebook reader body) instead cap to a centered, readable column and scale that cap up in three explicit steps at 1920px/2560px/3840px so wide monitors don't strand the content in a fixed mobile-era width — established today via `.ai-page`, `.npo-body`, `.stats-page-body`, `.debug-page-body`, `.album-page` in `index.css`. New reading-width surfaces should follow the same three-breakpoint scaling pattern rather than a single static `max-width`.

Mobile breakpoint is `900px`: sidebar hides in favor of a bottom mini-player + radial/mobile nav, and any page-level secondary sidebar (e.g. the AI conversation history panel) collapses into a slide-in overlay behind a toggle rather than disappearing outright.

## Elevation & Depth

The incumbent implementation was almost entirely flat, using a 1px inset hairline (`inset 0 0 0 1px rgba(255,255,255,0.05–0.3)`) in place of drop shadows for structure — a reasonable choice on a void-black background, where dark shadows don't read at all. The owner asked for a more **tactile and confident** feel going forward, so this system commits to a real (if restrained) elevation model rather than staying purely flat:

- **Resting:** Charcoal Panel surface, hairline inset border only (as today) — no shadow.
- **Raised (hover-capable elements: buttons, cards, list rows):** on hover/focus, lift with a soft ambient glow — `box-shadow: 0 8px 20px -8px rgba(255,255,255,0.2)` (already used on the AI avatar and send button) — plus a `1–2px` translateY. Light, not color, reads as depth here.
- **Floating (popovers, the reaction picker, modals):** a heavier ambient shadow against the page behind it — `box-shadow: 0 6px 20px rgba(0,0,0,0.5)` (already used by `.ai-reaction-picker`) — since floating surfaces sit above other UI, not directly on void-black.

### Named Rules
**The Light-Not-Color Rule.** Depth is expressed with white ambient glow and subtle lift, never with a second color or a dark drop-shadow (dark shadows are invisible on a `#050505` background). This is what makes elevation feel tactile without breaking the monochrome rule.

## Shapes

Corner radius scales with a component's intent rather than following one fixed value: small chips/badges/inline controls use `4–8px`; cards, panels, and bubbles use `11–20px`; anything meant to feel like a discrete "pill" (badges, small icon buttons, avatars, the reaction trigger) goes fully round (`999px` / `50%`). Borders are rare and always a hairline `1px solid rgba(255,255,255,0.07–0.15)` — never a heavier stroke.

## Components

### Buttons
- **Shape:** `8px` radius by default (`{rounded.md}`); fully round for icon-only buttons.
- **Primary:** Paper White background, black text, `10px 16px` padding.
- **Hover / Focus:** background steps down to `#e0e0e0`; add the Raised elevation glow.
- **Ghost / Secondary:** transparent background, `1px` hairline border, Dim Text color; used for the many small control-row buttons (🧠, 📋-equivalent, model input, etc.).

### Cards / Containers
- **Corner Style:** `11–16px`.
- **Background:** Charcoal Panel at rest, Raised Charcoal or Surface Hover Wash on hover.
- **Shadow Strategy:** none at rest; Raised elevation glow on hover for interactive cards.
- **Border:** `1px` hairline, `rgba(255,255,255,0.07)`.

### Inputs / Fields
- **Style:** Charcoal Panel background, `8px` radius, no visible border at rest.
- **Focus:** inset hairline brightens to `rgba(255,255,255,0.5)` (see `.ai-input-wrap:focus-within`) rather than an outline ring — consistent with the hairline-as-structure language.

### Navigation
- Sidebar items: Body-weight label text, Dim Text at rest, Bright Text + Surface Hover Wash background when active/hovered, generous `12–16px` row padding for a console-like scan rhythm. Mobile drops the sidebar for a bottom mini-player and radial nav; secondary in-page navigation (e.g. AI chat history) becomes a slide-in overlay behind a toggle.

### Conversation Sidebar (signature component)
The AI assistant's chat-history sidebar (`.ai-history-sidebar`) is the clearest expression of "console, not chat toy": a fixed 260px column, one-line-truncated session titles in Body weight over a Geist Mono timestamp, active session marked only by Surface Hover Wash — no color, no icon badge.

## Do's and Don'ts

### Do:
- **Do** treat Paper White as the only accent in any new surface — resist the urge to add a second color for "variety."
- **Do** use the three explicit wide-monitor breakpoints (1920/2560/3840px) for any new reading-width column, matching `.ai-page`.
- **Do** give interactive elements a hover glow + slight lift (Raised elevation) — flat-and-static now reads as unfinished, not minimal.
- **Do** reserve Geist Mono for data/system readouts only.

### Don't:
- **Don't** reference `var(--accent)` — it does not exist; use `var(--green)`.
- **Don't** add drop shadows in dark colors — they're invisible on `#050505`; use the white ambient-glow pattern instead.
- **Don't** treat the current Spotify-shaped play-button icon as a locked brand asset — it's an acknowledged placeholder, fair game to replace with a Cozyroom-original mark.
- **Don't** touch backend/DB/k8s config as part of design work in this project — impeccable's scope here is `frontend/src` only (owner-confirmed constraint).

## Origin

- Created by `/impeccable document` (scan mode), 2026-08-26, from `frontend/src/index.css` custom properties and rendered component patterns, plus a qualitative interview with the owner (Creative North Star, logo status, elevation direction, component feel).
