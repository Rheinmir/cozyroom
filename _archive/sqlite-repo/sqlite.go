// Package sqlite implements the domain repository interfaces on top of
// database/sql with the modernc.org/sqlite driver.
package sqlite

import (
	"context"
	"database/sql"

	"cozyroom/internal/domain"
)

// ensure compile-time interface compliance
var (
	_ domain.ArtistRepository      = (*ArtistRepo)(nil)
	_ domain.AlbumRepository       = (*AlbumRepo)(nil)
	_ domain.TrackRepository       = (*TrackRepo)(nil)
	_ domain.VideoRepository       = (*VideoRepo)(nil)
	_ domain.PlaybackRepository    = (*PlaybackRepo)(nil)
	_ domain.SearchRepository      = (*SearchRepo)(nil)
	_ domain.StatsRepository       = (*StatsRepo)(nil)
	_ domain.LyricsCacheRepository = (*LyricsCacheRepo)(nil)
	_ domain.SettingsRepository    = (*SettingsRepo)(nil)
	_ domain.EbookRepository       = (*EbookRepo)(nil)
	_ domain.UnitOfWork            = (*unitOfWork)(nil)
	_ domain.UnitOfWorkFactory     = (*UoWFactory)(nil)
)

// ---- querier: allows repos to work with both *sql.DB and *sql.Tx ----

type querier interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

// ---- Unit of Work ----

// UoWFactory creates new transactional units of work.
type UoWFactory struct{ DB *sql.DB }

func (f *UoWFactory) Begin(ctx context.Context) (domain.UnitOfWork, error) {
	tx, err := f.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	return &unitOfWork{tx: tx}, nil
}

type unitOfWork struct{ tx *sql.Tx }

func (u *unitOfWork) Artists() domain.ArtistRepository { return &ArtistRepo{q: u.tx} }
func (u *unitOfWork) Albums() domain.AlbumRepository   { return &AlbumRepo{q: u.tx} }
func (u *unitOfWork) Tracks() domain.TrackRepository   { return &TrackRepo{q: u.tx} }
func (u *unitOfWork) Videos() domain.VideoRepository   { return &VideoRepo{q: u.tx} }
func (u *unitOfWork) Ebooks() domain.EbookRepository   { return &EbookRepo{q: u.tx} }
func (u *unitOfWork) Commit() error                    { return u.tx.Commit() }
func (u *unitOfWork) Rollback() error                  { return u.tx.Rollback() }
