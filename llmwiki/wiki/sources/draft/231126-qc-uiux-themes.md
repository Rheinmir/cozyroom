---
type: draft
status: done
title: qc-uiux audit of the three themes (Dark, Light, Warm)
---

# qc-uiux — themes Dark / Light / Warm (23-11-26)

Scope: `/`, `/music/discover`, `/music/albums/<id>`, the sidebar theme toggle; widths 1300 and 390; engine = visual-qa `DESIGN_AUDIT` run on the live site (before) and on the branch dev server (after).

## Measured (engine, issues before -> after)
| Rule | Before | After | Note |
|---|---|---|---|
| tap-target (<24px) | 114 per theme/width | 0 | `.fav-star` 20px, `.fav-arrow` 16px -> min 24px |
| row-misalign | 60 / 57 | 3 / 0 | rest = sidebar brand 28px mark vs 24px text -> line-height 28px |
| contrast-aa Warm | 243 / 207 | 6 | 6 left = white text on image hero cards (engine cannot see the image; same in Light) |
| monochrome-surface Warm | 3 | 0 | sidebar glass now the canvas tone |
| overlap at 390 | 11 | 11 | floating nav bubble / search island over content: by design, not changed |
| console/network | 404 `/media/covers/011bf58990c2913b` | same | data (missing cover), not code |

## Four parts (score, worst, fix)
1. Accessibility 7/10. Worst: starred state was white (`.fav-star--active` `#fff !important`) = invisible on Light and Warm; sitewide focus ring white = invisible on Light. Fix: ink token, dark ring on Light, Warm ring #c24e1c. By eye still owed: keyboard order, alt text meaning.
2. Visual hierarchy 8/10. Worst: none measured. The Warm page top was whiter than the sidebar (gradient surface -> bg): solid canvas in Warm.
3. Consistency 6/10 -> 8/10. Worst: hard-coded dark glass `rgba(28,28,30,.5)` in 7 rules (stat chips, back button, search island) = cool grey chips on a peach page. Fix: token `--chrome-glass` per theme. Drift left: `.fav-pill` and others still hold some white-alpha literals.
4. Antipattern 7/10. Worst: the theme toggle cycled Dark -> Light -> Warm on every click (a click on "Warm" stopped at Light). Fix: radio group, each option sets its theme at once; collapsed rail keeps one cycling icon.

Verdict: PASS for the measured items after the fixes (advisory). Open for the owner's eye: the floating bubble overlap at 390, dark/light sidebar tone vs canvas (intentional), pages not audited.

## Origin
- Owner request m1a207e915cc18f5 (room kho-cozyroom), method skill qc-uiux, branch kozu/theme-audit.
