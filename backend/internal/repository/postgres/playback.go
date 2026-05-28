package postgres

import (
	"context"
	"database/sql"

	"cozyroom/internal/domain"
)

type PlaybackRepo struct{ DB *sql.DB }

func (r *PlaybackRepo) Get(ctx context.Context, itemType, itemID string) (*domain.PlaybackProgress, error) {
	var p domain.PlaybackProgress
	err := r.DB.QueryRowContext(ctx,
		`SELECT item_type, item_id, position_s, updated_at FROM playback_progress WHERE item_type=$1 AND item_id=$2`,
		itemType, itemID).
		Scan(&p.ItemType, &p.ItemID, &p.PositionS, &p.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *PlaybackRepo) Set(ctx context.Context, p domain.PlaybackProgress) error {
	_, err := r.DB.ExecContext(ctx,
		`INSERT INTO playback_progress (item_type, item_id, position_s, updated_at)
		 VALUES ($1, $2, $3, EXTRACT(EPOCH FROM NOW())::INTEGER)
		 ON CONFLICT(item_type, item_id) DO UPDATE SET
		 	position_s=EXCLUDED.position_s,
		 	updated_at=EXTRACT(EPOCH FROM NOW())::INTEGER`,
		p.ItemType, p.ItemID, p.PositionS)
	return err
}
