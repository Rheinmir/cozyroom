---
type: draft
title: So lieu luot nghe nhac + chart (local count + Last.fm backfill)
status: proposed
tags: [stats, play-count, lastfm, chart, be-fe]
timestamp: 2026-08-02
---

# 020826-music-play-stats-chart-be-fe
**Type:** draft
**Status:** proposed
**Tags:** stats, play-count, lastfm, chart, be-fe
**Proposed:** 2026-08-02
**Sequence diagram:** [html/020826-music-play-stats-chart-be-fe-seq.html](../../../html/020826-music-play-stats-chart-be-fe-seq.html)

## What
Cozyroom hiện chưa đếm số lượt nghe của từng bài hát ở đâu cả — chỉ có scrobble 1 chiều sang Last.fm (ghi ra ngoài, không đọc lại). User muốn có số liệu lượt nghe + vẽ chart, và đã chọn hướng kết hợp: (1) đếm lượt nghe local đi tới, ghi log từng lần nghe thật (append-only, không phải chỉ 1 counter — để vừa tính được "top bài nghe nhiều nhất" vừa vẽ được "lượt nghe theo ngày"); (2) lấy lịch sử cũ từ Last.fm qua `track.getInfo` (trả về `userplaycount` theo từng bài, dùng `lastfm_username` đã lưu sẵn) làm baseline một lần, cộng vào tổng khi hiển thị.

## Affected

| File | Thay đổi |
|---|---|
| `backend/internal/db/db.go` | Thêm bảng `track_plays` (log append-only mỗi lần nghe thật) + cột `tracks.lastfm_backfill_count` (snapshot 1 lần từ Last.fm) |
| `backend/internal/repository/postgres/track.go` | Thêm `RecordPlay(ctx, trackID)` — INSERT 1 dòng vào `track_plays` |
| `backend/internal/api/handler.go` | Thêm `POST /api/tracks/{id}/play` |
| `backend/internal/api/lastfm.go` | Thêm `POST /api/lastfm/backfill-play-counts` — loop toàn bộ track, gọi `track.getInfo` (đọc, không cần ký `api_sig`), lấy `userplaycount`, cập nhật `lastfm_backfill_count` bằng `GREATEST` |
| `backend/internal/api/routes.go` | Đăng ký 2 route mới ở trên, cộng `GET /api/stats/plays` |
| `frontend/src/api.ts` | Thêm `recordPlay(trackId)`, `fetchPlayStats()`, `backfillLastfmPlayCounts()` |
| `frontend/src/PlayerContext.tsx` | Gọi `recordPlay(track.id)` ngay tại đúng điểm scrobble hiện có (dòng ~796-802: đã nghe ≥30s và ≥50%/240s bài) — tái dùng đúng ngưỡng "coi là đã nghe thật" đã có sẵn |
| `frontend/src/pages/MusicStatsPage.tsx` (mới) | Trang mới: BarChart top-played + LineChart lượt nghe theo ngày (dùng `recharts`, theo pattern có sẵn ở `AIStatsPage.tsx`) + nút "Đồng bộ Last.fm" |
| `frontend/src/AppRoutes.tsx`, `Sidebar.tsx` | Đăng ký route + link nav cho trang mới |

## Risks

- **`track_plays` phình to theo thời gian** (mỗi lần nghe = 1 dòng) — chấp nhận được ở quy mô thư viện cá nhân; nếu sau này cần dọn, thêm job xoá dòng cũ hơn N ngày là việc riêng, không làm hôm nay.
- **Backfill Last.fm chậm** (loop từng track, rate-limit ~4 req/s để tôn trọng giới hạn Last.fm) — với thư viện vài trăm–vài nghìn bài có thể mất vài phút. Chạy như background goroutine + endpoint trạng thái đơn giản (in-memory, không cần bảng riêng), không block HTTP request.
- **`lastfm_username` chưa kết nối** — endpoint backfill phải trả lỗi rõ ràng (503 "chưa kết nối Last.fm"), không được crash hay chạy job vô nghĩa.
- **Double-count khi chạy backfill nhiều lần**: dùng `GREATEST(lastfm_backfill_count, userplaycount_mới)` thay vì cộng dồn — Last.fm luôn trả TỔNG playcount tới hiện tại, không phải phần tăng thêm, nên cộng dồn sẽ sai; lấy max là đúng ngữ nghĩa "baseline một lần, không tăng thêm mỗi lần chạy lại".
- **`recordPlay` không được phụ thuộc Last.fm đã kết nối hay chưa** — phải gọi độc lập, giống cách `lastfmScrobble` hiện tại cũng gọi vô điều kiện và tự nuốt lỗi (`.catch(() => {})`) nếu chưa kết nối.
- **Không đổi ngưỡng "coi là đã nghe thật"** — tái dùng đúng logic đã có (`duration>=30`, `progress >= min(duration*0.5,240)` và `>=30`), không phát minh ngưỡng mới để tránh lệch số liệu giữa Last.fm scrobble và local count.
- **Trang thống kê mới không có scope theo user** — app này không có khái niệm user/tài khoản (đã xác nhận qua research), nên đây là số liệu toàn bộ thư viện, không phải "của riêng ai".

## Global constraints

- Không đổi bảng/logic `playback_progress` (resume-position) hay `chat_logs`/`ai_model_prices` — chỉ thêm bảng/cột mới, thuần additive.
- Không đổi ngưỡng scrobble hiện có trong `PlayerContext.tsx` (dòng 791-803) — chỉ thêm 1 lời gọi API mới cạnh `lastfmScrobble`, không sửa điều kiện `if`.
- `RecordPlay`/endpoint `/api/tracks/{id}/play` không được throw lỗi ra ngoài làm gián đoạn phát nhạc — lỗi ghi log chỉ log server-side, frontend luôn `.catch(() => {})` như pattern `lastfmScrobble` đã có.
- Backfill Last.fm dùng đúng `lastfm_username` đã lưu sẵn trong `settings` (không yêu cầu nhập lại), không cần `api_sig` cho `track.getInfo` (method đọc công khai).
- Migration theo đúng style hiện có trong `db.go`: `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, không dùng framework migration mới.

## Plan

- [ ] Task 1: `db.go` — thêm bảng `track_plays(id, track_id, played_at)` + index theo `track_id`/`played_at`, cột `tracks.lastfm_backfill_count INTEGER NOT NULL DEFAULT 0`
- [ ] Task 2: Backend record-play — `track.go` thêm `RecordPlay()`, `handler.go` thêm `POST /api/tracks/{id}/play`, đăng ký route
- [ ] Task 3: Backend stats endpoint — `GET /api/stats/plays?days=30` trả top-N most-played (join `lastfm_backfill_count + COUNT(track_plays)`) + lượt nghe theo ngày (từ `track_plays` local)
- [ ] Task 4: Backend Last.fm backfill — `POST /api/lastfm/backfill-play-counts` trong `lastfm.go`, loop track gọi `track.getInfo`, `GREATEST` cập nhật `lastfm_backfill_count`, chạy nền + endpoint trạng thái đơn giản
- [ ] Task 5: Frontend record-play hook — `api.ts` thêm `recordPlay()`, gọi trong `PlayerContext.tsx` ngay cạnh `lastfmScrobble` hiện có
- [ ] Task 6: Frontend trang thống kê — `MusicStatsPage.tsx` mới (BarChart top-played + LineChart theo ngày, dùng `recharts` theo pattern `AIStatsPage.tsx`) + nút "Đồng bộ Last.fm", đăng ký route + nav
- [ ] Task 7: Verify — nghe thử 1 bài đủ ngưỡng, xác nhận `track_plays` có dòng mới; gọi backfill, xác nhận `lastfm_backfill_count` cập nhật đúng; chart hiển thị đúng số liệu; `go build`/`tsc --noEmit` sạch

## Agent Task Assignment

| Task | Agent (CLI) | Lý do chọn | Status |
|------|------|------|------|
| Task 1: Schema mới | Claude Code (sonnet) | Đụng migration file dùng chung (`db.go`), cần đúng style idempotent hiện có | pending |
| Task 2: Backend record-play | Claude Code (sonnet) | Đụng `handler.go`/`routes.go` dùng chung, cần đảm bảo không throw lỗi ra ngoài làm gián đoạn phát nhạc | pending |
| Task 3: Backend stats endpoint | Claude Code (sonnet) | Query join nhiều bảng (`tracks`/`albums`/`artists`/`track_plays`), cần đúng ngữ nghĩa GREATEST/baseline | pending |
| Task 4: Backend Last.fm backfill | Claude Code (sonnet) | Đụng `lastfm.go` dùng chung, cần đúng rate-limit + chạy nền không block HTTP, rủi ro cao nếu sai (gọi API ngoài) | pending |
| Task 5: Frontend record-play hook | Claude Code (sonnet) | Đụng đúng effect scrobble hiện có trong `PlayerContext.tsx` — file lõi, cần cẩn trọng không đổi ngưỡng cũ | pending |
| Task 6: Frontend trang thống kê | Claude Code (sonnet) | Trang mới + chart, theo pattern có sẵn nhưng cần thiết kế layout/route mới | pending |
| Task 7: Verify end-to-end | Claude Code (sonnet) | Cần verify thật (nghe nhạc thật, gọi backfill thật, xem chart thật) — không giao CLI rẻ | pending |

## Success criteria

- Nghe 1 bài đủ ngưỡng (≥30s, ≥50%/240s) → `SELECT * FROM track_plays WHERE track_id=...` xuất hiện đúng 1 dòng mới với `played_at` hợp lý.
- Nghe lại bài đó → thêm 1 dòng nữa (không phải update — mỗi lần nghe là 1 sự kiện riêng).
- Đã kết nối Last.fm, bấm "Đồng bộ Last.fm" → sau khi job xong, `tracks.lastfm_backfill_count` của các bài có lịch sử nghe trên Last.fm được cập nhật đúng bằng `userplaycount` thật (so sánh tay với vài bài trên trang Last.fm cá nhân).
- Chạy backfill 2 lần liên tiếp → `lastfm_backfill_count` không tăng gấp đôi (đúng ngữ nghĩa GREATEST/snapshot).
- Trang `MusicStatsPage` hiển thị đúng: BarChart top 10 bài nghe nhiều nhất (tổng = local + Last.fm backfill), LineChart lượt nghe 30 ngày gần nhất (chỉ từ local, có ghi chú rõ nếu cần).
- Chưa kết nối Last.fm → bấm "Đồng bộ Last.fm" báo lỗi rõ ràng, không crash trang.
- `go build ./...` và `tsc --noEmit` sạch.

## Render brief

### Task 1 — Schema mới trong db.go
1. *(add)* `CREATE TABLE IF NOT EXISTS track_plays (id TEXT PRIMARY KEY, track_id TEXT NOT NULL, played_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER))`.
2. *(add)* `CREATE INDEX IF NOT EXISTS idx_track_plays_track_id ON track_plays(track_id)` + `idx_track_plays_played_at ON track_plays(played_at)`.
3. *(add)* `ALTER TABLE tracks ADD COLUMN IF NOT EXISTS lastfm_backfill_count INTEGER NOT NULL DEFAULT 0`.

**Prose:** Bảng `track_plays` được thiết kế dạng log append-only (mỗi lần nghe là 1 dòng mới, không phải update 1 counter) vì đây là lựa chọn duy nhất cho phép vừa tính "top bài nghe nhiều nhất" (đếm tổng số dòng theo track) vừa vẽ được biểu đồ "lượt nghe theo ngày" (nhóm theo ngày từ cột `played_at`) từ CÙNG một nguồn dữ liệu — nếu chỉ lưu 1 counter duy nhất, biểu đồ theo thời gian sẽ không thể vẽ được vì không còn giữ dấu thời gian của từng lần nghe riêng lẻ. Cột `lastfm_backfill_count` trên bảng `tracks` cố tình tách biệt khỏi `track_plays` vì dữ liệu từ Last.fm chỉ là một con số tổng (`userplaycount`) tại một thời điểm, không có dấu thời gian của từng lần nghe lịch sử — nên không thể và không nên giả tạo ra các dòng `track_plays` khống để khớp con số đó.

### Task 2 — Backend record-play
1. *(add)* `track.go`: `func (r *TrackRepo) RecordPlay(ctx context.Context, trackID string) error` — sinh ID ngẫu nhiên theo đúng pattern hex-id hiện có của các bảng khác, `INSERT INTO track_plays (id, track_id, played_at) VALUES (...)`.
2. *(add)* `handler.go`: `POST /api/tracks/{id}/play` — đọc `track_id` từ path, gọi `RecordPlay`, trả `204 No Content` (không trả lỗi chi tiết ra ngoài để không làm gián đoạn UI phát nhạc nếu ghi log thất bại — chỉ log server-side).
3. *(add)* `routes.go`: đăng ký route mới.

**Prose:** Endpoint này cố tình được thiết kế "fire-and-forget" từ góc nhìn frontend — nó không bao giờ được phép làm hỏng trải nghiệm phát nhạc chỉ vì việc ghi log lượt nghe gặp sự cố (DB tạm thời chậm, mất kết nối...). Vì vậy phía backend chỉ log lỗi nội bộ chứ không trả mã lỗi gây chú ý, và phía frontend (Task 5) sẽ gọi kèm `.catch(() => {})` giống hệt cách `lastfmScrobble` đã làm từ trước — sự nhất quán này quan trọng vì cả hai đều là "ghi nhận phụ", không phải luồng chính của trải nghiệm nghe nhạc.

### Task 3 — Backend stats endpoint
1. *(add)* `GET /api/stats/plays?days=30` (handler mới, có thể đặt cạnh `h.stats` trong `handler.go` hoặc file riêng `stats_plays.go`).
2. *(add)* Query top-N: `SELECT t.id, t.title, ar.name, al.title, t.lastfm_backfill_count + COUNT(tp.id) AS total_plays FROM tracks t JOIN albums al ON al.id=t.album_id JOIN artists ar ON ar.id=al.artist_id LEFT JOIN track_plays tp ON tp.track_id=t.id GROUP BY t.id, ar.name, al.title ORDER BY total_plays DESC LIMIT 10`.
3. *(add)* Query lượt nghe theo ngày: `SELECT to_char(to_timestamp(played_at),'YYYY-MM-DD') d, COUNT(*) FROM track_plays WHERE played_at >= extract(epoch from now() - ($1 || ' days')::interval) GROUP BY d ORDER BY d` (chỉ tính local, ghi chú rõ trong response/UI rằng phần Last.fm backfill không có breakdown theo ngày).

**Prose:** Điểm quan trọng cần làm rõ ngay từ thiết kế: "top bài nghe nhiều nhất" là con số TỔNG HỢP (local + Last.fm baseline) vì đây là câu hỏi "bài nào tôi nghe nhiều nhất từ trước đến giờ", còn "lượt nghe theo ngày" chỉ phản ánh dữ liệu TỪ KHI tính năng này chạy (local), vì Last.fm chỉ cho biết tổng số, không cho biết đã nghe vào ngày nào trong quá khứ — đây là giới hạn dữ liệu thật cần nói rõ trong UI, không phải lỗi thiết kế.

### Task 4 — Backend Last.fm backfill
1. *(add)* `lastfm.go`: `POST /api/lastfm/backfill-play-counts` — đọc `lastfm_username` từ settings, nếu rỗng trả 503 "chưa kết nối Last.fm".
2. *(add)* Chạy nền (goroutine): lấy danh sách toàn bộ track (title + tên nghệ sĩ), với mỗi track gọi `track.getInfo` (`method=track.getInfo&api_key=...&artist=...&track=...&username=...`, KHÔNG cần `api_sig` vì là read method công khai), parse `track.userplaycount`.
3. *(add)* `UPDATE tracks SET lastfm_backfill_count = GREATEST(lastfm_backfill_count, $1) WHERE id = $2` cho từng track có kết quả.
4. *(add)* Rate-limit ~250ms giữa các lần gọi (tôn trọng giới hạn Last.fm ~4-5 req/s), lưu trạng thái tiến trình trong biến in-memory (vd `map` hoặc struct có mutex) để endpoint trạng thái riêng (hoặc response ban đầu) có thể polling.
5. *(block)* Nếu `lastfm_username` rỗng → trả lỗi ngay, không khởi động goroutine.

**Prose:** Việc chạy nền là bắt buộc chứ không phải tối ưu tuỳ chọn — với thư viện vài trăm đến vài nghìn bài, gọi tuần tự có rate-limit sẽ mất từ vài chục giây đến vài phút, vượt xa thời gian một HTTP request thông thường nên chấp nhận được (browser/client sẽ timeout hoặc người dùng tưởng bị treo). Việc dùng `GREATEST` thay vì gán trực tiếp hay cộng dồn là quyết định ngữ nghĩa cốt lõi: Last.fm luôn trả về TỔNG số lần nghe tính đến thời điểm gọi API, không phải "số lần mới từ lần backfill trước" — nên nếu user bấm nút backfill nhiều lần (vô tình hoặc để refresh), kết quả phải giữ nguyên đúng con số thật từ Last.fm, không được nhân đôi hay giảm xuống do một lần gọi API tạm thời lỗi trả về 0.

### Task 5 — Frontend record-play hook
1. *(add)* `api.ts`: `export const recordPlay = (trackId: string): Promise<void> => fetch('/api/tracks/'+trackId+'/play', {method:'POST'}).then(()=>{})` — theo đúng khuôn mẫu `lastfmScrobble` đã có (dòng 71-76).
2. *(add)* `PlayerContext.tsx` dòng ~798-801: thêm `recordPlay(track.id).catch(() => {})` ngay cạnh lời gọi `lastfmScrobble(...)` hiện có, bên trong cùng khối `if (progress >= threshold && progress >= 30)`.
3. *(legacy)* Không đổi bất kỳ điều kiện `if` nào của khối scrobble hiện có (dòng 792-796) — tái dùng nguyên vẹn ngưỡng đã có.

**Prose:** Việc gắn `recordPlay` vào ĐÚNG cùng một điều kiện với `lastfmScrobble` (thay vì viết lại ngưỡng riêng) đảm bảo hai nguồn số liệu — Last.fm scrobble và local play count — luôn đồng nhất về định nghĩa "thế nào là một lượt nghe thật", tránh tình trạng số liệu lệch nhau khó giải thích sau này (vd Last.fm nói 50 lượt, local nói 48 lượt, chỉ vì ngưỡng tính khác nhau).

### Task 6 — Frontend trang thống kê
1. *(add)* `MusicStatsPage.tsx` mới: gọi `GET /api/stats/plays`, render `BarChart` top-10 bài nghe nhiều nhất (trục X = tên bài, trục Y = tổng lượt nghe) và `LineChart` lượt nghe theo ngày 30 ngày gần nhất — cả hai bọc trong `ResponsiveContainer`, theo đúng pattern đã có ở `AIStatsPage.tsx`.
2. *(add)* Nút "Đồng bộ Last.fm" gọi `POST /api/lastfm/backfill-play-counts`, hiển thị trạng thái loading/kết quả (toast hoặc text đơn giản), disable nếu Last.fm chưa kết nối (dùng lại `lastfmStatus` endpoint đã có).
3. *(add)* `AppRoutes.tsx` + `Sidebar.tsx`: đăng ký route mới (vd `/stats/music`) + link nav.

**Prose:** Trang này được thiết kế như một trang thống kê nhạc độc lập, tách biệt hoàn toàn khỏi `AIStatsPage.tsx` (vốn là thống kê chi phí/sử dụng AI, không liên quan âm nhạc) dù dùng chung thư viện `recharts` và cùng convention bọc `ResponsiveContainer` — lý do là hai loại dữ liệu phục vụ hai mục đích hoàn toàn khác nhau (vận hành AI vs sở thích nghe nhạc cá nhân), gộp chung sẽ gây nhầm lẫn về ngữ cảnh cho người dùng.

### Task 7 — Verify end-to-end
1. *(add)* Nghe thử 1 bài đủ ngưỡng trên trình duyệt thật, kiểm tra `track_plays` có dòng mới đúng `track_id`.
2. *(add)* Nghe lại → xác nhận có thêm 1 dòng nữa (không phải update).
3. *(add)* Gọi backfill (nếu đã kết nối Last.fm) → so sánh tay `lastfm_backfill_count` với số liệu thật trên trang Last.fm cá nhân của vài bài.
4. *(block)* Chạy backfill 2 lần liên tiếp → nếu `lastfm_backfill_count` tăng gấp đôi thay vì giữ nguyên → sai, quay lại Task 4 sửa logic GREATEST.
5. *(add)* Xem `MusicStatsPage` → xác nhận BarChart/LineChart hiển thị đúng số liệu khớp với DB.
6. *(add)* `go build ./...`, `tsc --noEmit` sạch.

**Prose:** Phép thử quan trọng nhất trong bước verify này là kịch bản chạy backfill 2 lần — đây chính là nơi một lỗi ngữ nghĩa tinh vi (cộng dồn thay vì lấy max) sẽ lộ ra ngay lập tức bằng một con số nhân đôi vô lý, trong khi nếu chỉ test chạy 1 lần thì lỗi này hoàn toàn không thể phát hiện được.

## Notes
- Invoked via: user yêu cầu "claim số liệu nghe của các bài hát và vẽ chart" → research hạ tầng hiện có (Explore agent) → hỏi rõ nguồn dữ liệu → user chọn "cả hai — Last.fm cho lịch sử cũ, tự đếm cho từ giờ" → `/propose`
- App không có khái niệm user/tài khoản (xác nhận qua research) — số liệu là của toàn bộ thư viện, không phân theo người dùng
- Liên quan: [[280526-sqlite-to-postgres]] (search.go/db.go hiện dùng Postgres), scrobble logic hiện có trong `PlayerContext.tsx`

## Origin
- **Draft:** `wiki/sources/draft/020826-music-play-stats-chart-be-fe.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
