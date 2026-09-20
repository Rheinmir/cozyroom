# RTK — Rust Token Killer

CLI proxy giảm 60-90% token tiêu thụ khi AI agents chạy shell commands. Intercept output của 100+ lệnh trước khi đưa vào context window của model.

## Cơ chế hoạt động

RTK không thay command — nó **rewrite** command để output được filter ngay tại nguồn:

```
AI agent muốn chạy: git diff --stat
RTK rewrite thành: rtk git diff --stat
Output gốc (2,000 tokens) → RTK filter → Output (400 tokens) → vào context
```

**4 chiến lược filter:**

| Chiến lược | Mô tả |
|-----------|-------|
| **Smart Filtering** | Xoá lines ít giá trị (verbose logs, progress bars, timestamps) |
| **Grouping** | Gộp output lặp lại (e.g. 500 identical warnings → "500× WarningX") |
| **Truncation** | Cắt bớt output dài, giữ đầu + cuối (tránh mất context quan trọng) |
| **Deduplication** | Loại bỏ duplicate lines/blocks hoàn toàn |

## Hook system — auto-rewrite

RTK cài hook vào agent shell. Mọi command agent chạy đều tự động qua RTK mà không cần thay đổi gì:

```bash
rtk hooks install --agent claude   # Claude Code
rtk hooks install --agent opencode # OpenCode
rtk hooks install --agent agy      # Antigravity
```

Sau khi cài hook: agent chạy `git diff` → hook tự chuyển thành `rtk git diff` transparently.

## Ecosystems được hỗ trợ (relevant với project này)

| Ecosystem | Commands |
|-----------|----------|
| **Go** | `go build`, `go test`, `go vet`, `golangci-lint` |
| **TypeScript/JS** | `tsc`, `eslint`, `npm`, `pnpm`, `jest`, `vitest`, `playwright` |
| **Docker** | `docker build`, `docker compose`, `docker logs` |
| **Git** | `git diff`, `git log`, `git status`, `gh`, `glab` |
| **System** | `ls`, `tree`, `find`, `grep`, `cat`, `env`, `curl` |
| **Rust** | `cargo build`, `cargo test`, `cargo clippy` |

## Token savings thực tế

| Session type | Before | After | Reduction |
|-------------|--------|-------|-----------|
| 30-min coding | 118,000 | 23,900 | **80%** |
| Typical command | varies | varies | 60-90% |
| Startup overhead | — | <10ms | — |
| Memory | — | <5MB | — |

## Integration với multi-agent workflow của chúng ta

RTK đặc biệt hữu ích khi:
- Antigravity (agy) chạy `go build ./...` → filter compiler output verbose
- OpenCode chạy `docker compose up` → filter container startup logs
- Claude Code chạy `npx tsc --noEmit` → filter TypeScript output
- Bất kỳ agent nào chạy `git diff` trước commit → filter whitespace noise

**Skills cần update** sau khi cài RTK: `verify-before-commit.md` và `lint.md` sẽ tự hưởng lợi từ hook mà không cần thay step nào.

## Cài đặt

```bash
# Windows (recommended via WSL):
curl -sSf https://rtk-ai.app/install.sh | sh

# Cargo:
cargo install rtk

# Sau khi cài, init cho project:
rtk init

# Cài hook cho từng agent:
rtk hooks install --agent claude
rtk hooks install --agent opencode
```

**CHECK:**
```bash
rtk --version
rtk hooks list
```

## Kiến trúc kỹ thuật

- **Language**: Rust 100% — single binary, no runtime deps
- **Storage**: SQLite (token tracking analytics)
- **Config**: TOML files per project (`rtk.toml`)
- **Filters**: TOML-defined + Rust module fallback
- **License**: Apache 2.0

## Origin

- **Source:** https://github.com/rtk-ai/rtk (v0.40.0, 53,135 stars)
- **Ingested:** 2026-05-23
- **Relevance:** Token efficiency trong multi-agent workflow (Claude Code + OpenCode + Antigravity)
