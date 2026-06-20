package postgres

import (
	"context"
	"database/sql"

	"cozyroom/internal/domain"
)

type ArtistRepo struct{ q querier }

func NewArtistRepo(db *sql.DB) *ArtistRepo { return &ArtistRepo{q: db} }

func (r *ArtistRepo) List(ctx context.Context) ([]domain.Artist, error) {
	rows, err := r.q.QueryContext(ctx,
		"SELECT id, name, COALESCE(image_path,'') FROM artists ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Artist
	for rows.Next() {
		var a domain.Artist
		if err := rows.Scan(&a.ID, &a.Name, &a.ImageURL); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (r *ArtistRepo) GetByID(ctx context.Context, id string) (*domain.Artist, error) {
	var a domain.Artist
	err := r.q.QueryRowContext(ctx,
		`SELECT id, name, COALESCE(image_path,'') FROM artists WHERE id = $1`, id).
		Scan(&a.ID, &a.Name, &a.ImageURL)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *ArtistRepo) GetDetail(ctx context.Context, id string) (*domain.ArtistDetail, error) {
	d := &domain.ArtistDetail{ID: id, Genres: []string{}}
	err := r.q.QueryRowContext(ctx,
		`SELECT a.name,
		        COUNT(DISTINCT al.id),
		        COUNT(DISTINCT t.id)
		 FROM artists a
		 LEFT JOIN albums al ON al.artist_id = a.id
		 LEFT JOIN tracks t  ON t.album_id   = al.id
		 WHERE a.id = $1
		 GROUP BY a.name`, id).
		Scan(&d.Name, &d.AlbumCount, &d.TrackCount)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	rows, _ := r.q.QueryContext(ctx,
		`SELECT DISTINCT t.genre FROM tracks t JOIN albums al ON al.id = t.album_id
		 WHERE al.artist_id = $1 AND t.genre != '' ORDER BY t.genre`, id)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var g string
			rows.Scan(&g)
			d.Genres = append(d.Genres, g)
		}
	}
	return d, nil
}

func (r *ArtistRepo) ListWithoutImage(ctx context.Context) ([]domain.Artist, error) {
	rows, err := r.q.QueryContext(ctx,
		"SELECT id, name FROM artists WHERE image_path = '' OR image_path IS NULL ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Artist
	for rows.Next() {
		var a domain.Artist
		rows.Scan(&a.ID, &a.Name)
		out = append(out, a)
	}
	return out, rows.Err()
}

func (r *ArtistRepo) Upsert(ctx context.Context, a domain.Artist) error {
	_, err := r.q.ExecContext(ctx,
		`INSERT INTO artists(id, name) VALUES($1, $2) ON CONFLICT DO NOTHING`, a.ID, a.Name)
	return err
}

func (r *ArtistRepo) SetImagePath(ctx context.Context, id, imagePath string) error {
	_, err := r.q.ExecContext(ctx,
		"UPDATE artists SET image_path = $1 WHERE id = $2", imagePath, id)
	return err
}
