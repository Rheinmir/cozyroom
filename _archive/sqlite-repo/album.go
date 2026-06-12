package sqlite

import (
	"context"
	"database/sql"

	"cozyroom/internal/domain"
)

// AlbumRepo implements domain.AlbumRepository.
type AlbumRepo struct{ q querier }

// NewAlbumRepo creates a repo backed by the given DB (read path).
func NewAlbumRepo(db *sql.DB) *AlbumRepo { return &AlbumRepo{q: db} }

func (r *AlbumRepo) List(ctx context.Context, artistID string) ([]domain.Album, error) {
	query := `SELECT al.id, al.artist_id, ar.name, al.title, COALESCE(al.year,0), COALESCE(al.cover_path,''), COALESCE(ar.image_path,'')
	          FROM albums al JOIN artists ar ON ar.id = al.artist_id`
	args := []any{}
	if artistID != "" {
		query += " WHERE al.artist_id = ?"
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

func (r *AlbumRepo) Upsert(ctx context.Context, a domain.Album) error {
	_, err := r.q.ExecContext(ctx,
		`INSERT OR IGNORE INTO albums(id, artist_id, title, year, cover_path) VALUES(?, ?, ?, ?, ?)`,
		a.ID, a.ArtistID, a.Title, a.Year, a.CoverURL)
	return err
}
