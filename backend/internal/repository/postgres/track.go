package postgres

import (
	"context"
	"crypto/rand"
	"database/sql"
	"fmt"

	"cozyroom/internal/domain"
)

type TrackRepo struct{ q querier }

func NewTrackRepo(db *sql.DB) *TrackRepo { return &TrackRepo{q: db} }

func (r *TrackRepo) List(ctx context.Context, albumID string) ([]domain.Track, error) {
	query := `SELECT t.id, t.album_id, t.title, COALESCE(t.track_num,0), COALESCE(t.duration_s,0), ar.name, al.title, ar.id
	          FROM tracks t JOIN albums al ON al.id = t.album_id JOIN artists ar ON ar.id = al.artist_id`
	args := []any{}
	if albumID != "" {
		query += " WHERE t.album_id = $1"
		args = append(args, albumID)
	}
	query += " ORDER BY t.track_num, t.title"

	rows, err := r.q.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.Track
	for rows.Next() {
		var t domain.Track
		if err := rows.Scan(&t.ID, &t.AlbumID, &t.Title, &t.TrackNum, &t.DurationS, &t.ArtistName, &t.AlbumTitle, &t.ArtistID); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *TrackRepo) GetByID(ctx context.Context, id string) (*domain.Track, error) {
	var t domain.Track
	err := r.q.QueryRowContext(ctx,
		`SELECT t.id, t.album_id, t.title, COALESCE(t.track_num,0), COALESCE(t.duration_s,0), ar.name, al.title, ar.id
		 FROM tracks t JOIN albums al ON al.id = t.album_id JOIN artists ar ON ar.id = al.artist_id
		 WHERE t.id = $1`, id).
		Scan(&t.ID, &t.AlbumID, &t.Title, &t.TrackNum, &t.DurationS, &t.ArtistName, &t.AlbumTitle, &t.ArtistID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *TrackRepo) GetMeta(ctx context.Context, id string) (*domain.TrackMeta, error) {
	var m domain.TrackMeta
	err := r.q.QueryRowContext(ctx, `
		SELECT t.file_path, t.title, ar.name, al.title, COALESCE(t.duration_s, 0)
		FROM tracks t
		JOIN albums al ON al.id = t.album_id
		JOIN artists ar ON ar.id = al.artist_id
		WHERE t.id = $1`, id).
		Scan(&m.FilePath, &m.Title, &m.Artist, &m.Album, &m.DurationS)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *TrackRepo) GetFilePath(ctx context.Context, id string) (string, error) {
	var fp string
	err := r.q.QueryRowContext(ctx, "SELECT file_path FROM tracks WHERE id = $1", id).Scan(&fp)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return fp, err
}

// SmartQueue picks the next tracks to queue, biased same-artist > same-genre >
// similar-genre > random — same priority weights as before (8:5:3:1), but
// computed as 4 small indexed lookups instead of one ORDER BY over every row
// in the library (see llmwiki postmortem 2026-07-12, "SmartQueue O(N log N)").
// A tier that returns fewer than its proportional share (e.g. an artist with
// only 2 tracks) rolls its shortfall into the next tier's target, so the
// total still reaches `limit` and one prolific artist can't crowd out the
// genre-diversity the original single-query version provided.
func (r *TrackRepo) SmartQueue(ctx context.Context, trackID string, limit int) ([]domain.Track, error) {
	var genre, artistID string
	err := r.q.QueryRowContext(ctx,
		`SELECT COALESCE(t.genre,''), al.artist_id
		 FROM tracks t JOIN albums al ON al.id = t.album_id
		 WHERE t.id = $1`, trackID).Scan(&genre, &artistID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	const trackCols = `t.id, t.album_id, t.title, COALESCE(t.track_num,0), COALESCE(t.duration_s,0), ar.name, al.title, ar.id`
	const trackJoin = `FROM tracks t JOIN albums al ON al.id = t.album_id JOIN artists ar ON ar.id = al.artist_id`

	seen := map[string]bool{trackID: true}
	var out []domain.Track

	// fetch runs one tier's query capped at `want` rows, appending any
	// not-already-seen results to out, and returns how many it actually got.
	fetch := func(want int, query string, args ...any) (int, error) {
		if want <= 0 {
			return 0, nil
		}
		rows, err := r.q.QueryContext(ctx, query, append(args, want)...)
		if err != nil {
			return 0, err
		}
		defer rows.Close()
		got := 0
		for rows.Next() {
			var t domain.Track
			if err := rows.Scan(&t.ID, &t.AlbumID, &t.Title, &t.TrackNum, &t.DurationS, &t.ArtistName, &t.AlbumTitle, &t.ArtistID); err != nil {
				return got, err
			}
			if seen[t.ID] {
				continue
			}
			seen[t.ID] = true
			out = append(out, t)
			got++
		}
		return got, rows.Err()
	}

	// Proportional split of `limit` across the 4 priority tiers (weights 8:5:3:1
	// match the old CASE scores); tier 4 absorbs the rounding remainder.
	target1 := limit * 8 / 17
	target2 := limit * 5 / 17
	target3 := limit * 3 / 17
	target4 := limit - target1 - target2 - target3

	// Tier 1 — same artist. Indexed via idx_albums_artist_id.
	got, err := fetch(target1,
		`SELECT `+trackCols+` `+trackJoin+`
		 WHERE al.artist_id = $1 AND t.id != $2
		 ORDER BY RANDOM() LIMIT $3`,
		artistID, trackID)
	if err != nil {
		return nil, err
	}
	carry := target1 - got

	// Tier 2 — exact genre match. Indexed via idx_tracks_genre.
	want2 := target2 + carry
	got2 := 0
	if genre != "" {
		got2, err = fetch(want2,
			`SELECT `+trackCols+` `+trackJoin+`
			 WHERE t.genre = $1 AND t.id != $2
			 ORDER BY RANDOM() LIMIT $3`,
			genre, trackID)
		if err != nil {
			return nil, err
		}
	}
	carry = want2 - got2

	// Tier 3 — similar genre. Indexed via idx_tracks_genre_trgm (pg_trgm GIN).
	want3 := target3 + carry
	got3 := 0
	if genre != "" {
		got3, err = fetch(want3,
			`SELECT `+trackCols+` `+trackJoin+`
			 WHERE t.genre != '' AND t.genre % $1 AND t.id != $2
			 ORDER BY RANDOM() LIMIT $3`,
			genre, trackID)
		if err != nil {
			return nil, err
		}
	}
	carry = want3 - got3

	// Tier 4 — random fallback across the whole library, absorbing any
	// shortfall from the tiers above (e.g. no genre tagged, or a lone track
	// by its artist). This tier alone is still an O(N log N) sort, same as
	// the old query — but it only runs, and only for the leftover slots,
	// when the indexed tiers above didn't already fill `limit`.
	want4 := target4 + carry
	if _, err := fetch(want4,
		`SELECT `+trackCols+` `+trackJoin+`
		 WHERE t.id != $1
		 ORDER BY RANDOM() LIMIT $2`,
		trackID); err != nil {
		return nil, err
	}

	return out, nil
}

func (r *TrackRepo) IsEmpty(ctx context.Context) bool {
	var n int
	r.q.QueryRowContext(ctx, "SELECT COUNT(*) FROM tracks").Scan(&n)
	return n == 0
}

// RecordPlay logs one completed listen as a new row (not an update) — see
// track_plays schema comment in db.go for why append-only.
func (r *TrackRepo) RecordPlay(ctx context.Context, trackID string) error {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	id := fmt.Sprintf("%x", b)
	_, err := r.q.ExecContext(ctx,
		`INSERT INTO track_plays (id, track_id) VALUES ($1, $2)`, id, trackID)
	return err
}

// genreKeyExpr normalizes raw ID3 genre tags for grouping: real libraries tag
// the same genre inconsistently (Pop / POP, V-POP / V.POP / V_POP), which
// without normalization renders as near-duplicate tiles side by side in the
// Browse-by-genre grid. Stripping punctuation/case merges those variants.
const genreKeyExpr = `upper(regexp_replace(%s, '[^a-zA-Z0-9]+', '', 'g'))`

// ListGenres returns every distinct genre in the library (grouped by
// genreKeyExpr, displayed as the most common raw spelling within the group),
// with a track count and a representative cover (the cover of the album
// that has the most tracks tagged with that genre), ordered by track count
// desc.
func (r *TrackRepo) ListGenres(ctx context.Context) ([]domain.Genre, error) {
	rows, err := r.q.QueryContext(ctx, fmt.Sprintf(`
		WITH g AS (
			SELECT genre, COUNT(*) AS cnt, `+genreKeyExpr+` AS key
			FROM tracks
			WHERE genre != ''
			GROUP BY genre
		), ranked AS (
			SELECT key, genre AS display_name, cnt,
			       SUM(cnt) OVER (PARTITION BY key)                              AS total_cnt,
			       ROW_NUMBER() OVER (PARTITION BY key ORDER BY cnt DESC, genre) AS rn
			FROM g
		)
		SELECT key, display_name, total_cnt FROM ranked WHERE rn = 1 ORDER BY total_cnt DESC`, "genre"))
	if err != nil {
		return nil, err
	}
	type genreRow struct {
		key, name string
		count     int
	}
	var list []genreRow
	for rows.Next() {
		var g genreRow
		if err := rows.Scan(&g.key, &g.name, &g.count); err != nil {
			rows.Close()
			return nil, err
		}
		list = append(list, g)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	covers := map[string]string{}
	coverRows, err := r.q.QueryContext(ctx, fmt.Sprintf(`
		SELECT DISTINCT ON (key) key, cover_path FROM (
			SELECT `+genreKeyExpr+` AS key, COALESCE(al.cover_path,'') AS cover_path,
			       al.id, COUNT(*) AS cnt
			FROM tracks t JOIN albums al ON al.id = t.album_id
			WHERE t.genre != ''
			GROUP BY key, al.id, al.cover_path
		) x
		ORDER BY key, (cover_path != '') DESC, cnt DESC`, "t.genre"))
	if err == nil {
		for coverRows.Next() {
			var key, cover string
			if err := coverRows.Scan(&key, &cover); err != nil {
				coverRows.Close()
				return nil, err
			}
			covers[key] = cover
		}
		coverRows.Close()
		if err := coverRows.Err(); err != nil {
			return nil, err
		}
	}

	out := make([]domain.Genre, 0, len(list))
	for _, g := range list {
		out = append(out, domain.Genre{Name: g.name, TrackCount: g.count, CoverURL: covers[g.key]})
	}
	return out, nil
}

// GetByGenre returns the albums and tracks tagged with the given genre,
// for the Browse-by-genre click-through in Search. Matches via genreKeyExpr
// so it captures every raw spelling variant grouped under that tile by
// ListGenres, not just the one exact string shown as its display name.
func (r *TrackRepo) GetByGenre(ctx context.Context, genre string) (*domain.GenreDetail, error) {
	d := &domain.GenreDetail{Albums: []domain.SearchAlbum{}, Tracks: []domain.SearchTrack{}}
	genreKey := fmt.Sprintf(genreKeyExpr, "$1")

	rows, err := r.q.QueryContext(ctx,
		`SELECT DISTINCT al.id, al.artist_id, ar.name, al.title, COALESCE(al.year,0), COALESCE(al.cover_path,'')
		 FROM albums al JOIN artists ar ON ar.id = al.artist_id JOIN tracks t ON t.album_id = al.id
		 WHERE `+fmt.Sprintf(genreKeyExpr, "t.genre")+` = `+genreKey+` ORDER BY al.title`, genre)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var a domain.SearchAlbum
		if err := rows.Scan(&a.ID, &a.ArtistID, &a.ArtistName, &a.Title, &a.Year, &a.CoverURL); err != nil {
			rows.Close()
			return nil, err
		}
		d.Albums = append(d.Albums, a)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = r.q.QueryContext(ctx,
		`SELECT t.id, t.album_id, al.title, t.title, COALESCE(t.track_num,0), ar.name, COALESCE(t.duration_s,0), ar.id
		 FROM tracks t JOIN albums al ON al.id = t.album_id JOIN artists ar ON ar.id = al.artist_id
		 WHERE `+fmt.Sprintf(genreKeyExpr, "t.genre")+` = `+genreKey+` ORDER BY t.title LIMIT 200`, genre)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var t domain.SearchTrack
		if err := rows.Scan(&t.ID, &t.AlbumID, &t.AlbumTitle, &t.Title, &t.TrackNum, &t.ArtistName, &t.DurationS, &t.ArtistID); err != nil {
			return nil, err
		}
		d.Tracks = append(d.Tracks, t)
	}
	return d, rows.Err()
}

func (r *TrackRepo) Upsert(ctx context.Context, t domain.Track) error {
	_, err := r.q.ExecContext(ctx,
		`INSERT INTO tracks(id, album_id, title, track_num, file_path, genre) VALUES($1, $2, $3, $4, $5, $6)
		 ON CONFLICT(id) DO UPDATE SET
		 	album_id=EXCLUDED.album_id, title=EXCLUDED.title, track_num=EXCLUDED.track_num,
		 	file_path=EXCLUDED.file_path, genre=EXCLUDED.genre`,
		t.ID, t.AlbumID, t.Title, t.TrackNum, t.FilePath, t.Genre)
	return err
}
