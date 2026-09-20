---
name: TrendingChartMode
description: Chart Mode for the Trending page — 9 charts from existing data, tier chip filter + drawer, Recharts
---

# TrendingChartMode

Chart Mode là view mặc định của trang Trending; Grid Mode (view cũ) toggle-able qua segmented control.

## Mode Toggle

- State: `'chart' | 'grid'`, default `'chart'` (new users)
- Persisted: `localStorage('trending-view-mode')` — returning users giữ mode cũ
- UI: `[Chart] [Grid]` button group ở header, cạnh date picker

## Tier Chips

4 chip luôn hiển thị (cả 2 mode):
```
● transformative (N)  ⚡ significant (N)  📈 incremental (N)  🔬 niche (N)
```
- Count = 0 → muted/disabled, không ẩn (layout ổn định)
- Click → mở **RepoDrawer** slide-in (desktop) / bottom-sheet 62vh (mobile)
- Drawer: list repo với `name`, `language` (community color), `+star_delta`, `impact_score/10`
- Footer: "ℹ️ Impact labels are AI-generated estimates"

## 9 Charts

Tất cả dùng `<ResponsiveContainer>` từ Recharts. Không cần endpoint mới.

| # | ID | Type | Data nguồn | Insight |
|---|-----|------|------------|---------|
| 1 | `scatter` | ScatterChart | `stars`, `impact_score`, `star_delta`, `language` | Tương quan popularity & impact; size=delta, color=lang |
| 2 | `bar` | BarChart (horizontal) | `star_delta` top 15 | Repo "nổ" tuần này; bar tô màu theo tier |
| 3 | `donut` | PieChart (Nightingale Rose) | `star_delta` buckets (<100/100-500/500-2k/2k+) | Shape của cohort; bán kính đại diện cho số lượng repo |
| 4 | `histogram` | BarChart (column) | `impact_score` buckets (1-3/4-6/7-8/9-10/Pending) | Chất lượng cohort |
| 5 | `lang` | BarChart (horizontal) | `language` count + avg impact | Tech landscape |
| 6 | `lines` | LineChart | `StarPoint[]` history top 5 by delta | Velocity shape; lazy fetch |
| 7 | `slope` | BarChart (horizontal) | earliest vs latest `StarPoint`, net delta | Net change khi history thưa |
| 8 | `topics` | Treemap | `topics[]` frequency flat map | Themes của cohort |
| 9 | `heatmap` | Custom grid | `language` × `impact_label` count | Pattern ngôn ngữ nào trending "chất" |

**Scatter** là primary canvas mặc định (richest chart).

## History Charts (Lines + Slope)

- Lazy fetch: chỉ gọi `/api/trending/history?id=` khi user chọn chart Lines hoặc Slope
- Fetch top 5 repos by `star_delta`; cache trong `Map<id, StarPoint[]>` local state
- Empty state nếu không có history: "No history data available"

## Layout

**Desktop (≥768px):**
```
[chips row]
┌──────────────┬─────────────────────────────┐
│ Chart nav    │ Primary canvas (selectedChart)│
│ (9 buttons)  │ height: 380px                │
│ 156px fixed  │                              │
└──────────────┴─────────────────────────────┘
```

**Mobile (<768px):**
- Nav = horizontal scroll tab strip
- Chips = horizontal scroll row
- Canvas full width, charts stack
- Drawer = bottom sheet 62vh

## Files

| File | Role |
|------|------|
| `frontend/src/pages/TrendingChartMode.tsx` | Chart Mode component (485 lines) |
| `frontend/src/pages/TrendingPage.tsx` | Mode toggle + conditional render |
| `frontend/src/index.css` | `.tc-*` CSS classes |
| `frontend/package.json` | `recharts` dependency |

## Color System

- **Language colors:** community standard (TypeScript=#3178c6, Python=#3572a5, Rust=#ce422b, Go=#00acd7…)
- **Tier colors:** orange/yellow/blue/purple (match badge chips và heatmap)
- Hai systems **không trùng channel** trong scatter — lang = color, impact_score = size

## Related

- [[TrendingInsights]] — backend architecture, AI enrichment, tier scoring
- `frontend/src/api.ts` — `TrendingRepo`, `StarPoint` types (unchanged)

## Origin

- Draft: `llmwiki/wiki/sources/draft/240526-trending-chart-mode-fe.md`
- AGY review: integrated (9 charts, Recharts, scatter as primary, localStorage persist, AI disclosure)
- Nightingale Rose: cải tiến dynamic radius theo số lượng repo & fix crop mobile dùng Legend (commit `9c00e74`)
- Concentric Nightingale & Donut side-by-side: kết hợp Donut (góc = tỷ lệ số repo) và Nightingale Rose (bán kính = stars/delta, không viền) song song, responsive (commit `08e5d08`)
- Stacked Radii: xếp chồng liên tục không khoảng hở giữa 2 lớp (inner = delta, outer = total stars), tăng chiều cao mobile lên 220px và dịch tâm lên cy=42% chống crop (commit `8422b2a`)
- Pie Chart & Bottom Legends: chuyển đổi Donut Chart thành Pie Chart biên liền mạch không viền (`innerRadius={0}`, `paddingAngle={0}`, `stroke="none"`), đưa phần trăm nhãn vào trong lát cắt, hiển thị Legend chân cho cả hai biểu đồ trên desktop và mobile để chống crop hoàn toàn (commit `401f9d7`).
- Ẩn Legend trùng lặp: loại bỏ các dòng ghi chú trùng nhau cho biểu đồ Nightingale Rose bằng cách thiết lập `legendType="none"` cho Pie bên trong (commit `7507166`).
- Giữ song song trên desktop/tablet: hạ ngưỡng breakpoint dọc từ 767px xuống 550px cho thuộc tính `flexDirection` để hai biểu đồ luôn xếp ngang trên cửa sổ thu nhỏ, tránh tình trạng tự động chuyển về xếp dọc sau khi tương tác click (commit `928397b`).
- Hạ ngưỡng dọc tiếp tục xuống 450px: hạ ngưỡng breakpoint dọc cho `flexDirection` xuống `450px` để tránh hiện tượng xếp dọc trên màn hình desktop bị zoom lớn (logical width bị co dưới 550px) (commit `07c28d4`).
- Custom Aim Crosshair: tùy biến con trỏ crosshair của biểu đồ Scatter (Momentum Bubble) thành tâm ngắm (aim crosshair) với khung hình vuông bo ngoài bong bóng dữ liệu (có khoảng đệm an toàn tính theo radius động dựa trên impact score), các đường nét đứt chỉ tâm vẽ từ các cạnh hình vuông đi ra biên đồ thị chứ không cắt trực tiếp vào hình tròn (commit `7bc74fc`).
- Sửa lỗi tham số Custom Cursor: sửa đổi cách trích xuất tọa độ `cx`, `cy` của CustomCrosshairCursor từ thuộc tính `points` thay vì nhận trực tiếp từ tham số gốc của Recharts, khôi phục lại hiển thị của đường crosshair khi hover (commit `bfed5f8`).
- **Root-cause fix Custom Cursor (Recharts v3)**: Recharts v3 `Cursor.js` chia nhánh theo `chartName` — với `ScatterChart`, cursor component nhận `x`, `y` top-level (spread từ `activeCoordinate`), **không phải** `points` array. Fix: dùng `{ x, y, width, height, top, left }` thay vì `{ points, ... }`. Đây là lý do crosshair chưa bao giờ render từ đầu (commit `868410a`).
- Commit: `ddb6759 — feat(trending): Chart Mode with 9 charts`, `9c00e74`, `08e5d08`, `8422b2a`, `401f9d7`, `7507166`, `928397b`, `7bc74fc`, `bfed5f8`, `07c28d4`, `868410a — fix(trending): Use x/y props in CustomCrosshairCursor (Recharts v3 ScatterChart passes x,y not points)`
- Promoted: 2026-05-25

## Recharts v3 Gotchas

### Cursor props differ by chart type

Đọc `node_modules/recharts/es6/component/Cursor.js` trước khi implement custom cursor:

| Chart type | Props truyền cho cursor component |
|------------|----------------------------------|
| `ScatterChart` | `x`, `y` (spread từ `activeCoordinate`), `top`, `left`, `width`, `height` (từ `offset`) |
| `LineChart` / `AreaChart` | `points: [{x, y}, ...]` (từ `getCursorPoints`) |
| `BarChart` | `x`, `y`, `width`, `height` (từ `getCursorRectangle`) |
| Radial | `cx`, `cy`, `startAngle`, `endAngle`, `innerRadius`, `outerRadius` |

**Nguyên tắc**: Không assume `points` luôn có. Log props ra console khi develop để xác nhận.
