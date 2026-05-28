package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

type SettingsRepo struct{ DB *sql.DB }

func (r *SettingsRepo) Get(ctx context.Context, key string) (string, error) {
	var val string
	err := r.DB.QueryRowContext(ctx,
		`SELECT value FROM settings WHERE key = $1`, key).Scan(&val)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return val, err
}

func (r *SettingsRepo) Set(ctx context.Context, key, value string) error {
	_, err := r.DB.ExecContext(ctx,
		`INSERT INTO settings (key, value) VALUES ($1, $2)
		 ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value`, key, value)
	return err
}

func (r *SettingsRepo) Delete(ctx context.Context, keys ...string) error {
	if len(keys) == 0 {
		return nil
	}
	placeholders := make([]string, len(keys))
	args := make([]any, len(keys))
	for i, k := range keys {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = k
	}
	_, err := r.DB.ExecContext(ctx,
		`DELETE FROM settings WHERE key IN (`+strings.Join(placeholders, ",")+`)`, args...)
	return err
}
