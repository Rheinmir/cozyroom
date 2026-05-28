package sqlite

import (
	"database/sql"
	"time"
)

type ComicsCacheRepo struct{ DB *sql.DB }

func (r *ComicsCacheRepo) SaveSearch(source, query string, results []byte) error {
	_, err := r.DB.Exec(`
		INSERT OR REPLACE INTO comics_cache (source, query, results, updated_at)
		VALUES (?, ?, ?, ?)
	`, source, query, string(results), time.Now().Unix())
	return err
}

func (r *ComicsCacheRepo) GetSearch(source, query string, maxAge time.Duration) ([]byte, error) {
	var results string
	var updatedAt int64
	err := r.DB.QueryRow(`
		SELECT results, updated_at FROM comics_cache WHERE source = ? AND query = ?
	`, source, query).Scan(&results, &updatedAt)
	if err != nil {
		return nil, err
	}
	if time.Since(time.Unix(updatedAt, 0)) > maxAge {
		return nil, sql.ErrNoRows
	}
	return []byte(results), nil
}

func (r *ComicsCacheRepo) SaveGallery(gid, token string, detail []byte) error {
	_, err := r.DB.Exec(`
		INSERT OR REPLACE INTO comics_galleries (gid, token, detail, updated_at)
		VALUES (?, ?, ?, ?)
	`, gid, token, string(detail), time.Now().Unix())
	return err
}

func (r *ComicsCacheRepo) GetGallery(gid, token string, maxAge time.Duration) ([]byte, error) {
	var detail string
	var updatedAt int64
	err := r.DB.QueryRow(`
		SELECT detail, updated_at FROM comics_galleries WHERE gid = ? AND token = ?
	`, gid, token).Scan(&detail, &updatedAt)
	if err != nil {
		return nil, err
	}
	if time.Since(time.Unix(updatedAt, 0)) > maxAge {
		return nil, sql.ErrNoRows
	}
	return []byte(detail), nil
}

func (r *ComicsCacheRepo) SaveChapterPages(gid, chapID string, pages []byte) error {
	_, err := r.DB.Exec(`
		INSERT OR REPLACE INTO comics_pages (manga_id, chapter_id, pages, updated_at)
		VALUES (?, ?, ?, ?)
	`, gid, chapID, string(pages), time.Now().Unix())
	return err
}

func (r *ComicsCacheRepo) GetChapterPages(chapID string, maxAge time.Duration) ([]byte, error) {
	var pages string
	var updatedAt int64
	err := r.DB.QueryRow(`
		SELECT pages, updated_at FROM comics_pages WHERE chapter_id = ?
	`, chapID).Scan(&pages, &updatedAt)
	if err != nil {
		return nil, err
	}
	if time.Since(time.Unix(updatedAt, 0)) > maxAge {
		return nil, sql.ErrNoRows
	}
	return []byte(pages), nil
}

func (r *ComicsCacheRepo) InitSchema() error {
	_, err := r.DB.Exec(`
		CREATE TABLE IF NOT EXISTS comics_cache (
			source TEXT NOT NULL,
			query TEXT NOT NULL,
			results TEXT NOT NULL,
			updated_at INTEGER NOT NULL,
			PRIMARY KEY (source, query)
		)
	`)
	if err != nil {
		return err
	}
	_, err = r.DB.Exec(`
		CREATE TABLE IF NOT EXISTS comics_galleries (
			gid TEXT NOT NULL,
			token TEXT NOT NULL,
			detail TEXT NOT NULL,
			updated_at INTEGER NOT NULL,
			PRIMARY KEY (gid, token)
		)
	`)
	if err != nil {
		return err
	}
	_, err = r.DB.Exec(`
		CREATE TABLE IF NOT EXISTS comics_pages (
			chapter_id TEXT NOT NULL,
			manga_id TEXT NOT NULL,
			pages TEXT NOT NULL,
			updated_at INTEGER NOT NULL,
			PRIMARY KEY (chapter_id)
		)
	`)
	return err
}