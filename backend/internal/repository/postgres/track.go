package postgres

import (
	"context"
	"database/sql"

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

	rows, err := r.q.QueryContext(ctx, `
		SELECT t.id, t.album_id, t.title, COALESCE(t.track_num,0), COALESCE(t.duration_s,0), ar.name, al.title, ar.id
		FROM tracks t JOIN albums al ON al.id = t.album_id JOIN artists ar ON ar.id = al.artist_id
		WHERE t.id != $1
		ORDER BY (
			CASE
				WHEN al.artist_id = $2                                        THEN 8.0
				WHEN t.genre != '' AND t.genre = $3                           THEN 5.0
				WHEN t.genre != '' AND $3 != '' AND (
					t.genre ILIKE '%' || $3 || '%' OR $3 ILIKE '%' || t.genre || '%'
				)                                                             THEN 3.0
				ELSE 1.0
			END * (0.5 + RANDOM())
		) DESC
		LIMIT $4`,
		trackID, artistID, genre, limit,
	)
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

func (r *TrackRepo) IsEmpty(ctx context.Context) bool {
	var n int
	r.q.QueryRowContext(ctx, "SELECT COUNT(*) FROM tracks").Scan(&n)
	return n == 0
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
