package usecase

import (
	"context"
	"cozyroom/internal/domain"
)

type EbookUsecase struct {
	repoFactory domain.UnitOfWorkFactory
}

func NewEbookUsecase(f domain.UnitOfWorkFactory) *EbookUsecase {
	return &EbookUsecase{repoFactory: f}
}

func (u *EbookUsecase) ListEbooks(ctx context.Context) ([]domain.Ebook, error) {
	uow, err := u.repoFactory.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer uow.Rollback()
	return uow.Ebooks().List(ctx)
}

func (u *EbookUsecase) GetEbookByID(ctx context.Context, id string) (*domain.Ebook, error) {
	uow, err := u.repoFactory.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer uow.Rollback()
	return uow.Ebooks().GetByID(ctx, id)
}

func (u *EbookUsecase) EbookFilePath(ctx context.Context, id string) (string, error) {
	uow, err := u.repoFactory.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer uow.Rollback()
	e, err := uow.Ebooks().GetByID(ctx, id)
	if err != nil || e == nil {
		return "", err
	}
	return e.FilePath, nil
}

func (u *EbookUsecase) SetNSFW(ctx context.Context, id string, isNSFW bool) error {
	uow, err := u.repoFactory.Begin(ctx)
	if err != nil {
		return err
	}
	defer uow.Rollback()

	if err := uow.Ebooks().SetNSFW(ctx, id, isNSFW); err != nil {
		return err
	}
	return uow.Commit()
}

func (u *EbookUsecase) SetProgress(ctx context.Context, id string, progress string) error {
	uow, err := u.repoFactory.Begin(ctx)
	if err != nil {
		return err
	}
	defer uow.Rollback()

	if err := uow.Ebooks().SetProgress(ctx, id, progress); err != nil {
		return err
	}
	return uow.Commit()
}

func (u *EbookUsecase) SetCollection(ctx context.Context, id string, collection string) error {
	uow, err := u.repoFactory.Begin(ctx)
	if err != nil {
		return err
	}
	defer uow.Rollback()

	if err := uow.Ebooks().SetCollection(ctx, id, collection); err != nil {
		return err
	}
	return uow.Commit()
}
