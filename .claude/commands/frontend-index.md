---
name: frontend-index
description: Quét toàn bộ frontend/src/**/*.tsx|ts, tạo map exports/imports/props/used-by. Chạy trước mọi refactor để biết chính xác file nào bị ảnh hưởng. Trigger khi user nói "refactor", "rename component", "move component", "đổi props", "đổi API", hoặc gọi /frontend-index.
---

# Skill: frontend-index

## Purpose

Trước khi refactor bất kỳ thứ gì trong `frontend/src/`, chạy skill này để có bản đồ đầy đủ:
- **Exports** của từng file (default + named)
- **Local imports** (ai import ai)
- **Props interface** (fields của từng component)
- **Used-by graph** (file nào đang dùng file này)

Map này cho phép trả lời ngay:
- "Tôi đổi prop `title` của `Header` → 3 pages dùng nó, cần sửa cả 3"
- "Tôi xoá `FavoritePill` → 2 files import nó, cần clean import"
- "Tôi rename `PlayerContext` → 12 files phụ thuộc"

## When to use

- **BẮT BUỘC** trước mọi refactor, rename, move component, đổi props/API trong `frontend/src/`
- Khi user hỏi "component X được dùng ở đâu?"
- Khi user hỏi "file nào import Y?"
- Định kỳ sau mỗi 10+ commit có thêm component mới

## Steps

### 1. Chạy script để tạo/cập nhật map

```bash
python3 harness/scripts/index-frontend.py --root .
```

Output: `llmwiki/wiki/concepts/frontend-component-map.md`

### 2. Đọc map trước khi refactor

```bash
# Tìm nhanh component cần refactor
grep -A8 "### \`frontend/src/components/Header" llmwiki/wiki/concepts/frontend-component-map.md
```

Hoặc đọc toàn bộ map và xác định:
1. **Used-by** của file sẽ thay đổi → danh sách file cần cập nhật
2. **Props** của component → danh sách callers cần cập nhật interface
3. **Local imports** của file → dependencies sẽ bị ảnh hưởng

### 3. Tiến hành refactor với danh sách đầy đủ

Chỉ tiến hành sau khi có đủ danh sách từ map. Không bao giờ refactor mù.

### 4. Cập nhật map sau khi xong

```bash
python3 harness/scripts/index-frontend.py --root .
```

Chạy lại để map phản ánh trạng thái mới.

## Output

- `llmwiki/wiki/concepts/frontend-component-map.md` — map đầy đủ, overwrite mỗi lần chạy
- In ra terminal: số file đã scan + path output

## Notes

- Script dùng regex, không phải AST — đủ chính xác cho use-case này, không có dependency ngoài stdlib Python
- Props chỉ extract được khi interface/type có tên chứa "Props"
- Map không tự cập nhật — phải chạy lại thủ công hoặc trong CI
