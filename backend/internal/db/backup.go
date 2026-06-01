package db

import (
	"database/sql"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const (
	MaxBackups = 10
)

// GetBackupsDir returns the directory path for database backups.
func GetBackupsDir(dbPath string) string {
	return filepath.Join(filepath.Dir(dbPath), "backups")
}

// PerformBackup is a no-op for PostgreSQL. Use pg_dump for backups.
func PerformBackup(db *sql.DB, dbPath string) (string, error) {
	return "", nil
}

// PruneBackups keeps only the last MaxBackups backups.
func PruneBackups(dbPath string) error {
	backupsDir := GetBackupsDir(dbPath)
	entries, err := os.ReadDir(backupsDir)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}

	var backupFiles []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasPrefix(entry.Name(), "metadata_auto_") && strings.HasSuffix(entry.Name(), ".db") {
			backupFiles = append(backupFiles, filepath.Join(backupsDir, entry.Name()))
		}
	}

	// Sort alphabetically (chronological sorting based on timestamp)
	sort.Strings(backupFiles)

	if len(backupFiles) > MaxBackups {
		toDelete := backupFiles[:len(backupFiles)-MaxBackups]
		for _, file := range toDelete {
			if err := os.Remove(file); err != nil {
				log.Printf("[Database] Failed to delete old backup %s: %v", file, err)
			} else {
				log.Printf("[Database] Pruned old backup %s", file)
			}
		}
	}

	return nil
}

// VerifyAndRecover is a no-op for PostgreSQL.
func VerifyAndRecover(dbPath string) error {
	return nil
}

func restoreLatestBackup(dbPath string) error {
	backupsDir := GetBackupsDir(dbPath)
	entries, err := os.ReadDir(backupsDir)
	if os.IsNotExist(err) || len(entries) == 0 {
		return fmt.Errorf("no database backups available to restore from")
	}
	if err != nil {
		return fmt.Errorf("failed to read backups directory: %w", err)
	}

	var backupFiles []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasPrefix(entry.Name(), "metadata_auto_") && strings.HasSuffix(entry.Name(), ".db") {
			backupFiles = append(backupFiles, filepath.Join(backupsDir, entry.Name()))
		}
	}

	if len(backupFiles) == 0 {
		return fmt.Errorf("no database backups found")
	}

	// Sort alphabetically to get chronological order (latest is last)
	sort.Strings(backupFiles)
	latestBackup := backupFiles[len(backupFiles)-1]

	log.Printf("[Database] Found latest valid backup: %s", latestBackup)

	// Rename the current corrupted database to prevent overwriting/loss of original file
	timestamp := time.Now().Format("20060102_150405")
	corruptedRename := dbPath + ".corrupted_" + timestamp
	if err := os.Rename(dbPath, corruptedRename); err != nil {
		log.Printf("[Database] Warning: failed to rename corrupted database: %v", err)
	} else {
		log.Printf("[Database] Renamed corrupted database to %s", corruptedRename)
	}

	// Copy backup to dbPath
	if err := copyFile(latestBackup, dbPath); err != nil {
		return fmt.Errorf("failed to copy backup to db path: %w", err)
	}

	log.Printf("[Database] SUCCESS: Restored database from backup %s", latestBackup)
	return nil
}

// RestoreFromBackup attaches the backup database, clears the main tables, and copies
// data schema-resiliently (matching columns only) to prevent migration mismatch issues.
func RestoreFromBackup(db *sql.DB, backupPath string) error {
	// 1. Attach database (MUST be outside transaction)
	attachQuery := fmt.Sprintf("ATTACH DATABASE '%s' AS backup_db;", strings.ReplaceAll(backupPath, "'", "''"))
	if _, err := db.Exec(attachQuery); err != nil {
		return fmt.Errorf("failed to attach backup db: %w", err)
	}
	defer func() {
		_, _ = db.Exec("DETACH DATABASE backup_db;")
	}()

	// 2. Start transaction
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 3. Disable foreign keys during copy
	if _, err := tx.Exec("PRAGMA foreign_keys = OFF;"); err != nil {
		return fmt.Errorf("failed to disable foreign keys: %w", err)
	}

	// 4. Retrieve list of tables from main database
	rows, err := tx.Query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
	if err != nil {
		return fmt.Errorf("failed to list tables: %w", err)
	}
	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			rows.Close()
			return err
		}
		tables = append(tables, name)
	}
	rows.Close()

	// 5. Schema-resilient copy for each table
	for _, table := range tables {
		// Clean the main table first
		if _, err := tx.Exec(fmt.Sprintf("DELETE FROM main.%s;", table)); err != nil {
			return fmt.Errorf("failed to clear table main.%s: %w", table, err)
		}

		// Find column intersection to support older/newer backup schemas
		mainCols, err := getTableColumns(tx, "main.", table)
		if err != nil {
			return fmt.Errorf("failed to get columns for main.%s: %w", table, err)
		}
		backupCols, err := getTableColumns(tx, "backup_db.", table)
		if err != nil {
			// If table is missing in backup, just log and skip copying data (keep it empty)
			log.Printf("[Database] Warning: table %s is missing in backup, keeping it empty", table)
			continue
		}

		commonMap := make(map[string]bool)
		for _, c := range backupCols {
			commonMap[c] = true
		}

		var colsToCopy []string
		for _, c := range mainCols {
			if commonMap[c] {
				colsToCopy = append(colsToCopy, c)
			}
		}

		if len(colsToCopy) == 0 {
			log.Printf("[Database] Warning: no common columns for table %s, skipping", table)
			continue
		}

		colsStr := strings.Join(colsToCopy, ", ")
		insertQuery := fmt.Sprintf("INSERT INTO main.%s (%s) SELECT %s FROM backup_db.%s;", table, colsStr, colsStr, table)
		if _, err := tx.Exec(insertQuery); err != nil {
			return fmt.Errorf("failed to restore table data for %s: %w", table, err)
		}
	}

	// 6. Enable foreign keys back
	if _, err := tx.Exec("PRAGMA foreign_keys = ON;"); err != nil {
		return fmt.Errorf("failed to enable foreign keys: %w", err)
	}

	// 7. Commit
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit restore: %w", err)
	}

	log.Printf("[Database] Restore complete from %s", backupPath)
	return nil
}

func getTableColumns(tx *sql.Tx, schemaPrefix, tableName string) ([]string, error) {
	// PRAGMA table_info returns columns: cid, name, type, notnull, dflt_value, pk
	query := fmt.Sprintf("PRAGMA %stable_info(%s);", schemaPrefix, tableName)
	rows, err := tx.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var columns []string
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull int
		var dfltVal interface{}
		var pk int
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dfltVal, &pk); err != nil {
			return nil, err
		}
		columns = append(columns, name)
	}
	return columns, nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err = io.Copy(out, in); err != nil {
		return err
	}
	return out.Sync()
}
