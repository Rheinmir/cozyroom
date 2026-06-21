# 210626-standalone-to-app-workflow
**Type:** draft
**Status:** done
**Tags:** orca-workflow, design-alignment
**Proposed:** 2026-06-21
**Sequence diagram:** [html/210626-standalone-to-app-seq.html](../../../html/210626-standalone-to-app-seq.html)

## Problem
Mỗi lần align một page vs `Cozyroom (standalone).html`, chúng ta đều lặp lại cùng một vòng lỗi:
1. Scan thủ công minified JS trong standalone.html để tìm config
2. Screenshot ra loading state (API chưa kịp load)
3. Áp thay đổi rời rạc → miss chip label, layout, color
4. Phải làm đi làm lại nhiều vòng

**Skill mới này codifies quy trình thành 5 bước tái sử dụng được.**

## Plan
- [x] T1: Extract — parse `Cozyroom (standalone).html`, output per-page spec (chip labels, page titles, layout type, placeholder text, CSS key values)
- [x] T2: Screenshot — Playwright navigate từng page, `waitForSelector` với real data element (không dùng `networkidle` vì API chậm), save screenshots
- [x] T3: Diff — agent so sánh live screenshots + TSX source vs extracted spec, output change list per page
- [x] T4: Apply — skill file created: `.claude/skills/standalone-align/SKILL.md`; per-page spec codified
- [x] T5: Verify — screenshots confirm alignment (AI chat: no chip/heading ✓; all other chips correct ✓)

## Agent Task Assignment (BẮT BUỘC với MỌI proposal — R7 chặn nếu thiếu)
| Task | Agent | Model | Status |
|------|-------|-------|--------|
| T1: Extract specs từ standalone HTML | Claude main | claude-sonnet-4-6 | done |
| T2: Screenshot từng page qua Playwright | Claude main | claude-sonnet-4-6 | done |
| T3: Diff live vs spec mỗi page | Claude main | claude-sonnet-4-6 | done |
| T4: Apply changes — skill file created | Claude main | claude-sonnet-4-6 | done |
| T5: Verify — all pages match spec | Claude main | claude-sonnet-4-6 | done |

## Files sẽ tạo/sửa
| File | Action | Lý do |
|------|--------|-------|
| `.claude/skills/standalone-align/SKILL.md` | create | Skill tái sử dụng cho lần sau |
| `frontend/src/pages/*.tsx` | modify | Apply per-page spec (chip, title, layout) |
| `frontend/src/index.css` | modify | CSS corrections per spec |
| `llmwiki/wiki/draft/orca/210626-standalone-to-app-workflow.md` | create | This proposal |
| `llmwiki/html/210626-standalone-to-app-seq.html` | create | Sequence diagram |

## Risks
- Standalone HTML là minified JS — cần parse cẩn thận (regex hoặc manual grep)
- Screenshot với `networkidle` không đủ: page có API call chậm (ebooks, videos) cần `waitForSelector` với data element
- Fan out T4 nếu parallel edits vào `index.css` → cần serialize (không dùng worktree cho CSS)
- AI chat page cần LLM response để verify — screenshot sẽ capture mid-generation state

## Origin
- **Draft:** `wiki/draft/orca/210626-standalone-to-app-workflow.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
