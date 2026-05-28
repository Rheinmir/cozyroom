# AI Markdown + GFM Rendering
**Type:** concept
**Tags:** ai, markdown, gfm, rendering

AI assistant responses render as Markdown with GitHub-Flavored Markdown (GFM) table support using `react-markdown` + `remark-gfm`.

## Notes

- Import: `ReactMarkdown` + `remarkGfm` in `AIAssistantPage.tsx`
- Wrapping class `.ai-bubble-text--md` on assistant bubbles enables styled tables, code blocks, lists, headings, blockquotes, and horizontal rules
- CSS (17 rules in `index.css`): table borders/striping, code inline/block, nested lists, heading normalization, blockquote accent border, link accent color, HR styling
- User bubbles remain plain text (no markdown parsing — only assistant gets `ReactMarkdown`)
- This enables AI to output structured tables (e.g. track listings with columns), code snippets, and formatted lists in chat responses
- [[AIChatSessions]] — sessions use same rendering

## Origin
- **Source:** `frontend/src/pages/AIAssistantPage.tsx:4-5,373-376`, `frontend/src/index.css:106-122`
- **Commit:** working tree on top of `5bcef19`
- **Date:** 2026-05-27
