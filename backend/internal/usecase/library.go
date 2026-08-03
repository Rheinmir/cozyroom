// Package usecase contains application-level business logic.
// Each usecase depends only on domain interfaces (ports), never on sql or http.
package usecase

import (
	"context"

	"cozyroom/internal/domain"
)

// LibraryUsecase provides read-only library queries.
type LibraryUsecase struct {
	Artists domain.ArtistRepository
	Albums  domain.AlbumRepository
	Tracks  domain.TrackRepository
	Search  domain.SearchRepository
	Stats   domain.StatsRepository
}

func (u *LibraryUsecase) ListArtists(ctx context.Context) ([]domain.Artist, error) {
	return u.Artists.List(ctx)
}

func (u *LibraryUsecase) ArtistDetail(ctx context.Context, id string) (*domain.ArtistDetail, error) {
	return u.Artists.GetDetail(ctx, id)
}

func (u *LibraryUsecase) ListAlbums(ctx context.Context, artistID string) ([]domain.Album, error) {
	return u.Albums.List(ctx, artistID)
}

func (u *LibraryUsecase) GetAlbum(ctx context.Context, id string) (*domain.Album, error) {
	return u.Albums.GetByID(ctx, id)
}

func (u *LibraryUsecase) ListTracks(ctx context.Context, albumID string) ([]domain.Track, error) {
	return u.Tracks.List(ctx, albumID)
}

func (u *LibraryUsecase) TrackFilePath(ctx context.Context, id string) (string, error) {
	return u.Tracks.GetFilePath(ctx, id)
}

func (u *LibraryUsecase) SmartQueue(ctx context.Context, trackID string, limit int) ([]domain.Track, error) {
	return u.Tracks.SmartQueue(ctx, trackID, limit)
}

func (u *LibraryUsecase) RecordPlay(ctx context.Context, trackID string) error {
	return u.Tracks.RecordPlay(ctx, trackID)
}

func (u *LibraryUsecase) SearchAll(ctx context.Context, q string) (*domain.SearchResult, error) {
	return u.Search.Search(ctx, q)
}

func (u *LibraryUsecase) GetStats(ctx context.Context) (*domain.Stats, error) {
	return u.Stats.Get(ctx)
}

func (u *LibraryUsecase) IsEmpty(ctx context.Context) bool {
	return u.Tracks.IsEmpty(ctx)
}

func (u *LibraryUsecase) TrackMeta(ctx context.Context, id string) (*domain.TrackMeta, error) {
	return u.Tracks.GetMeta(ctx, id)
}
