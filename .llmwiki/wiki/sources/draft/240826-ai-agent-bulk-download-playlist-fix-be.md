---
type: draft
title: Fix AI agent bi ket khi tao playlist bulk (tai YouTube + them vao playlist nhieu bai)
status: done
tags: [bugfix, ai-agent, mcp, youtube, playlist, be]
timestamp: 2026-08-24
---

# 240826-ai-agent-bulk-download-playlist-fix-be
**Type:** draft
**Status:** done — implement + build pass 2026-08-24, chưa deploy/commit
**Tags:** bugfix, ai-agent, mcp, youtube, playlist, be
**Proposed:** 2026-08-24
**Sequence diagram:** [html/240826-ai-agent-bulk-download-playlist-fix-be-seq.html](../../../html/240826-ai-agent-bulk-download-playlist-fix-be-seq.html)

## What
User yêu cầu AI agent (DeepSeek qua MCP tools) tạo 1 playlist gồm 24 tác phẩm nhạc cổ điển (Great Works trong Civ VI), tải từng bài từ YouTube, thêm vào playlist. Agent tự lý luận đúng rằng nó bị kẹt rồi dừng lại giữa việc, không hoàn thành. Điều tra từ transcript thật cho thấy 2 nguyên nhân gốc độc lập: (1) tool `download_youtube` không tự tải gì — chỉ ra lệnh cho frontend tải async, nên không có `track_id` ngay để gọi `add_to_playlist`; (2) vòng lặp tool-calling trong `ai.go` bị giới hạn cứng 6 lượt, không đủ cho tác vụ cần ~49 lệnh (24 download + 24 add_to_playlist + 1 create_playlist).

## Affected

| File | Thay đổi |
|---|---|
| `backend/internal/library/youtube_download.go` (mới) | Extract logic tải + index YouTube từ `youtube.go`, trả về `track_id` xác định trước |
| `backend/internal/api/youtube.go` | `(h *YouTubeHandlers) download` gọi hàm dùng chung thay vì logic inline, response HTTP không đổi |
| `backend/internal/mcp/registry.go` | `downloadYouTubeTool` tải đồng bộ + trả `track_id` thật, bỏ `_frontend_action`; `ToolDeps` thêm field path |
| `backend/internal/api/routes.go` | Wire `MusicPath/YtDownloadPath/CoversDir` vào `mcp.ToolDeps{}` |
| `backend/internal/api/ai.go` | 3 vòng lặp `for i<6` → `const maxToolRounds=25`; thêm hướng dẫn batch tool-call vào system prompt |

Không đụng: `youtube.go` các handler search/stream/channel, `db.go migrate()`, `routes.go` phần khung ngoài wiring ToolDeps, `frontend/src/pages/AIAssistantPage.tsx` (nhánh xử lý `_frontend_action: download_youtube` giữ nguyên, chỉ đơn giản không còn được tool này trigger nữa).

## Risks

- **`ai.go`/`mcp/registry.go` là file dùng chung** (mọi domain AI đều đi qua) — đổi round-cap và tool result shape có thể ảnh hưởng mọi luồng chat khác, không riêng playlist. Đã kiểm tra: `IndexFileWithMetadata` chỉ 2 nơi gọi (`scanner.go`, `youtube.go`) → an toàn thêm điểm gọi thứ 3.
- **Nâng ceiling 6→25 không tự nó giải quyết bulk task** nếu model vẫn gọi tool tuần tự 1 lệnh/lượt — phải đi kèm hướng dẫn system prompt để model tự dồn nhiều tool-call cùng loại vào 1 lượt, ceiling chỉ là lưới an toàn chống runaway.
- **Bỏ `_frontend_action` khỏi `download_youtube`** — frontend (`AIAssistantPage.tsx:636-641`) không còn tự fire `POST /api/youtube/download` khi thấy action này nữa (vì backend đã tự làm xong trong tool call) — tránh double-download, không phải regression.
- **HTTP endpoint `POST /api/youtube/download` giữ nguyên response** `{"status":"ok","tracks_scanned":1}` — người dùng thường (không qua AI) không thấy khác biệt gì.

## Plan

- [x] Task 1: Extract `DownloadYouTubeAudio()` vào `library/youtube_download.go`, trả `(trackID, title, artist string, err error)`
- [x] Task 2: `downloadYouTubeTool` gọi hàm dùng chung đồng bộ, trả `track_id` thật; wire `ToolDeps` + `routes.go`
- [x] Task 3: Nâng round-cap `6→25` (const chung), thêm hướng dẫn batch tool-call vào system prompt
- [x] Task 4: Verify — `go build ./...` + `go vet ./...` sạch

## Agent Task Assignment

| Task | Agent (CLI) | Lý do chọn | Status |
|------|------|------|------|
| Task 1-4: Toàn bộ fix | `ai-engineer` subagent | Mọi file thay đổi (`ai.go`, `mcp/registry.go`, `youtube.go`, `routes.go` phần ToolDeps) đều nằm đúng domain AI theo bảng persona trong CLAUDE.md — không tách nhỏ hơn vì các thay đổi phụ thuộc lẫn nhau chặt (đổi tool result shape ảnh hưởng trực tiếp tới việc round-cap có đủ dùng không) | done |

## Success criteria

- `go build ./...` và `go vet ./...` sạch — **đã xác nhận, pass**
- Chưa test end-to-end thật với list 24 tác phẩm (chưa deploy/commit) — cần: agent tạo playlist, gọi `download_youtube` nhiều lần trong 1-2 lượt (không phải 24 lượt riêng), mỗi lần trả `track_id` dùng được ngay cho `add_to_playlist`, hoàn thành trong dưới 25 vòng lặp
- Không regression: request tải YouTube đơn giản qua UI thường (không qua AI) vẫn hoạt động y hệt trước, response HTTP không đổi

## Render brief

### Task 1 — Extract DownloadYouTubeAudio (thư viện dùng chung)
1. *(legacy)* Logic `yt-dlp -x --audio-format best ...` + tìm file kết quả + resolve uploader + copy thumbnail giữ nguyên hoàn toàn, chỉ di chuyển vị trí.
2. *(add)* Hàm mới `library.DownloadYouTubeAudio(ctx, db, dlPath, coversDir, videoID, title, artist)` trả về `(trackID, resolvedTitle, resolvedArtist string, err error)`.
3. *(add)* `trackID` tính bằng `id8(filePath)` — đúng công thức deterministic mà `scanner.go` đã dùng, không phải giá trị mới bịa ra.
4. *(add)* Sentinel error `ErrYouTubeFileNotFound` để caller phân biệt "yt-dlp fail" và "tải xong nhưng không thấy file" mà không cần parse string lỗi.

**Prose:** Trước khi sửa, logic tải + index YouTube nằm nguyên trong HTTP handler `(h *YouTubeHandlers) download`, không thể tái sử dụng ở nơi khác mà không copy-paste. Vì `trackID` trong toàn hệ thống được tính hoàn toàn xác định trước (deterministic hash của đường dẫn file, không phải ID sinh ngẫu nhiên hay auto-increment), việc trích xuất logic này thành 1 hàm dùng chung trả thẳng `trackID` là an toàn — không có rủi ro 2 nơi gọi tính ra 2 ID khác nhau cho cùng 1 file, vì công thức `id8(path)` không đổi bất kể ai gọi nó.

### Task 2 — MCP tool đồng bộ + trả track_id
1. *(legacy)* Chữ ký tool `download_youtube` trong MCP registry (tên, input schema `id/title/artist`) giữ nguyên.
2. *(block)* Bỏ hoàn toàn nhánh trả `_frontend_action: "download_youtube"` — đây chính là nguồn gốc bug, tool "thành công" mà không đảm bảo download thật sự đã xảy ra.
3. *(add)* Handler gọi `library.DownloadYouTubeAudio(...)` ngay trong tool call, chờ xong (đồng bộ), trả `{"track_id", "title", "artist"}` thật.
4. *(add)* `ToolDeps` thêm field `MusicPath/YtDownloadPath/CoversDir`, wire từ `routes.go` (đã có sẵn giá trị này dùng cho `YouTubeHandlers` vài dòng trên).

**Prose:** Đây là fix cho đúng nguyên nhân agent tự phát hiện trong transcript — nó nhận ra `download_youtube` không cho nó cách nào lấy `track_id` để gọi `add_to_playlist` ngay sau, vì việc tải trước đây tách rời hoàn toàn khỏi lượt gọi tool (chỉ có tác dụng nếu 1 frontend đang lắng nghe action và tự gọi API tải riêng). Sau khi sửa, tool tự làm hết việc tải + index bên trong backend, không cần frontend tham gia — hoạt động đúng cả khi agent chạy headless (không có UI nào mở), và trả về đủ thông tin để model ghép ngay vào bước tiếp theo trong cùng 1 chuỗi suy luận.

### Task 3 — Round-cap + hướng dẫn batch tool-call
1. *(legacy)* Cấu trúc vòng lặp `for i := 0; i < N; i++ { provider.call(...) }` ở cả 3 nơi (`chat`, `chatStream`, `ExecutePrompt`) giữ nguyên logic, chỉ đổi N.
2. *(add)* `const maxToolRounds = 25` dùng chung cho cả 3 vòng lặp, thay thế số cứng `6` lặp lại 3 lần.
3. *(add)* Thêm 1 dòng vào system prompt: khi cần thực hiện nhiều hành động cùng loại (tải nhiều bài, thêm nhiều track vào playlist), hãy gọi nhiều tool-call cùng loại trong CÙNG 1 lượt response.
4. *(block)* Nếu model vẫn gọi tuần tự 1 lệnh/lượt dù có hướng dẫn — 25 vòng vẫn là lưới an toàn cản việc chạy runaway vô hạn, không phải cơ chế chính giải quyết bulk task.

**Prose:** Quyết định có chủ đích của user: không chỉ tăng 1 con số cứng lớn hơn (vì bất kỳ số cố định nào cũng có thể bị vượt qua bởi 1 batch lớn hơn trong tương lai — ví dụ list 24 tác phẩm hôm nay, có thể là 50 vào lúc khác), mà để model tự thiết kế cách gọi hiệu quả trước, harness chỉ cần đủ rộng rãi để không cắt ngang khi model đang làm đúng hướng. Vì hầu hết API tool-calling hiện đại (bao gồm định dạng OpenAI-compatible mà DeepSeek dùng) cho phép 1 lượt response trả về nhiều `tool_calls` cùng lúc, việc hướng dẫn model batch nhiều lệnh giống nhau vào 1 lượt có thể giảm 1 tác vụ 24-tải-24-thêm từ ~49 lượt riêng lẻ xuống chỉ còn vài lượt thật — ceiling 25 khi đó đóng vai trò lưới an toàn cho trường hợp model không tuân theo hướng dẫn, không phải giới hạn thực tế cản việc như số 6 cũ.

## Notes
- Invoked via: `/propose` skill (retroactive — code đã implement + build pass trước khi tạo proposal này, theo yêu cầu trực tiếp của user, gate approval được bỏ qua có chủ đích)
- Bối cảnh phát hiện bug: user gửi ảnh chụp AIAssistantPage thật cho thấy agent (DeepSeek) tự lý luận vào ngõ cụt rồi dừng lại — không phải bug do test giả lập
- Liên quan: [[040826-lyrics-auto-translate-fe]] (cùng domain ai-engineer, cùng pattern MCP tool)

## Origin
- **Draft:** `wiki/sources/draft/240826-ai-agent-bulk-download-playlist-fix-be.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
