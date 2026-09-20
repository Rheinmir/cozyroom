# Homelab Music Setup — Brainstorm Notes
**Type:** source
**Tags:** navidrome, docker, wsl2, prometheus, grafana, reference

Quick-storm notes on a Navidrome + Prometheus + Grafana music homelab stack running in Docker/WSL2, streaming from a Windows music folder. Serves as prior-art reference for the Cozyroom project.

## Notes

### Original Stack (reference, not adopted)
- **Navidrome** — music server with FLAC/MP3 support, auto-scans ID3 tags
- **Prometheus** — container metrics collection
- **Node Exporter** — WSL2/host resource metrics
- **Grafana** — monitoring dashboard (import dashboard ID `1860` for Node Exporter Full)

### Key WSL2 Mount Pattern
Windows folder `D:\Music` is accessible inside WSL2/Docker as `/mnt/d/Music`.
```yaml
volumes:
  - /mnt/d/Music:/music:ro
```
This pattern is reused in [[tech-stack-decisions]].

### Navidrome Ports
- Music UI: `http://localhost:4533`
- Grafana: `http://localhost:3000`

### Mobile Clients (Subsonic-compatible)
- **Substreamer** (iOS)
- **Amperfy** (iOS)

### Decision
Cozyroom is a custom build instead of Navidrome, to have full control over UI/API. The Docker volume mount pattern and WSL2 approach are directly carried over.

## Origin
- **Source:** `quickStorm.md` (root, now deleted)
- **Date:** 2026-05-03
