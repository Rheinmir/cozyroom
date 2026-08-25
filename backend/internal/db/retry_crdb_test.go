package db

import (
	"database/sql"
	"os"
	"sync"
	"sync/atomic"
	"testing"
)

// TestTransactRetriesOnContention forces a real serialization conflict on a
// live CockroachDB (SERIALIZABLE) and asserts Transact retries through it.
// Skipped unless CRDB_TEST_URL is set, e.g.:
//
//	CRDB_TEST_URL=postgres://root@localhost:26257/cozyroom?sslmode=disable go test ./internal/db -run Contention -v
func TestTransactRetriesOnContention(t *testing.T) {
	url := os.Getenv("CRDB_TEST_URL")
	if url == "" {
		t.Skip("set CRDB_TEST_URL to run against a live CockroachDB")
	}
	sqlDB, err := sql.Open("pgx", url)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer sqlDB.Close()
	if err := sqlDB.Ping(); err != nil {
		t.Fatalf("ping: %v", err)
	}

	if _, err := sqlDB.Exec(`CREATE TABLE IF NOT EXISTS retry_test_kv (k INT PRIMARY KEY, v INT NOT NULL)`); err != nil {
		t.Fatalf("create table: %v", err)
	}
	defer sqlDB.Exec(`DROP TABLE IF EXISTS retry_test_kv`)
	if _, err := sqlDB.Exec(`UPSERT INTO retry_test_kv (k, v) VALUES (1, 0)`); err != nil {
		t.Fatalf("seed: %v", err)
	}

	// Both transactions read k=1, meet at a barrier, then both write k=1.
	// The second committer must fail with 40001 and succeed on retry.
	var totalAttempts int32
	var barrier sync.WaitGroup
	barrier.Add(2)

	run := func() error {
		first := true
		return Transact(sqlDB, func(tx *sql.Tx) error {
			atomic.AddInt32(&totalAttempts, 1)
			var v int
			if err := tx.QueryRow(`SELECT v FROM retry_test_kv WHERE k = 1`).Scan(&v); err != nil {
				return err
			}
			if first {
				first = false
				barrier.Done()
				barrier.Wait() // both txns hold their read before either writes
			}
			_, err := tx.Exec(`UPDATE retry_test_kv SET v = $1 WHERE k = 1`, v+1)
			return err
		})
	}

	errs := make(chan error, 2)
	go func() { errs <- run() }()
	go func() { errs <- run() }()
	for i := 0; i < 2; i++ {
		if err := <-errs; err != nil {
			t.Fatalf("Transact should have retried through 40001, got: %v", err)
		}
	}

	if got := atomic.LoadInt32(&totalAttempts); got <= 2 {
		t.Errorf("expected at least one retry (attempts > 2), got %d", got)
	}
	var final int
	if err := sqlDB.QueryRow(`SELECT v FROM retry_test_kv WHERE k = 1`).Scan(&final); err != nil {
		t.Fatalf("final read: %v", err)
	}
	if final != 2 {
		t.Errorf("serializable correctness: expected v=2 (both increments applied), got %d", final)
	}
}
