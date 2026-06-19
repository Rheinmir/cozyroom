package postgres

import (
	"context"
	"database/sql"

	"cozyroom/internal/domain"
)

type AlbumRepo struct{ q querier }

func NewAlbumRepo(db *sql.DB) *AlbumRepo { return &AlbumRepo{q: db} }

func (r *AlbumRepo) List(ctx context.Context, artistID string) ([]domain.Album, error) {
	query := `SELECT al.id, al.artist_id, ar.name, al.title, COALESCE(al.year,0), COALESCE(al.cover_path,''), COALESCE(ar.image_path,'')
	          FROM albums al JOIN artists ar ON ar.id = al.artist_id`
	args := []any{}
	if artistID != "" {
		query += " WHERE al.artist_id = $1"
		args = append(args, artistID)
	}
	query += " ORDER BY ar.name, al.year, al.title"

	rows, err := r.q.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.Album
	for rows.Next() {
		var a domain.Album
		if err := rows.Scan(&a.ID, &a.ArtistID, &a.ArtistName, &a.Title, &a.Year, &a.CoverURL, &a.ArtistImageURL); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (r *AlbumRepo) GetByID(ctx context.Context, id string) (*domain.Album, error) {
	var a domain.Album
	err := r.q.QueryRowContext(ctx,
		`SELECT al.id, al.artist_id, ar.name, al.title, COALESCE(al.year,0), COALESCE(al.cover_path,''), COALESCE(ar.image_path,'')
		 FROM albums al JOIN artists ar ON ar.id = al.artist_id WHERE al.id = $1`, id).
		Scan(&a.ID, &a.ArtistID, &a.ArtistName, &a.Title, &a.Year, &a.CoverURL, &a.ArtistImageURL)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &a, err
}

func (r *AlbumRepo) Upsert(ctx context.Context, a domain.Album) error {
	_, err := r.q.ExecContext(ctx,
		`INSERT INTO albums(id, artist_id, title, year, cover_path) VALUES($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
		a.ID, a.ArtistID, a.Title, a.Year, a.CoverURL)
	return err
}
