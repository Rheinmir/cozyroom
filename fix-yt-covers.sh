#!/bin/bash
set -euo pipefail

COVERS_DIR="/tmp/k8s-cozyroom-data/covers"
TSV="/tmp/yt_tracks.tsv"

count=0; fixed=0; already=0

while IFS='|' read -r filepath album_id; do
  filepath=$(echo "$filepath" | xargs)
  album_id=$(echo "$album_id" | xargs)
  [ -z "$album_id" ] && continue
  count=$((count+1))

  dest="${COVERS_DIR}/${album_id}.jpg"
  if [ -f "$dest" ]; then
    already=$((already+1))
    continue
  fi

  fname="${filepath##*/}"
  ytid="${fname%.*}"

  ok=0
  for url in \
    "https://img.youtube.com/vi/${ytid}/maxresdefault.jpg" \
    "https://img.youtube.com/vi/${ytid}/hqdefault.jpg" \
    "https://img.youtube.com/vi/${ytid}/mqdefault.jpg"; do
    wget -q --timeout=10 -O "$dest" "$url" 2>/dev/null || true
    # check JPEG magic bytes ffd8
    if [ -s "$dest" ] && python3 -c "import sys; d=open('$dest','rb').read(2); sys.exit(0 if d==b'\\xff\\xd8' else 1)" 2>/dev/null; then
      echo "OK $ytid → $album_id"
      ok=1; fixed=$((fixed+1)); break
    fi
    rm -f "$dest"
  done
  [ $ok -eq 0 ] && echo "FAIL $ytid"
done < "$TSV"

echo "Done: $fixed fixed, $already already existed, $count total"
