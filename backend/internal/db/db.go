package db

import (
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

	_ "modernc.org/sqlite"
)

func Open(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	// Limit connection pool to 1 to serialize all SQLite writes and completely prevent locks
	db.SetMaxOpenConns(1)

	// Set busy timeout via direct PRAGMA statement
	if _, err := db.Exec("PRAGMA busy_timeout = 5000;"); err != nil {
		db.Close()
		return nil, err
	}

	if err := migrate(db); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func migrate(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS artists (
			id         TEXT PRIMARY KEY,
			name       TEXT NOT NULL,
			image_path TEXT
		);
		CREATE TABLE IF NOT EXISTS albums (
			id         TEXT PRIMARY KEY,
			artist_id  TEXT NOT NULL,
			title      TEXT NOT NULL,
			year       INT,
			cover_path TEXT,
			FOREIGN KEY (artist_id) REFERENCES artists(id)
		);
		CREATE TABLE IF NOT EXISTS tracks (
			id         TEXT PRIMARY KEY,
			album_id   TEXT NOT NULL,
			title      TEXT NOT NULL,
			track_num  INT,
			duration_s INT,
			file_path  TEXT NOT NULL,
			FOREIGN KEY (album_id) REFERENCES albums(id)
		);
		CREATE TABLE IF NOT EXISTS videos (
			id         TEXT PRIMARY KEY,
			title      TEXT NOT NULL,
			duration_s INT,
			size_bytes INT,
			file_path  TEXT NOT NULL,
			created_at INTEGER NOT NULL DEFAULT (unixepoch())
		);
	`)
	if err != nil {
		return err
	}
	// Additive migrations — ignore errors if already exists
	db.Exec(`ALTER TABLE tracks ADD COLUMN genre TEXT NOT NULL DEFAULT ''`)
	db.Exec(`CREATE TABLE IF NOT EXISTS lyrics_cache (
		track_id   TEXT PRIMARY KEY,
		results    TEXT NOT NULL,
		fetched_at INTEGER NOT NULL DEFAULT (unixepoch())
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS settings (
		key   TEXT PRIMARY KEY,
		value TEXT NOT NULL
	)`)
	db.Exec(`ALTER TABLE videos ADD COLUMN trickplay_ready INTEGER NOT NULL DEFAULT 0`)
	db.Exec(`ALTER TABLE videos ADD COLUMN poster_path TEXT`)
	db.Exec(`CREATE TABLE IF NOT EXISTS playback_progress (
		item_type  TEXT NOT NULL,
		item_id    TEXT NOT NULL,
		position_s REAL NOT NULL DEFAULT 0,
		updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
		PRIMARY KEY (item_type, item_id)
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS ebooks (
		id         TEXT PRIMARY KEY,
		title      TEXT NOT NULL,
		author     TEXT NOT NULL,
		format     TEXT NOT NULL,
		size_bytes INTEGER NOT NULL,
		file_path  TEXT NOT NULL,
		cover_path TEXT,
		is_nsfw    INTEGER NOT NULL DEFAULT 0,
		progress   TEXT NOT NULL DEFAULT '',
		created_at INTEGER NOT NULL DEFAULT (unixepoch())
	)`)
	db.Exec(`ALTER TABLE ebooks ADD COLUMN is_nsfw INTEGER NOT NULL DEFAULT 0`)
	db.Exec(`ALTER TABLE ebooks ADD COLUMN progress TEXT NOT NULL DEFAULT ''`)
	db.Exec(`ALTER TABLE ebooks ADD COLUMN collection TEXT NOT NULL DEFAULT ''`)
	db.Exec(`CREATE TABLE IF NOT EXISTS comics_cache (
		source TEXT NOT NULL, query TEXT NOT NULL, results TEXT NOT NULL,
		updated_at INTEGER NOT NULL, PRIMARY KEY (source, query)
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS comics_galleries (
		gid TEXT NOT NULL, token TEXT NOT NULL, detail TEXT NOT NULL,
		updated_at INTEGER NOT NULL, PRIMARY KEY (gid, token)
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS comics_pages (
		chapter_id TEXT NOT NULL, manga_id TEXT NOT NULL, pages TEXT NOT NULL,
		updated_at INTEGER NOT NULL, PRIMARY KEY (chapter_id)
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS trending_repos (
		id          TEXT PRIMARY KEY,
		name        TEXT NOT NULL,
		url         TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		language    TEXT NOT NULL DEFAULT '',
		topics      TEXT NOT NULL DEFAULT '[]'
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS trending_daily (
		repo_id        TEXT NOT NULL,
		date           TEXT NOT NULL,
		stars          INTEGER NOT NULL DEFAULT 0,
		star_delta     INTEGER NOT NULL DEFAULT 0,
		problem_solved TEXT,
		tech_used      TEXT,
		simple_flow    TEXT,
		PRIMARY KEY (repo_id, date)
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS trending_star_history (
		repo_id    TEXT NOT NULL,
		sampled_at TEXT NOT NULL,
		stars      INTEGER NOT NULL,
		PRIMARY KEY (repo_id, sampled_at)
	)`)
	db.Exec(`ALTER TABLE trending_daily ADD COLUMN impact_score INTEGER`)
	db.Exec(`ALTER TABLE trending_daily ADD COLUMN impact_label TEXT`)
	db.Exec(`CREATE TABLE IF NOT EXISTS comics_downloads (
		id          TEXT PRIMARY KEY,
		source      TEXT NOT NULL,
		title       TEXT NOT NULL,
		cover       TEXT NOT NULL DEFAULT '',
		local_dir   TEXT NOT NULL DEFAULT '',
		page_count  INTEGER NOT NULL DEFAULT 0,
		downloaded  INTEGER NOT NULL DEFAULT 0,
		status      TEXT NOT NULL DEFAULT 'queued',
		error       TEXT NOT NULL DEFAULT '',
		created_at  INTEGER NOT NULL,
		updated_at  INTEGER NOT NULL
	)`)
	db.Exec(`ALTER TABLE comics_downloads ADD COLUMN token TEXT NOT NULL DEFAULT ''`)
	db.Exec(`CREATE TABLE IF NOT EXISTS lyrics_translations (
		track_id   TEXT NOT NULL,
		lang       TEXT NOT NULL,
		lines_json TEXT NOT NULL,
		created_at INTEGER NOT NULL DEFAULT (unixepoch()),
		PRIMARY KEY (track_id, lang)
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS playlists (
		id          TEXT PRIMARY KEY,
		name        TEXT NOT NULL,
		created_at  INTEGER NOT NULL DEFAULT (unixepoch())
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS playlist_tracks (
		playlist_id  TEXT NOT NULL,
		track_id     TEXT NOT NULL,
		position     INTEGER NOT NULL,
		added_at     INTEGER NOT NULL DEFAULT (unixepoch()),
		PRIMARY KEY (playlist_id, track_id)
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS chat_logs (
		id          TEXT PRIMARY KEY,
		created_at  TEXT NOT NULL,
		model       TEXT NOT NULL DEFAULT '',
		provider    TEXT NOT NULL DEFAULT '',
		user_msg    TEXT NOT NULL,
		ai_msg      TEXT NOT NULL,
		actions     TEXT NOT NULL DEFAULT '[]',
		failed      INTEGER NOT NULL DEFAULT 0,
		fail_reason TEXT NOT NULL DEFAULT '',
		tokens_in   INTEGER NOT NULL DEFAULT 0,
		tokens_out  INTEGER NOT NULL DEFAULT 0
	)`)
	db.Exec(`ALTER TABLE chat_logs ADD COLUMN tokens_in INTEGER NOT NULL DEFAULT 0`)
	db.Exec(`ALTER TABLE chat_logs ADD COLUMN tokens_out INTEGER NOT NULL DEFAULT 0`)
	db.Exec(`ALTER TABLE chat_logs ADD COLUMN tool_errors TEXT NOT NULL DEFAULT '[]'`)
	db.Exec(`ALTER TABLE chat_logs ADD COLUMN response_ms INTEGER NOT NULL DEFAULT 0`)
	db.Exec(`ALTER TABLE chat_logs ADD COLUMN session_id TEXT NOT NULL DEFAULT ''`)
	db.Exec(`ALTER TABLE chat_logs ADD COLUMN tokens_cached_in INTEGER NOT NULL DEFAULT 0`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_chat_logs_session ON chat_logs(session_id) WHERE session_id != ''`)
	db.Exec(`CREATE TABLE IF NOT EXISTS agent_memory (
		key        TEXT PRIMARY KEY,
		value      TEXT NOT NULL,
		updated_at TEXT NOT NULL
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS ai_model_prices (
		model      TEXT PRIMARY KEY,
		price_in   REAL NOT NULL DEFAULT 0,
		price_out  REAL NOT NULL DEFAULT 0,
		updated_at TEXT NOT NULL DEFAULT ''
	)`)
	db.Exec(`ALTER TABLE ai_model_prices ADD COLUMN cached_in REAL NOT NULL DEFAULT 0`)
	db.Exec(`ALTER TABLE ai_model_prices ADD COLUMN cached_out REAL NOT NULL DEFAULT 0`)
	db.Exec(`CREATE TABLE IF NOT EXISTS scheduled_tasks (
		id              TEXT PRIMARY KEY,
		cron_expression TEXT NOT NULL,
		prompt          TEXT NOT NULL,
		last_run_at     TEXT NOT NULL DEFAULT '',
		created_at      TEXT NOT NULL
	)`)
	if err := migrateYouTubeTracks(db); err != nil {
		return err
	}
	return nil
}

func migrateYouTubeTracks(db *sql.DB) error {
	// 0. Merge channel ID artist 'UCHDDRBkbRodM6lRa65WLXaQ' into friendly 'Nhạc Việt Nam nhưng ở 1 diễn biến khác'
	_, _ = db.Exec(`
		UPDATE albums 
		SET artist_id = 'c162696972742920' 
		WHERE artist_id = 'b0f03640d132863b'
	`)

	// 1. Calculate IDs helper
	id8 := func(s string) string {
		h := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(s))))
		return fmt.Sprintf("%x", h[:8])
	}

	// 2. Find all tracks to check if they are YouTube downloads
	rows, err := db.Query(`
		SELECT t.id, t.title, t.file_path, al.artist_id, t.album_id
		FROM tracks t
		JOIN albums al ON al.id = t.album_id
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	reYT := regexp.MustCompile(`^[a-zA-Z0-9_-]{11}$`)
	type trackUpdate struct {
		trackID    string
		trackTitle string
		newAlbumID string
		artistID   string
		youtubeID  string
	}
	var updates []trackUpdate

	for rows.Next() {
		var id, title, filePath, artistID, albumID string
		if err := rows.Scan(&id, &title, &filePath, &artistID, &albumID); err != nil {
			return err
		}

		base := filepath.Base(filePath)
		ext := filepath.Ext(base)
		baseNoExt := strings.TrimSuffix(base, ext)

		// Check if it's a YouTube download (filename without ext is 11-char YouTube ID)
		if len(baseNoExt) == 11 && reYT.MatchString(baseNoExt) {
			newAlbumTitle := title
			newAlbumID := id8(artistID + newAlbumTitle)
			if albumID != newAlbumID {
				updates = append(updates, trackUpdate{
					trackID:    id,
					trackTitle: title,
					newAlbumID: newAlbumID,
					artistID:   artistID,
					youtubeID:  baseNoExt,
				})
			}
		}
	}

	if len(updates) > 0 {
		tx, err := db.Begin()
		if err != nil {
			return err
		}
		defer tx.Rollback()

		coversDir := os.Getenv("COVERS_DIR")
		if coversDir == "" {
			coversDir = "/data/covers"
		}
		_ = os.MkdirAll(coversDir, 0755)

		for _, u := range updates {
			// Ensure new album exists for this track
			coverPath := "/api/covers/" + u.newAlbumID
			_, err := tx.Exec(`
				INSERT OR IGNORE INTO albums (id, artist_id, title, year, cover_path)
				VALUES (?, ?, ?, ?, ?)
			`, u.newAlbumID, u.artistID, u.trackTitle, 0, coverPath)
			if err != nil {
				return err
			}

			// Update track's album_id
			_, err = tx.Exec(`UPDATE tracks SET album_id = ? WHERE id = ?`, u.newAlbumID, u.trackID)
			if err != nil {
				return err
			}

			// Download the cover thumbnail if it doesn't exist
			destPath := filepath.Join(coversDir, u.newAlbumID+".jpg")
			if _, statErr := os.Stat(destPath); os.IsNotExist(statErr) {
				go func(ytID, dest string) {
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
						out, err := os.Create(dest)
						if err != nil {
							resp.Body.Close()
							return
						}
						_, err = io.Copy(out, resp.Body)
						out.Close()
						resp.Body.Close()
						if err == nil {
							log.Printf("youtube download cover: successfully saved cover to %s", dest)
							return
						}
					}
				}(u.youtubeID, destPath)
			}
		}

		// Clean up empty albums/artists
		if _, err := tx.Exec(`DELETE FROM albums WHERE id NOT IN (SELECT DISTINCT album_id FROM tracks)`); err != nil {
			return err
		}
		if _, err := tx.Exec(`DELETE FROM artists WHERE id NOT IN (SELECT DISTINCT artist_id FROM albums)`); err != nil {
			return err
		}

		if err := tx.Commit(); err != nil {
			return err
		}
	}

	return nil
}

