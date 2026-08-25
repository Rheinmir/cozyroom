package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

// RDB wraps *sql.DB and auto-converts ? placeholders to $1,$2,... for PostgreSQL.
type RDB struct{ *sql.DB }

func rebind(query string) string {
	if !strings.Contains(query, "?") {
		return query
	}
	n := 1
	var b strings.Builder
	for _, r := range query {
		if r == '?' {
			b.WriteString(fmt.Sprintf("$%d", n))
			n++
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func (db *RDB) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	// Autocommit single statements are safe to retry on 40001 (never committed).
	q := rebind(query)
	var res sql.Result
	err := WithRetry(func() error {
		var execErr error
		res, execErr = db.DB.ExecContext(ctx, q, args...)
		return execErr
	})
	return res, err
}
func (db *RDB) Exec(query string, args ...any) (sql.Result, error) {
	return db.ExecContext(context.Background(), query, args...)
}
func (db *RDB) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	return db.DB.QueryContext(ctx, rebind(query), args...)
}
func (db *RDB) Query(query string, args ...any) (*sql.Rows, error) {
	return db.DB.QueryContext(context.Background(), rebind(query), args...)
}
func (db *RDB) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	return db.DB.QueryRowContext(ctx, rebind(query), args...)
}
func (db *RDB) QueryRow(query string, args ...any) *sql.Row {
	return db.DB.QueryRowContext(context.Background(), rebind(query), args...)
}
func (db *RDB) BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error) {
	return db.DB.BeginTx(ctx, opts)
}
func (db *RDB) Close() error { return db.DB.Close() }
