package sqlite

import (
	"context"
	"database/sql"
	"strings"
)

// SettingsRepo implements domain.SettingsRepository.
type SettingsRepo struct{ DB *sql.DB }

func (r *SettingsRepo) Get(ctx context.Context, key string) (string, error) {
	var val string
	err := r.DB.QueryRowContext(ctx,
		`SELECT value FROM settings WHERE key = ?`, key).Scan(&val)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return val, err
}

func (r *SettingsRepo) Set(ctx context.Context, key, value string) error {
	_, err := r.DB.ExecContext(ctx,
		`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, key, value)
	return err
}

func (r *SettingsRepo) Delete(ctx context.Context, keys ...string) error {
	if len(keys) == 0 {
		return nil
	}
	placeholders := make([]string, len(keys))
	args := make([]any, len(keys))
	for i, k := range keys {
		placeholders[i] = "?"
		args[i] = k
	}
	_, err := r.DB.ExecContext(ctx,
		`DELETE FROM settings WHERE key IN (`+strings.Join(placeholders, ",")+`)`, args...)
	return err
}
