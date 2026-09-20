# lieflat-charts — workflows

`lieflat-charts` không phải CLI có `package.json`. Nó là một **Agent Skill** (chuẩn `SKILL.md`, giống các skill trong `~/.claude/skills/`) do [moxt.ai](https://moxt.ai) / tác giả "躺在废墟里" làm, phát hành dưới **PolyForm Noncommercial License 1.0.0** (⚠️ dùng thương mại phải xin phép riêng).

Nó là bộ **sinh biểu đồ + báo cáo HTML một-file, template-driven**: agent đọc `SKILL.md` + `catalog.md`, chọn một template thật trong `templates/*.html`, thay dữ liệu, xuất ra 1 file HTML mở-bằng-double-click. 63 loại biểu đồ (Glance 20 · Lupi 19 · Basics F1–F17 · Maps 2 · Interactive 3) + 12 template báo cáo nguyên trang song ngữ (R01–R12, mỗi bộ có `.zh.html` và `.en.html`).

Pin: commit `eace082a317b696c5570c25826a53a7fa113e984`.

## Index

| File | Mục đích | Track | Loại lệnh |
|---|---|---|---|
| `01-install.md` | Cài skill vào agent của bạn (Claude Code / Codex / Moxt) + cập nhật | Consumer | Shell |
| `02-generate-charts-and-reports.md` | Ra lệnh cho agent sinh biểu đồ / báo cáo và xem kết quả | Consumer | Chat-only |
| `03-contributor-verify.md` | Sửa template rồi kiểm chứng bằng `validate.mjs` + `smoke-new-charts.mjs` | Contributor | Shell |

## Suggested run order

- **Chỉ muốn dùng công cụ:** `01` (cài một lần) → `02` (dùng mỗi lần cần biểu đồ). Không đụng tới `03`.
- **Muốn sửa/thêm template biểu đồ:** clone repo → sửa → `03` để verify trước khi mở PR. `01`/`02` không bắt buộc.

## Tại sao consumer và contributor tách riêng

`scripts/validate.mjs` và `scripts/smoke-new-charts.mjs` là công cụ kiểm thử **của chính repo** — chúng chỉ có nghĩa khi bạn *sửa* skill. Người dùng cuối không bao giờ chạy chúng: họ chỉ cài skill (`01`) rồi nói chuyện với agent (`02`). Gộp hai track sẽ khiến người dùng tưởng phải cài Playwright global chỉ để vẽ một biểu đồ — hoàn toàn không cần.

Lệnh chat (`$lieflat-charts …`) và lệnh shell (`npx …`, `node …`) cũng tách file: dán một lệnh chat vào terminal (hoặc ngược lại) sẽ lỗi.

## How this was verified — không paraphrase README

| Khẳng định trong bundle | Chứng cứ từ source (không phải README) |
|---|---|
| Không có manifest npm; entry là `SKILL.md` | `find` toàn repo: 0 `package.json`/`pyproject.toml`. `SKILL.md` frontmatter `name: lieflat-charts` |
| Lệnh cài `npx skills add …` | `README.md:181`; `--skill lieflat-charts` khớp `name:` trong frontmatter `SKILL.md` |
| `validate.mjs` zero-dep, exit 0 pass / 1 fail | Đọc `scripts/validate.mjs`: chỉ import `node:fs/path/vm/url`; `process.exit(1)` dòng 318, thành công in `检查通过：…` |
| **`validate.mjs` fail 722 lỗi giả trên Windows** | **Chạy thật:** Windows → `EXIT=1`, 721 "彩色值" + 1 `Math.random`. WSL Linux → `检查通过：52 … 56 …` exit 0. Bug: dòng 273 & 281 so path bằng `/` hardcode trong khi `path.relative()` trả `\` trên Windows |
| `smoke-new-charts.mjs` cần Playwright global | Đọc `scripts/smoke-new-charts.mjs:8-10`: resolve `npm root -g` rồi `import(playwright)`; `process.exit(1)` khi fail |
| Glance/Circular/Force/R11/R12 cần mạng | `THIRD_PARTY_NOTICES.md` + grep templates thấy `cdn.jsdelivr.net/npm/{chart.js,echarts}`, `fonts.googleapis.com`. Lupi/Basics là SVG thuần → offline OK |
| Đường cài Claude vs Codex | `README.md:188,192` (`~/.claude/skills/…` vs `~/.codex/skills/…`) |

Bản clone dùng để khám phá nằm trong sandbox scratchpad và **không bị sửa** (exploration read-only). Bundle này là file mới duy nhất được tạo.
