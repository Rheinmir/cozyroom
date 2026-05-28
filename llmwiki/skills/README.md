# skills/

Multi-step reusable workflows the agent invokes autonomously based on context.

## Structure

```
skills/
  wiki-loop/   — Wiki knowledge management (ingest, query, lint)
  dev-loop/    — Development loop & setup (propose, impact-check, safe-change, verify-before-commit, new-project-setup, join-project, onboard-codebase)
  orchestrate/ — Orca orchestration (orca-workflow, orca-onboard, orca-dispatch-reference)
  utils/       — Utilities & templates (docs-site-macos-skill, extract-site, md-to-html, sync-template)
```

## wiki-loop/

| Skill | Purpose |
|-------|---------|
| `ingest` | Process a new `raw/` file into wiki pages |
| `query` | Synthesize an answer from the wiki; persist new insights |
| `lint` | Health-check the wiki for orphans, contradictions, stale content |

## dev-loop/

| Skill | Purpose |
|-------|---------|
| `propose` | Plan a feature before coding; create a draft in `wiki/sources/draft/` |
| `impact-check` | Map all dependents of a symbol before modifying it |
| `safe-change` | Modify shared code without breaking existing callers |
| `verify-before-commit` | Gate every commit; typecheck, lint, then promote draft to wiki |
| `new-project-setup` | Deploy llmwiki từ đầu: template pull, skill install, RTK, wiki seed, onboard |
| `join-project` | Orient nhanh vào dự án đang chạy đã có llmwiki — read-only, <2 phút |
| `onboard-codebase` | Deep analysis codebase → populate wiki/concepts/ + wiki/entities/ |

## orchestrate/

| Skill | Purpose |
|-------|---------|
| `orca-workflow` | Orchestrate multi-agent tasks via Orca (propose → gate → dispatch → verify) |
| `orca-onboard` | Onboard a new agent CLI to the Orca pool |
| `orca-dispatch-reference` | Reference for Antigravity/OpenCode dispatch, skill installation, AgentMemory, RTK token proxy |

## utils/

| Skill | Purpose |
|-------|---------|
| `sync-template` | Upstreaming/downstreaming template improvements |
| `extract-site` | Extract documentation from a live site |
| `docs-site-macos-skill` | Build macOS-style documentation site |
| `md-to-html` | Convert Markdown to standalone HTML |
