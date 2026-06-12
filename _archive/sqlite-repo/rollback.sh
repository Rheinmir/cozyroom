#!/usr/bin/env bash
# Rollback: restore sqlite repository package
# Run from repo root: bash _archive/sqlite-repo/rollback.sh

set -euo pipefail

DEST="backend/internal/repository/sqlite"

if [ -d "$DEST" ]; then
  echo "ERROR: $DEST already exists — remove it first"
  exit 1
fi

mkdir -p "$DEST"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for f in "$SCRIPT_DIR"/*.go; do
  cp "$f" "$DEST/"
  echo "restored: $DEST/$(basename "$f")"
done

echo ""
echo "Restored. Re-add driver dependency if needed:"
echo "  go get modernc.org/sqlite"
echo "  go mod tidy"
