package sqlite

import (
	"database/sql"
	"time"
)

// ComicsDownload tracks a discovered or downloaded comic/gallery.
// status='idle'       → discovered, cover stored, not downloaded
// status='queued'     → user requested download
// status='downloading'→ in progress
// status='done'       → downloaded, files on disk
// status='failed'     → download attempted, failed
type ComicsDownload struct {
	ID         string `json:"id"`
	Source     string `json:"source"`
	Title      string `json:"title"`
	Cover      string `json:"cover"`
	Token      string `json:"token,omitempty"`
	LocalDir   string `json:"local_dir"`
	PageCount  int    `json:"page_count"`
	Downloaded int    `json:"downloaded"`
	Status     string `json:"status"`
	Error      string `json:"error,omitempty"`
	CreatedAt  int64  `json:"created_at"`
	UpdatedAt  int64  `json:"updated_at"`
}

type ComicsDownloadsRepo struct {
	DB *sql.DB
}

// InsertCover adds a discovered entry (status='idle') if it does not already exist.
func (r *ComicsDownloadsRepo) InsertCover(d ComicsDownload) error {
	now := time.Now().Unix()
	_, err := r.DB.Exec(
		`INSERT OR IGNORE INTO comics_downloads
		 (id,source,title,cover,token,local_dir,page_count,downloaded,status,error,created_at,updated_at)
		 VALUES (?,?,?,?,?,?,0,0,'idle','',?,?)`,
		d.ID, d.Source, d.Title, d.Cover, d.Token, now, now,
	)
	return err
}

// Enqueue sets an existing idle/failed entry to queued, or inserts a new queued entry.
func (r *ComicsDownloadsRepo) Enqueue(d ComicsDownload) error {
	now := time.Now().Unix()
	// Try to update existing idle/failed record first
	res, err := r.DB.Exec(
		`UPDATE comics_downloads
		 SET status='queued',error='',downloaded=0,page_count=0,local_dir='',updated_at=?
		 WHERE id=? AND status IN ('idle','failed')`,
		now, d.ID,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n > 0 {
		return nil
	}
	// Insert fresh queued record
	_, err = r.DB.Exec(
		`INSERT OR IGNORE INTO comics_downloads
		 (id,source,title,cover,token,local_dir,page_count,downloaded,status,error,created_at,updated_at)
		 VALUES (?,?,?,?,?,?,0,0,'queued','',?,?)`,
		d.ID, d.Source, d.Title, d.Cover, d.Token, now, now,
	)
	return err
}

func (r *ComicsDownloadsRepo) SetStatus(id, status, errMsg string) error {
	_, err := r.DB.Exec(
		`UPDATE comics_downloads SET status=?,error=?,updated_at=? WHERE id=?`,
		status, errMsg, time.Now().Unix(), id,
	)
	return err
}

func (r *ComicsDownloadsRepo) SetProgress(id string, downloaded, total int) error {
	_, err := r.DB.Exec(
		`UPDATE comics_downloads SET downloaded=?,page_count=?,updated_at=? WHERE id=?`,
		downloaded, total, time.Now().Unix(), id,
	)
	return err
}

func (r *ComicsDownloadsRepo) SetLocalDir(id, localDir string) error {
	_, err := r.DB.Exec(
		`UPDATE comics_downloads SET local_dir=?,updated_at=? WHERE id=?`,
		localDir, time.Now().Unix(), id,
	)
	return err
}

func (r *ComicsDownloadsRepo) GetAll() ([]ComicsDownload, error) {
	return r.scan(
		`SELECT id,source,title,cover,token,local_dir,page_count,downloaded,status,error,created_at,updated_at
		 FROM comics_downloads ORDER BY updated_at DESC`,
	)
}

func (r *ComicsDownloadsRepo) GetQueued() ([]ComicsDownload, error) {
	return r.scan(
		`SELECT id,source,title,cover,token,local_dir,page_count,downloaded,status,error,created_at,updated_at
		 FROM comics_downloads WHERE status='queued' ORDER BY created_at ASC`,
	)
}

func (r *ComicsDownloadsRepo) GetByID(id string) (*ComicsDownload, error) {
	var d ComicsDownload
	err := r.DB.QueryRow(
		`SELECT id,source,title,cover,token,local_dir,page_count,downloaded,status,error,created_at,updated_at
		 FROM comics_downloads WHERE id=?`, id,
	).Scan(&d.ID, &d.Source, &d.Title, &d.Cover, &d.Token, &d.LocalDir,
		&d.PageCount, &d.Downloaded, &d.Status, &d.Error, &d.CreatedAt, &d.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &d, err
}

func (r *ComicsDownloadsRepo) Exists(id string) bool {
	var n int
	r.DB.QueryRow(`SELECT COUNT(1) FROM comics_downloads WHERE id=?`, id).Scan(&n)
	return n > 0
}

func (r *ComicsDownloadsRepo) Delete(id string) error {
	_, err := r.DB.Exec(`DELETE FROM comics_downloads WHERE id=?`, id)
	return err
}

func (r *ComicsDownloadsRepo) Requeue(id string) error {
	_, err := r.DB.Exec(
		`UPDATE comics_downloads SET status='queued',error='',downloaded=0,page_count=0,local_dir='',updated_at=? WHERE id=?`,
		time.Now().Unix(), id,
	)
	return err
}

func (r *ComicsDownloadsRepo) UpdateCover(id, cover string) error {
	_, err := r.DB.Exec(`UPDATE comics_downloads SET cover=?,updated_at=? WHERE id=?`,
		cover, time.Now().Unix(), id)
	return err
}

func (r *ComicsDownloadsRepo) GetEmptyCover(source string) ([]ComicsDownload, error) {
	return r.scan(
		`SELECT id,source,title,cover,token,local_dir,page_count,downloaded,status,error,created_at,updated_at
		 FROM comics_downloads WHERE source=? AND (cover IS NULL OR cover='') ORDER BY created_at ASC`,
		source,
	)
}

func (r *ComicsDownloadsRepo) ResetDownloading() {
	r.DB.Exec(
		`UPDATE comics_downloads SET status='queued',updated_at=? WHERE status='downloading'`,
		time.Now().Unix(),
	)
}

// CleanupV1 runs once on startup (guarded by a settings flag) to delete all old
// download records so the new idle/user-initiated flow starts clean.
func (r *ComicsDownloadsRepo) CleanupV1() {
	var done int
	r.DB.QueryRow(`SELECT 1 FROM settings WHERE key='comics_dl_reset_v1'`).Scan(&done)
	if done == 1 {
		return
	}
	r.DB.Exec(`DELETE FROM comics_downloads`)
	r.DB.Exec(`INSERT OR IGNORE INTO settings (key,value) VALUES ('comics_dl_reset_v1','1')`)
}

func (r *ComicsDownloadsRepo) scan(q string, args ...any) ([]ComicsDownload, error) {
	rows, err := r.DB.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ComicsDownload
	for rows.Next() {
		var d ComicsDownload
		if rows.Scan(&d.ID, &d.Source, &d.Title, &d.Cover, &d.Token, &d.LocalDir,
			&d.PageCount, &d.Downloaded, &d.Status, &d.Error,
			&d.CreatedAt, &d.UpdatedAt) == nil {
			out = append(out, d)
		}
	}
	return out, nil
}
