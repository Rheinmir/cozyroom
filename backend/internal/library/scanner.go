package library

import (
	"crypto/sha256"
	"database/sql"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

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

	durS := probeDuration(path)
	_, err = tx.Exec(
		`INSERT INTO tracks(id, album_id, title, track_num, duration_s, file_path, genre) VALUES($1, $2, $3, $4, $5, $6, $7) ON CONFLICT(id) DO UPDATE SET album_id=EXCLUDED.album_id, title=EXCLUDED.title, track_num=EXCLUDED.track_num, duration_s=EXCLUDED.duration_s, file_path=EXCLUDED.file_path, genre=EXCLUDED.genre`,
		trackID, albumID, trackTitle, 0, durS, path, "",
	)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// probeDuration calls ffprobe to get audio duration in seconds. Returns 0 on error.
func probeDuration(path string) int {
	out, err := exec.Command("ffprobe",
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1",
		path,
	).Output()
	if err != nil {
		return 0
	}
	f, err := strconv.ParseFloat(strings.TrimSpace(string(out)), 64)
	if err != nil {
		return 0
	}
	return int(f)
}

// DownloadYTThumbnail fetches a YouTube thumbnail synchronously to destPath.
func DownloadYTThumbnail(ytID, destPath string) { downloadYTThumbnail(ytID, destPath) }

// AlbumID returns the album ID that would be assigned to an artist+title pair.
func AlbumID(artist, title string) string { return id8(id8(artist) + title) }

func downloadYTThumbnail(ytID, destPath string) {
	urls := []string{
		"https://img.youtube.com/vi/" + ytID + "/maxresdefault.jpg",
		"https://img.youtube.com/vi/" + ytID + "/hqdefault.jpg",
		"https://img.youtube.com/vi/" + ytID + "/mqdefault.jpg",
	}

	for _, url := range urls {
		resp, err := http.Get(url)
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
		
		_, err = io.Copy(out, resp.Body)
		out.Close()
		resp.Body.Close()
		
		if err == nil {
			log.Printf("youtube download cover: successfully saved cover to %s", destPath)
			return
		}
	}
}

// ReconcileResult holds the outcome of a reconciliation run.
type ReconcileResult struct {
	Removed int // DB entries removed because file missing on disk
	Added   int // files found on disk that were not in DB
	Errors  int
}

// ReconcileLibrary ensures DB and disk are in sync:
//   - Removes DB track entries whose file_path no longer exists on disk.
//   - Indexes audio files found on disk that have no DB entry.
//
// Safe to run at any time; all SQL uses ON CONFLICT semantics.
func ReconcileLibrary(db *sql.DB, musicPath, coversDir string) ReconcileResult {
	var res ReconcileResult

	// ── Pass 1: DB → disk (remove orphan DB entries) ──────────────────────────
	rows, err := db.Query(`SELECT id, file_path FROM tracks`)
	if err != nil {
		log.Printf("reconcile: query tracks: %v", err)
		res.Errors++
		return res
	}
	type entry struct{ id, path string }
	var all []entry
	for rows.Next() {
		var e entry
		if rows.Scan(&e.id, &e.path) == nil {
			all = append(all, e)
		}
	}
	rows.Close()

	for _, e := range all {
		if _, err := os.Stat(e.path); os.IsNotExist(err) {
			db.Exec(`DELETE FROM tracks WHERE id = $1`, e.id)
			log.Printf("reconcile: removed orphan track %s (missing file: %s)", e.id, e.path)
			res.Removed++
		}
	}

	// ── Pass 2: disk → DB (index any untracked audio files) ───────────────────
	// Build set of known file_paths for fast lookup.
	known := make(map[string]bool, len(all))
	rows2, err := db.Query(`SELECT file_path FROM tracks`)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var p string
			if rows2.Scan(&p) == nil {
				known[p] = true
			}
		}
	}

	exts := map[string]bool{
		".flac": true, ".mp3": true, ".opus": true,
		".m4a": true, ".webm": true, ".wav": true,
	}
	err = filepath.WalkDir(musicPath, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(path))
		if !exts[ext] {
			return nil
		}
		// Translate to container path (/music/...) from walk path.
		containerPath := "/music" + path[len(musicPath):]
		if known[containerPath] {
			return nil
		}
		// File exists on disk but not in DB — index it.
		tx, err := db.Begin()
		if err != nil {
			res.Errors++
			return nil
		}
		if err := indexFile(tx, path, coversDir); err != nil {
			tx.Rollback()
			log.Printf("reconcile: index %s: %v", path, err)
			res.Errors++
		} else {
			tx.Commit()
			log.Printf("reconcile: indexed missing file %s", path)
			res.Added++
		}
		return nil
	})
	if err != nil {
		log.Printf("reconcile: walk error: %v", err)
		res.Errors++
	}

	if res.Removed > 0 || res.Added > 0 || res.Errors > 0 {
		log.Printf("reconcile: removed=%d added=%d errors=%d", res.Removed, res.Added, res.Errors)
	} else {
		log.Printf("reconcile: library consistent — no discrepancies")
	}
	return res
}

// BackfillDurations updates duration_s for tracks where it is 0 or NULL.
// Runs ffprobe against the file_path for each such track.
func BackfillDurations(db *sql.DB) {
	rows, err := db.Query(`SELECT id, file_path FROM tracks WHERE duration_s IS NULL OR duration_s = 0`)
	if err != nil {
		log.Printf("backfill durations: query: %v", err)
		return
	}
	defer rows.Close()
	type entry struct{ id, path string }
	var todo []entry
	for rows.Next() {
		var e entry
		if rows.Scan(&e.id, &e.path) == nil {
			todo = append(todo, e)
		}
	}
	rows.Close()
	if len(todo) == 0 {
		return
	}
	log.Printf("backfill durations: probing %d tracks", len(todo))
	updated := 0
	for _, e := range todo {
		d := probeDuration(e.path)
		if d > 0 {
			db.Exec(`UPDATE tracks SET duration_s = $1 WHERE id = $2`, d, e.id)
			updated++
		}
	}
	log.Printf("backfill durations: updated %d/%d tracks", updated, len(todo))
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

	durS := probeDuration(path)
	_, err = tx.Exec(
		`INSERT INTO tracks(id, album_id, title, track_num, duration_s, file_path, genre) VALUES($1, $2, $3, $4, $5, $6, $7) ON CONFLICT(id) DO UPDATE SET album_id=EXCLUDED.album_id, title=EXCLUDED.title, track_num=EXCLUDED.track_num, duration_s=EXCLUDED.duration_s, file_path=EXCLUDED.file_path, genre=EXCLUDED.genre`,
		trackID, albumID, trackTitle, trackNum, durS, path, genre,
	)
	return err
}

func id8(s string) string {
	h := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(s))))
	return fmt.Sprintf("%x", h[:8])
}

// TrackIDFromPath returns the track ID that would be assigned to a file at the given path.
func TrackIDFromPath(path string) string { return id8(path) }
