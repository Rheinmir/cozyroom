# 03 · Kiểm chứng khi sửa lieflat-charts (contributor)

**Why you'd use this:** bạn thêm/sửa một template biểu đồ và cần chắc nó không phá quy tắc mono, không lỗi cú pháp `<script>`, không trùng `id`, và thực sự vẽ ra nội dung.
**What it produces:** kết quả pass/fail + danh sách vi phạm cụ thể (file:dòng). Không sinh file mới.

> Track: **Contributor** · Loại: **Shell**. Chỉ chạy khi bạn *sửa* repo, không phải khi dùng skill.

Yêu cầu Node ≥ 15 (script dùng `String.replaceAll`, `matchAll`, top-level `await`). Chạy từ trong repo đã clone.

## Bước 1 — kiểm tra tĩnh (bắt buộc, zero-dependency)

```bash
node scripts/validate.mjs
```

Chỉ dùng `node:` builtins — không cài gì thêm. Nó kiểm: đủ file phát hành; mỗi gallery có đủ container `id=` + dải đánh số; các dòng bảng trong `catalog.md`/`report-catalog.md`; quy tắc chủ lực/hậu bị trong `SKILL.md`; `color-presets.js` expose `PRESETS.get()`; mọi khối `<script>` trong HTML parse được; không trùng `id`; **không có `Math.random()`** (bắt buộc dùng `rnd()` tất định); màu trong `templates/color/*` phải thuộc đúng preset; ngoài đó không được lọt màu.

**Exit code (đọc từ source, không đoán):**

| Exit | Nghĩa | Output |
|---|---|---|
| `0` | Pass | `检查通过：<N> 个 HTML 文件，<M> 个文本文件。` |
| `1` | Có vi phạm | `检查失败（<K> 项）：` rồi liệt kê từng dòng |

## ⚠️ BUG: `validate.mjs` báo sai 722 lỗi trên Windows

**Đã kiểm chứng bằng cách chạy thật (không suy đoán):**

- Trên **Windows** (Git Bash / PowerShell, Node 24): `EXIT=1`, `检查失败（722 项）` — 721 lỗi "检测到明显彩色值" trong chính các file `templates/color/*` + 1 lỗi `Math.random()` trong chính `validate.mjs`. **Đều là false-positive.**
- Trên **WSL / Linux / macOS** (cùng repo, cùng Node): `检查通过：52 个 HTML 文件，56 个文本文件。` exit 0.

**Nguyên nhân:** `validate.mjs` so sánh path bằng chuỗi hardcode dấu `/`:

- dòng 273: `relative === 'scripts/validate.mjs'` (để tự loại mình khỏi luật `Math.random`)
- dòng 281: `relative.match(/^templates\/color\/.+-(porcelain|palm|wire)\.html$/)` (để nhận diện file được phép có màu)

Nhưng `path.relative()` trên Windows trả `scripts\validate.mjs` và `templates\color\…` (dấu `\`), nên cả hai không khớp → validator tự tố mình + coi mọi màu cố ý trong `templates/color/` là vi phạm mono.

**Workaround (chạy đúng trên Windows):**

```bash
# Cách A — chạy qua WSL (khuyến nghị trên máy này, đã xác nhận pass)
wsl bash -lc "cd '/mnt/c/đường/tới/lieflat-charts' && node scripts/validate.mjs"
```

Cách B — nếu định gửi PR upstream, sửa 2 dòng để chuẩn hoá separator, ví dụ so sánh trên `relative.split(path.sep).join('/')` thay vì `relative` thô. (Sửa ở bản fork/PR — **không** sửa trong bản clone read-only của khám phá này.)

## Bước 2 — smoke test runtime (khi thêm/sửa loại biểu đồ)

```bash
node scripts/smoke-new-charts.mjs
```

Mở headless-chromium từng gallery qua `file://`, cuộn từng biểu đồ vào viewport (gallery lazy-render bằng IntersectionObserver), rồi kiểm mỗi container có kích thước hợp lý + ≥ 3 phần tử con vẽ ra + console không lỗi. Nhóm Maps bị loại (cần GeoJSON online).

**Điều kiện tiên quyết — Playwright cài GLOBAL** (script resolve qua `npm root -g`, đọc dòng 8–10):

```bash
npm install -g playwright
npx playwright install chromium
```

**Exit code:** `0` = `烟测通过：12 个 gallery 的新增图型均已绘制，无控制台错误。` · `1` = `烟测失败（<K> 项）：` + danh sách.

## Thứ tự đề nghị

1. Sửa template.
2. `node scripts/validate.mjs` (qua WSL nếu ở Windows) → phải exit 0.
3. `node scripts/smoke-new-charts.mjs` → phải exit 0.
4. Chỉ khi cả hai xanh mới mở PR.

> Repo có `.github/` CI riêng gate trên đúng 2 script này — nhưng đây là pipeline nội bộ của tool, không phải "cách bạn tích hợp tool vào CI của mình". Người dùng cuối không cần CI cho việc này.
