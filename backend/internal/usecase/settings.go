package usecase

import (
	"context"

	"cozyroom/internal/domain"
)

// SettingsUsecase manages key-value settings (e.g. Last.fm credentials).
type SettingsUsecase struct {
	Settings domain.SettingsRepository
}

func (u *SettingsUsecase) Get(ctx context.Context, key string) (string, error) {
	return u.Settings.Get(ctx, key)
}

func (u *SettingsUsecase) Set(ctx context.Context, key, value string) error {
	return u.Settings.Set(ctx, key, value)
}

func (u *SettingsUsecase) Delete(ctx context.Context, keys ...string) error {
	return u.Settings.Delete(ctx, keys...)
}
