package usecase

import (
	"context"

	cozydb "cozyroom/internal/db"
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
	return u.write(ctx, func(uow domain.UnitOfWork) error {
		return uow.Ebooks().SetNSFW(ctx, id, isNSFW)
	})
}

func (u *EbookUsecase) SetProgress(ctx context.Context, id string, progress string) error {
	return u.write(ctx, func(uow domain.UnitOfWork) error {
		return uow.Ebooks().SetProgress(ctx, id, progress)
	})
}

func (u *EbookUsecase) SetCollection(ctx context.Context, id string, collection string) error {
	return u.write(ctx, func(uow domain.UnitOfWork) error {
		return uow.Ebooks().SetCollection(ctx, id, collection)
	})
}

// write runs fn in a unit of work, retrying the whole transaction on
// serialization failure (CockroachDB SERIALIZABLE).
func (u *EbookUsecase) write(ctx context.Context, fn func(domain.UnitOfWork) error) error {
	return cozydb.WithRetry(func() error {
		uow, err := u.repoFactory.Begin(ctx)
		if err != nil {
			return err
		}
		defer uow.Rollback()

		if err := fn(uow); err != nil {
			return err
		}
		return uow.Commit()
	})
}
