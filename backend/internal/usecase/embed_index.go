package usecase

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"cozyroom/internal/domain"
	"cozyroom/internal/embed"
)

// embedBatch is the sidecar's hard cap: text-embeddings-inference with e5-base
// logs "forcing max_batch_requests=8", so requests larger than 8 are rejected.
const embedBatch = 8

// EmbedIndexer builds text representations of library entities, embeds them via
// the sidecar, and upserts the vectors. Documents use the e5 "passage:" prefix
// (queries use "query:" on the search side).
type EmbedIndexer struct {
	DB    *sql.DB
	Embed *embed.Client
	Emb   domain.EmbeddingRepository
}

type indexItem struct {
	id      string
	content string
}

// BackfillMusic (re)indexes every artist, album and track. Returns the number of
// embeddings upserted.
func (ix *EmbedIndexer) BackfillMusic(ctx context.Context) (int, error) {
	total := 0
	specs := []struct {
		entityType string
		query      string
		scan       func(*sql.Rows) (indexItem, error)
	}{
		{"artist",
			`SELECT id, name FROM artists`,
			func(r *sql.Rows) (indexItem, error) {
				var id, name string
				err := r.Scan(&id, &name)
				return indexItem{id, "passage: " + name}, err
			}},
		{"album",
			`SELECT al.id, al.title, ar.name FROM albums al JOIN artists ar ON ar.id = al.artist_id`,
			func(r *sql.Rows) (indexItem, error) {
				var id, title, artist string
				err := r.Scan(&id, &title, &artist)
				return indexItem{id, "passage: " + joinNonEmpty(title, artist)}, err
			}},
		{"track",
			`SELECT t.id, t.title, ar.name, al.title, COALESCE(t.genre,'')
			 FROM tracks t JOIN albums al ON al.id = t.album_id JOIN artists ar ON ar.id = al.artist_id`,
			func(r *sql.Rows) (indexItem, error) {
				var id, title, artist, album, genre string
				err := r.Scan(&id, &title, &artist, &album, &genre)
				return indexItem{id, "passage: " + joinNonEmpty(title, artist, album, genre)}, err
			}},
	}

	for _, s := range specs {
		items, err := ix.collect(ctx, s.query, s.scan)
		if err != nil {
			return total, fmt.Errorf("collect %s: %w", s.entityType, err)
		}
		n, err := ix.embedAndUpsert(ctx, s.entityType, items)
		total += n
		if err != nil {
			return total, fmt.Errorf("index %s: %w", s.entityType, err)
		}
	}
	return total, nil
}

// IndexTrack/IndexAlbum/IndexArtist re-embed a single entity — for the scanner to
// call on create/update (incremental indexing).
func (ix *EmbedIndexer) IndexArtist(ctx context.Context, id, name string) error {
	return ix.one(ctx, "artist", id, "passage: "+name)
}
func (ix *EmbedIndexer) IndexAlbum(ctx context.Context, id, title, artist string) error {
	return ix.one(ctx, "album", id, "passage: "+joinNonEmpty(title, artist))
}
func (ix *EmbedIndexer) IndexTrack(ctx context.Context, id, title, artist, album, genre string) error {
	return ix.one(ctx, "track", id, "passage: "+joinNonEmpty(title, artist, album, genre))
}

func (ix *EmbedIndexer) one(ctx context.Context, entityType, id, content string) error {
	vec, err := ix.Embed.EmbedOne(ctx, content)
	if err != nil {
		return err
	}
	return ix.Emb.Upsert(ctx, entityType, id, content, vec)
}

func (ix *EmbedIndexer) collect(ctx context.Context, query string, scan func(*sql.Rows) (indexItem, error)) ([]indexItem, error) {
	rows, err := ix.DB.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []indexItem
	for rows.Next() {
		it, err := scan(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

func (ix *EmbedIndexer) embedAndUpsert(ctx context.Context, entityType string, items []indexItem) (int, error) {
	done := 0
	for start := 0; start < len(items); start += embedBatch {
		end := start + embedBatch
		if end > len(items) {
			end = len(items)
		}
		batch := items[start:end]
		texts := make([]string, len(batch))
		for i, it := range batch {
			texts[i] = it.content
		}
		vecs, err := ix.Embed.Embed(ctx, texts)
		if err != nil {
			return done, err
		}
		for i, it := range batch {
			if err := ix.Emb.Upsert(ctx, entityType, it.id, it.content, vecs[i]); err != nil {
				return done, err
			}
			done++
		}
	}
	return done, nil
}

func joinNonEmpty(parts ...string) string {
	kept := parts[:0]
	for _, p := range parts {
		if strings.TrimSpace(p) != "" {
			kept = append(kept, p)
		}
	}
	return strings.Join(kept, " — ")
}
