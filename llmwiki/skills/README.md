# skills/

Multi-step reusable workflows the agent invokes autonomously based on context.

Skills are managed globally via `npx skills` (installed to `~/.claude/skills/`).
Local skill files removed — use `npx skills list -g` to see what's installed.

## Quick reference

| Skill | Purpose |
|-------|---------|
| `ingest` | Process a new `raw/` file into wiki pages |
| `query` | Synthesize an answer from the wiki; persist new insights |
| `lint` | Health-check the wiki for orphans, contradictions, stale content |
| `propose` | Plan a feature before coding; create a draft in `wiki/sources/draft/` |
| `impact-check` | Map all dependents of a symbol before modifying it |
| `safe-change` | Modify shared code without breaking existing callers |
| `verify-before-commit` | Gate every commit; typecheck, lint, then promote draft to wiki |
| `new-project-setup` | Deploy llmwiki từ đầu: template pull, skill install, RTK, wiki seed, onboard |
| `join-project` | Orient nhanh vào dự án đang chạy đã có llmwiki — read-only |
| `onboard-codebase` | Deep analysis codebase → populate wiki/concepts/ + wiki/entities/ |
| `orca-workflow` | Orchestrate multi-agent tasks via Orca |
| `orca-onboard` | Onboard a new agent CLI to the Orca pool |
| `sync-template` | Upstreaming/downstreaming template improvements |
| `extract-site` | Extract documentation from a live site |
| `docs-site-macos` | Build macOS-style documentation site |
| `md-to-html` | Convert Markdown to standalone HTML |
