package postgres

import (
	"context"
	"database/sql"
	"cozyroom/internal/domain"
)

type EbookRepo struct{ q querier }

func NewEbookRepo(db *sql.DB) *EbookRepo { return &EbookRepo{q: db} }

func (r *EbookRepo) List(ctx context.Context) ([]domain.Ebook, error) {
	rows, err := r.q.QueryContext(ctx, `
		SELECT id, title, author, format, size_bytes, cover_path, is_nsfw, collection, progress, created_at
		FROM ebooks
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ebooks []domain.Ebook
	for rows.Next() {
		var e domain.Ebook
		var cover sql.NullString
		var nsfw int
		if err := rows.Scan(&e.ID, &e.Title, &e.Author, &e.Format, &e.SizeBytes, &cover, &nsfw, &e.Collection, &e.Progress, &e.CreatedAt); err != nil {
			return nil, err
		}
		if cover.Valid {
			e.CoverURL = cover.String
		}
		e.IsNSFW = nsfw == 1
		ebooks = append(ebooks, e)
	}
	return ebooks, nil
}

func (r *EbookRepo) GetByID(ctx context.Context, id string) (*domain.Ebook, error) {
	var e domain.Ebook
	var cover sql.NullString
	var nsfw int
	err := r.q.QueryRowContext(ctx, `
		SELECT id, title, author, format, size_bytes, file_path, cover_path, is_nsfw, collection, progress, created_at
		FROM ebooks
		WHERE id = $1
	`, id).Scan(&e.ID, &e.Title, &e.Author, &e.Format, &e.SizeBytes, &e.FilePath, &cover, &nsfw, &e.Collection, &e.Progress, &e.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if cover.Valid {
		e.CoverURL = cover.String
	}
	e.IsNSFW = nsfw == 1
	return &e, nil
}

func (r *EbookRepo) Upsert(ctx context.Context, e domain.Ebook) error {
	nsfw := 0
	if e.IsNSFW {
		nsfw = 1
	}
	_, err := r.q.ExecContext(ctx, `
		INSERT INTO ebooks (id, title, author, format, size_bytes, file_path, cover_path, is_nsfw, collection, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT(id) DO UPDATE SET
			title = EXCLUDED.title,
			author = EXCLUDED.author,
			format = EXCLUDED.format,
			size_bytes = EXCLUDED.size_bytes,
			file_path = EXCLUDED.file_path,
			cover_path = EXCLUDED.cover_path
	`, e.ID, e.Title, e.Author, e.Format, e.SizeBytes, e.FilePath, e.CoverURL, nsfw, e.Collection, e.CreatedAt)
	return err
}

func (r *EbookRepo) IsEmpty(ctx context.Context) bool {
	var count int
	r.q.QueryRowContext(ctx, "SELECT COUNT(*) FROM ebooks").Scan(&count)
	return count == 0
}

func (r *EbookRepo) SetNSFW(ctx context.Context, id string, isNSFW bool) error {
	val := 0
	if isNSFW {
		val = 1
	}
	_, err := r.q.ExecContext(ctx, "UPDATE ebooks SET is_nsfw = $1 WHERE id = $2", val, id)
	return err
}

func (r *EbookRepo) SetProgress(ctx context.Context, id string, progress string) error {
	_, err := r.q.ExecContext(ctx, "UPDATE ebooks SET progress = $1 WHERE id = $2", progress, id)
	return err
}

func (r *EbookRepo) SetCollection(ctx context.Context, id string, collection string) error {
	_, err := r.q.ExecContext(ctx, "UPDATE ebooks SET collection = $1 WHERE id = $2", collection, id)
	return err
}
