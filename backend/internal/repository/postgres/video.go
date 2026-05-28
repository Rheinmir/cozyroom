package postgres

import (
	"context"
	"database/sql"
	"path/filepath"

	"cozyroom/internal/domain"
)

type VideoRepo struct{ q querier }

func NewVideoRepo(db *sql.DB) *VideoRepo { return &VideoRepo{q: db} }

func (r *VideoRepo) List(ctx context.Context) ([]domain.Video, error) {
	rows, err := r.q.QueryContext(ctx, `SELECT id, title, duration_s, size_bytes, file_path, created_at,
		trickplay_ready, COALESCE(poster_path,'') FROM videos ORDER BY title ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.Video
	for rows.Next() {
		var v domain.Video
		var tr int
		if err := rows.Scan(&v.ID, &v.Title, &v.DurationS, &v.SizeBytes, &v.FilePath, &v.CreatedAt, &tr, &v.PosterURL); err != nil {
			return nil, err
		}
		v.TrickplayReady = tr != 0
		v.GroupName = filepath.Base(filepath.Dir(v.FilePath))
		out = append(out, v)
	}
	return out, nil
}

func (r *VideoRepo) GetByID(ctx context.Context, id string) (*domain.Video, error) {
	var v domain.Video
	var tr int
	err := r.q.QueryRowContext(ctx, `SELECT id, title, duration_s, size_bytes, file_path, created_at,
		trickplay_ready, COALESCE(poster_path,'') FROM videos WHERE id=$1`, id).
		Scan(&v.ID, &v.Title, &v.DurationS, &v.SizeBytes, &v.FilePath, &v.CreatedAt, &tr, &v.PosterURL)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	v.TrickplayReady = tr != 0
	return &v, nil
}

func (r *VideoRepo) Upsert(ctx context.Context, v domain.Video) error {
	_, err := r.q.ExecContext(ctx, `
		INSERT INTO videos (id, title, duration_s, size_bytes, file_path)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT(id) DO UPDATE SET
			title=EXCLUDED.title,
			duration_s=EXCLUDED.duration_s,
			size_bytes=EXCLUDED.size_bytes,
			file_path=EXCLUDED.file_path
	`, v.ID, v.Title, v.DurationS, v.SizeBytes, v.FilePath)
	return err
}

func (r *VideoRepo) IsEmpty(ctx context.Context) bool {
	var count int
	_ = r.q.QueryRowContext(ctx, "SELECT COUNT(1) FROM videos").Scan(&count)
	return count == 0
}

func (r *VideoRepo) SetPosterPath(ctx context.Context, id, posterURL string) error {
	_, err := r.q.ExecContext(ctx, `UPDATE videos SET poster_path=$1 WHERE id=$2`, posterURL, id)
	return err
}

func (r *VideoRepo) SetTrickplayReady(ctx context.Context, id string) error {
	_, err := r.q.ExecContext(ctx, `UPDATE videos SET trickplay_ready=1 WHERE id=$1`, id)
	return err
}
