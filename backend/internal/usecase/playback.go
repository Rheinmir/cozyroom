package usecase

import (
	"context"

	"cozyroom/internal/domain"
)

type PlaybackUsecase struct {
	Playback domain.PlaybackRepository
}

func (u *PlaybackUsecase) Get(ctx context.Context, itemType, itemID string) (*domain.PlaybackProgress, error) {
	return u.Playback.Get(ctx, itemType, itemID)
}

func (u *PlaybackUsecase) Set(ctx context.Context, p domain.PlaybackProgress) error {
	return u.Playback.Set(ctx, p)
}
