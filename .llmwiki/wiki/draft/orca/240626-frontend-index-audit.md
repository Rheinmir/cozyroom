# 240626-frontend-index-audit

**Status:** done
**Sequence diagram (hoạt họa):** [html/240626-frontend-index-audit-seq.html](../../../html/240626-frontend-index-audit-seq.html)
**Proposed:** 2026-06-24

## Problem

Audit độc lập `frontend-index` skill vừa tạo (240626-frontend-component-index-skill).
Query phase đã phát hiện 3 bug cụ thể cần xác nhận + fix.

## Findings từ Query

### Bug 1 — Import paths không normalize (MEDIUM)
Script dùng `path.parent / raw` mà không gọi `.resolve()` → path có `..` không được flatten.

**Biểu hiện trong map:**
```
# Thực tế trong map:
- **Local imports:** `frontend/src/pages/../PlayerContext`
# Đúng ra phải là:
- **Local imports:** `frontend/src/PlayerContext.tsx`
```

### Bug 2 — Used-by graph broken cho cross-dir imports (HIGH)
`build_used_by()` so sánh `imp_base` vs `target_base`. Khi import path chứa `..` (không normalize):
- `imp_base` = `frontend/src/pages/../PlayerContext`
- `target_base` = `frontend/src/PlayerContext`
- Không match → tất cả page nào import `../PlayerContext` bị bỏ qua khỏi used-by của PlayerContext

**Hậu quả:** Nếu refactor PlayerContext dựa vào map hiện tại → bỏ sót 8+ pages phụ thuộc.

### Bug 3 — Duplicate imports (LOW)
Một file có 2 import statement từ cùng module (ví dụ: `import { usePlayer }` + `import type { Track }` từ cùng path) → script ghi cả hai vào danh sách → map có duplicate entries.

**Biểu hiện:** `AIAssistantPage`: PlayerContext xuất hiện 2 lần, `SearchPage`: api xuất hiện 2 lần.

### Limitation (acceptable) — Props extraction
Script chỉ extract interface/type có `Props` trong tên. `PlayerCtx`, `SavedState` bị bỏ qua.
Chấp nhận được vì tên convention `*Props` là chuẩn React — không fix.

## Plan

- [ ] Task 1: Verify accuracy bằng cách sample thêm 5 files — xác nhận 3 bugs có tái hiện không
- [ ] Task 2: Fix Bug 2 (HIGH) — normalize paths dùng `.resolve()` trong parse_file
- [ ] Task 3: Fix Bug 1 (MEDIUM) — cosmetic cleanup import paths sau normalize
- [ ] Task 4: Fix Bug 3 (LOW) — deduplicate local_imports
- [ ] Task 5: Regenerate baseline map và verify used-by của PlayerContext có đủ các pages
- [ ] Task 6: Thêm harness self-check — `--verify` mode vào `index-frontend.py` + wire vào pre-commit hook

## Agent Task Assignment (BẮT BUỘC với MỌI proposal — R7 chặn nếu thiếu/ô Agent trống)

| Task | Agent | Model | Status |
|------|-------|-------|--------|
| Task 1: Sample + verify 5 files | Claude main | claude-sonnet-4-6 | done |
| Task 2: Fix Bug 2 — path normalize | Claude main | claude-sonnet-4-6 | done |
| Task 3: Fix Bug 1 — cosmetic cleanup | Claude main | claude-sonnet-4-6 | done |
| Task 4: Fix Bug 3 — dedup imports | Claude main | claude-sonnet-4-6 | done |
| Task 5: Regen map + verify | Claude main | claude-sonnet-4-6 | done |
| Task 6: Harness self-check (`--verify` + pre-commit) | Claude main | claude-sonnet-4-6 | done |

## Files sẽ sửa

| File | Action | Lý do |
|------|--------|-------|
| `harness/scripts/index-frontend.py` | modify | Fix 3 bugs + thêm `--verify` mode |
| `llmwiki/wiki/concepts/frontend-component-map.md` | overwrite | Regenerate với script đã fix |
| `.claude/hooks/pre-commit` hoặc tương đương | modify | Wire `--verify` vào harness gate |

## Thiết kế Task 6 — `--verify` mode

```bash
# Chạy standalone (đọc map đã có, không regen):
python3 harness/scripts/index-frontend.py --verify

# Auto-verify sau mỗi lần generate (default on):
python3 harness/scripts/index-frontend.py  # luôn chạy verify cuối
```

**Checks thực hiện (exit 2 nếu fail):**
1. **No `../` in paths** — detect unnormalized path bug bị regress
2. **No duplicate imports** — detect dedup bị bỏ
3. **Hub files have used-by** — `PlayerContext`, `api.ts`, `types.ts` phải có `used_by ≥ 3`
4. **All files indexed** — count phải ≥ 30 (alert nếu scan thiếu file)
5. **No empty default_export for component files** — mọi file trong `components/` phải có export

**Wire vào harness:** Thêm vào `llmwiki/.claude/hooks/pre-commit` hoặc tạo `harness/scripts/frontend-map-verify.sh` chạy trước commit nếu `frontend-component-map.md` bị sửa.

## Risks

- Fix path normalize có thể làm vỡ các path so sánh khác trong script → cần test trên nhiều patterns
- Không có unit test cho script → verify thủ công bằng cách so sánh map output với grep trực tiếp
- Pre-commit hook chỉ chạy khi map file nằm trong staged changes — nếu script thay đổi mà map chưa regen, hook không trigger

## Origin

- **Draft:** `wiki/draft/orca/240626-frontend-index-audit.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
