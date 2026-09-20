# Grafana Dashboard Best Practices: Lessons Learned

**Type:** source
**Date:** 2026-06-08
**Tags:** grafana, prometheus, dashboard, monitoring, ops

## Environment
- Grafana 11.5.3
- Prometheus 2.x
- Dashboards: Node Exporter Full (rYdddlPWk), Cadvisor (pMEd7m0Mz), Docker Container (4dMaCsRZz), Prometheus Overview (ffodrsh84r0n4d), PostgreSQL (v5ciIbUZz), Cozyroom Infra (cozyroom-infra-v2)

---

## Variable Gotchas in Grafana 11

### Query variables with empty options → "Select value" / no data

Grafana 11 changed behavior: a query-type variable with `options: []` shows "Select value" and doesn't auto-select, causing ALL panels to show "No data".

**Symptoms:**
- Dashboard loads, variable dropdown shows "Select value"
- All panels blank even though Prometheus has data

**Fix — switch to `custom` type when values are known:**
```json
{
  "type": "custom",
  "query": "k8s2-demo,master-wsl2,k8s1-jenkins",
  "options": [
    {"selected": true, "text": "k8s2-demo", "value": "k8s2-demo"},
    ...
  ]
}
```

**Fix — for dynamic values, use proper query:**
```
label_values(container_last_seen{instance="$host",name!=""}, name)
```
NOT the old wildcard form: `label_values({__name__=~"container.*"}, name)` — fails in Grafana 11.

### `ds_prometheus` variable (Node Exporter Full)

All panels in Node Exporter Full use `${ds_prometheus}` as datasource UID. If this variable is unset, ALL 40+ panels fail silently.

**Fix:** Set as datasource type variable:
```json
{
  "name": "ds_prometheus",
  "type": "datasource",
  "query": "prometheus",
  "current": {
    "text": "Prometheus",
    "value": "<actual-datasource-uid>"
  }
}
```

Get UID: `GET /api/datasources` → find Prometheus entry → copy `uid`.

---

## Dashboard schemaVersion Compatibility

### schemaVersion 14 (legacy, `rows[]` structure)
Old dashboards (Prometheus Overview, pre-2018 imports) use:
```json
{
  "schemaVersion": 14,
  "rows": [
    {
      "panels": [ ... ]
    }
  ]
}
```

NOT `panels[]` at root level. Must iterate `rows[].panels[]` when patching via API.

### Prometheus 1.x vs 2.x metric names
Old dashboards use `http_requests_total` etc. — Prometheus 2.x uses different names.
Patch datasource refs but metrics may still return no data for old dashboards.

---

## Grafana API Patterns

### Get dashboard
```python
GET /api/dashboards/uid/{uid}
# Returns: {"dashboard": {...}, "meta": {...}}
```

### Save dashboard
```python
POST /api/dashboards/db
{
  "dashboard": {...},  # modified dashboard object
  "folderId": 0,
  "overwrite": true
}
```

### Update variable in dashboard via API
```python
dash = GET /api/dashboards/uid/{uid}
d = dash['dashboard']
for v in d['templating']['list']:
    if v['name'] == 'host':
        v['query'] = 'k8s2-demo,master-wsl2,k8s1-jenkins'
        v['options'].append({'selected': False, 'text': 'k8s1-jenkins', 'value': 'k8s1-jenkins'})
POST /api/dashboards/db  # with modified d
```

### Datasource UID
Always use object form in panel `datasource` field:
```json
{"type": "prometheus", "uid": "ffoazqldn8jk0b"}
```
NOT string form: `"datasource": "Prometheus"` — breaks in Grafana 11.

---

## Common "No Data" Root Causes

| Root Cause | Symptom | Fix |
|-----------|---------|-----|
| Wrong job name in panel queries | Data missing for specific panels | Update `job=` matchers in all expressions |
| `ds_prometheus` variable unset | ALL panels fail | Fix datasource variable type + current value |
| Container variable query fails | Cadvisor container dropdown empty | Use `label_values(container_last_seen{...}, name)` |
| Dashboard uses old job names | Panels show no data after rename | Bulk replace job matchers via API |
| Panel datasource = string not object | Panels fail silently | Convert to `{type, uid}` object |
| Legacy `rows[]` structure | API patch doesn't find panels | Iterate `rows[].panels[]` not `panels[]` |
| Stale TSDB series (30d retention) | Old series still appear in queries | Wait 30d or use `tombstone` API |

---

## Prometheus Job Naming Convention

### Bad (host-specific)
```yaml
job_name: k8s2-node      # → job="k8s2-node"
job_name: k8s2-cadvisor  # → job="k8s2-cadvisor"
```

### Good (generic + instance label)
```yaml
job_name: node
static_configs:
  - targets: ["100.114.107.68:9100"]
    labels:
      instance: k8s2-demo

job_name: cadvisor
static_configs:
  - targets: ["100.114.107.68:8888"]
    labels:
      instance: k8s2-demo
  - targets: ["100.97.8.41:8888"]
    labels:
      instance: k8s1-jenkins
```

Dashboard queries then use `job="node"` + `instance=~"$node"` — works for any number of hosts.

---

## Backup Before Editing

Always back up current dashboard JSON before API patching:
```python
import json
dash = GET /api/dashboards/uid/{uid}
with open(f'backup_{uid}.json', 'w') as f:
    json.dump(dash, f, indent=2)
```

Grafana also has built-in version history: **Dashboard → ⋮ → Version History**.

---

## Origin
- **Source:** Session 2026-06-07/08, fixing all 6 Grafana dashboards post K8S2 migration
- **Commit:** _(filled by verify-before-commit)_
