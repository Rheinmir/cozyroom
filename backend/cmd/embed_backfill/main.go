// Command embed_backfill (re)indexes the music library into the embeddings
// table for semantic search. Runs as a one-off k8s Job using the backend image;
// reads DATABASE_URL + EMBED_URL from the environment (same as the server).
package main

import (
	"context"
	"log"
	"os"
	"time"

	"cozyroom/internal/db"
	"cozyroom/internal/embed"
	repo "cozyroom/internal/repository/postgres"
	"cozyroom/internal/usecase"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("[backfill] DATABASE_URL is required")
	}
	// db.Open runs migrate(), which ensures the vector extension + embeddings
	// table exist before we write to them.
	database, err := db.Open(dbURL)
	if err != nil {
		log.Fatalf("[backfill] db open: %v", err)
	}
	defer database.Close()

	ix := &usecase.EmbedIndexer{
		DB:    database.DB,
		Embed: embed.New(),
		Emb:   &repo.EmbeddingsRepo{DB: database.DB},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	log.Println("[backfill] starting music backfill (artists, albums, tracks)...")
	start := time.Now()
	n, err := ix.BackfillMusic(ctx)
	if err != nil {
		log.Fatalf("[backfill] failed after %d embeddings: %v", n, err)
	}
	log.Printf("[backfill] done: %d embeddings upserted in %s", n, time.Since(start).Round(time.Second))
}
