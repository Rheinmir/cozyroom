package api

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"cozyroom/internal/db"
)

type BackupInfo struct {
	Filename  string    `json:"filename"`
	SizeBytes int64     `json:"size_bytes"`
	CreatedAt time.Time `json:"created_at"`
}

func (h *handlers) backupDB(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	backupPath, err := db.PerformBackup(h.scanDB, "")
	if err != nil {
		log.Printf("[API] Backup failed: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":   "success",
		"filename": filepath.Base(backupPath),
		"path":     backupPath,
	})
}

func (h *handlers) listDBBackups(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	backupsDir := db.GetBackupsDir("")
	entries, err := os.ReadDir(backupsDir)
	if os.IsNotExist(err) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]BackupInfo{})
		return
	} else if err != nil {
		log.Printf("[API] Failed to read backups dir: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var backups []BackupInfo
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasPrefix(entry.Name(), "metadata_auto_") && strings.HasSuffix(entry.Name(), ".db") {
			info, err := entry.Info()
			if err != nil {
				continue
			}
			backups = append(backups, BackupInfo{
				Filename:  entry.Name(),
				SizeBytes: info.Size(),
				CreatedAt: info.ModTime(),
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(backups)
}

func (h *handlers) restoreDB(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Try reading filename from request body JSON or query parameters
	var reqBody struct {
		Filename string `json:"filename"`
	}
	
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&reqBody)
	}

	filename := reqBody.Filename
	if filename == "" {
		filename = r.URL.Query().Get("filename")
	}

	if filename == "" {
		http.Error(w, "Missing filename", http.StatusBadRequest)
		return
	}

	// Sanitize filename to prevent directory traversal
	filename = filepath.Base(filename)
	if !strings.HasPrefix(filename, "metadata_auto_") || !strings.HasSuffix(filename, ".db") {
		http.Error(w, "Invalid backup filename format", http.StatusBadRequest)
		return
	}

	backupsDir := db.GetBackupsDir("")
	backupPath := filepath.Join(backupsDir, filename)

	if _, err := os.Stat(backupPath); os.IsNotExist(err) {
		http.Error(w, "Backup file does not exist", http.StatusNotFound)
		return
	}

	log.Printf("[API] Initiating restore from backup: %s", backupPath)

	err := db.RestoreFromBackup(h.scanDB, backupPath)
	if err != nil {
		log.Printf("[API] Restore failed: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": "Database successfully restored from " + filename,
	})
}
