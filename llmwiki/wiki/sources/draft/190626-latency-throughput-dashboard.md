# 190626-latency-throughput-dashboard
**Type:** draft
**Status:** proposed
**Tags:** orca-workflow, docs-site-macos, output-report
**Proposed:** 2026-06-19

## What
Created a macOS-style performance dashboard estimating Cozyroom's latency and throughput before/after session fixes.

## Output
- `llmwiki/html/190626-latency-throughput-dashboard.html` — full dashboard, 5 sections, KPI cards, SVG charts, gauge bars, fix timeline

## Content Sections
| Section | Topic |
|---------|-------|
| 01 · Tổng quan | Architecture diagram: Browser → CF Edge → Cloudflared → nginx → Go → PG |
| 02 · Latency | Horizontal bar chart before/after per endpoint + comparison table |
| 03 · Streaming | TTFB comparison lossless 1st/2nd+ vs 320kbps transcode |
| 04 · Throughput | Capacity gauges (Go/PG/bandwidth/disk) + max concurrent streams |
| 05 · Cải thiện hôm nay | 6 fix cards with before→after numbers and % improvement |

## Estimates summary
| Endpoint | Before | After | Mechanism |
|----------|--------|-------|-----------|
| /api/artists, /stats | ~350ms | ~0ms | SW StaleWhileRevalidate |
| /api/albums/{id} | ~350ms | ~10ms | new single-row endpoint |
| YT search (cached) | ~3500ms | ~100ms | debounce + in-memory cache |
| Audio 2nd+ (CF cached) | ~350ms | ~20ms | Cache-Control: public |
| Deploy downtime | 5–15s | 0s | readinessProbe + maxUnavailable:0 |

## Files
| File | Action |
|------|--------|
| `llmwiki/html/190626-latency-throughput-dashboard.html` | created |
| `llmwiki/wiki/sources/draft/190626-latency-throughput-dashboard.md` | created |

## Notes
- Invoked via: `/orca-workflow` + `/docs-site-macos` skills
- Served at: `http://localhost:8765/190626-latency-throughput-dashboard.html`
- Bottleneck: home upload bandwidth (100 Mbps → max ~71 FLAC concurrent streams)
- CF edge caching for lossless audio is the highest-leverage fix (17× latency, saves bandwidth for repeated plays)
- 320kbps transcode cannot be CF-cached (streaming response, no Content-Length); future option: pre-transcode + store

## Origin
- **Draft:** `wiki/sources/draft/190626-latency-throughput-dashboard.md`
- **Commit:** _(filled by verify-before-commit)_
- **Date promoted:** _(filled by verify-before-commit)_
