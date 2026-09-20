---
type: draft
title: 200926-glassmorphism-ref-ingest
tags: [ingest, output-report, glassmorphism]
timestamp: 2026-09-20
---

# 200926-glassmorphism-ref-ingest
**Status:** proposed
**Proposed:** 2026-09-20

## What
Ingest file mới trong `raw/glassmorphism/` (css.scss + index.tsx, demo smart-home glassmorphism) thành 2 trang wiki tham khảo — chưa áp dụng vào code thật.

## Output
- Tạo `concepts/GlassmorphismReference.md`: phân tích công thức kính (backdrop-filter blur + rgba trắng + hairline border), pattern component (ScrollableComponent, PIN digit), và ghi nhận rõ xung đột trực tiếp với One Accent Rule / Light-Not-Color Rule trong `DESIGN.md` (root) hiện tại.
- Tạo `sources/200926-glassmorphism-smarthome-demo.md`: tóm tắt nguồn raw, 5 key takeaways.
- **Chưa đụng** `DESIGN.md`, chưa đụng bất kỳ file `frontend/src/` nào — việc áp dụng style này (nếu được duyệt) là một quyết định thiết kế lớn, cần qua `propose` riêng.

## Files
| File | Action |
|------|--------|
| `.llmwiki/wiki/concepts/GlassmorphismReference.md` | created |
| `.llmwiki/wiki/sources/200926-glassmorphism-smarthome-demo.md` | created |
| `.llmwiki/wiki/index.md` | modified |
| `.llmwiki/wiki/log.md` | modified |

## Notes
- Invoked via: `ingest` skill
- [[GlassmorphismReference]]

## Origin
- **Draft:** `wiki/sources/draft/200926-glassmorphism-ref-ingest.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
