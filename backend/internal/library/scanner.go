package library

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/dhowden/tag"
)

var (
	reTimestamp = regexp.MustCompile(`_\d{8}_\d{6}$`)
	reTrackNum  = regexp.MustCompile(`^\d+[.\-\s]+`)
	reYouTubeID = regexp.MustCompile(`^[a-zA-Z0-9_-]{11}$`)
)


// cleanTitle strips auto-generated filename patterns: timestamp suffixes and leading track numbers.
func cleanTitle(s string) string {
	s = reTimestamp.ReplaceAllString(s, "")
	s = reTrackNum.ReplaceAllString(strings.TrimSpace(s), "")
	return strings.TrimSpace(s)
}

var audioExts = map[string]bool{
	".mp3": true, ".flac": true, ".m4a": true,
	".ogg": true, ".aac": true, ".wav": true,
	".opus": true, ".webm": true,
}

// Result holds scanner outcome counts.
type Result struct {
	Tracks int
	Errors int
}

// Scan walks musicPath, reads audio metadata, and upserts into the DB.
// Cover art is written to coversDir as {albumID}.jpg.
func Scan(db *sql.DB, musicPath, coversDir string) (Result, error) {
	if err := os.MkdirAll(coversDir, 0755); err != nil {
		return Result{}, fmt.Errorf("create covers dir: %w", err)
	}

	tx, err := db.Begin()
	if err != nil {
		return Result{}, err
	}
	defer tx.Rollback()

	var res Result
	walkErr := filepath.Walk(musicPath, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return err
		}
		if !audioExts[strings.ToLower(filepath.Ext(path))] {
			return nil
		}
		if indexErr := indexFile(tx, path, coversDir); indexErr != nil {
			log.Printf("scanner: skip %s: %v", path, indexErr)
			res.Errors++
		} else {
			res.Tracks++
		}
		return nil
	})
	if walkErr != nil {
		return Result{}, walkErr
	}
	return res, tx.Commit()
}

// IndexFile indexes a single audio file in the database.
func IndexFile(db *sql.DB, path, coversDir string) error {
	if err := os.MkdirAll(coversDir, 0755); err != nil {
		return fmt.Errorf("create covers dir: %w", err)
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := indexFile(tx, path, coversDir); err != nil {
		return err
	}
	return tx.Commit()
}

// IndexFileWithMetadata indexes a single audio file and overrides its tag metadata with the provided values.
func IndexFileWithMetadata(db *sql.DB, path, coversDir, title, artist, album string) error {
	if err := os.MkdirAll(coversDir, 0755); err != nil {
		return fmt.Errorf("create covers dir: %w", err)
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	artistName := strings.TrimSpace(artist)
	if artistName == "" {
		artistName = "Unknown Artist"
	}
	albumTitle := strings.TrimSpace(album)
	if albumTitle == "" {
		albumTitle = "Unknown Album"
	}
	trackTitle := strings.TrimSpace(title)
	if trackTitle == "" {
		trackTitle = cleanTitle(strings.TrimSuffix(filepath.Base(path), filepath.Ext(path)))
	}

	artistID := id8(artistName)
	albumID := id8(artistID + albumTitle)
	trackID := id8(path)

	if _, err := tx.Exec(`INSERT INTO artists(id, name) VALUES($1, $2) ON CONFLICT(id) DO NOTHING`,
		artistID, artistName); err != nil {
		return err
	}

	coverPath := ""
	baseName := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
	if len(baseName) == 11 { // YouTube ID length is exactly 11
		dest := filepath.Join(coversDir, albumID+".jpg")
		if _, statErr := os.Stat(dest); os.IsNotExist(statErr) {
			log.Printf("youtube download cover: fetching thumbnail for video ID %s to %s", baseName, dest)
			go downloadYTThumbnail(baseName, dest)
		}
		coverPath = "/api/covers/" + albumID
	} else {
		// Standard file tag cover extraction
		f, err := os.Open(path)
		if err == nil {
			m, _ := tag.ReadFrom(f)
			if m != nil && m.Picture() != nil {
				dest := filepath.Join(coversDir, albumID+".jpg")
				if _, statErr := os.Stat(dest); os.IsNotExist(statErr) {
					_ = os.WriteFile(dest, m.Picture().Data, 0644)
				}
				coverPath = "/api/covers/" + albumID
			}
			f.Close()
		}
	}

	if _, err := tx.Exec(
		`INSERT INTO albums(id, artist_id, title, year, cover_path) VALUES($1, $2, $3, $4, $5) ON CONFLICT(id) DO NOTHING`,
		albumID, artistID, albumTitle, 0, coverPath,
	); err != nil {
		return err
	}

	_, err = tx.Exec(
		`INSERT INTO tracks(id, album_id, title, track_num, file_path, genre) VALUES($1, $2, $3, $4, $5, $6) ON CONFLICT(id) DO UPDATE SET album_id=excluded.album_id, title=excluded.title, track_num=excluded.track_num, file_path=excluded.file_path, genre=excluded.genre`,
		trackID, albumID, trackTitle, 0, path, "",
	)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func downloadYTThumbnail(ytID, destPath string) {
	urls := []string{
		"https://img.youtube.com/vi/" + ytID + "/maxresdefault.jpg",
		"https://img.youtube.com/vi/" + ytID + "/hqdefault.jpg",
		"https://img.youtube.com/vi/" + ytID + "/mqdefault.jpg",
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	for _, url := range urls {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			continue
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil || resp.StatusCode != http.StatusOK {
			if resp != nil {
				resp.Body.Close()
			}
			continue
		}

		out, err := os.Create(destPath)
		if err != nil {
			resp.Body.Close()
			return
		}

		_, copyErr := io.Copy(out, resp.Body)
		out.Close()
		resp.Body.Close()

		if copyErr == nil {
			log.Printf("youtube download cover: successfully saved cover to %s", destPath)
			return
		}
		os.Remove(destPath)
	}
}

// IsEmpty returns true when the tracks table has no rows.
func IsEmpty(db *sql.DB) bool {
	var n int
	db.QueryRow("SELECT COUNT(*) FROM tracks").Scan(&n)
	return n == 0
}

func indexFile(tx *sql.Tx, path, coversDir string) error {
	base := filepath.Base(path)
	ext := filepath.Ext(base)
	baseNoExt := strings.TrimSuffix(base, ext)
	isYT := len(baseNoExt) == 11 && reYouTubeID.MatchString(baseNoExt)
	isWav := strings.ToLower(ext) == ".wav"
	isMp3Subdir := strings.Contains(filepath.ToSlash(path), "/mp3/")
	if isYT || isWav || isMp3Subdir {
		trackID := id8(path)
		var exists int
		tx.QueryRow(`SELECT 1 FROM tracks WHERE id = $1`, trackID).Scan(&exists)
		if exists == 1 {
			return nil
		}
	}

	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	m, _ := tag.ReadFrom(f) // ignore parse errors — we still index the file

	artistName := "Unknown Artist"
	albumTitle := "Unknown Album"
	trackTitle := cleanTitle(strings.TrimSuffix(filepath.Base(path), filepath.Ext(path)))
	year, trackNum := 0, 0
	var genre string

	if m != nil {
		if v := m.Artist(); v != "" {
			artistName = v
		}
		if v := m.Album(); v != "" {
			albumTitle = v
		}
		if v := m.Title(); v != "" {
			if reTimestamp.MatchString(v) {
				trackTitle = cleanTitle(v)
			} else {
				trackTitle = v
			}
		}
		if v := m.Genre(); v != "" {
			genre = v
		}
		year = m.Year()
		trackNum, _ = m.Track()
	}

	artistID := id8(artistName)
	albumID := id8(artistID + albumTitle)
	trackID := id8(path)

	if _, err := tx.Exec(`INSERT INTO artists(id, name) VALUES($1, $2) ON CONFLICT(id) DO NOTHING`,
		artistID, artistName); err != nil {
		return err
	}

	// Extract and persist cover art once per album.
	coverPath := ""
	if m != nil && m.Picture() != nil {
		dest := filepath.Join(coversDir, albumID+".jpg")
		if _, statErr := os.Stat(dest); os.IsNotExist(statErr) {
			_ = os.WriteFile(dest, m.Picture().Data, 0644)
		}
		coverPath = "/api/covers/" + albumID
	}

	if _, err := tx.Exec(
		`INSERT INTO albums(id, artist_id, title, year, cover_path) VALUES($1, $2, $3, $4, $5) ON CONFLICT(id) DO NOTHING`,
		albumID, artistID, albumTitle, year, coverPath,
	); err != nil {
		return err
	}

	_, err = tx.Exec(
		`INSERT INTO tracks(id, album_id, title, track_num, file_path, genre) VALUES($1, $2, $3, $4, $5, $6) ON CONFLICT(id) DO UPDATE SET album_id=excluded.album_id, title=excluded.title, track_num=excluded.track_num, file_path=excluded.file_path, genre=excluded.genre`,
		trackID, albumID, trackTitle, trackNum, path, genre,
	)
	return err
}

func id8(s string) string {
	h := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(s))))
	return fmt.Sprintf("%x", h[:8])
}
