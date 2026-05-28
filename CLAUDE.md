## ⚠️ TUYỆT ĐỐI KHÔNG ĐƯỢC ĐỤNG VÀO DATABASE ⚠️

**PRODUCTION DATABASE: `/mnt/c/Users/olive/orca/workspaces/home-spotify/m/data/metadata.db`**

TRƯỚC KHI `docker compose up --force-recreate` hoặc bất kỳ thao tác nào với container:
1. PHẢI kiểm tra volume mount path của container đang chạy: `docker inspect <container> | grep -A5 Mounts`
2. PHẢI đảm bảo path mount KHÔNG THAY ĐỔI so với container cũ
3. KHÔNG BAO GIỜ đổi `./data` path mà không backup trước
4. KHÔNG BAO GIỜ recreate container mà không xác nhận DB path với user

Vi phạm rule này = mất dữ liệu người dùng không thể khôi phục.

---

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask.

2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

3. Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
## Rules
- FOLLOW the instructions in README.md in llmwiki/wiki folder
- EVERY wiki file must have an `## Origin` section — source is always traceable
- NEVER write to `llmwiki/raw/`
- ALWAYS update `llmwiki/wiki/index.md` when adding or removing a wiki file
- ALWAYS append to `llmwiki/wiki/log.md` after every operation
- Use `[[wikilinks]]` to cross-reference entries in `llmwiki/wiki/`
- Wiki files live in `concepts/`, `entities/`, or `sources/` — never in `llmwiki/wiki/` root
- Wiki entries are only created AFTER code is committed — never during proposal or planning

## Skills

Skills managed globally via `npx skills`. Use `Skill` tool to invoke.

| Skill | Invoke when |
|-------|------------|
| `ingest` | New file in `llmwiki/raw/` |
| `query` | Question requiring wiki synthesis |
| `lint` | After every 10 ingests, or wiki feels stale |
| `propose` | Any new feature or change requested |
| `impact-check` | Before modifying any shared symbol |
| `safe-change` | Editing code called from more than one place |
| `verify-before-commit` | Before every commit |
| `new-project-setup` | Deploy llmwiki vào project mới từ đầu |
| `join-project` | Orient nhanh vào project đã có llmwiki |
| `orca-workflow` | Orchestrating multi-agent tasks |
| `orca-onboard` | Onboarding new agent to Orca |

## Invocation rules
- New file in `llmwiki/raw/` → invoke `ingest` immediately
- New feature request → invoke `propose` first, stop, wait for approval
- Edit to shared code → invoke `impact-check` then `safe-change`
