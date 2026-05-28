---
type: source
tags: [workflow, skill, quality-gate]
---

# Skill: verify-before-commit

## Purpose
Run a mandatory checklist before every `git commit` to catch type errors, lint violations, test failures, and missing documentation before code enters version control.

## When to invoke
- Before every `git commit` or `git push`
- After completing any implementation task
- When asked to "wrap up" or "finish" a feature

## Steps the skill executes
1. **Type check** — run `tsc --noEmit` (frontend) and `go build ./...` (backend). Fix all errors.
2. **Lint** — run the project linter. Fix errors; note warnings.
3. **Tests** — run the full test suite. Fix any failures.
4. **Smoke check** — manually verify the golden path of the feature just built.
5. **Commit** with a message describing *why*, not *what*.
6. **Promote draft** — find the corresponding `wiki/sources/draft/` file, move it to its permanent folder (`concepts/`, `entities/`, or `sources/`), fill in TBD entries, add `## Origin` section.
7. **Update wiki** — update `wiki/index.md` with the promoted file's location, append to `wiki/log.md`.
8. **Rebuild Docker** — run `wsl bash -c "cd /mnt/c/Users/olive/home-spotify && docker compose up -d --build backend"` so the running container reflects the latest commit.

## Rules
- Never skip steps 1–3 even if "nothing changed in types/tests"
- If no type checker or linter is configured, note this and proceed but flag to user
- Passing tests ≠ working feature — step 4 (smoke check) is mandatory

## File location
`skills/verify-before-commit.md`

## Origin
- Created to enforce quality gates after repeated pattern of untested commits
- Docker rebuild step added 2026-05-11 so changes are immediately testable in the running container
