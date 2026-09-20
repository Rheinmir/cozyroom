# Trending Insights — AI Industry Impact Dashboard

GitHub Trending tab với AI-evaluated impact score theo mức độ ảnh hưởng thực tế tới ngành.

## Kiến trúc

```
GitHub Search API (30d, stars>50, sort:stars)
  → SaveTrendingSnapshot (3 tables: repos, daily, star_history)
  → EnrichWithAI (5-field prompt, slot failover)
  → GET /api/trending?date= (ordered by impact_score DESC)
  → TrendingPage (hero card + tier badges + sparklines)
```

## Dữ liệu

**Schema:**
```sql
trending_repos      (id, name, url, description, language, topics)
trending_daily      (repo_id, date, stars, star_delta,
                     problem_solved, tech_used, simple_flow,
                     impact_score INTEGER, impact_label TEXT)
trending_star_history (repo_id, sampled_at, stars)
```

**GitHub query:** `created:>YYYY-MM-DD stars:>50 sort:stars order:desc per_page:30` — cửa sổ 30 ngày.

## AI Enrichment — 5-field prompt

Prompt anchor với danh sách vấn đề ngành thực tế (2025-2026):
- LLM/AI, DevOps, Security, DX, Data

Output format (EXACTLY 5 dòng):
```
Solved: <vấn đề, ≤12 từ>
Technology: <tech, ≤10 từ>
Flow: <kiến trúc, ≤10 từ>
Impact: <số 1-10>
Label: <transformative|significant|incremental|niche>
```

Slot failover: Gemini 2.5-flash → Gemini 2.0-flash-lite → Gemini 1.5-flash → OpenRouter models. Rate limit → advance slot.

## UI Tiers

| Tier | Score | Badge | Border |
|------|-------|-------|--------|
| transformative | 8-10 | 🔥 | orange glow |
| significant | 6-7 | ⚡ | yellow glow |
| incremental | 4-5 | 📈 | blue border |
| niche | 1-3 | 🔬 | purple border |
| (pending) | 0 | — | none |

**Hero card** — repo `impact_score` cao nhất hiển thị full-width ở đầu grid, sparkline lớn (140×40).

CSS dùng `data-tier` attribute thay vì class để tránh proliferation:
```css
.trending-card[data-tier="transformative"] { border-color: #f97316; box-shadow: ...; }
```

## CJK Filter

AI response được reject nếu chứa ký tự CJK (Chinese/Japanese/Korean, codepoint 0x4E00-0x9FFF). Retry với slot tiếp theo. Giảm thiểu DeepSeek/Gemini trả lời bằng tiếng Trung khi không đọc được prompt.

## Origin

- **Draft:** `llmwiki/wiki/sources/draft/230526-trending-impact-ui-fe.md`
- **Commit:** `d5c4927 — feat(trending): AI industry-impact scoring + hero card + tier badges`
- **Date promoted:** 2026-05-23
