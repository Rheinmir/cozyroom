#!/bin/sh
# Run inside the backend pod: fixes missing YouTube covers by downloading from YT CDN
# Input via stdin: "filepath | album_id" lines

COVERS_DIR="/data/covers"
count=0; fixed=0; already=0

while IFS='|' read -r filepath album_id; do
  filepath=$(echo "$filepath" | tr -d ' ')
  album_id=$(echo "$album_id" | tr -d ' ')
  [ -z "$album_id" ] && continue
  count=$((count+1))

  dest="${COVERS_DIR}/${album_id}.jpg"
  if [ -f "$dest" ]; then
    already=$((already+1))
    continue
  fi

  # extract ytid from filename (strip directory + extension)
  fname="${filepath##*/}"
  ytid="${fname%.*}"

  ok=0
  for url in \
    "https://img.youtube.com/vi/${ytid}/maxresdefault.jpg" \
    "https://img.youtube.com/vi/${ytid}/hqdefault.jpg" \
    "https://img.youtube.com/vi/${ytid}/mqdefault.jpg"; do
    wget -q --timeout=15 -O "$dest" "$url" 2>/dev/null || true
    # check JPEG magic ffd8
    if [ -s "$dest" ]; then
      magic=$(dd if="$dest" bs=2 count=1 2>/dev/null | od -A n -t x1 | tr -d ' \n')
      if [ "$magic" = "ffd8" ]; then
        echo "OK $ytid"
        ok=1; fixed=$((fixed+1)); break
      fi
    fi
    rm -f "$dest"
  done

  [ $ok -eq 0 ] && echo "FAIL $ytid"
done

echo "---"
echo "Done: $fixed fixed, $already already existed, $count total"
