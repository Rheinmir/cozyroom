package db

import (
	"errors"
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestIsRetryable(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"nil", nil, false},
		{"plain error", errors.New("boom"), false},
		{"pgconn 40001", &pgconn.PgError{Code: "40001"}, true},
		{"pgconn other", &pgconn.PgError{Code: "23505"}, false},
		{"wrapped pgconn 40001", fmt.Errorf("exec: %w", &pgconn.PgError{Code: "40001"}), true},
		{"string SQLSTATE 40001", errors.New("ERROR: restart transaction: ... (SQLSTATE 40001)"), true},
		{"string restart transaction", errors.New("restart transaction: read within uncertainty interval"), true},
	}
	for _, c := range cases {
		if got := IsRetryable(c.err); got != c.want {
			t.Errorf("%s: IsRetryable = %v, want %v", c.name, got, c.want)
		}
	}
}

func TestWithRetrySucceedsAfterRetries(t *testing.T) {
	attempts := 0
	err := WithRetry(func() error {
		attempts++
		if attempts < 3 {
			return &pgconn.PgError{Code: "40001"}
		}
		return nil
	})
	if err != nil {
		t.Fatalf("expected success, got: %v", err)
	}
	if attempts != 3 {
		t.Errorf("expected 3 attempts, got %d", attempts)
	}
}

func TestWithRetryStopsOnNonRetryable(t *testing.T) {
	attempts := 0
	wantErr := errors.New("permanent")
	err := WithRetry(func() error {
		attempts++
		return wantErr
	})
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected permanent error, got: %v", err)
	}
	if attempts != 1 {
		t.Errorf("expected 1 attempt (no retry on non-retryable), got %d", attempts)
	}
}

func TestWithRetryGivesUpAfterMaxAttempts(t *testing.T) {
	attempts := 0
	err := WithRetry(func() error {
		attempts++
		return &pgconn.PgError{Code: "40001"}
	})
	if !IsRetryable(err) {
		t.Fatalf("expected the final 40001 to surface, got: %v", err)
	}
	if attempts != retryMaxAttempts {
		t.Errorf("expected %d attempts, got %d", retryMaxAttempts, attempts)
	}
}
