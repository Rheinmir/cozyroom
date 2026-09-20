---
type: draft
title: Smart search bang Claude API (mo rong keyword + rerank)
status: rejected
tags: [search, claude-api, ai, be-fe]
timestamp: 2026-08-01
---

# 010826-smart-search-claude-be-fe
**Type:** draft
**Status:** rejected — 2026-08-02, KHÔNG code. Xem "## Quyết định" bên dưới.
**Tags:** search, claude-api, ai, be-fe
**Proposed:** 2026-08-01
**Sequence diagram:** [html/010826-smart-search-claude-be-fe-seq.html](../../../html/010826-smart-search-claude-be-fe-seq.html)

## Quyết định (2026-08-02)
Sau khi duyệt plan và bắt đầu implement, user nhận ra cozyroom **đã có sẵn năng lực này** qua AI Assistant (`AIAssistantPage.tsx` + `ai.go` + tool `search_music` trong MCP registry) — chat đã hiểu câu hỏi tự nhiên và tìm nhạc được, chỉ khác là nằm ở tab chat thay vì thanh search. Endpoint `/api/search/smart` riêng sẽ là trùng lặp năng lực AI, không phải năng lực mới. **Quyết định: dùng luôn AI Assistant có sẵn, không thêm endpoint mới.** Không có dòng code nào của proposal này được viết (mới dừng ở bước đọc `usecase/library.go` để chuẩn bị Task 1).

## What
Search hiện tại (`backend/internal/repository/postgres/search.go`) chỉ dùng `ILIKE '%q%'` — không hiểu câu hỏi tự nhiên ("nhạc buồn của Sơn Tùng năm 2023" không match được gì vì không có chuỗi con nào khớp title/artist). Đề xuất thêm một endpoint **smart search** dùng Claude API (Haiku, structured output, không dùng tool-use/agent loop) để: (1) tách câu hỏi tự nhiên thành các từ khóa cụ thể có thể search được (tên nghệ sĩ, tên bài, tên album), mở rộng recall cho ILIKE hiện có; (2) rerank/lọc tập kết quả gộp lại theo mức độ liên quan tới đúng ý câu hỏi gốc. Đây là lớp suy luận **tại thời điểm gọi**, không tạo bảng mới, không dùng embeddings/pgvector — theo đúng lựa chọn "Semantic/hiểu ý truy vấn" mà user đã chọn, thực hiện **cả 2** phần (mở rộng từ khóa + rerank).

## Affected

| File | Thay đổi |
|---|---|
| `backend/internal/api/search_smart.go` (mới) | Handler mới: gọi Claude 2 lần (tách từ khóa → search rộng → rerank), fallback về search cũ nếu lỗi/không có key |
| `backend/internal/api/routes.go` | Đăng ký `GET /api/search/smart`, khởi tạo `SmartSearchHandlers{lib: d.Lib, anthropicKey: d.AnthropicKey}` theo đúng pattern các handler nhóm nhỏ hiện có (`TrendingHandlers`, `YouTubeHandlers`) |
| `frontend/src/pages/SearchPage.tsx` | Thêm toggle "✨ Tìm bằng AI" — chỉ gọi `/api/search/smart` khi user submit tường minh (Enter/toggle bật), không đổi hành vi search-theo-từng-ký-tự hiện có (`/api/search` giữ nguyên) |

## Risks

- **Độ trễ**: 2 lệnh gọi Claude tuần tự (~0.5–1.5s/lệnh) có thể lên tới ~3s. Chấp nhận được vì đây là hành động **tường minh** (bấm nút/Enter), không chạy trên mỗi ký tự gõ — search thường vẫn tức thời như cũ.
- **Chi phí**: mỗi lần bấm "AI search" = 2 lệnh gọi Haiku. Haiku rẻ ($1/$5 mỗi 1M token), payload nhỏ (candidate list giới hạn ~40 mục) → chi phí không đáng kể cho 1 hành động người dùng chủ động.
- **Rerank có thể loại nhầm kết quả đúng** nếu Claude đánh giá sai relevance. Giảm thiểu bằng: luôn đưa cả kết quả ILIKE trên câu gốc vào candidate pool trước khi rerank (không bao giờ để search cũ "biến mất" khỏi tầm nhìn của bước rerank), và **fallback về search thường** nếu bất kỳ lệnh Claude nào lỗi/parse JSON thất bại/hết timeout.
- **Không có `ANTHROPIC_API_KEY`** ở một số môi trường (đã thấy trong `main.go`, key có thể rỗng) — bắt buộc phải trả về y hệt kết quả search thường, không được lỗi 500.
- **Không đụng DB, không migration** — chỉ là lớp gọi API tại request-time trên dữ liệu title/artist/album/year/genre đã có sẵn, nên không vi phạm rule "không đụng DB" của CLAUDE.md (không có thao tác ghi/schema nào ở đây).
- **Endpoint mới hoàn toàn tách biệt** — `/api/search` (search-theo-ký-tự hiện có, cache 30s, tăng `metrics.SearchesTotal`) không bị sửa một dòng nào, nên không có rủi ro regression cho tính năng search đang chạy.

## Global constraints

- Phạm vi CHỈ endpoint mới `/api/search/smart` + toggle FE gọi nó — **không sửa** `handlers.search()`/`GET /api/search` hiện có, không đổi cache 30s hay `metrics.SearchesTotal` của nó.
- Không tạo bảng/cột DB mới, không dùng embeddings/pgvector trong lần này — chỉ là lớp gọi Claude API tại request-time trên dữ liệu đã có (title/artist/album/year/genre).
- Không thêm field mới vào struct `handlers` dùng chung trong `handler.go` — dùng struct handler nhỏ riêng (`SmartSearchHandlers`) theo đúng pattern `TrendingHandlers`/`YouTubeHandlers` đã có.
- Bắt buộc fallback về `SearchRepo.Search()` gốc khi thiếu `ANTHROPIC_API_KEY` hoặc bất kỳ lệnh gọi Claude nào lỗi/timeout/parse JSON thất bại — không bao giờ trả 500 hay response rỗng bất thường cho người dùng cuối.
- Timeout tổng cho toàn bộ nhánh smart search (2 lệnh Claude + DB) giới hạn ~8s — vượt quá thì fallback ngay, không để người dùng chờ vô thời hạn.
- Model dùng `claude-haiku-4-5-20251001` (đã dùng sẵn trong `ai.go` làm default) — không dùng model đắt hơn cho tác vụ extract/rerank ngắn này.

## Plan

- [ ] Task 1: Backend — `search_smart.go` mới: gọi Claude lần 1 (tách từ khóa từ câu hỏi tự nhiên, structured output json_schema), chạy `SearchRepo.Search()` cho câu gốc + từng từ khóa rồi gộp/dedupe (cap ~40 mục), gọi Claude lần 2 (rerank/lọc theo relevance, structured output), fallback về search thường nếu thiếu key hoặc bất kỳ bước nào lỗi/timeout
- [ ] Task 2: `routes.go` — đăng ký `GET /api/search/smart`, khởi tạo `SmartSearchHandlers` theo pattern handler nhóm nhỏ hiện có (giống `TrendingHandlers`/`YouTubeHandlers`), không đổi wiring của `handlers.search()` cũ
- [ ] Task 3: Frontend — `SearchPage.tsx` thêm toggle "✨ Tìm bằng AI", chỉ gọi endpoint mới khi submit tường minh, có trạng thái loading riêng ("Đang hiểu ý bạn..."), giữ nguyên hoàn toàn luồng gõ-từng-ký-tự cũ
- [ ] Task 4: Verify — test câu hỏi tự nhiên tiếng Việt qua cả 2 endpoint, test khi `ANTHROPIC_API_KEY` rỗng, `go build`/`tsc --noEmit` sạch

## Agent Task Assignment

| Task | Agent (CLI) | Lý do chọn | Status |
|------|------|------|------|
| Task 1: Backend smart search handler | Claude Code (sonnet) | Logic 2-bước gọi Claude + fallback an toàn cần judgment (không được để lỗi AI làm hỏng search), không phải việc chép mẫu | pending |
| Task 2: Đăng ký route + wiring | Claude Code (sonnet) | Đụng `routes.go` dùng chung nhiều handler khác — cần đảm bảo không phá route/wiring hiện có | pending |
| Task 3: Frontend toggle + gọi endpoint mới | Claude Code (sonnet) | Đụng `SearchPage.tsx` là file lõi search hiện có, cần đảm bảo luồng gõ-từng-ký-tự cũ không bị ảnh hưởng | pending |
| Task 4: Verify end-to-end | Claude Code (sonnet) | Cần verify thật (curl + trình duyệt + trường hợp thiếu API key) — không giao CLI rẻ | pending |

## Success criteria

- `curl "/api/search/smart?q=nhạc+buồn+của+sơn+tùng"` trả về track/album của "Sơn Tùng" dù chuỗi "nhạc buồn của sơn tùng" không khớp substring với bất kỳ title/artist nào — chứng minh bước tách từ khóa hoạt động thật.
- Cùng câu hỏi đó gọi `/api/search` (endpoint cũ, không đổi) vẫn trả kết quả như trước (khả năng rỗng) — chứng minh không regression endpoint cũ.
- Set `ANTHROPIC_API_KEY=""` (rỗng) rồi gọi `/api/search/smart` → trả kết quả y hệt `/api/search` cho cùng câu hỏi, không lỗi 500.
- `go build ./...` và `tsc --noEmit` sạch.
- Test tay trên trình duyệt: gõ câu hỏi tự nhiên, bấm "✨ Tìm bằng AI", thấy trạng thái loading rồi có kết quả liên quan trong ~3s; search gõ-từng-ký-tự thường vẫn tức thời như cũ (không bị ảnh hưởng).

## Render brief

### Task 1 — Backend smart search handler
1. *(add)* `SmartSearchHandlers{lib *usecase.LibraryUsecase; anthropicKey string}` trong file mới `search_smart.go`.
2. *(add)* Gọi Claude lần 1: raw HTTP tới `api.anthropic.com/v1/messages` (theo đúng convention có sẵn trong `ai_providers.go` — `x-api-key` header, không dùng SDK), model `claude-haiku-4-5-20251001`, `output_config.format` json_schema để ép output `{"keywords": string[]}`.
3. *(add)* Chạy `SearchRepo.Search(ctx, q)` cho câu gốc + từng keyword đã tách, gộp/dedupe theo ID, cap tổng ~40 mục trước khi đưa vào bước rerank.
4. *(add)* Gọi Claude lần 2: input = câu hỏi gốc + candidate list rút gọn (id, title, artist, album, year) → output structured json_schema là danh sách ID đã rerank/lọc theo từng loại (artist/album/track).
5. *(add)* Ráp lại `domain.SearchResult` theo đúng thứ tự Claude đã rerank; mục nào Claude loại bỏ thì không đưa vào response cuối.
6. *(block)* Nếu `anthropicKey == ""` HOẶC bất kỳ lệnh gọi Claude nào lỗi/parse JSON thất bại/vượt timeout ngắn (~8s tổng) → fallback ngay về `SearchRepo.Search(ctx, q)` gốc, không bao giờ trả lỗi 500 cho người dùng cuối.

**Prose:** Điểm quan trọng nhất của task này là ranh giới an toàn: đây là một lớp suy luận CỘNG THÊM vào trên search hiện có, không phải thay thế nó — nếu Claude API chậm, lỗi, hết quota, hoặc trả về JSON không đúng schema mong đợi, hệ thống phải lặng lẽ quay về đúng hành vi search bằng ILIKE thuần đã có từ trước, để người dùng không bao giờ thấy lỗi hay màn hình trắng chỉ vì một tính năng phụ trợ gặp sự cố. Việc tách thành 2 lệnh gọi tuần tự (trước tiên hiểu câu hỏi để mở rộng từ khóa, sau đó mới rerank tập kết quả đã mở rộng) là có chủ đích: nếu gộp làm một lệnh duy nhất, Claude sẽ phải đoán mù kết quả DB thực tế trông ra sao mà không có dữ liệu thật để rerank — tách hai bước cho phép bước thứ hai luôn làm việc trên dữ liệu thật đã lấy từ chính database, giảm khả năng bịa đặt kết quả không tồn tại.

### Task 2 — Đăng ký route + wiring
1. *(legacy)* Giữ nguyên `mux.HandleFunc("GET /api/search", h.search)` — không sửa dòng nào của handler cũ.
2. *(add)* Thêm dòng mới `mux.HandleFunc("GET /api/search/smart", ssh.searchSmart)` ngay sau route search cũ trong `routes.go`.
3. *(add)* Khởi tạo `ssh := &SmartSearchHandlers{lib: d.Lib, anthropicKey: d.AnthropicKey}` theo đúng pattern các handler nhóm nhỏ hiện có (`th := &TrendingHandlers{...}`, `yh := &YouTubeHandlers{...}`) — không thêm field mới vào struct `handlers` dùng chung, giữ đúng nguyên tắc "surgical changes".

**Prose:** Cách wiring này cố tình đi theo đúng khuôn mẫu đã tồn tại sẵn trong `routes.go` cho các nhóm tính năng phụ trợ (Trending, YouTube, Playlists, Notes) — mỗi nhóm là một struct handler nhỏ riêng, nhận đúng những dependency nó cần (ở đây là `Lib` để tái dùng `SearchRepo` bên trong và `AnthropicKey` vốn đã có sẵn trong `RouterDeps`), thay vì nhét thêm field vào struct `handlers` trung tâm vốn đang được hàng chục handler khác dùng chung. Làm vậy giảm tối đa diện tích thay đổi và rủi ro ảnh hưởng chéo tới các tính năng không liên quan.

### Task 3 — Frontend toggle + gọi endpoint mới
1. *(legacy)* Giữ nguyên `fetchSearch(q)` gọi `/api/search` và luồng gõ-từng-ký-tự hiện có trong `SearchPage.tsx` — không đổi.
2. *(add)* Thêm state `aiSearchOn` (toggle) và state loading riêng (`isSmartSearching`) cho nhánh mới.
3. *(add)* Khi toggle bật VÀ user submit tường minh (Enter, hoặc nút "✨ Tìm bằng AI") → gọi `/api/search/smart?q=...` thay vì `/api/search`, dùng chung type `SearchResult` đã có (response shape giống hệt, chỉ khác nội dung/thứ tự) để không phải đổi phần render kết quả.
4. *(add)* Hiển thị label loading riêng ("Đang hiểu ý bạn...") trong lúc chờ, vì độ trễ nhánh này cao hơn hẳn (~3s) so với search thường gần như tức thời.

**Prose:** Thiết kế UI cố tình tách bạch hai luồng: gõ-từng-ký-tự vẫn gọi `/api/search` y hệt hôm nay — nhanh, rẻ, không đổi cảm giác dùng hiện tại của mọi người dùng — còn nhánh AI chỉ kích hoạt khi người dùng chủ động yêu cầu (bật toggle rồi Enter, hoặc bấm nút riêng), phản ánh đúng bản chất "đây là một công cụ bổ trợ mạnh hơn nhưng chậm hơn", không phải một bản nâng cấp âm thầm thay thế hành vi mặc định. Việc tái dùng đúng type `SearchResult` sẵn có nghĩa là phần hiển thị danh sách nghệ sĩ/album/track không cần viết lại — chỉ nguồn dữ liệu đổi.

### Task 4 — Verify end-to-end
1. *(add)* `curl "/api/search/smart?q=nhạc+buồn+của+sơn+tùng"` — xác nhận trả về track/album của Sơn Tùng dù không có substring khớp trực tiếp.
2. *(add)* `curl "/api/search?q=nhạc+buồn+của+sơn+tùng"` (endpoint cũ) — xác nhận vẫn hành xử y hệt trước khi có thay đổi này (không regression).
3. *(block)* Set `ANTHROPIC_API_KEY=""` rồi gọi lại `/api/search/smart` — nếu trả lỗi 500 hoặc response rỗng bất thường thay vì fallback về search thường → sai, quay lại Task 1 sửa nhánh fallback.
4. *(add)* `go build ./...`, `tsc --noEmit` sạch; test tay trên trình duyệt bật toggle AI search, xác nhận loading state hiển thị đúng và search gõ-từng-ký-tự thường không bị chậm đi.

**Prose:** Bước verify quan trọng nhất ở đây không phải là "AI search có ra kết quả hay không" — mà là kịch bản khi API key rỗng hoặc lỗi, vì đây chính là ranh giới giữa một tính năng bổ trợ an toàn và một tính năng có thể làm hỏng trải nghiệm search cốt lõi của toàn bộ ứng dụng. Nếu bước fallback không hoạt động đúng, hậu quả không chỉ là "AI search không chạy" mà có thể là "search bình thường cũng bị ảnh hưởng theo" — nên đây là điều kiện chặn (block), không phải một ghi chú phụ.

## Notes
- Invoked via: `/claude-api` skill (thảo luận Claude API options) → user chọn "Semantic/hiểu ý truy vấn" → user xác nhận "thực hiện cả 2" (mở rộng từ khóa + rerank) → `/propose`
- Không dùng embeddings/pgvector trong lần này — nếu sau này cần typo-tolerance/fuzzy thật hoặc dữ liệu quá lớn, sẽ là proposal riêng theo hướng Postgres `pg_trgm`/`tsvector` hoặc search engine riêng (đã thảo luận, chưa chọn)
- Liên quan: [[280526-sqlite-to-postgres]] (search.go hiện dùng Postgres)

## Origin
- **Draft:** `wiki/sources/draft/010826-smart-search-claude-be-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
