package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"cozyroom/internal/domain"
	"cozyroom/internal/embed"
)

// SearchRepo runs the site search. Lexical (pg_trgm ILIKE, always) is fused with
// semantic vector KNN (pgvector) when the embedding sidecar + embeddings table
// are available; if either is missing/unhealthy the search degrades cleanly to
// lexical-only, so it is never worse than before semantic search existed.
type SearchRepo struct {
	DB    *sql.DB
	Embed *embed.Client    // nil → vector layer skipped
	Emb   *EmbeddingsRepo  // nil → vector layer skipped
}

func (r *SearchRepo) Search(ctx context.Context, query string) (*domain.SearchResult, error) {
	lk := "%" + query + "%"
	result := &domain.SearchResult{
		Artists: []domain.Artist{},
		Albums:  []domain.SearchAlbum{},
		Tracks:  []domain.SearchTrack{},
	}

	// ── Lexical (unchanged) — also record rank order for RRF fusion ──
	artistRank := map[string]int{}
	rows, err := r.DB.QueryContext(ctx,
		`SELECT id, name FROM artists WHERE f_unaccent(name) ILIKE f_unaccent($1) ORDER BY name LIMIT 20`, lk)
	if err == nil {
		for rows.Next() {
			var a domain.Artist
			rows.Scan(&a.ID, &a.Name)
			if _, seen := artistRank[a.ID]; !seen {
				artistRank[a.ID] = len(result.Artists)
				result.Artists = append(result.Artists, a)
			}
		}
		rows.Close()
	}

	albumRank := map[string]int{}
	rows, err = r.DB.QueryContext(ctx,
		`SELECT al.id, al.artist_id, ar.name, al.title, COALESCE(al.year,0), COALESCE(al.cover_path,'')
		 FROM albums al JOIN artists ar ON ar.id = al.artist_id
		 WHERE f_unaccent(al.title) ILIKE f_unaccent($1) OR f_unaccent(ar.name) ILIKE f_unaccent($1)
		 ORDER BY al.title LIMIT 20`, lk)
	if err == nil {
		for rows.Next() {
			var a domain.SearchAlbum
			rows.Scan(&a.ID, &a.ArtistID, &a.ArtistName, &a.Title, &a.Year, &a.CoverURL)
			if _, seen := albumRank[a.ID]; !seen {
				albumRank[a.ID] = len(result.Albums)
				result.Albums = append(result.Albums, a)
			}
		}
		rows.Close()
	}

	trackRank := map[string]int{}
	rows, err = r.DB.QueryContext(ctx,
		`SELECT t.id, t.album_id, al.title, t.title, COALESCE(t.track_num,0), ar.name, COALESCE(t.duration_s,0), ar.id
		 FROM tracks t JOIN albums al ON al.id = t.album_id JOIN artists ar ON ar.id = al.artist_id
		 WHERE f_unaccent(t.title) ILIKE f_unaccent($1) OR f_unaccent(ar.name) ILIKE f_unaccent($1) OR f_unaccent(al.title) ILIKE f_unaccent($1)
		 ORDER BY t.title LIMIT 30`, lk)
	if err == nil {
		for rows.Next() {
			var t domain.SearchTrack
			rows.Scan(&t.ID, &t.AlbumID, &t.AlbumTitle, &t.Title, &t.TrackNum, &t.ArtistName, &t.DurationS, &t.ArtistID)
			if _, seen := trackRank[t.ID]; !seen {
				trackRank[t.ID] = len(result.Tracks)
				result.Tracks = append(result.Tracks, t)
			}
		}
		rows.Close()
	}

	// ── Semantic fusion (best-effort; skipped on any failure) ──
	r.fuseVector(ctx, query, result, artistRank, albumRank, trackRank)
	return result, nil
}

const rrfK = 60.0 // Reciprocal Rank Fusion constant (standard default)

// fuseVector embeds the query, KNN-searches embeddings, hydrates any hits not
// already present, and reorders each result list by RRF of (lexical, vector)
// ranks. Any error leaves `result` as the pure-lexical result.
func (r *SearchRepo) fuseVector(ctx context.Context, query string, result *domain.SearchResult, aRank, alRank, tRank map[string]int) {
	if r.Embed == nil || r.Emb == nil {
		return
	}
	// e5 models expect the "query:" instruction prefix for search queries.
	qvec, err := r.Embed.EmbedOne(ctx, "query: "+query)
	if err != nil {
		return // sidecar down → lexical-only
	}
	hits, err := r.Emb.Search(ctx, qvec, []string{"artist", "album", "track"}, 30)
	if err != nil || len(hits) == 0 {
		return // empty embeddings table (pre-backfill) → lexical-only
	}

	vRank := map[string]map[string]int{"artist": {}, "album": {}, "track": {}}
	var newArtists, newAlbums, newTracks []string
	for _, h := range hits {
		m := vRank[h.EntityType]
		if m == nil {
			continue
		}
		if _, ok := m[h.EntityID]; ok {
			continue
		}
		m[h.EntityID] = len(m)
		switch h.EntityType {
		case "artist":
			if _, seen := aRank[h.EntityID]; !seen {
				newArtists = append(newArtists, h.EntityID)
			}
		case "album":
			if _, seen := alRank[h.EntityID]; !seen {
				newAlbums = append(newAlbums, h.EntityID)
			}
		case "track":
			if _, seen := tRank[h.EntityID]; !seen {
				newTracks = append(newTracks, h.EntityID)
			}
		}
	}

	// Hydrate vector-only hits so they can join the result set.
	for _, a := range r.fetchArtistsByIDs(ctx, newArtists) {
		aRank[a.ID] = len(result.Artists) // append after lexical hits
		result.Artists = append(result.Artists, a)
	}
	for _, a := range r.fetchAlbumsByIDs(ctx, newAlbums) {
		alRank[a.ID] = len(result.Albums)
		result.Albums = append(result.Albums, a)
	}
	for _, t := range r.fetchTracksByIDs(ctx, newTracks) {
		tRank[t.ID] = len(result.Tracks)
		result.Tracks = append(result.Tracks, t)
	}

	// Reorder each list by RRF of lexical + vector ranks.
	sortByRRF(result.Artists, func(a domain.Artist) string { return a.ID }, aRank, vRank["artist"])
	sortByRRF(result.Albums, func(a domain.SearchAlbum) string { return a.ID }, alRank, vRank["album"])
	sortByRRF(result.Tracks, func(t domain.SearchTrack) string { return t.ID }, tRank, vRank["track"])
}

func rrfScore(id string, lex, vec map[string]int) float64 {
	var s float64
	if rk, ok := lex[id]; ok {
		s += 1.0 / (rrfK + float64(rk))
	}
	if rk, ok := vec[id]; ok {
		s += 1.0 / (rrfK + float64(rk))
	}
	return s
}

// sortByRRF stable-sorts items descending by combined RRF score (simple
// insertion sort — result lists are tiny, ≤50).
func sortByRRF[T any](items []T, id func(T) string, lex, vec map[string]int) {
	for i := 1; i < len(items); i++ {
		for j := i; j > 0 && rrfScore(id(items[j]), lex, vec) > rrfScore(id(items[j-1]), lex, vec); j-- {
			items[j], items[j-1] = items[j-1], items[j]
		}
	}
}

// placeholders builds "$1,$2,..." starting at 1 for an IN (...) list.
func placeholders(n int) string {
	ph := make([]string, n)
	for i := range ph {
		ph[i] = fmt.Sprintf("$%d", i+1)
	}
	return strings.Join(ph, ",")
}

func idArgs(ids []string) []any {
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	return args
}

func (r *SearchRepo) fetchArtistsByIDs(ctx context.Context, ids []string) []domain.Artist {
	if len(ids) == 0 {
		return nil
	}
	rows, err := r.DB.QueryContext(ctx,
		`SELECT id, name FROM artists WHERE id IN (`+placeholders(len(ids))+`)`, idArgs(ids)...)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []domain.Artist
	for rows.Next() {
		var a domain.Artist
		rows.Scan(&a.ID, &a.Name)
		out = append(out, a)
	}
	return out
}

func (r *SearchRepo) fetchAlbumsByIDs(ctx context.Context, ids []string) []domain.SearchAlbum {
	if len(ids) == 0 {
		return nil
	}
	rows, err := r.DB.QueryContext(ctx,
		`SELECT al.id, al.artist_id, ar.name, al.title, COALESCE(al.year,0), COALESCE(al.cover_path,'')
		 FROM albums al JOIN artists ar ON ar.id = al.artist_id
		 WHERE al.id IN (`+placeholders(len(ids))+`)`, idArgs(ids)...)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []domain.SearchAlbum
	for rows.Next() {
		var a domain.SearchAlbum
		rows.Scan(&a.ID, &a.ArtistID, &a.ArtistName, &a.Title, &a.Year, &a.CoverURL)
		out = append(out, a)
	}
	return out
}

func (r *SearchRepo) fetchTracksByIDs(ctx context.Context, ids []string) []domain.SearchTrack {
	if len(ids) == 0 {
		return nil
	}
	rows, err := r.DB.QueryContext(ctx,
		`SELECT t.id, t.album_id, al.title, t.title, COALESCE(t.track_num,0), ar.name, COALESCE(t.duration_s,0), ar.id
		 FROM tracks t JOIN albums al ON al.id = t.album_id JOIN artists ar ON ar.id = al.artist_id
		 WHERE t.id IN (`+placeholders(len(ids))+`)`, idArgs(ids)...)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []domain.SearchTrack
	for rows.Next() {
		var t domain.SearchTrack
		rows.Scan(&t.ID, &t.AlbumID, &t.AlbumTitle, &t.Title, &t.TrackNum, &t.ArtistName, &t.DurationS, &t.ArtistID)
		out = append(out, t)
	}
	return out
}
