package db

import (
	"database/sql"
	"log"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func Open(databaseURL string) (*RDB, error) {
	raw, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, err
	}
	raw.SetMaxOpenConns(10)
	raw.SetMaxIdleConns(5)

	if err := migrate(raw); err != nil {
		raw.Close()
		return nil, err
	}
	return &RDB{raw}, nil
}

func migrate(db *sql.DB) error {
	_, err := db.Exec(`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
	if err != nil {
		log.Printf("[db] pg_trgm extension: %v", err)
	}

	_, err = db.Exec(`
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
			created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
		);
	`)
	if err != nil {
		return err
	}

	db.Exec(`ALTER TABLE tracks ADD COLUMN IF NOT EXISTS genre TEXT NOT NULL DEFAULT ''`)
	db.Exec(`CREATE TABLE IF NOT EXISTS lyrics_cache (
		track_id   TEXT PRIMARY KEY,
		results    TEXT NOT NULL,
		fetched_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS settings (
		key   TEXT PRIMARY KEY,
		value TEXT NOT NULL
	)`)
	db.Exec(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS trickplay_ready INTEGER NOT NULL DEFAULT 0`)
	db.Exec(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS poster_path TEXT`)
	db.Exec(`CREATE TABLE IF NOT EXISTS playback_progress (
		item_type  TEXT NOT NULL,
		item_id    TEXT NOT NULL,
		position_s REAL NOT NULL DEFAULT 0,
		updated_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
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
		created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
	)`)
	db.Exec(`ALTER TABLE ebooks ADD COLUMN IF NOT EXISTS is_nsfw INTEGER NOT NULL DEFAULT 0`)
	db.Exec(`ALTER TABLE ebooks ADD COLUMN IF NOT EXISTS progress TEXT NOT NULL DEFAULT ''`)
	db.Exec(`ALTER TABLE ebooks ADD COLUMN IF NOT EXISTS collection TEXT NOT NULL DEFAULT ''`)
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
	db.Exec(`ALTER TABLE trending_daily ADD COLUMN IF NOT EXISTS impact_score INTEGER`)
	db.Exec(`ALTER TABLE trending_daily ADD COLUMN IF NOT EXISTS impact_label TEXT`)
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
	db.Exec(`ALTER TABLE comics_downloads ADD COLUMN IF NOT EXISTS token TEXT NOT NULL DEFAULT ''`)
	db.Exec(`CREATE TABLE IF NOT EXISTS lyrics_translations (
		track_id   TEXT NOT NULL,
		lang       TEXT NOT NULL,
		lines_json TEXT NOT NULL,
		created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
		PRIMARY KEY (track_id, lang)
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS playlists (
		id          TEXT PRIMARY KEY,
		name        TEXT NOT NULL,
		created_at  INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS playlist_tracks (
		playlist_id  TEXT NOT NULL,
		track_id     TEXT NOT NULL,
		position     INTEGER NOT NULL,
		added_at     INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
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
	db.Exec(`ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS tokens_in INTEGER NOT NULL DEFAULT 0`)
	db.Exec(`ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS tokens_out INTEGER NOT NULL DEFAULT 0`)
	db.Exec(`ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS tool_errors TEXT NOT NULL DEFAULT '[]'`)
	db.Exec(`ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS response_ms INTEGER NOT NULL DEFAULT 0`)
	db.Exec(`ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS session_id TEXT NOT NULL DEFAULT ''`)
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
	db.Exec(`CREATE TABLE IF NOT EXISTS scheduled_tasks (
		id              TEXT PRIMARY KEY,
		cron_expression TEXT NOT NULL,
		prompt          TEXT NOT NULL,
		last_run_at     TEXT NOT NULL DEFAULT '',
		created_at      TEXT NOT NULL
	)`)
	db.Exec(`ALTER TABLE ai_model_prices ADD COLUMN IF NOT EXISTS cached_in REAL NOT NULL DEFAULT 0`)
	db.Exec(`ALTER TABLE ai_model_prices ADD COLUMN IF NOT EXISTS cached_out REAL NOT NULL DEFAULT 0`)
	db.Exec(`ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS tokens_cached_in INTEGER NOT NULL DEFAULT 0`)
	return nil
}
