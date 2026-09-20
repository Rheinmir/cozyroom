---
name: 230526-trending-impact-ui-fe
description: Proposal — Trending page: fix data source + AI industry impact score + impact color tiers + weekly champion
---

# Proposal: Trending — AI Industry Impact Score + Visual Tiers

## Origin
- **Type:** proposal draft
- **Date:** 2026-05-23
- **Request:** Repos ít sao, không rõ tiêu chí, muốn highlight theo impact dựa trên AI đánh giá độ ảnh hưởng với ngành

---

## 1. Restate

3 thay đổi song song:
1. **Fix data source** — mở rộng query từ "mới tạo 7 ngày" → "30 ngày + stars>50"
2. **AI industry impact** — extend AI call thêm 2 field: `impact_score` (1-10) + `impact_label`; AI đánh giá dựa trên các vấn đề **hiện tại của ngành** (AI/LLM race, DevOps complexity, security, observability, DX tooling)
3. **Visual tier UI** — card border/glow theo `impact_score`, weekly champion hero card

---

## 2. Files affected

| File | Thay đổi |
|------|----------|
| `backend/internal/db/db.go` | Additive migration: 2 cột mới `trending_daily` |
| `backend/internal/enricher/aitrends.go` | Extend prompt + parse thêm 2 field + save |
| `backend/internal/api/trending.go` | Expose `impact_score` + `impact_label` trong JSON |
| `frontend/src/api.ts` | Thêm 2 field vào `TrendingRepo` type |
| `frontend/src/pages/TrendingPage.tsx` | Hero card + impact tier logic |
| `frontend/src/index.css` | CSS tier classes + hero card |
| `backend/internal/enricher/github.go` | Sửa 1 dòng query |

---

## 3. Risk / side effects

- Existing rows `trending_daily` không có `impact_score` → NULL → frontend xử lý như tier thấp nhất, không crash
- AI prompt dài hơn ~30 tokens/repo — không ảnh hưởng đáng kể throughput
- `impact_score` do AI tự chọn → có thể bị ảo (inflated). Giảm thiểu bằng cách anchor prompt vào danh sách vấn đề ngành cụ thể
- Không thay đổi DB schema cũ (chỉ ALTER TABLE additive)

---

## 4. Chi tiết implementation

### Step 1 — DB migration (`db.go`)

```go
// Additive — chạy với ignore error như các migration khác
db.Exec(`ALTER TABLE trending_daily ADD COLUMN impact_score INTEGER`)
db.Exec(`ALTER TABLE trending_daily ADD COLUMN impact_label TEXT`)
```

### Step 2 — AI prompt mở rộng (`aitrends.go`)

Thêm 2 dòng output vào prompt. Anchor AI bằng danh sách vấn đề ngành thực tế:

```go
prompt := fmt.Sprintf(
    "Repo: %s\nDescription: %s\nLanguage: %s\nTopics: %s\n\n"+
    "Current industry pain points (2025-2026):\n"+
    "- LLM/AI: context limits, hallucination, agent reliability, RAG quality\n"+
    "- DevOps: IaC complexity, observability gaps, multi-cloud drift\n"+
    "- Security: supply chain attacks, secrets sprawl, SBOM compliance\n"+
    "- DX: build speed, monorepo tooling, type safety across stack\n"+
    "- Data: real-time pipelines, vector DBs, streaming consistency\n\n"+
    "Reply in Vietnamese (fallback English). NEVER use CJK characters.\n"+
    "Reply EXACTLY 5 lines, no other text:\n"+
    "Solved: <vấn đề giải quyết, ≤12 từ>\n"+
    "Technology: <tech stack, ≤10 từ>\n"+
    "Flow: <tóm tắt kiến trúc, ≤10 từ>\n"+
    "Impact: <điểm 1-10 theo mức độ ảnh hưởng ngành hiện tại>\n"+
    "Label: <transformative|significant|incremental|niche>",
    name, desc, language, strings.Join(topics, ", "),
)
```

Parse thêm 2 dòng trong `parseLines()` → return `[5]string` thay vì `[3]string`.

Save:
```go
db.Exec(`UPDATE trending_daily SET problem_solved=?, tech_used=?, simple_flow=?, impact_score=?, impact_label=? WHERE repo_id=? AND date=?`,
    analysis[0], analysis[1], analysis[2], toInt(analysis[3]), analysis[4], t.id, today)
```

### Step 3 — API JSON (`trending.go`)

```go
type trendingRepoJSON struct {
    // ...existing fields...
    ImpactScore int    `json:"impact_score"`
    ImpactLabel string `json:"impact_label"`
}
```

Query thêm 2 cột trong `listTrending()`.

### Step 4 — Frontend type (`api.ts`)

```ts
export type TrendingRepo = {
  // ...existing...
  impact_score: number   // 0 if not yet evaluated
  impact_label: string   // '' | 'transformative' | 'significant' | 'incremental' | 'niche'
}
```

### Step 5 — UI tier + hero (`TrendingPage.tsx`)

```tsx
function impactTier(score: number, label: string): 'transformative' | 'significant' | 'incremental' | 'niche' | '' {
  if (label) return label as any
  if (score >= 8) return 'transformative'
  if (score >= 6) return 'significant'
  if (score >= 4) return 'incremental'
  if (score >= 1) return 'niche'
  return ''   // not yet evaluated — no highlight
}
```

**Hero card** — repo `impact_score` cao nhất (hoặc `star_delta` nếu score chưa có):
```tsx
const champion = [...repos].sort((a, b) => (b.impact_score || 0) - (a.impact_score || 0))[0]
```

Hero card render full-width, hiển thị: badge tier, score số, tất cả AI fields, sparkline lớn.

**Card badge** — góc trên phải mỗi card:
```tsx
{tier === 'transformative' && <span className="tier-badge tier--transformative">🔥 Transformative</span>}
{tier === 'significant'    && <span className="tier-badge tier--significant">⚡ Significant</span>}
{tier === 'incremental'    && <span className="tier-badge tier--incremental">📈 Incremental</span>}
```

### Step 6 — CSS (`index.css`)

```css
/* Impact tier borders */
.trending-card[data-tier="transformative"] { border-color: #f97316; box-shadow: 0 0 16px rgba(249,115,22,.3); }
.trending-card[data-tier="significant"]    { border-color: #eab308; box-shadow: 0 0 10px rgba(234,179, 8,.2); }
.trending-card[data-tier="incremental"]   { border-color: #3b82f6; }

/* Hero card */
.trending-card--hero {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 1fr 220px;
  gap: 24px;
  padding: 24px;
  border-width: 2px;
}
.trending-card--hero .trending-card-name { font-size: 1.25rem; }

/* Tier badge */
.tier-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 99px; }
.tier--transformative { background: rgba(249,115,22,.15); color: #f97316; }
.tier--significant    { background: rgba(234,179, 8,.15); color: #eab308; }
.tier--incremental    { background: rgba(59,130,246,.15); color: #3b82f6; }
```

---

## 5. Success criteria

- [ ] Repos hiển thị có stars ≥ 50 (nhờ query fix)
- [ ] Card hiển thị badge tier đúng với `impact_label` từ AI
- [ ] Repo `impact_score` cao nhất hiện hero card full-width ở trên cùng
- [ ] Card chưa có AI eval (score = 0): không có border màu, không crash
- [ ] TypeScript build: 0 lỗi
- [ ] AI prompt trả đúng 5 dòng, parse không fail

---

## 6. Agent assignment

| Task | Agent | Ghi chú |
|------|-------|---------|
| Steps 1–3 — Go backend | Claude | DB migration + prompt + API |
| Steps 4–6 — FE | Claude | Type + UI + CSS |
