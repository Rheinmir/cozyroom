# Source: rtk-ai/rtk

**URL:** https://github.com/rtk-ai/rtk  
**Version ingested:** 0.40.0 (2026-05-23)  
**Stars:** 53,135 | **Forks:** 3,240 | **Language:** Rust

## Tóm tắt

RTK (Rust Token Killer) là CLI proxy nguồn mở giảm 60-90% token tiêu thụ khi AI agent chạy shell commands. Hoạt động bằng cách intercept + filter command output trước khi đưa vào model context.

→ Xem [[concepts/RTK]] để biết chi tiết cơ chế và integration.

## Docs chính đã đọc

| File | Nội dung |
|------|----------|
| README.md | Overview, token savings table, quick start, supported tools |
| ARCHITECTURE.md | Module org, filtering taxonomy, hook system, SQLite tracking |
| TECHNICAL.md | End-to-end flow, hook interception, command rewrite |
| CONTRIBUTING.md | 4 design principles, filter implementation, commit convention |
| INSTALL.md | Methods (brew/cargo/script), hook-first setup, checklist |
| TELEMETRY.md | Anonymous, daily, opt-in, GDPR, 12-month retention |
| SECURITY.md | Vuln reporting (security@rtk-ai.app), 90-day embargo |

## Design principles (từ CONTRIBUTING.md)

1. **Correctness** — Không bao giờ làm mất information quan trọng, chỉ filter noise
2. **Transparency** — User luôn có thể xem raw output nếu muốn
3. **Never Block** — Nếu RTK fail, command vẫn chạy bình thường (graceful degradation)
4. **Zero Overhead** — <10ms startup, <5MB memory

## Supported AI agents

Claude Code, GitHub Copilot, Cursor, Gemini CLI, Codex, Windsurf, Cline, OpenCode, Hermes, Antigravity (agy).

## Các lệnh quan trọng cho project này

```bash
rtk git diff              # Filter git diff output
rtk go build ./...        # Filter Go compiler output
rtk go test ./...         # Filter test output
rtk docker compose up     # Filter container startup logs
rtk npx tsc --noEmit      # Filter TypeScript errors
rtk docker logs <name>    # Filter Docker logs

# Analytics:
rtk stats                 # Xem token savings theo session
rtk stats --today         # Savings hôm nay
```

## Quyết định ingestion

RTK được ingest vì:
- Trực tiếp reduce token cost trong `verify-before-commit`, `lint`, `safe-change` skills
- Multi-agent workflow (Claude + OpenCode + agy) đều được hỗ trợ
- Hook system transparent — không cần sửa skill files hiện có
- 80% token reduction trên 30-min session = significant cost saving ở scale

## Origin

- **Source:** https://github.com/rtk-ai/rtk
- **Date ingested:** 2026-05-23
- **Method:** Manual fetch + wiki synthesis (không có file trong raw/)
