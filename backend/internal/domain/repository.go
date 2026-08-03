package domain

import "context"

// ---- Repository contracts (port interfaces) ----

// ArtistRepository reads and writes artists.
type ArtistRepository interface {
	List(ctx context.Context) ([]Artist, error)
	GetByID(ctx context.Context, id string) (*Artist, error)
	GetDetail(ctx context.Context, id string) (*ArtistDetail, error)
	ListWithoutImage(ctx context.Context) ([]Artist, error)
	Upsert(ctx context.Context, a Artist) error
	SetImagePath(ctx context.Context, id, imagePath string) error
}

// AlbumRepository reads and writes albums.
type AlbumRepository interface {
	List(ctx context.Context, artistID string) ([]Album, error)
	GetByID(ctx context.Context, id string) (*Album, error)
	Upsert(ctx context.Context, a Album) error
}

// TrackRepository reads and writes tracks.
type TrackRepository interface {
	List(ctx context.Context, albumID string) ([]Track, error)
	GetByID(ctx context.Context, id string) (*Track, error)
	GetMeta(ctx context.Context, id string) (*TrackMeta, error)
	GetFilePath(ctx context.Context, id string) (string, error)
	SmartQueue(ctx context.Context, trackID string, limit int) ([]Track, error)
	IsEmpty(ctx context.Context) bool
	Upsert(ctx context.Context, t Track) error
	RecordPlay(ctx context.Context, trackID string) error
}

// VideoRepository reads and writes videos.
type VideoRepository interface {
	List(ctx context.Context) ([]Video, error)
	GetByID(ctx context.Context, id string) (*Video, error)
	Upsert(ctx context.Context, v Video) error
	IsEmpty(ctx context.Context) bool
	SetPosterPath(ctx context.Context, id, posterURL string) error
	SetTrickplayReady(ctx context.Context, id string) error
}

// EbookRepository reads and writes ebooks.
type EbookRepository interface {
	List(ctx context.Context) ([]Ebook, error)
	GetByID(ctx context.Context, id string) (*Ebook, error)
	Upsert(ctx context.Context, e Ebook) error
	IsEmpty(ctx context.Context) bool
	SetNSFW(ctx context.Context, id string, isNSFW bool) error
	SetProgress(ctx context.Context, id string, progress string) error
	SetCollection(ctx context.Context, id string, collection string) error
}

// PlaybackRepository tracks resume positions for tracks and videos.
type PlaybackRepository interface {
	Get(ctx context.Context, itemType, itemID string) (*PlaybackProgress, error)
	Set(ctx context.Context, p PlaybackProgress) error
}

// SearchRepository provides full-text search across all entities.
type SearchRepository interface {
	Search(ctx context.Context, query string) (*SearchResult, error)
}

// StatsRepository returns library-wide aggregate counts.
type StatsRepository interface {
	Get(ctx context.Context) (*Stats, error)
}

// LyricsCacheRepository manages the lyrics online-result cache.
type LyricsCacheRepository interface {
	Get(ctx context.Context, trackID string) (string, error)
	Set(ctx context.Context, trackID string, jsonData string) error
	Delete(ctx context.Context, trackID string) error
}

// SettingsRepository stores key-value settings (e.g. lastfm session).
type SettingsRepository interface {
	Get(ctx context.Context, key string) (string, error)
	Set(ctx context.Context, key, value string) error
	Delete(ctx context.Context, keys ...string) error
}

// ---- Unit of Work ----

// UnitOfWork wraps a database transaction and exposes repository accessors
// that participate in the same transaction. Call Commit() to persist or
// Rollback() to discard. If neither is called the implementation must
// rollback automatically (defer pattern).
type UnitOfWork interface {
	Artists() ArtistRepository
	Albums()  AlbumRepository
	Tracks()  TrackRepository
	Videos()  VideoRepository
	Ebooks()  EbookRepository

	Commit() error
	Rollback() error
}

// UnitOfWorkFactory creates new Units of Work.
type UnitOfWorkFactory interface {
	Begin(ctx context.Context) (UnitOfWork, error)
}
