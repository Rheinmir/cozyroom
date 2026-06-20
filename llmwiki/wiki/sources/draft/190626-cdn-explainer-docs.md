# 190626-cdn-explainer-docs
**Type:** draft
**Status:** proposed
**Tags:** docs-site-macos, output-report
**Proposed:** 2026-06-19

## What
Created a self-contained macOS-style HTML documentation page explaining what CDN is and how Cozyroom uses CF Tunnel as an edge cache.

## Output
- `llmwiki/html/190626-cdn-explainer.html` — full docs site, 4 sections, interactive draggable SVG diagrams

## Content Sections
| Section | Topic |
|---------|-------|
| 01 · Khái niệm | CDN là gì? — edge nodes, cache hit/miss |
| 02 · Vấn đề | Không có CDN — mọi request về origin, CF as relay |
| 03 · Giải pháp | `Cache-Control: public, max-age=3600` bật CF làm CDN |
| 04 · Thực tế | Cozyroom + CF Tunnel = CDN miễn phí, before/after fix |

## Files
| File | Action |
|------|--------|
| `llmwiki/html/190626-cdn-explainer.html` | created |
| `llmwiki/wiki/sources/draft/190626-cdn-explainer-docs.md` | created |

## Notes
- Invoked via: `/docs-site-macos cdn là gì` skill
- Served at: `http://localhost:8765/190626-cdn-explainer.html`
- The `Cache-Control: public, max-age=3600` fix was committed in the same session (commit df3f6b6 area)
- Lossless passthrough only — transcoded streams (`?q=320`, `?q=lossless-clean`) keep `no-cache` (streaming response, no Content-Length)

## Origin
- **Draft:** `wiki/sources/draft/190626-cdn-explainer-docs.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
