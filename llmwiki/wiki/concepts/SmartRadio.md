# Smart Radio
**Type:** concept
**Tags:** smart-radio, queue, algorithm, shuffle, genre, sqlite

Mood-aware auto-queue mode that creates smooth genre/artist transitions instead of pure random shuffle. Designed to avoid jarring energy shifts (e.g. rock → classical concerto).

## Notes

### The problem with pure shuffle
Pure `Math.random()` treats all tracks as equally likely next candidates regardless of energy or genre. This produces jarring transitions:
- Rock → Ballad → Concerto → Hip-hop
- User has to manually skip frequently, breaking flow

### Algorithm: weighted random
Each candidate track receives a base score, then multiplied by a uniform random factor [0.5, 1.5]:

```sql
ORDER BY (
    CASE
        WHEN al.artist_id = :current_artist  THEN 8.0   -- familiar voice
        WHEN t.genre = :current_genre        THEN 5.0   -- same genre
        WHEN t.genre LIKE '%'||:genre||'%'   THEN 3.0   -- genre family
        ELSE                                      1.0   -- anything
    END * (0.5 + CAST(ABS(RANDOM()) % 1000 AS REAL) / 1000.0)
) DESC
```

**Effect:** score ranges after noise:
| Category | Base | Range after ×[0.5–1.5] |
|---|---|---|
| Same artist | 8 | 4 – 12 |
| Same genre | 5 | 2.5 – 7.5 |
| Genre family | 3 | 1.5 – 4.5 |
| Unrelated | 1 | 0.5 – 1.5 |

Overlapping ranges mean occasional unrelated tracks break monotony; same-genre tracks mostly stay grouped but aren't locked in a hard block. Result: smooth drift rather than category walls.

### Queue management (frontend)
1. User activates Smart mode → `fillSmartQueue(currentTrack.id)` called immediately
2. API returns 30 tracks in weighted order → appended to existing queue (deduped by ID)
3. When `queue.length - queueIdx < 10`, another fetch is triggered from the current track
4. Queue grows continuously — never runs dry during normal listening

### API
`GET /api/smart-queue?track_id={hex16}&limit={1–100}`

Returns: array of Track objects (id, album_id, title, track_num, duration_s)

### UI states (ShuffleMode)
Button cycles: **off** → **shuffle** (green arrows, pure random) → **smart** (purple ✦ sparkle, genre-aware) → off

### Limitations
- Genre data quality depends on ID3 tags embedded in files. Many tracks lack genre tags — these fall to the `else 1.0` bucket and behave like pure shuffle.
- Artist-based scoring works regardless of genre tags (artist_id always available).
- No BPM/energy analysis — pure metadata-based, no audio fingerprinting.

## Related
- [[concepts/Scanner]] — writes genre field consumed here
- [[sources/tech-stack-decisions]] — SQLite weighted random pattern

## Origin
- **Source:** Implementation; `backend/internal/api/handler.go#smartQueue`, `frontend/src/PlayerContext.tsx`
- **Date:** 2026-05-04
