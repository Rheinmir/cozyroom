package db

import (
	"os"
	"path/filepath"
	"testing"
)

func TestVerifyAndRecoverHealthy(t *testing.T) {
	t.Skip("legacy SQLite-era test — backup.go predates the Postgres migration and cannot run against pgx")
	tempDir, err := os.MkdirTemp("", "sqlite-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	dbPath := filepath.Join(tempDir, "test.db")
	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	db.Close()

	// Verify database passes integrity check
	err = VerifyAndRecover(dbPath)
	if err != nil {
		t.Errorf("expected no error from VerifyAndRecover for healthy DB, got: %v", err)
	}
}

func TestBackupAndPruning(t *testing.T) {
	t.Skip("legacy SQLite-era test — backup.go predates the Postgres migration and cannot run against pgx")
	tempDir, err := os.MkdirTemp("", "sqlite-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	dbPath := filepath.Join(tempDir, "test.db")
	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	// Test PerformBackup
	backupPath, err := PerformBackup(db.DB, dbPath)
	if err != nil {
		t.Fatalf("expected backup to succeed, got: %v", err)
	}

	if _, err := os.Stat(backupPath); os.IsNotExist(err) {
		t.Errorf("expected backup file to exist at %s, but it does not", backupPath)
	}

	// Test Pruning by creating 12 backups
	for i := 0; i < 12; i++ {
		_, err := PerformBackup(db.DB, dbPath)
		if err != nil {
			t.Fatalf("expected backup #%d to succeed, got: %v", i, err)
		}
	}

	// Check if only MaxBackups (10) exist
	backupsDir := GetBackupsDir(dbPath)
	entries, err := os.ReadDir(backupsDir)
	if err != nil {
		t.Fatalf("failed to read backups dir: %v", err)
	}

	count := 0
	for _, entry := range entries {
		if !entry.IsDir() && filepath.Ext(entry.Name()) == ".db" {
			count++
		}
	}

	if count > MaxBackups {
		t.Errorf("expected at most %d backups after pruning, found %d", MaxBackups, count)
	}
}

func TestRestoreFromBackup(t *testing.T) {
	t.Skip("legacy SQLite-era test — backup.go predates the Postgres migration and cannot run against pgx")
	tempDir, err := os.MkdirTemp("", "sqlite-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	dbPath := filepath.Join(tempDir, "test.db")
	dbInst, err := Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}

	// Insert dummy data
	_, err = dbInst.Exec(`INSERT INTO settings (key, value) VALUES ('test_key', 'value_v1');`)
	if err != nil {
		dbInst.Close()
		t.Fatalf("failed to insert dummy data: %v", err)
	}

	// Perform backup
	backupPath, err := PerformBackup(dbInst.DB, dbPath)
	if err != nil {
		dbInst.Close()
		t.Fatalf("failed to perform backup: %v", err)
	}

	// Modify settings table in original db
	_, err = dbInst.Exec(`UPDATE settings SET value = 'value_v2' WHERE key = 'test_key';`)
	if err != nil {
		dbInst.Close()
		t.Fatalf("failed to update data: %v", err)
	}

	// Verify it was updated
	var val string
	err = dbInst.QueryRow("SELECT value FROM settings WHERE key = 'test_key'").Scan(&val)
	if err != nil || val != "value_v2" {
		dbInst.Close()
		t.Fatalf("failed to verify updated data: %v", err)
	}

	// Restore from backup
	err = RestoreFromBackup(dbInst.DB, backupPath)
	if err != nil {
		dbInst.Close()
		t.Fatalf("failed to restore database: %v", err)
	}

	// Verify it was rolled back to v1
	err = dbInst.QueryRow("SELECT value FROM settings WHERE key = 'test_key'").Scan(&val)
	if err != nil {
		dbInst.Close()
		t.Errorf("failed to retrieve value after restore: %v", err)
	}
	if val != "value_v1" {
		t.Errorf("expected value to be 'value_v1' after restore, got: %q", val)
	}

	dbInst.Close()
}
