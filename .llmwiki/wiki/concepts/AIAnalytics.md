# AI Analytics
**Type:** concept
**Tags:** ai, analytics, recharts, stats, cost, mcp

Dedicated analytics page (`/ai/stats`) for AI chat usage — Recharts dashboard + paginated logs + dislike labeling + cost estimation. Backend: aggregated SQL + per-model daily breakdown + model price persistence.

## Charts tab

- **Summary cards**: total requests, success rate, tokens in/out (total), avg response time, failed count, avg in/req, avg out/req
- **Extreme requests panel**: most expensive + cheapest request by token count; shows prompt snippet, model badge, cost estimate (≈$X.XXXX in yellow); date range filter (from/to); model filter pills (all models, no LIMIT 10)
- **Token + cost ComposedChart**: stacked bars per model per day (total tokens) + line (estimated cost $) on dual Y-axis. Computed from `GET /api/ai/stats/daily?from=&to=` → `[{date, model, tokens_in, tokens_out}]`
- **Price rate chart**: horizontal grouped bars (cyan = input $/1M, amber = output $/1M) sorted descending — shows all models with prices set, no token multiplication
- **Daily messages bar** (30-day stacked success/failed)
- **Token usage line** (tokens_in/out per day)
- **Hourly activity bar**, **Response time line**, **Model donut**, **Action distribution bar**, **Failure reason bar**

## Pricing / Cost Estimation

- Collapsible "💰 Giá token" panel inside extremes section
- Per-model input/output price ($/1M tokens) — stored in `ai_model_prices` table (SQLite), synced to DB with 1s debounce; localStorage used as fast initial cache
- OCR flow: click 📷 → select image → panel shows thumbnail + editable prompt → user hits "Gửi" → `POST /api/ai/ocr-pricing` → vision model (`google/gemini-2.0-flash-001`) extracts prices → fuzzy-match model names against `all_models` list → auto-fill table
- `calcCost(log)` → `(tokens_in × price_in + tokens_out × price_out) / 1M`, shows `≈$X.XXXX` or `<$0.0001`

## Logs tab

- Paginated (50/page), failed-only toggle, model label, token counts
- Border-left: red (failed), green (success)
- **👎 dislike button** on every log row — `POST /api/ai/logs/{id}/dislike` sets `failed=1, fail_reason='user_dislike'`; optimistic UI update in-place. Enables retroactive labeling of bad responses.
- Tool errors displayed inline (parsed JSON)

## Backend endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/ai/stats` | Aggregate stats — `models` (top 10 for charts), `all_models` (no limit, for pricing/pills) |
| `GET /api/ai/stats/daily?from=&to=` | Per-model daily token breakdown for charts |
| `GET /api/ai/logs?limit=&offset=&failed=` | Paginated log entries |
| `POST /api/ai/logs/{id}/dislike` | Label response as bad |
| `GET /api/ai/extremes?model=&from=&to=` | Most expensive + cheapest (dynamic WHERE) |
| `GET /api/ai/model-prices` | Load saved prices from DB |
| `PUT /api/ai/model-prices` | Upsert prices (bulk) |
| `POST /api/ai/ocr-pricing` | Vision OCR → `[{model, input_per_1m, output_per_1m}]` |

## MCP analytics tools

Three tools added to MCP registry so AI agent can self-inspect usage:

- **`get_ai_analytics`** — summary (total, failed, tokens, avg_ms, top models); optional `from`/`to`
- **`get_ai_logs`** — recent logs; optional `model`, `failed_only`, `limit` (max 50)
- **`get_ai_extremes`** — most expensive + cheapest; optional `model`/`from`/`to`

## Data model

```sql
chat_logs(id, created_at, model, provider, user_msg, ai_msg, actions, failed, fail_reason, tokens_in, tokens_out, tool_errors, response_ms, session_id)
ai_model_prices(model PK, price_in, price_out, updated_at)
```

`all_models` field in stats response: `GROUP BY model ORDER BY count DESC` — no LIMIT. Used for pricing table, filter pills, color index, fuzzy match. `models` (top 10) used only for donut pie chart.

## Origin

- **Source:** `frontend/src/pages/AIStatsPage.tsx`, `backend/internal/api/ai.go`, `backend/internal/mcp/registry.go`, `backend/internal/db/db.go`
- **Commits:** working tree on `Rheinmir/m` branch — features added 2026-05-27 → 2026-05-28
- **Date:** 2026-05-28
