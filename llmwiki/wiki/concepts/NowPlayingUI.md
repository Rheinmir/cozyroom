# Concept: Now Playing UI (Modernized)

## Overview
The "Now Playing" interface has been redesigned to provide a premium, immersive listening experience. The design prioritizes visual aesthetics, dynamic content adaptation, and a distraction-free lyric reading experience.

## Key Features

### 1. Premium Capsule Equalizer
- **Visuals:** 60 vertical capsule bars with rounded caps.
- **Reflection:** A mirrored lower half that creates a "liquid" reflection effect.
- **Dynamic Gradients:** The bars use a linear gradient sampled from the top and bottom of the current track's album cover.
- **Auto-Brightness Boost:** An algorithm that calculates color luminance and automatically increases brightness and saturation for dark artwork to ensure visibility.
- **Responsiveness:** Frequency-responsive animation using the Web Audio API AnalyserNode.

### 2. Immersive Background System
- **Layered Approach:** 
  1. Base layer: Heavily blurred (80px) and desaturated version of the cover image.
  2. Overlay layer: A dynamic gradient tint using extracted artwork colors.
- **Transitions:** CSS crossfades ensure a smooth visual flow when tracks change, eliminating "black screen" flickering.

### 3. Streamlined [[concepts/Lyrics|Lyrics]] Interface
- **Faded Opacity:** [[concepts/Lyrics|Lyrics]] use a distance-based opacity formula to fade out at the edges, preventing harsh clipping.
- **Settings Panel:** All secondary tools (source selection, manual save, monitor) are consolidated into a toggleable overlay, accessible via a persistent "More" button in the top-right corner.

## Implementation Details
- **State Management:** `PlayerContext` stores the `coverColors` array, which is updated by `PlayerBar` after analyzing the artwork.
- **Rendering Loop:** `Equalizer.tsx` uses a mutable `ref` for colors to ensure the high-frequency `requestAnimationFrame` loop always uses the latest palette without closure staleness.

## Update — 2026-05-19: Mobile tap zones replace tab bar

Removed the "Now Playing / Lyrics" pill tab bar on mobile. Replaced with invisible tap zones:
- **Right 35% of npo-body** (when in player tab) → switches to Lyrics
- **Left 35% of npo-body** (when in lyrics tab) → returns to Now Playing (`npo-back-zone`)
- `npo-info-badges` (SMART/LOSSLESS) given `z-index: 3` to remain tappable above the zones
- Toast mechanism (`showTabs`/`handleNpoClick`) had already been removed in a prior session

**Commit:** `6f13c4a — feat: comics per-site download strategy, NPO tap zones, PWA update banner`

## Update — 2026-05-19: PWA update banner

Changed `registerType` from `'autoUpdate'` to `'prompt'`. Added `UpdateBanner` component in `App.tsx` using `useRegisterSW` hook — shows purple bar "Có phiên bản mới · Cập nhật ngay" when a new service worker is waiting. Also fixed `apple-touch-icon` (was commented out in `index.html`), causing iOS to use page screenshot as icon.

## Origin
- **Draft:** N/A (Direct implementation)
- **Commit:** `bdf5079 — feat(ui): modernize Now Playing with dynamic artwork-driven visualizer and immersive background`
- **Date promoted:** 2026-05-12
