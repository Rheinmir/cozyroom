---
name: 240526-trending-chart-mode-fe
description: Proposal — Trending page: Chart Mode (default) + Grid Mode toggle, 9 charts từ data sẵn có, badge chip filter, Recharts
---

# Proposal: Trending Chart Mode

## 1. Restate

Thêm **Chart Mode** làm view mặc định cho trang Trending; view grid/list hiện tại trở thành **Grid Mode** toggle-able. Chart Mode hiển thị 9 loại biểu đồ phân tích từ dữ liệu đang fetch về — không cần endpoint mới. Gồm badge chip filter theo AI impact tier và drawer hiển thị danh sách repo tương ứng.

---

## 2. Files affected

| File | Action |
|------|--------|
| `frontend/src/pages/TrendingPage.tsx` | Refactor thành host: thêm mode toggle, conditional render Grid vs Chart |
| `frontend/src/pages/TrendingChartMode.tsx` | CREATE — toàn bộ Chart Mode UI |
| `frontend/src/pages/TrendingChartMode.css` | CREATE — layout sidebar, canvas, chips, drawer |
| `frontend/src/api.ts` | No change — `TrendingRepo` + `StarPoint` đủ |
| `frontend/package.json` | ADD `recharts` dependency |
| `backend/` | No change |

---

## 3. Existing behaviour có thể break

- Trang Trending hiện mặc định render grid — sau khi merge, new user sẽ vào Chart Mode. Returning user được bảo vệ qua `localStorage` key (xem UX concern #3).
- Sparkline nhỏ trong hero card hiện dùng inline SVG thủ công — cần giữ nguyên trong Grid Mode; Chart Mode dùng Recharts.

---

## 4. Implementation Plan

### Step 0 — Install Recharts

```bash
cd frontend && npm install recharts
```

### Step 1 — Mode toggle trong TrendingPage

Thêm `mode: "chart" | "grid"` state, persist vào `localStorage("trending-view-mode")`, default = `"chart"`.

```tsx
const [mode, setMode] = useState<"chart"|"grid">(
  () => (localStorage.getItem("trending-view-mode") as "chart"|"grid") ?? "chart"
)
```

Toggle UI: 2 tabs hoặc segmented control ở header, cạnh date picker.

### Step 2 — Badge Chips (impact tier filter)

Đặt ngay dưới toggle, luôn hiển thị ở cả 2 mode.

```tsx
// Tính từ repos[]
const tierCounts = {
  transformative: repos.filter(r => r.impact_label === "transformative").length,
  significant:    repos.filter(r => r.impact_label === "significant").length,
  incremental:    repos.filter(r => r.impact_label === "incremental").length,
  niche:          repos.filter(r => r.impact_label === "niche").length,
}
```

Chip design: `● transformative (12)` — màu map với tier hiện có (orange/yellow/blue/purple).  
Click chip → open **drawer** (desktop: slide-in right panel; mobile: bottom sheet 60vh).  
Multi-select: shift-click thêm tier, AND-filter.  
Chip count = 0 → render muted/disabled, không ẩn.

**Drawer content:**
- Header: "Showing N [tier] repos"
- List: `name` | `language` badge | `+star_delta` | `impact_score /10`
- Mỗi row click → mở `url` new tab
- Button "Add to chart" → thêm repo vào line chart (time series)

**Cross-linking:** khi chip active, các chart dim data points không khớp (opacity 0.2) thay vì ẩn.

### Step 3 — 9 Charts

Tất cả dùng `<ResponsiveContainer width="100%" height={380}>`. Data đến từ `repos: TrendingRepo[]` và `history: Map<id, StarPoint[]>` (fetch `/api/trending/history` per repo lazy).

| # | Chart | Type | Axes / Segments | Insight |
|---|-------|------|-----------------|---------|
| 1 | **Star Delta Bar** | Horizontal bar | X: `star_delta`, Y: `name` (top 15) | Repo "bùng nổ" tuần này |
| 2 | **Star Delta Donut** | Donut | Buckets: <100 / 100-500 / 500-2k / 2k+ | Shape của cohort |
| 3 | **Impact Histogram** | Column | X: score bucket (1-3/4-6/7-8/9-10), Y: count | Chất lượng cohort |
| 4 | **Language Bar** | Horizontal bar | X: repo count, Y: `language`; overlay: avg impact_score dot | Tech landscape |
| 5 | **Stars vs Impact Scatter** ⭐ | Scatter | X: `stars`, Y: `impact_score`, size: `star_delta`, color: `language` | Tương quan popularity & impact |
| 6 | **Star Growth Lines** | Line (time series) | X: `sampled_at`, Y: `stars`; default top 5 by star_delta | Velocity shape |
| 7 | **Star Velocity Slope** | Slope / connected dot | Earliest vs latest `StarPoint` per repo, sorted by delta | Net change, legible khi history thưa |
| 8 | **Topics Treemap** | Treemap | Cell = unique topic, size = count of repos containing it | Themes của cohort |
| 9 | **Impact × Language Heatmap** | Grid heatmap | Row: language, Col: impact_label, Cell: count | Pattern: ngôn ngữ nào trending "chất" |

**Bars in Star Delta Bar:** tô màu theo `impact_label` tier — dùng lại palette của chip.

### Step 4 — Layout

**Desktop (≥1024px):**
```
┌─────────────────────────────────────────────────────────┐
│  [Grid]  [Chart ✓]   [date picker]   [chip chips row]   │
├──────────────┬──────────────────────────────────────────┤
│  Chart nav   │  Primary canvas (chart #5 Scatter hoặc   │
│  • Star Bar  │  chart #1 Bar — configurable default)     │
│  • Scatter   │  height: 380px                            │
│  • Lines     ├──────────────────────────────────────────┤
│  • Donut     │  Secondary row: 2-up (Donut + Language)   │
│  • Topics    │  each 50% width, height: 260px            │
│  • Heatmap   │                                           │
│  • …         │                                           │
└──────────────┴──────────────────────────────────────────┘
```
Sidebar: 160px fixed. Click chart nav item → swap primary canvas.

**Mobile (<768px):** chips horizontal scroll, charts full-width stack, nav = horizontal tab strip, drawer = bottom sheet.

**Tablet (768-1023px):** tab strip (no sidebar), primary full-width, secondary 2-up nếu đủ chỗ.

### Step 5 — UX guardrails (bắt buộc)

1. **Line chart cap** — default top 5 by `star_delta`; multi-select dropdown để add; hard cap 10 lines.
2. **Empty state per chart** — repos không có `StarPoint[]` → "No history available" placeholder trong slope/line charts. Topics treemap < 10 unique topics → "Not enough data".
3. **star_delta footnote** — dưới donut: `"Based on 30-day window ending [date]"`
4. **AI disclosure** — icon ℹ️ cạnh chip row: `"Impact labels are AI-generated estimates."`
5. **Tooltip contract cho scatter:** `name`, `language`, `stars` (12.4k format), `+star_delta`, `impact_score/10`
6. **Color palette:** language dùng community colors (Rust=orange, TS=blue, Python=yellow); impact_score dùng sequential scale xanh→đỏ — không trùng channel.
7. **localStorage persist** — key `"trending-view-mode"`, value `"chart"|"grid"`.

---

## 5. Success Criteria

- [ ] Toggle Chart/Grid hoạt động; localStorage persist mode across refresh
- [ ] 4 badge chips hiển thị count đúng; click mở drawer với đúng repo list
- [ ] Drawer repo row click mở URL; "Add to chart" append repo vào line chart
- [ ] 9 charts render không lỗi trên data thực; empty state đúng khi data thiếu
- [ ] Multi-line chart default 5 repos; không vượt 10; repo selector hoạt động
- [ ] Scatter tooltip đủ 5 fields
- [ ] ℹ️ AI disclosure hiển thị
- [ ] Mobile: chips scroll ngang, charts stack, drawer là bottom sheet
- [ ] Không có endpoint mới; `recharts` là dependency duy nhất thêm vào

---

## 6. AGY Review Additions

_(Integrated above — key additions từ AGY audit)_

| Finding | Applied |
|---------|---------|
| Star Delta Bar > Pie cho comparison | Bar là chart #1, Donut demoted to secondary |
| Scatter là chart giàu thông tin nhất | Đặt là primary canvas default |
| Line chart cần repo selector & cap | Step 5 guardrail #1 |
| star_delta là snapshot delta, không phải rate | Footnote guardrail #3 |
| localStorage persist mode | Guardrail #7 |
| Dim not hide khi filter | Step 2 cross-linking |
| Color palette collision warning | Guardrail #6 |
| AI disclosure | Guardrail #4 |
| Slope chart khi history thưa | Chart #7 added |
| Topics treemap từ `topics[]` flat | Chart #8 added |
| Impact × Language heatmap | Chart #9 added |

## Origin

- Requested: user session 2026-05-24
- AGY review: integrated (agent ID a57f0837d69b6bc4f)
- Status: PENDING APPROVAL
