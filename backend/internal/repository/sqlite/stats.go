package sqlite

import (
	"context"
	"database/sql"

	"cozyroom/internal/domain"
)

// StatsRepo implements domain.StatsRepository.
type StatsRepo struct{ DB *sql.DB }

func (r *StatsRepo) Get(ctx context.Context) (*domain.Stats, error) {
	var s domain.Stats
	r.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM artists").Scan(&s.Artists)
	r.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM albums").Scan(&s.Albums)
	r.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM tracks").Scan(&s.Tracks)
	return &s, nil
}
