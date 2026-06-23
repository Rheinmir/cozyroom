# 240626-frontend-component-index-skill

**Status:** done
**Sequence diagram (hoạt họa):** [html/240626-frontend-component-index-skill-seq.html](../../../html/240626-frontend-component-index-skill-seq.html)
**Proposed:** 2026-06-24

## Problem

Mỗi lần refactor frontend (rename prop, move component, đổi API), agent/dev phải tự nhớ xem component nào dùng cái đó — dễ bỏ sót dẫn đến build lỗi hoặc UI broken. Không có map "ai dùng ai" thì refactor luôn là rủi ro.

## Plan

- [ ] Task 1: Viết script `harness/scripts/index-frontend.py` — quét toàn bộ `frontend/src/**/*.tsx|ts`, extract metadata (exports, local imports, props interface) → ghi ra `llmwiki/wiki/concepts/frontend-component-map.md`
- [ ] Task 2: Viết `skills/frontend-index/SKILL.md` — skill chuẩn hoá quy trình: trước mỗi refactor chạy script → đọc map → biết chính xác những file nào bị ảnh hưởng
- [ ] Task 3: Chạy script lần đầu → tạo `frontend-component-map.md` baseline với 37 files hiện tại
- [ ] Task 4: Đăng ký skill trong bảng CLAUDE.md + README llmwiki

## Agent Task Assignment (BẮT BUỘC với MỌI proposal — R7 chặn nếu thiếu/ô Agent trống)

| Task | Agent | Model | Status |
|------|-------|-------|--------|
| Task 1: Viết index-frontend.py | Claude main | claude-sonnet-4-6 | done |
| Task 2: Viết SKILL.md frontend-index | Claude main | claude-sonnet-4-6 | done |
| Task 3: Chạy script → tạo baseline map | Claude main | claude-sonnet-4-6 | done |
| Task 4: Đăng ký skill CLAUDE.md + README | Claude main | claude-sonnet-4-6 | done |

## Files sẽ tạo/sửa

| File | Action | Lý do |
|------|--------|-------|
| `harness/scripts/index-frontend.py` | create | Script Python quét + extract metadata |
| `llmwiki/wiki/concepts/frontend-component-map.md` | create | Map toàn bộ 37 components + relationships |
| `skills/frontend-index/SKILL.md` | create | Skill definition — trigger + steps |
| `CLAUDE.md` | modify | Thêm row `frontend-index` vào bảng Skills |
| `llmwiki/wiki/README.md` | modify | Ghi chú về skill mới |

## Thiết kế script `index-frontend.py`

```python
# Output format cho mỗi file:
## ComponentName  (frontend/src/components/Header.tsx)
- **Exports:** default Header, HeaderProps
- **Local imports:** from ./Sidebar, from ../PlayerContext
- **Used by:** (files that import this component)
- **Props:** title: string, onSearch: () => void
```

Map này cho phép:
1. "Tôi sắp đổi `PlayerContext` → tìm ngay 12 files phụ thuộc"
2. "Tôi đổi prop `title` của `Header` → biết ngay 3 pages dùng nó"
3. "Tôi xoá `FavoritePill` → xem ai import nó"

## Trigger cho skill `frontend-index`

Skill sẽ được invoke khi:
- User nói "refactor", "rename", "move component", "đổi props", "đổi API"
- Trước bất kỳ thay đổi nào ở `frontend/src/`

## Risks

- Script cần parse TS/TSX — dùng regex đơn giản (không cần full AST parser) đủ cho use-case này
- Map sẽ stale nếu không chạy lại sau mỗi commit thêm component mới → skill nhắc chạy lại khi file mới xuất hiện

## Origin

- **Draft:** `wiki/draft/orca/240626-frontend-component-index-skill.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
