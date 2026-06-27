#!/usr/bin/env bash
# Migrate data from K8s Postgres → Citus coordinator.
# Run from Node 1 (WSL2) AFTER coordinator + all workers are up.
set -euo pipefail

CITUS_PASSWORD="${CITUS_PASSWORD:-cozyroom-k8s}"
CITUS_DSN="postgres://cozyroom:${CITUS_PASSWORD}@localhost:5432/cozyroom"
DUMP_FILE="/tmp/cozyroom_data_$(date +%Y%m%d_%H%M%S).sql"

echo "=== Step 1: Register workers + distribute tables ==="
psql "${CITUS_DSN}" -f "$(dirname "$0")/citus_setup.sql"

echo "=== Step 2: Wait for coordinator to see all workers ==="
psql "${CITUS_DSN}" -c "SELECT * FROM pg_dist_node;"

echo "=== Step 3: pg_dump from K8s postgres via port-forward ==="
kubectl port-forward -n cozyroom-k8s postgres-0 15432:5432 &
PF_PID=$!
trap "kill ${PF_PID} 2>/dev/null || true" EXIT
sleep 4

pg_dump \
  -h 127.0.0.1 -p 15432 \
  -U cozyroom -d cozyroom \
  --data-only --no-owner --no-privileges \
  --disable-triggers \
  > "${DUMP_FILE}"

echo "Dump: ${DUMP_FILE} ($(du -sh "${DUMP_FILE}" | cut -f1))"

echo "=== Step 4: Restore data to Citus ==="
# Disable FK triggers (Citus doesn't use them, but --disable-triggers sets session_replication_role)
psql "${CITUS_DSN}" \
  -c "SET session_replication_role = 'replica';" \
  -f "${DUMP_FILE}"

echo "=== Step 5: Verify row counts ==="
psql "${CITUS_DSN}" -c "
SELECT table_name, count
FROM (VALUES
  ('artists',              (SELECT COUNT(*) FROM artists)),
  ('albums',               (SELECT COUNT(*) FROM albums)),
  ('tracks',               (SELECT COUNT(*) FROM tracks)),
  ('videos',               (SELECT COUNT(*) FROM videos)),
  ('ebooks',               (SELECT COUNT(*) FROM ebooks)),
  ('playback_progress',    (SELECT COUNT(*) FROM playback_progress)),
  ('chat_logs',            (SELECT COUNT(*) FROM chat_logs))
) t(table_name, count);
"

echo "=== Migration complete. Update k8s/db-adapter.yaml then: kubectl apply -f k8s/db-adapter.yaml ==="
