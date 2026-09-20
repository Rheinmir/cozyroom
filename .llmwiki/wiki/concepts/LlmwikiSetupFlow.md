---
name: LlmwikiSetupFlow
description: Two-skill setup flow for llmwiki — new-project-setup (fresh deploy) and join-project (quick orient)
---

# LlmwikiSetupFlow

Two skills covering the two entry points into an llmwiki-powered project.

## Skills

| Skill | File | When |
|-------|------|------|
| `new-project-setup` | `llmwiki/skills/setup/new-project-setup.md` | Project has no `llmwiki/` yet — or needs a full reset |
| `join-project` | `llmwiki/skills/setup/join-project.md` | Joining mid-project that already has `llmwiki/` |

## new-project-setup — Fresh Deploy

Sequence for a blank project:

1. **CHECK** `test -d llmwiki` → if exists, ask user; reset = keep `log.md` + `sources/`, delete `concepts/` + `entities/`
2. **INVOKE** `sync-template` — pulls template + installs skills into `.claude/commands/` and `~/.agents/skills/`
3. **MKDIR** `llmwiki/wiki/{concepts,entities,sources/draft}` `llmwiki/{skills,raw}` + touch `index.md`, `log.md`, `raw/.gitkeep`
4. **RTK (WSL only)** — guard: `uname -r | grep -qi microsoft`; install binary + `rtk init -g` + verify hook in `~/.claude/settings.json`
5. **SEED** — read `README.md`/`go.mod`/`package.json` → create `sources/project-requirements.md` + first `log.md` entry
6. **INVOKE** `onboard-codebase` — deep analysis → `concepts/` + `entities/` (includes lint; no extra lint step)

## join-project — Quick Orient

Read-only, target: agent oriented in <2 min:

1. **CHECK** `test -f llmwiki/wiki/index.md` → missing = redirect to `new-project-setup`
2. **READ** `index.md` + `log.md` (20 entries) + `concepts/Architecture.md`
3. **RANK** most-linked concepts: `grep -roh '\[\[.*?\]\]' llmwiki/wiki/ | sort | uniq -c | sort -rn | head -5` → read top 3
4. **CHECK** `.claude/commands/` + `~/.agents/skills/` → missing = INVOKE `sync-template`
5. **REPORT** — project stack, 3 key technical points, recent changes, skills state, wiki gaps

## Design Decisions

- `join-project` is **read-only** — no wiki writes; `onboard-codebase` is the deep + write variant
- RTK step has WSL guard (`uname -r | grep -qi microsoft`) — never runs on Windows native shell
- `new-project-setup` delegates to `sync-template` for skill install — no duplicate install logic
- `onboard-codebase` already includes lint — `new-project-setup` does not call lint separately
- `join-project` has no RTK check — orient flow does not need tooling setup

## Related

- [[RTK]] — token proxy; `new-project-setup` step 4 installs it in WSL
- [[Architecture]] — first concept to read in `join-project` step 2
- `llmwiki/skills/setup/sync-template.md` — called by `new-project-setup` step 2
- `llmwiki/skills/setup/onboard-codebase.md` — called by `new-project-setup` step 6

## Origin

- Proposed: `llmwiki/wiki/sources/draft/230526-llmwiki-setup-join-skills.md`
- Reviewed by: agy (APPROVE-WITH-CHANGES — 6 fixes applied)
- Implemented: commit `bec038b — feat(skills): add new-project-setup + join-project setup skills`
- Promoted: 2026-05-24
