# Proposal: AI Stats — Cost Calculator + Image OCR Pricing

**Date:** 2026-05-27

## Tính năng 1: Date range filter + Token pricing + Cost estimate

### UI thêm vào section "Request đắt / rẻ nhất"

**Date range:**
- 2 input `date` (from / to), mặc định = last 30 days
- Backend `/api/ai/extremes` nhận thêm `?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Backend `/api/ai/stats` cũng filter theo date range

**Pricing inputs (per model):**
- Mỗi model trong danh sách có 2 field: `$/1M input tokens` và `$/1M output tokens`
- Lưu vào `localStorage` (không cần DB)
- Hiển thị dạng bảng nhỏ, collapsible

**Cost estimate display:**
- Trong mỗi extreme card: `≈ $X.XXXX` tính từ tokens × giá model đó
- Trong summary: tổng chi phí ước tính toàn bộ kỳ (from/to)
- Backend cần trả thêm `tokens_in_total` và `tokens_out_total` per model để tính

### Backend changes
- `/api/ai/extremes?from=&to=&model=` — filter by date range
- `/api/ai/stats?from=&to=` — all queries filter by date range
- Add per-model token aggregation to stats response: `model_tokens: [{model, tokens_in, tokens_out}]`

---

## Tính năng 2: Image OCR → auto-fill model pricing

**Flow:**
1. User click nút 📷 trong pricing table
2. Upload ảnh (screenshot từ OpenRouter / Anthropic pricing page)
3. Frontend gửi ảnh lên `POST /api/ai/ocr-pricing` (base64 encoded)
4. Backend gọi vision model (ưu tiên model free có vision: `google/gemma-3-12b-it:free` hoặc fallback `openai/gpt-4o-mini`)
5. Prompt: "Extract model pricing from this image. Return JSON: [{model, input_per_1m, output_per_1m}]"
6. Frontend nhận kết quả, auto-fill vào pricing table + lưu localStorage

**Backend endpoint:**
```
POST /api/ai/ocr-pricing
Content-Type: application/json
{ "image_b64": "...", "mime": "image/png" }
→ { "prices": [{ "model": "...", "input_per_1m": 0.1, "output_per_1m": 0.3 }] }
```

---

## Implementation plan

### Phase 1 (Frontend only, ~2h)
1. Add date range pickers to stats page, pass to `/api/ai/extremes` and `/api/ai/stats`
2. Add per-model pricing table (collapsible), localStorage persistence
3. Show `≈ $cost` in extreme cards

### Phase 2 (Backend + Frontend, ~1h)
4. Backend: add `from`/`to` query params to `extremes` and `stats` handlers
5. Backend: add `model_tokens` aggregation to stats
6. Show per-model cost breakdown in summary

### Phase 3 (OCR, ~1h)
7. Backend: `POST /api/ai/ocr-pricing` — vision model call
8. Frontend: 📷 button, image upload, auto-fill

## Origin
User feedback via Orca design feedback tool on /ai/stats page, 2026-05-27.
