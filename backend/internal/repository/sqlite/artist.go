package sqlite

import (
	"context"
	"database/sql"

	"cozyroom/internal/domain"
)

// ArtistRepo implements domain.ArtistRepository.
type ArtistRepo struct{ q querier }

// NewArtistRepo creates a repo backed by the given DB (read path).
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
	err := r.q.QueryRowContext(ctx, `SELECT id, name, COALESCE(image_path,'') FROM artists WHERE id = ?`, id).
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
	var name string
	if err := r.q.QueryRowContext(ctx, `SELECT name FROM artists WHERE id = ?`, id).Scan(&name); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	d := &domain.ArtistDetail{ID: id, Name: name, Genres: []string{}}

	r.q.QueryRowContext(ctx, `SELECT COUNT(*) FROM albums WHERE artist_id = ?`, id).Scan(&d.AlbumCount)
	r.q.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM tracks t JOIN albums al ON al.id = t.album_id WHERE al.artist_id = ?`, id).Scan(&d.TrackCount)

	rows, _ := r.q.QueryContext(ctx,
		`SELECT DISTINCT t.genre FROM tracks t JOIN albums al ON al.id = t.album_id
		 WHERE al.artist_id = ? AND t.genre != '' ORDER BY t.genre`, id)
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
		`INSERT OR IGNORE INTO artists(id, name) VALUES(?, ?)`, a.ID, a.Name)
	return err
}

func (r *ArtistRepo) SetImagePath(ctx context.Context, id, imagePath string) error {
	_, err := r.q.ExecContext(ctx,
		"UPDATE artists SET image_path = ? WHERE id = ?", imagePath, id)
	return err
}
