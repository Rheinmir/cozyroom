# 220626-ai-chat-design-fix
**Status:** done
**Sequence diagram:** [html/220626-ai-chat-design-fix-seq.html](../../../html/220626-ai-chat-design-fix-seq.html)

## Problem

`standalone-align` ran on the AI chat page (commit a3c1af2) but produced 8 visual regressions vs
the standalone reference. Root cause: the skill's T3 diff step only checked chip *label* and page
*title* strings — it never diffed CSS property *values* (colors, radius, padding, gradient vs solid).

Diffs confirmed from agent read of `Cozyroom (standalone).html` vs `index.css` + `AIAssistantPage.tsx`:

| # | Element | Current (app) | Target (standalone) |
|---|---------|--------------|---------------------|
| 1 | Eyebrow chip color | purple `rgba(168,85,247)` | teal `rgba(45,212,191)` |
| 2 | Page title size | 28px, weight 800 | 42px, weight 700, letter-spacing -0.03em |
| 3 | Avatar shape | circle (`border-radius:50%`) | rounded-square `11px` |
| 4 | Avatar background | blue `rgba(59,130,246,.18)` | gradient `#a855f7→#2dd4bf` |
| 5 | Assistant bubble bg | `var(--surface)` = `#0e0e13` | `rgba(255,255,255,0.04)` glass |
| 6 | Bubble border-radius | `16px` + bottom corner 4px | assistant `4px 18px 18px 18px`, user `18px 4px 18px 18px` |
| 7 | User bubble bg | solid `#a855f7` | `rgba(168,85,247,0.16)` + inset border |
| 8 | Input area | rectangle `12px` radius | pill `999px`, transparent textarea, gradient send btn |

## Plan
- [ ] T1: Add `.ai-page .library-tag` scoped override → teal chip (no global change to other pages)
- [ ] T2: Add `.ai-page .page-title` scoped override → 42px, weight 700, letter-spacing -0.03em
- [ ] T3: Fix `.ai-avatar` → 34×34px, border-radius 11px, gradient bg, SVG sparkle icon + glow
- [ ] T4: Fix `.ai-bubble--assistant` → glass bg, `4px 18px 18px 18px` radius, inset shadow
- [ ] T5: Fix `.ai-bubble--user` → semi-transparent, `18px 4px 18px 18px` radius, inset shadow
- [ ] T6: Redesign input area → pill container (`.ai-input-row`), transparent textarea, gradient send btn + glow
- [ ] T7: Fix `standalone-align` skill T3 step + spec entry — add CSS value checklist, fix "blue avatar" entry
- [ ] T8: Deploy via `deploy-k8s-frontend`, verify screenshot matches standalone

## Agent Task Assignment (BẮT BUỘC)
| Task | Agent | Model | Status |
|------|-------|-------|--------|
| T1–T6: CSS + JSX fixes in index.css + AIAssistantPage.tsx | Claude main | claude-sonnet-4-6 | done |
| T7: Skill update in .claude/skills/standalone-align/SKILL.md | Claude main | claude-sonnet-4-6 | done |
| T8: Deploy + verify | Claude main via deploy-k8s-frontend | claude-sonnet-4-6 | done |

All tasks to one agent (Claude main) because changes are sequential and interdependent — T8 depends on T1–T7.

## Files sẽ tạo/sửa
| File | Action | Lý do |
|------|--------|-------|
| `frontend/src/index.css` | sửa | Fix 8 CSS regressions (T1–T6) |
| `frontend/src/pages/AIAssistantPage.tsx` | sửa | Fix avatar icon + input pill structure (T3, T6) |
| `.claude/skills/standalone-align/SKILL.md` | sửa | T7: add CSS value diff checklist + fix "blue avatar" spec |

## Risks
- `.library-tag` is shared — T1 must use `.ai-page .library-tag` scoped override, not modify global rule
- Input pill (T6) moves structure: send button may need to move inside `.ai-input-wrap`; test ghost-text completion still renders correctly
- Bubble padding/line-height changes (T4–T5) may shift layout of long messages — visual check required
- `tsc --noEmit` after every TSX change

## Origin
- **Draft:** `wiki/draft/orca/220626-ai-chat-design-fix.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
