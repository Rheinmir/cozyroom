---
type: source
title: Postmortem — Design skills thiếu sau setup, root cause và fix
tags: [postmortem, skills, bootstrap, setup]
---

# Postmortem — Design skills thiếu sau setup

**Ngày phát hiện:** 2026-06-27  
**Triệu chứng:** Skill list không có `design-taste-frontend`, `high-end-visual-design`, `image-to-code`, v.v. dù remote repo có 51 skills.

---

## Root Cause #1 — Bootstrap chạy sai cú pháp (nguyên nhân chính)

Lệnh được chạy thực tế:

```bash
curl -fsSL https://raw.githubusercontent.com/Rheinmir/setup/orca/harness/poc-vendor-neutral/bootstrap.sh | bash check skill xong /resume start lại session
```

Bash nhận phần sau `| bash` là **arguments**, và cố chạy `check` như một lệnh → `bash: check: No such file or directory`. Bootstrap **không chạy lần nào**. Script bị abort trước khi download bất kỳ file nào.

**Lệnh đúng:**

```bash
curl -fsSL https://raw.githubusercontent.com/Rheinmir/setup/orca/harness/poc-vendor-neutral/bootstrap.sh | bash
```

Mọi text phía sau `| bash` phải là shell flags, không phải prose. Nếu muốn pass flags:

```bash
curl -fsSL ... | bash -s -- --full
```

---

## Root Cause #2 — Plugin `caveman@rheinmir-setup-skills` chỉ cover Caveman category

File `~/.claude/settings.json` có:

```json
"enabledPlugins": {
  "caveman@rheinmir-setup-skills": true
}
```

Plugin này chỉ load **Caveman-category** skills (`cavecrew`, `caveman`, `caveman-commit`, v.v.) dưới namespace `caveman:xxx`. Nó **không cài** các skills thuộc category Project/General/Design.

Các skills bị bỏ sót hoàn toàn:

| Category | Skills thiếu |
|----------|-------------|
| Design | `design-taste-frontend`, `design-taste-frontend-v1`, `high-end-visual-design`, `gpt-taste`, `brandkit` |
| Image | `image-to-code`, `imagegen-frontend-mobile`, `imagegen-frontend-web` |
| UI style | `industrial-brutalist-ui`, `minimalist-ui`, `cursor-animated-sites` |
| Redesign | `redesign-existing-projects`, `stitch-design-taste` |
| Ops | `health-check`, `check-approve`, `jenkins-agent-l3-deploy`, `last30days`, `snapshot-push` |

---

## Root Cause #3 — `~/.claude/commands/` là nguồn thứ 3 gây duplicate, không phải nguồn chính

Trước fix, `~/.claude/commands/` chứa 14 file `.md` copy từ harness. Đây là nguồn **thứ 3** ngoài `~/.agents/skills/` và plugin — gây skill list xuất hiện 3 lần mỗi skill. Sau khi xóa, còn 2 nguồn (agents + plugin namespace).

---

## Fix đã áp dụng

```bash
# Cài đủ 51 skills từ repo
npx skills add rheinmir/setup@orca --all -g

# Xóa duplicate từ ~/.claude/commands/
rm ~/.claude/commands/{cavecrew,caveman,...}.md
```

---

## Fix cho máy chính / lần setup tiếp theo

**Bước 1** — Chạy bootstrap đúng cú pháp:

```bash
curl -fsSL https://raw.githubusercontent.com/Rheinmir/setup/orca/harness/poc-vendor-neutral/bootstrap.sh | bash
```

Bootstrap mặc định chạy `--full` (cài cả 3 trụ: harness + skills + llmwiki). Nếu cần chỉ skills:

```bash
curl -fsSL ... | bash -s -- --with-skills
```

**Bước 2** — Verify sau cài:

```bash
npx skills list -g | grep -c "skill"   # phải thấy ~51+
ls ~/.agents/skills/ | grep design     # phải có design-taste-frontend
```

**Bước 3** — Không để file `.md` trong `~/.claude/commands/` nếu đã dùng `npx skills`. Hai hệ thống độc lập, cùng tồn tại = duplicate.

---

## Sơ đồ 3 nguồn skills

```
~/.claude/settings.json
  └─ enabledPlugins.caveman@rheinmir-setup-skills
       └─ Claude Code plugin → load caveman:xxx (Caveman category only)

~/.agents/skills/
  └─ npx skills add rheinmir/setup@orca --all -g
       └─ 51 skills (Caveman + Design + Orca + Project + General)

~/.claude/commands/  ← XÓA, không dùng song song với npx skills
  └─ .md files thủ công → duplicate block 1 với ~./agents/skills/
```

## Origin

Điều tra thực tế 2026-06-27: so sánh `ls ~/.agents/skills/` vs `gh api repos/rheinmir/setup/git/trees/orca`. Fix bằng `npx skills add rheinmir/setup@orca --all -g`.
