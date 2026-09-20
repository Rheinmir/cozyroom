# 190626-onboard-cozyroom
**Type:** draft
**Status:** done
**Tags:** orca-onboard, output-report
**Proposed:** 2026-06-19

## Agent CLI Availability
| Agent | Binary | Status |
|-------|--------|--------|
| Antigravity | `agy` | ❌ not found |
| OpenCode | `opencode` | ✅ usable (1.15.13) |
| Kiro | `kiro-cli` | ❌ not found |

## Agent Task Assignment
| Task | Agent | Model | Status |
|------|-------|-------|--------|
| Phase 1 — Graph generation (428 files) | distilled pipeline: bash + opencode (batch) + Claude (layers/tour) | DeepSeek Flash v4 + Sonnet | done |
| Phase 2 — Domain enrichment | Claude main thread | Sonnet | done |
| Phase 3 — Wiki generation | opencode | DeepSeek Flash v4 | done |
| Phase 4 — HTML docs | opencode | DeepSeek Flash v4 | done |

## What
Onboard `cozyroom` — understand-anything graph, domain enrichment, wiki, HTML.

## Output
- `.understand-anything/knowledge-graph.json`
- `.understand-anything/ONBOARDING.md` (~20k tokens distilled)
- `.orca-onboard/intermediate/domain-graph.json`
- `llmwiki/wiki/` (index, concepts, entities, architecture, tours)
- `llmwiki/html/onboarding-cozyroom.html`

## Files
| File | Action |
|------|--------|
| `.understand-anything/knowledge-graph.json` | created by Phase 1 pipeline |
| `.understand-anything/ONBOARDING.md` | created by Phase 1 pipeline |
| `.orca-onboard/intermediate/domain-graph.json` | created by Claude |
| `llmwiki/wiki/index.md` | modified |
| `llmwiki/wiki/concepts/architecture.md` | created |
| `llmwiki/wiki/concepts/onboarding-tour.md` | created |
| `llmwiki/wiki/entities/project-structure.md` | created |
| `llmwiki/html/onboarding-cozyroom.html` | created |

## Notes
- Invoked via: `/orca-onboard` skill
- Project root: `/mnt/c/Users/olive/orca/cozyroom`
- Files tracked: 428
- Reasoning phases (layers, tour, domain) in Claude main thread — NOT dispatched to cheap models
- Mechanical phases (batch analyze, wiki render, HTML): opencode + DeepSeek Flash v4

## Cost Estimate
| Phase | Agent | Est. tokens | Est. cost |
|-------|-------|-------------|-----------|
| Phase 1 (graph) | bash + opencode batches + Claude layers/tour | ~1.5M (DeepSeek) + ~50k (Sonnet) | ~$0.50 |
| Phase 2 (domain) | Claude Sonnet | ~50k | ~$0.50 |
| Phase 3 (wiki) | DeepSeek Flash | ~100k | ~$0.02 |
| Phase 4 (HTML) | DeepSeek Flash | ~50k | ~$0.01 |

## Origin
- **Draft:** `wiki/draft/orca/190626-onboard-cozyroom.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
