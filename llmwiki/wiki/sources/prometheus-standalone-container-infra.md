---
name: Prometheus Standalone Container
description: Move Prometheus and Grafana from WSL systemd to a standalone Docker Compose stack in ~/observability/, reusable across all projects
type: source
status: draft
---

# Proposal: Prometheus + Grafana as Standalone Docker Stack

**Request:** Tách Prometheus ra khỏi home-spotify, chạy như Docker container độc lập, dùng được cho nhiều project khác.

## Files affected

| File/Service | Change |
|---|---|
| `/etc/systemd/system/prometheus.service` | Disable + stop |
| `/etc/systemd/system/grafana-server.service` | Disable + stop |
| `/etc/prometheus/prometheus.yml` | Migrate → `~/observability/prometheus.yml` (bind mount) |
| `/var/lib/prometheus/` (214 MB) | Migrate → Docker named volume |
| `/var/lib/grafana/` | Migrate → Docker named volume |
| `home-spotify/docker-compose.yml` | No change needed |

## Breakage risks

- Port conflicts: 9090 (Prometheus) and 3001 (Grafana) — must stop systemd services first
- Grafana saved dashboards/datasources must be migrated from `/var/lib/grafana/`
- Prometheus needs `network_mode: host` to reach WSL localhost services (18080, 9100, etc.)

## Chosen approach: `network_mode: host`

Simpler for local WSL dev — no scrape config changes needed, all `localhost:XXXX` targets continue working. Grafana also uses host network so datasource URL stays `http://localhost:9090`.

## Implementation plan

1. Create `~/observability/` directory
2. Copy `/etc/prometheus/prometheus.yml` → `~/observability/prometheus.yml`
3. Copy existing TSDB data: `sudo cp -a /var/lib/prometheus/ ~/observability/prometheus-data/`
4. Copy Grafana data: `sudo cp -a /var/lib/grafana/ ~/observability/grafana-data/`
5. Write `~/observability/docker-compose.yml` with Prometheus + Grafana, both `network_mode: host`
6. Stop and disable systemd services
7. `docker compose up -d` in `~/observability/`
8. Verify targets + Grafana login

## Success criteria

- `curl http://localhost:9090/api/v1/targets` → `home-spotify: up`, `wsl-node-exporter: up`
- Grafana accessible at `http://localhost:3001`, existing datasources intact
- 214 MB historical data preserved
- `systemctl is-active prometheus` → `inactive`
- Adding new project = edit `~/observability/prometheus.yml` + `docker compose restart prometheus`
