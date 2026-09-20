# 01 · Cài lieflat-charts vào agent của bạn

**Why you'd use this:** để agent (Claude Code / Codex / Moxt) đọc được `SKILL.md` + template và biết cách sinh biểu đồ theo bộ quy tắc lieflat.
**What it produces:** một thư mục skill trong `~/.claude/skills/lieflat-charts` (hoặc đường Codex), sẵn sàng gọi bằng `$lieflat-charts`.

> Track: **Consumer** · Loại: **Shell**. Cả trang này là lệnh terminal thật.

## Cách 1 — một lệnh (khuyến nghị)

Cùng cơ chế `npx skills` bạn đang dùng cho `rheinmir/setup`:

```bash
npx skills add https://github.com/larashero3-dotcom/lieflat-charts --skill lieflat-charts
```

- `--skill lieflat-charts` khớp đúng `name:` trong frontmatter `SKILL.md`.
- Với **Codex**, skill nằm ở `~/.codex/skills/lieflat-charts` thay vì đường Claude — trình cài xử lý theo agent target.

## Cách 2 — clone tay (khi muốn kiểm soát/pin commit)

```bash
# Claude Code
git clone https://github.com/larashero3-dotcom/lieflat-charts ~/.claude/skills/lieflat-charts

# Codex
git clone https://github.com/larashero3-dotcom/lieflat-charts ~/.codex/skills/lieflat-charts
```

## Xác minh đã cài đúng

```bash
ls ~/.claude/skills/lieflat-charts/SKILL.md \
   ~/.claude/skills/lieflat-charts/catalog.md \
   ~/.claude/skills/lieflat-charts/templates
```

Kỳ vọng: cả 3 đường tồn tại (`SKILL.md`, `catalog.md`, thư mục `templates/`). Skill sẽ xuất hiện trong danh sách Skill ở **phiên agent kế tiếp** (danh sách skill nạp lúc khởi động phiên).

## Cập nhật về sau

```bash
cd ~/.claude/skills/lieflat-charts && git pull
```

## Lưu ý quan trọng

- **License PolyForm Noncommercial 1.0.0** — học/sửa/chia sẻ/dùng phi thương mại thì OK; dùng thương mại cần giấy phép riêng.
- **Không cần Node/Playwright để dùng.** Node chỉ cần cho track contributor (`03`). Người dùng cuối không chạy script nào cả.
