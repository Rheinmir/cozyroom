---
type: source
tags: [workflow, skill, planning]
---

# Skill: propose

## Purpose
Gate any new feature or change behind an explicit planning step before code is written. Forces scope clarification, surface impact, and alignment before implementation begins.

## When to invoke
- Any new feature, endpoint, component, or behavior is requested
- A change touches shared or core code
- The scope is unclear or could be interpreted multiple ways

## Steps the skill executes
1. **Restate** the request in one sentence to confirm understanding
2. **Impact list** — every existing file, function, or module that will change
3. **Breakage list** — existing features that could break as a side effect
4. **Implementation plan** — minimal numbered steps
5. **Success criteria** — verifiable conditions
6. **Create draft** in `wiki/sources/draft/DDMMYY-feature-name-module.md`, update `wiki/index.md` and `wiki/log.md`
7. **STOP** — never write code during this skill; wait for explicit approval

## Rules
- Never begin implementation during this skill
- If multiple approaches exist, present tradeoffs — do not pick silently
- If impact list is empty, state "No existing code affected" explicitly

## File location
`skills/propose.md`

## Origin
- Created as part of project workflow scaffolding
- Modelled on team code-review gate practice: plan first, commit second
