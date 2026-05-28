package usecase

import (
	"context"

	"cozyroom/internal/domain"
)

// LyricsUsecase provides lyrics cache management.
type LyricsUsecase struct {
	Cache domain.LyricsCacheRepository
}

func (u *LyricsUsecase) GetCached(ctx context.Context, trackID string) (string, error) {
	return u.Cache.Get(ctx, trackID)
}

func (u *LyricsUsecase) SetCached(ctx context.Context, trackID, jsonData string) error {
	return u.Cache.Set(ctx, trackID, jsonData)
}

func (u *LyricsUsecase) DeleteCached(ctx context.Context, trackID string) error {
	return u.Cache.Delete(ctx, trackID)
}
