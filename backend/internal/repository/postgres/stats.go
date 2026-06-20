package postgres

import (
	"context"
	"database/sql"

	"cozyroom/internal/domain"
)

type StatsRepo struct{ DB *sql.DB }

func (r *StatsRepo) Get(ctx context.Context) (*domain.Stats, error) {
	var s domain.Stats
	err := r.DB.QueryRowContext(ctx,
		`SELECT (SELECT COUNT(*) FROM artists), (SELECT COUNT(*) FROM albums), (SELECT COUNT(*) FROM tracks)`).
		Scan(&s.Artists, &s.Albums, &s.Tracks)
	return &s, err
}
