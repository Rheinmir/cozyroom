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
	// f_unaccent: accent-insensitive search ("yeu 5" must match "Yêu 5").
	// translate() + a generated 67-char Vietnamese diacritic table, rather
	// than the unaccent extension, so 'đ' (no Unicode decomposition, and not
	// covered by stock unaccent.rules) is handled explicitly and correctly.
	// IMMUTABLE so it can be used in the GIN trgm expression indexes below.
	if _, err := db.Exec(`CREATE OR REPLACE FUNCTION f_unaccent(t TEXT) RETURNS TEXT AS $$
		SELECT translate(lower(t), 'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd')
	$$ LANGUAGE SQL IMMUTABLE`); err != nil {
		log.Printf("[db] f_unaccent function: %v", err)
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

	// Search + SmartQueue indexes. pg_trgm (extension created above) lets
	// Postgres use a GIN index for existing ILIKE '%...%' queries automatically —
	// no query rewrite needed, this alone turns full-table scans into index
	// scans. Auto-maintained by Postgres on every INSERT/UPDATE, so new tracks
	// added by the scanner are indexed as part of the same write — no separate
	// rebuild/refresh job needed.
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_artists_name_trgm ON artists USING GIN (name gin_trgm_ops)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_albums_title_trgm ON albums USING GIN (title gin_trgm_ops)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_tracks_title_trgm ON tracks USING GIN (title gin_trgm_ops)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_tracks_genre_trgm ON tracks USING GIN (genre gin_trgm_ops)`)
	// Accent-insensitive search (search.go: f_unaccent(col) ILIKE f_unaccent($1),
	// so "yeu 5" matches "Yêu 5") — expression indexes on the normalized text,
	// same GIN trgm mechanism as above. f_unaccent is IMMUTABLE so Postgres
	// accepts it as an index expression.
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_artists_name_unaccent_trgm ON artists USING GIN (f_unaccent(name) gin_trgm_ops)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_albums_title_unaccent_trgm ON albums USING GIN (f_unaccent(title) gin_trgm_ops)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_tracks_title_unaccent_trgm ON tracks USING GIN (f_unaccent(title) gin_trgm_ops)`)
	// SmartQueue tier lookups: same-artist (via albums.artist_id) and exact-genre.
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_albums_artist_id ON albums (artist_id)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks (genre) WHERE genre != ''`)
	db.Exec(`CREATE TABLE IF NOT EXISTS lyrics_cache (
		track_id   TEXT PRIMARY KEY,
		results    TEXT NOT NULL,
		fetched_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS settings (
		key   TEXT PRIMARY KEY,
		value TEXT NOT NULL
	)`)
	// CockroachDB has no advisory locks — enrich_lease replaces
	// pg_try_advisory_lock for cross-pod mutual exclusion (see enricher/aitrends.go).
	db.Exec(`CREATE TABLE IF NOT EXISTS enrich_lease (
		key        TEXT PRIMARY KEY,
		holder     TEXT NOT NULL,
		expires_at TIMESTAMPTZ NOT NULL
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
	db.Exec(`CREATE TABLE IF NOT EXISTS kanban_notes (
		id          TEXT PRIMARY KEY,
		column_key  TEXT NOT NULL,
		title       TEXT NOT NULL,
		content     TEXT NOT NULL DEFAULT '',
		position    INTEGER NOT NULL,
		created_at  INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
		updated_at  INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
	)`)
	// Kanban upgrade (030826): boards/columns replace the old fixed 3-column
	// layout; column_key is kept (unused by new code) rather than dropped,
	// so the backfill below stays reversible until verified in production.
	db.Exec(`ALTER TABLE kanban_notes ADD COLUMN IF NOT EXISTS board_id TEXT`)
	db.Exec(`ALTER TABLE kanban_notes ADD COLUMN IF NOT EXISTS column_id TEXT`)
	db.Exec(`ALTER TABLE kanban_notes ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT ''`)
	db.Exec(`ALTER TABLE kanban_notes ADD COLUMN IF NOT EXISTS due_date INTEGER`)
	db.Exec(`ALTER TABLE kanban_notes ADD COLUMN IF NOT EXISTS assigned_user_id TEXT NOT NULL DEFAULT ''`)
	// column_key is legacy (see backfill below) — new inserts no longer set it.
	db.Exec(`ALTER TABLE kanban_notes ALTER COLUMN column_key DROP NOT NULL`)
	db.Exec(`CREATE TABLE IF NOT EXISTS kanban_boards (
		id         TEXT PRIMARY KEY,
		name       TEXT NOT NULL,
		position   INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS kanban_columns (
		id       TEXT PRIMARY KEY,
		board_id TEXT NOT NULL,
		name     TEXT NOT NULL,
		position INTEGER NOT NULL
	)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_kanban_columns_board_id ON kanban_columns(board_id)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS kanban_labels (
		id       TEXT PRIMARY KEY,
		board_id TEXT NOT NULL,
		name     TEXT NOT NULL,
		color    TEXT NOT NULL DEFAULT ''
	)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_kanban_labels_board_id ON kanban_labels(board_id)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS kanban_note_labels (
		note_id  TEXT NOT NULL,
		label_id TEXT NOT NULL,
		PRIMARY KEY (note_id, label_id)
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS kanban_subtasks (
		id       TEXT PRIMARY KEY,
		note_id  TEXT NOT NULL,
		title    TEXT NOT NULL,
		done     INTEGER NOT NULL DEFAULT 0,
		position INTEGER NOT NULL
	)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_kanban_subtasks_note_id ON kanban_subtasks(note_id)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS kanban_comments (
		id             TEXT PRIMARY KEY,
		note_id        TEXT NOT NULL,
		author_user_id TEXT NOT NULL DEFAULT '',
		author_label   TEXT NOT NULL DEFAULT '',
		content        TEXT NOT NULL,
		created_at     INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
	)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_kanban_comments_note_id ON kanban_comments(note_id)`)
	// kanban_users/kanban_sessions are a separate, kanban-scoped auth system
	// (register + owner-approve, Gitea-style) — independent of OwnerPassword,
	// which remains the sole admin/approval credential (see auth_kanban.go).
	db.Exec(`CREATE TABLE IF NOT EXISTS kanban_users (
		id            TEXT PRIMARY KEY,
		username      TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		status        TEXT NOT NULL DEFAULT 'pending',
		color         TEXT NOT NULL DEFAULT '',
		created_at    INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER),
		approved_at   INTEGER
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS kanban_sessions (
		token      TEXT PRIMARY KEY,
		user_id    TEXT NOT NULL,
		expires_at INTEGER NOT NULL
	)`)
	// Roles are scoped PER BOARD (040826 module 1) — a user's permission level
	// can differ across boards, so role is a membership fact (board_id,
	// user_id) -> role_id, not an attribute of kanban_users itself.
	db.Exec(`CREATE TABLE IF NOT EXISTS kanban_roles (
		id          TEXT PRIMARY KEY,
		board_id    TEXT NOT NULL,
		name        TEXT NOT NULL,
		permissions TEXT NOT NULL,
		is_system   INTEGER NOT NULL DEFAULT 0,
		position    INTEGER NOT NULL DEFAULT 0
	)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_kanban_roles_board_id ON kanban_roles(board_id)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS kanban_board_members (
		board_id TEXT NOT NULL,
		user_id  TEXT NOT NULL,
		role_id  TEXT NOT NULL,
		PRIMARY KEY (board_id, user_id)
	)`)
	// One-time backfill (idempotent via fixed IDs + board_id IS NULL guard):
	// notes created before this upgrade have no board/column yet.
	db.Exec(`INSERT INTO kanban_boards (id, name, position) VALUES ('default', 'Bảng chính', 0) ON CONFLICT (id) DO NOTHING`)
	db.Exec(`INSERT INTO kanban_columns (id, board_id, name, position) VALUES
		('col_todo', 'default', 'Cần làm', 0),
		('col_doing', 'default', 'Đang làm', 1),
		('col_done', 'default', 'Xong', 2)
		ON CONFLICT (id) DO NOTHING`)
	db.Exec(`UPDATE kanban_notes SET
		board_id = 'default',
		column_id = CASE column_key WHEN 'todo' THEN 'col_todo' WHEN 'doing' THEN 'col_doing' WHEN 'done' THEN 'col_done' ELSE 'col_todo' END
		WHERE board_id IS NULL`)
	// Seed the 4 default roles for the pre-existing 'default' board (fixed
	// IDs so this stays idempotent — boards created after this migration get
	// their own freshly generated role IDs via boards.go's createBoard).
	const fullPerms = `{"board":["create","read","update","delete"],"column":["create","read","update","delete"],"label":["create","read","update","delete"],"note":["create","read","update","delete","assign"],"comment":["create","read","update","delete"]}`
	const memberPerms = `{"board":["read"],"column":["read"],"label":["read"],"note":["create","read","update","delete","assign"],"comment":["create","read","update","delete"]}`
	const viewerPerms = `{"board":["read"],"column":["read"],"label":["read"],"note":["read"],"comment":["read"]}`
	db.Exec(`INSERT INTO kanban_roles (id, board_id, name, permissions, is_system, position) VALUES
		('default_role_owner', 'default', 'owner', $1, 1, 0),
		('default_role_admin', 'default', 'admin', $1, 1, 1),
		('default_role_member', 'default', 'member', $2, 1, 2),
		('default_role_viewer', 'default', 'viewer', $3, 1, 3)
		ON CONFLICT (id) DO NOTHING`, fullPerms, memberPerms, viewerPerms)
	// Users approved before this module existed had no per-board role at
	// all — without this backfill, hasPermission's fail-closed default would
	// silently strip every one of them of write access on the default board.
	db.Exec(`INSERT INTO kanban_board_members (board_id, user_id, role_id)
		SELECT 'default', id, 'default_role_member' FROM kanban_users WHERE status = 'approved'
		ON CONFLICT (board_id, user_id) DO NOTHING`)
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
	// ADK-style scoped state: one table, four scopes via (scope, scope_id) prefix.
	// scope: 'user' | 'session' | 'app'
	// scope_id: user/session identifier, or 'global' for app-wide.
	db.Exec(`CREATE TABLE IF NOT EXISTS agent_state (
		scope      TEXT    NOT NULL DEFAULT 'user',
		scope_id   TEXT    NOT NULL DEFAULT 'default',
		key        TEXT    NOT NULL,
		value      TEXT    NOT NULL,
		updated_at TEXT    NOT NULL,
		PRIMARY KEY (scope, scope_id, key)
	)`)
	// One-time migration: copy existing agent_memory rows into agent_state as user-scoped.
	db.Exec(`INSERT INTO agent_state (scope, scope_id, key, value, updated_at)
		SELECT 'user', 'default', key, value, updated_at FROM agent_memory
		ON CONFLICT (scope, scope_id, key) DO NOTHING`)
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
	// track_plays: append-only log, one row per completed local play — lets us
	// compute both "top played" (COUNT per track) and "plays per day" (GROUP BY
	// played_at) from the same source. lastfm_backfill_count is a separate
	// one-time snapshot from Last.fm's userplaycount (a running total, not a
	// per-play timestamp, so it can't be represented as track_plays rows).
	db.Exec(`CREATE TABLE IF NOT EXISTS track_plays (
		id         TEXT PRIMARY KEY,
		track_id   TEXT NOT NULL,
		played_at  INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
	)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_track_plays_track_id ON track_plays(track_id)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_track_plays_played_at ON track_plays(played_at)`)
	db.Exec(`ALTER TABLE tracks ADD COLUMN IF NOT EXISTS lastfm_backfill_count INTEGER NOT NULL DEFAULT 0`)
	return nil
}
