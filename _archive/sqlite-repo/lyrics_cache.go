package sqlite

import (
	"context"
	"database/sql"
)

// LyricsCacheRepo implements domain.LyricsCacheRepository.
type LyricsCacheRepo struct{ DB *sql.DB }

func (r *LyricsCacheRepo) Get(ctx context.Context, trackID string) (string, error) {
	var jsonData string
	err := r.DB.QueryRowContext(ctx,
		`SELECT results FROM lyrics_cache WHERE track_id = ?`, trackID).Scan(&jsonData)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return jsonData, err
}

func (r *LyricsCacheRepo) Set(ctx context.Context, trackID string, jsonData string) error {
	_, err := r.DB.ExecContext(ctx,
		`INSERT OR REPLACE INTO lyrics_cache (track_id, results, fetched_at)
		 VALUES (?, ?, unixepoch())`, trackID, jsonData)
	return err
}

func (r *LyricsCacheRepo) Delete(ctx context.Context, trackID string) error {
	_, err := r.DB.ExecContext(ctx,
		`DELETE FROM lyrics_cache WHERE track_id = ?`, trackID)
	return err
}
