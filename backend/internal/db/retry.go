package db

import (
	"database/sql"
	"errors"
	"math/rand"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

// retryMaxAttempts bounds WithRetry. CockroachDB runs SERIALIZABLE by default
// (QĐ2B), so concurrent transactions can fail with SQLSTATE 40001; a 40001
// means the transaction never committed, so retrying is always safe.
const retryMaxAttempts = 5

// IsRetryable reports whether err is a serialization failure (SQLSTATE 40001).
func IsRetryable(err error) bool {
	if err == nil {
		return false
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "40001"
	}
	s := err.Error()
	return strings.Contains(s, "SQLSTATE 40001") || strings.Contains(s, "restart transaction")
}

// WithRetry runs fn, retrying serialization failures with exponential
// backoff + jitter. fn must not have side effects outside the DB (it may run
// multiple times).
func WithRetry(fn func() error) error {
	var err error
	for attempt := 0; attempt < retryMaxAttempts; attempt++ {
		if err = fn(); !IsRetryable(err) {
			return err
		}
		time.Sleep(time.Duration(50<<attempt)*time.Millisecond +
			time.Duration(rand.Intn(50))*time.Millisecond)
	}
	return err
}

// Transact runs fn inside a transaction, retrying the whole transaction on
// serialization failure. fn must not have side effects outside the DB.
func Transact(sqlDB *sql.DB, fn func(*sql.Tx) error) error {
	return WithRetry(func() error {
		tx, err := sqlDB.Begin()
		if err != nil {
			return err
		}
		defer tx.Rollback()
		if err := fn(tx); err != nil {
			return err
		}
		return tx.Commit()
	})
}
