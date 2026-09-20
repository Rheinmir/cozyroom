# 050626-fix-playback-sql-bugs
**Type:** draft
**Status:** proposed
**Tags:** orca-workflow, output-report, bugfix
**Proposed:** 2026-06-05

## Agent Task Assignment
| Task | Agent | Status |
|------|-------|--------|
| Fix PIPELINE_ERROR_DECODE (mono/stereo mid-stream) | Claude Code | done |
| Fix trending SQL SQLSTATE 42601 (? vs $N) | Claude Code | done |
| Fix all remaining ? → $N across playlists, ai, mcp, cron, lyrics, aitrends | Claude Code | done |
| Fix date format bug "2006-05-02" in cron/registry | Claude Code | done |

## What
Fixed 2 active bugs found in production playback error reports + trending logs: Chrome decode error from mixed mono/stereo FLAC, and PostgreSQL SQLSTATE 42601 from SQLite-style `?` placeholders left over from the SQLite→PostgreSQL migration.

## Output
- `transcode.go`: Added `-ac 2` to `ToMP3_320` and `ToCleanFLAC` (changed copy→re-encode) to normalize stereo output
- `enricher/github.go`: Fixed `?` → `$N` in `SaveTrendingSnapshot` and `BackfillStarHistory`
- `api/trending.go`: Fixed `?` → `$N` in `listTrending` and `repoHistory`
- `api/playlists.go`: Fixed 7 queries with `?`
- `api/ai.go`: Fixed 6 queries including dynamic WHERE (counter pattern)
- `api/lyrics.go`: Fixed 1 query
- `enricher/aitrends.go`: Fixed 2 queries
- `internal/cron/cron.go`: Fixed `?` + wrong date format `"2006-05-02"` → `"2006-01-02"`
- `internal/mcp/registry.go`: Fixed 12 queries including dynamic WHERE + same date format bug

## Files
| File | Action |
|------|--------|
| `backend/internal/transcode/transcode.go` | modified |
| `backend/internal/enricher/github.go` | modified |
| `backend/internal/api/trending.go` | modified |
| `backend/internal/api/playlists.go` | modified |
| `backend/internal/api/ai.go` | modified |
| `backend/internal/api/lyrics.go` | modified |
| `backend/internal/enricher/aitrends.go` | modified |
| `backend/internal/cron/cron.go` | modified |
| `backend/internal/mcp/registry.go` | modified |

## Notes
- Invoked via: `/orca-workflow` skill
- Trigger: user reported FE→BE error reports from `POST /api/playback/error`
- Track `a2aae6a22978c42a` (FLAC) has mixed mono/stereo frames — Chrome emits `PIPELINE_ERROR_DECODE: Channels: 1 vs 2`
- Trending error `SQLSTATE 42601` fired every ~6h (cron refresh cycle)
- All `?` bugs are from incomplete SQLite→PostgreSQL migration (commit 5c48e08)

## Origin
- **Draft:** `wiki/draft/orca/050626-fix-playback-sql-bugs.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
