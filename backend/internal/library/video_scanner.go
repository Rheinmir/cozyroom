package library

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"io/fs"
	"path/filepath"
	"strings"

	"cozyroom/internal/domain"
	repo "cozyroom/internal/repository/sqlite"
)

// ensure id8 can be shared or redefine locally
func id8Video(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:4])
}

func ScanVideos(db *sql.DB, filmsDir string) error {
	videosRepo := repo.NewVideoRepo(db)

	return filepath.WalkDir(filmsDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // skip errors
		}
		if d.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(path))
		if ext == ".mp4" || ext == ".mkv" || ext == ".ts" || ext == ".avi" {
			info, err := d.Info()
			if err != nil {
				return nil
			}
			
			title := strings.TrimSuffix(d.Name(), filepath.Ext(d.Name()))
			
			v := domain.Video{
				ID:        id8Video(path),
				Title:     title,
				DurationS: 0,
				SizeBytes: info.Size(),
				FilePath:  path,
			}
			
			videosRepo.Upsert(context.Background(), v)
		}
		return nil
	})
}
