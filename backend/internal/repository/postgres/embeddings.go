package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"

	"cozyroom/internal/domain"
)

// EmbeddingsRepo persists and queries entity embeddings via pgvector.
type EmbeddingsRepo struct{ DB *sql.DB }

// vectorLiteral renders a float slice as pgvector's text input form "[a,b,c]",
// which the `::vector` cast accepts — avoids needing a pgvector-specific driver.
func vectorLiteral(v []float32) string {
	var b strings.Builder
	b.Grow(len(v)*8 + 2)
	b.WriteByte('[')
	for i, f := range v {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteString(strconv.FormatFloat(float64(f), 'f', -1, 32))
	}
	b.WriteByte(']')
	return b.String()
}

// Upsert stores (or replaces) the embedding for one entity.
func (r *EmbeddingsRepo) Upsert(ctx context.Context, entityType, entityID, content string, embedding []float32) error {
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO embeddings (entity_type, entity_id, content, embedding, updated_at)
		VALUES ($1, $2, $3, $4::vector, now())
		ON CONFLICT (entity_type, entity_id)
		DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding, updated_at = now()
	`, entityType, entityID, content, vectorLiteral(embedding))
	return err
}

// Search returns the nearest entities by cosine similarity, optionally limited to
// the given entity types. Score is cosine similarity in [-1,1] (higher = closer).
func (r *EmbeddingsRepo) Search(ctx context.Context, embedding []float32, entityTypes []string, limit int) ([]domain.VectorHit, error) {
	if limit <= 0 {
		limit = 20
	}
	args := []any{vectorLiteral(embedding)} // $1
	where := ""
	if len(entityTypes) > 0 {
		ph := make([]string, len(entityTypes))
		for i, t := range entityTypes {
			args = append(args, t)
			ph[i] = fmt.Sprintf("$%d", len(args))
		}
		where = "WHERE entity_type IN (" + strings.Join(ph, ",") + ")"
	}
	args = append(args, limit) // $N (last)
	q := fmt.Sprintf(`
		SELECT entity_type, entity_id, 1 - (embedding <=> $1::vector) AS score
		FROM embeddings
		%s
		ORDER BY embedding <=> $1::vector
		LIMIT $%d
	`, where, len(args))

	rows, err := r.DB.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var hits []domain.VectorHit
	for rows.Next() {
		var h domain.VectorHit
		if err := rows.Scan(&h.EntityType, &h.EntityID, &h.Score); err != nil {
			return nil, err
		}
		hits = append(hits, h)
	}
	return hits, rows.Err()
}
