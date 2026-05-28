---
name: 230526-llmwiki-setup-join-skills
description: Proposal — 2 skill mới: new-project-setup + join-project (reviewed by agy, APPROVE-WITH-CHANGES)
---

# Proposal: llmwiki Setup & Join Skills

## 1. Restate

Thiếu 2 skill:

| Tình huống | Hiện có | Vấn đề |
|-----------|---------|--------|
| **Dự án mới** | `sync-template` + `onboard-codebase` | Không có checklist tổng hợp |
| **Vào ngang** | `onboard-codebase` (chậm, full analysis) | Không có flow orient nhanh |

## 2. Files affected

| File | Action |
|------|--------|
| `llmwiki/skills/setup/new-project-setup.md` | CREATE |
| `llmwiki/skills/setup/join-project.md` | CREATE |
| `llmwiki/skills/README.md` + `CLAUDE.md` | Update |
| `~/.agents/skills/*/SKILL.md` | Install |

## 3. Risks

- `new-project-setup` gọi `sync-template` như substep — không duplicate (agy review confirmed)
- `join-project` read-only — không ghi wiki; `onboard-codebase` là "deep + ghi"
- RTK phải có WSL guard (agy review fix #3)

## 4. Implementation

### Skill A — `new-project-setup.md`

```
1. CHECK: test -d llmwiki && echo exists || echo missing
   → Nếu exists: hỏi user. Reset = chỉ xóa concepts/ + entities/, GIỮ log.md + sources/.

2. INVOKE: sync-template
   ← pull template files + auto-install skills vào .claude/commands/ và ~/.agents/skills/
   (sync-template step 7 đã xử lý install — không duplicate)

3. Init wiki structure:
   RUN: mkdir -p llmwiki/wiki/{concepts,entities,sources/draft} llmwiki/{skills,raw}
   RUN: touch llmwiki/wiki/index.md llmwiki/wiki/log.md llmwiki/raw/.gitkeep

4. RTK (WSL only):
   CHECK: uname -r | grep -qi microsoft || { echo "RTK: WSL only, skip"; exit 0; }
   CHECK: rtk --version 2>/dev/null || echo not-installed
   → Nếu not-installed:
     RUN: curl -fsSL https://github.com/rtk-ai/rtk/releases/latest/download/rtk-x86_64-unknown-linux-musl.tar.gz | tar xz -C /usr/local/bin
     RUN: rtk init -g
   CHECK: grep -q "rtk hook claude" ~/.claude/settings.json && echo hooked || echo needs-manual-hook

5. Seed wiki:
   READ: README.md, package.json (hoặc go.mod) để lấy project name + stack
   CREATE: llmwiki/wiki/sources/project-requirements.md với frontmatter + ## Origin section
   APPEND: llmwiki/wiki/log.md ← "## YYYY-MM-DD — init — <project-name>"

6. INVOKE: onboard-codebase
   ← phân tích sâu + populate concepts/ + entities/ + lint (onboard-codebase đã bao gồm lint)
```

---

### Skill B — `join-project.md`

```
1. CHECK: test -f llmwiki/wiki/index.md && echo ok || echo "Missing — run new-project-setup"

2. Đọc tổng quan:
   READ: llmwiki/wiki/index.md
   READ: llmwiki/wiki/log.md (20 entries cuối)
   READ: llmwiki/wiki/concepts/Architecture.md (nếu tồn tại)

3. Đọc 3 concepts được reference nhiều nhất:
   RUN: grep -roh '\[\[.*?\]\]' llmwiki/wiki/ | sort | uniq -c | sort -rn | head -5
   → Pick 3 concept files từ danh sách, READ mỗi file.
   (Fallback nếu grep empty: READ 3 files đầu trong concepts/ theo mtime)

4. CHECK skills:
   RUN: ls .claude/commands/ 2>/dev/null || echo "Claude: no skills"
   RUN: ls ~/.agents/skills/ 2>/dev/null || echo "Agents: no skills"
   → Nếu thiếu: INVOKE sync-template (step 7 auto-installs)

5. Synthesize & report:
   → Project là gì, stack chính, 3 điểm quan trọng nhất, open issues trong log
   → Gaps trong wiki → đề nghị chạy onboard-codebase cho phần thiếu
```

> **RTK check đã xóa khỏi join-project** — orient flow không cần setup tools (agy review)

## 5. Success criteria

- [ ] `new-project-setup`: project trống → llmwiki/ đầy đủ, skills installed, RTK hooked (WSL), wiki seeded
- [ ] `join-project`: <2 phút agent biết stack + recent changes + skills state
- [ ] Không duplicate: step 4 new-project-setup delegate hoàn toàn sang `sync-template`
- [ ] Mỗi bước có CHECK/RUN command explicit — không verbose description
- [ ] RTK guard: `uname -r | grep -qi microsoft` trước khi install

## 6. agy Review Summary (APPROVE-WITH-CHANGES)

| Finding | Fix applied |
|---------|------------|
| Step 4 new-project-setup duplicate sync-template install | Xóa, INVOKE sync-template |
| join-project Step 3 "most-linked" không có lệnh | Thêm `grep -roh '\[\[.*?\]\]'` explicit |
| RTK install thiếu WSL guard | Thêm `uname -r \| grep -qi microsoft` |
| join-project Step 5 RTK check không liên quan orient | Xóa hoàn toàn |
| new-project-setup Step 8 lint duplicate | Xóa (onboard-codebase đã lint) |
| reset = không rõ scope | Clarified: giữ log.md + sources/ |
