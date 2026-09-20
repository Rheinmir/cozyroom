---
type: draft
title: Chuyển Cozyroom sang kiến trúc BASE (Basically Available, Soft state, Eventually consistent)
status: proposed
tags: [base, availability, soft-state, eventual-consistency, architecture, be, fe]
timestamp: 2026-07-10
---

# 100726-base-architecture-be-fe
**Type:** draft
**Status:** proposed

> **Update 2026-07-10 (cùng ngày):** từng tạm park khi user redirect sang [[100726-cockroachdb-migration-db]], nhưng **un-park** sau khi user cho biết thực tế vận hành: "cả 3 máy hàng tuần vẫn có thể restart vài ngày". CRDB RF=3 chỉ chịu được 1 máy nghỉ — khi 2/3 máy nghỉ chồng lấn (kịch bản thường trực), softstate serve-stale + outbox của draft này là lớp duy nhất giữ app sống. Vai trò mới: **phase sau CRDB migration**, không phải phương án thay thế.
**Tags:** base, availability, soft-state, eventual-consistency, architecture
**Proposed:** 2026-07-10
**Sequence diagram:** [html/100726-base-architecture-seq.html](../../../html/100726-base-architecture-seq.html)

## What
Chuyển Cozyroom từ mô hình "mọi request phụ thuộc Postgres sống" sang triết lý **BASE**: đọc luôn trả được dữ liệu (dù cũ), ghi không quan trọng được nhận ngay rồi đồng bộ dần, DB chết không kéo sập app — hiện thực hoá quyết định đã ghi trong [[CapConsistency]] (chọn A thay vì C).

## Hiện trạng — đã BASE ở đâu, chưa BASE ở đâu

| Tầng | Hiện trạng | Đánh giá |
|------|-----------|----------|
| FE (Workbox SW) | StaleWhileRevalidate cho covers/artists/albums/stats, NetworkFirst 4s cho tracks/search | ✅ đã BASE một nửa |
| BE read path | Handler → PgBouncer → Postgres trực tiếp, DB chết → **500 toàn bộ API** | ❌ chưa |
| BE write path | Mọi POST ghi đồng bộ vào Postgres, DB chết → **mất write** (progress, scrobble) | ❌ chưa |
| Hợp đồng degradation | Không có — client không biết dữ liệu là fresh hay stale | ❌ chưa |

Nghĩa là: người dùng đã mở app rồi thì SW che được phần nào, nhưng user mới / cache miss / mọi write đều chết theo Postgres. BASE thật sự phải nằm ở backend.

## Affected

| File / Symbol | How it changes |
|---------------|---------------|
| `backend/internal/softstate/` (MỚI) | Package cache đọc: TTL fresh 60s, giữ bản stale không giới hạn tuổi, serve-stale khi DB lỗi |
| `backend/internal/outbox/` (MỚI) | Package write-behind: queue in-memory + persist JSONL `/data/outbox/`, flusher retry backoff |
| `backend/internal/api/routes.go` | Wrap các GET nóng (artists, albums, tracks, stats, search, trending, playlists) qua softstate; chuyển 4 route soft-write sang outbox |
| `backend/internal/api/handler.go` | Các handler GET nóng nhận cache layer; header `X-Data-Freshness: fresh\|stale` |
| `backend/internal/api/` (playback, lastfm, ebook handlers) | `POST /api/playback/progress`, `/api/playback/error`, `/api/lastfm/scrobble`, `/api/ebooks/{id}/progress` → enqueue outbox, trả **202** |
| `frontend/src/api.ts` | Đọc header `X-Data-Freshness`, expose trạng thái freshness |
| `frontend/src/components/` (1 component nhỏ MỚI) | Badge "⏳ dữ liệu tạm thời cũ" khi backend đang degraded |

**KHÔNG đổi:** schema Postgres, PgBouncer/db-adapter, k8s manifests, các write cứng (playlists CRUD, AI memory, NSFW flag, lyrics save — vẫn synchronous vì user cần read-your-writes ngay).

## Risks

- **Read-your-writes vỡ:** tạo playlist xong, GET playlists có thể trả bản cache cũ → softstate phải **invalidate theo key** ngay khi write cùng domain thành công.
- **At-least-once → ghi trùng:** playback progress là upsert (idempotent, an toàn); lastfm scrobble cần idempotency theo `(track, timestamp)` để không scrobble đôi khi retry.
- **Outbox mất khi pod chết:** queue in-memory phải persist JSONL vào `/data` (PV đã mount sẵn trên node backend); replay khi pod khởi động lại.
- **RAM backend tăng:** cache stale phải cap số entry (LRU, ~vài nghìn key), không cache response stream/audio.
- **Bài học sw2.js ([[180626-sw-blank-page-cf-cache]]):** T3 chỉ đụng `api.ts` + component, **không đụng precache/tên SW** — tránh lặp sự cố blank page.
- **Chaos test T4 đụng hạ tầng thật** (scale postgres về 0 trên K3s) → chỉ chạy khi user xác nhận, không đụng PVC/data, tuân thủ rule bảo vệ DB trong CLAUDE.md.

## Plan

- [ ] **T1 — BE softstate read cache:** package `internal/softstate` (get/set TTL 60s, giữ stale vô hạn, LRU cap); wrap GET nóng; DB lỗi → trả bản stale + `X-Data-Freshness: stale`; write thành công → invalidate key cùng domain. Verify: unit test + tắt DB local → GET vẫn 200.
- [ ] **T2 — BE outbox write-behind:** package `internal/outbox` (enqueue → append JSONL `/data/outbox/pending.jsonl` → 202; flusher goroutine batch-flush 5s, retry backoff, replay lúc boot); áp cho 4 route soft-write. Verify: tắt DB → POST 202, file JSONL có dòng; bật DB → flush sạch.
- [ ] **T3 — FE freshness indicator:** `api.ts` đọc header, badge nhỏ khi stale; không đụng service worker config. Verify: mock header → badge hiện/ẩn đúng.
- [ ] **T4 — Chaos verify BASE end-to-end:** scale `postgres` → 0: browse OK (stale), progress 202; scale → 1: outbox flush ≤60s, số liệu khớp. Verify: script đo + screenshot, ghi kết quả vào wiki.

## Agent Task Assignment

| Task | Agent (CLI) | Lý do chọn | Status |
|------|-------------|------------|--------|
| T1 — softstate read cache | Claude main (claude-fable-5) | Đụng shared core `routes.go`/`handler.go`, cần context wiki + impact-check — không giao CLI rẻ | pending |
| T2 — outbox write-behind | Claude main (claude-fable-5) | Logic durability/idempotency dễ sai âm thầm, rủi ro mất write — cần model mạnh nhất | pending |
| T3 — FE freshness badge | Claude main (claude-fable-5) | Nhỏ, nhưng dính `api.ts` (shared, 37 components dùng) — đi cùng phiên T1 để khớp header contract | pending |
| T4 — chaos verify | Claude main (claude-fable-5) | Đụng hạ tầng K3s thật, cần tuân thủ rule bảo vệ DB, user giám sát | pending |

Tất cả trên một agent vì cả 4 task xoay quanh một hợp đồng chung (header freshness + semantics 202) — tách agent rẻ sẽ tốn phí đồng bộ hợp đồng hơn phí token tiết kiệm được. HTML seq page do Claude render trực tiếp (standalone `/propose`).

## Success criteria

- Postgres tắt → `GET /api/artists` trả **200** + `X-Data-Freshness: stale` (thay vì 500).
- Postgres tắt → `POST /api/playback/progress` trả **202**, dòng tương ứng xuất hiện trong `/data/outbox/pending.jsonl`.
- Postgres bật lại → outbox flush hết trong ≤60s, `play_count`/progress khớp số request đã gửi (không mất, không trùng).
- DB khỏe mạnh → hành vi y hệt hiện tại: response fresh, latency cộng thêm không đáng kể (<1ms), toàn bộ test/typecheck pass.
- FE hiện badge stale khi degraded, tự ẩn khi fresh trở lại.

## Notes
- [[CapConsistency]] — quyết định gốc: chọn A (Availability)
- [[160626-db-architecture-review]] — SPOF Postgres, adapter layer
- [[200626-db-antipattern]] — triết lý "DB bare metal, ghét master-slave"; BASE ở tầng app là hướng thay thế cho HA phức tạp ở tầng DB
- [[CozyArchitecture]] — topology K3s hiện tại

## Origin
- **Draft:** `wiki/sources/draft/100726-base-architecture-be-fe.md`
- **Source:** yêu cầu user 2026-07-10: "planning chuyển dự án sang kiến trúc BASE"
- **Commit:** _(filled by `verify-before-commit`)_
- **Date promoted:** _(filled by `verify-before-commit`)_
