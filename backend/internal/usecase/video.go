package usecase

import (
	"context"
	"cozyroom/internal/domain"
)

type VideoUsecase struct {
	Videos domain.VideoRepository
}

func (u *VideoUsecase) ListVideos(ctx context.Context) ([]domain.Video, error) {
	return u.Videos.List(ctx)
}

func (u *VideoUsecase) GetVideo(ctx context.Context, id string) (*domain.Video, error) {
	return u.Videos.GetByID(ctx, id)
}
