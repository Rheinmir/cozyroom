# 220626-trending-ai-dedup-lock

**Type:** draft
**Status:** proposed
**Tags:** bug-fix, trending, ai-enrich, distributed-lock
**Proposed:** 2026-06-22
**Sequence diagram:** [html/220626-trending-ai-dedup-lock-seq.html](../../../html/220626-trending-ai-dedup-lock-seq.html)

---

## Chẩn đoán

Có 3 vấn đề xảy ra cùng lúc khiến nhiều worker `EnrichWithAI` bị pending và key bị cạn quota:

**Vấn đề 1 — 3 k8s pod cùng chạy cron song song**
Hàm trong `main.go` (line 207-231) spawn goroutine ngay khi startup, gọi thẳng `enricher.EnrichWithAI()` — KHÔNG qua `TrendingHandlers.running` (atomic.Bool chỉ bảo vệ HTTP endpoint). Với 3 pod, 3 goroutine fire đồng thời, dùng chung key Gemini → cạn quota 3x nhanh hơn.

**Vấn đề 2 — Không có early-exit "hôm nay đã chạy rồi"**
Code chỉ query `WHERE d.problem_solved IS NULL` — nếu 3 pod cùng query trước khi bất kỳ pod nào xử lý xong, cả 3 đều thấy N repos cần enrich → cả 3 đều chạy. Không có guard nào block.

**Vấn đề 3 — Slot rotation không phân biệt daily-quota vs rate-limit**
Khi key bị daily quota (429 + "quota exceeded"), code chỉ `slotIdx++` rồi thử slot tiếp — nhưng nếu 3 pod đang cùng chạy, chúng dùng state `slotIdx` riêng biệt, không chia sẻ thông tin "key này đã cạn". Hệ quả: tất cả pod đều thử key đã cạn.

---

## Plan

- [ ] Task 1: Thêm PostgreSQL advisory lock vào đầu `EnrichWithAI` — chỉ 1 instance chạy tại một thời điểm (cross-pod)
- [ ] Task 2: Thêm early-exit guard — nếu `COUNT(*) WHERE date=today AND problem_solved IS NULL = 0` thì return ngay

Không làm Task 3 (key exhaustion tracking) — nếu Task 1 fix được concurrent run thì không cần thiết.

---

## Agent Task Assignment

| Task | Agent | Model | Status |
|------|-------|-------|--------|
| Task 1: PG advisory lock trong `EnrichWithAI` | Claude main | claude-sonnet-4-6 | pending |
| Task 2: Early-exit "today already done" guard | Claude main | claude-sonnet-4-6 | pending |

---

## Files sẽ sửa

| File | Action | Lý do |
|------|--------|-------|
| `backend/internal/enricher/aitrends.go` | modified | Thêm advisory lock + early-exit — 2 vị trí, ~15 dòng thêm |

Không thêm bảng, không đổi schema, không sửa file khác.

---

## Risks

- Advisory lock dùng `pg_try_advisory_lock(hashtext(...))` — hashtext collision cực thấp nhưng có thể dùng số cố định (ví dụ `12345678`) để tránh hoàn toàn.
- Nếu pod crash giữa chừng, advisory lock tự release khi session PostgreSQL đóng — không bị deadlock.
- Early-exit chạy trước lock → nếu pod A xong, pod B khởi động sau sẽ thấy 0 repos và skip — đúng behavior mong muốn.

---

## Origin

- **Draft:** `wiki/draft/orca/220626-trending-ai-dedup-lock.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
