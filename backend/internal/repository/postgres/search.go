package postgres

import (
	"context"
	"database/sql"

	"cozyroom/internal/domain"
)

type SearchRepo struct{ DB *sql.DB }

func (r *SearchRepo) Search(ctx context.Context, query string) (*domain.SearchResult, error) {
	lk := "%" + query + "%"
	result := &domain.SearchResult{
		Artists: []domain.Artist{},
		Albums:  []domain.SearchAlbum{},
		Tracks:  []domain.SearchTrack{},
	}

	// Artists
	rows, err := r.DB.QueryContext(ctx,
		`SELECT id, name FROM artists WHERE f_unaccent(name) ILIKE f_unaccent($1) ORDER BY name LIMIT 20`, lk)
	if err == nil {
		seen := map[string]bool{}
		for rows.Next() {
			var a domain.Artist
			rows.Scan(&a.ID, &a.Name)
			if !seen[a.ID] {
				seen[a.ID] = true
				result.Artists = append(result.Artists, a)
			}
		}
		rows.Close()
	}

	// Albums (by title or artist name)
	rows, err = r.DB.QueryContext(ctx,
		`SELECT al.id, al.artist_id, ar.name, al.title, COALESCE(al.year,0), COALESCE(al.cover_path,'')
		 FROM albums al JOIN artists ar ON ar.id = al.artist_id
		 WHERE f_unaccent(al.title) ILIKE f_unaccent($1) OR f_unaccent(ar.name) ILIKE f_unaccent($1)
		 ORDER BY al.title LIMIT 20`, lk)
	if err == nil {
		seen := map[string]bool{}
		for rows.Next() {
			var a domain.SearchAlbum
			rows.Scan(&a.ID, &a.ArtistID, &a.ArtistName, &a.Title, &a.Year, &a.CoverURL)
			if !seen[a.ID] {
				seen[a.ID] = true
				result.Albums = append(result.Albums, a)
			}
		}
		rows.Close()
	}

	// Tracks (by title, artist name, or album title)
	rows, err = r.DB.QueryContext(ctx,
		`SELECT t.id, t.album_id, al.title, t.title, COALESCE(t.track_num,0), ar.name, COALESCE(t.duration_s,0), ar.id
		 FROM tracks t JOIN albums al ON al.id = t.album_id JOIN artists ar ON ar.id = al.artist_id
		 WHERE f_unaccent(t.title) ILIKE f_unaccent($1) OR f_unaccent(ar.name) ILIKE f_unaccent($1) OR f_unaccent(al.title) ILIKE f_unaccent($1)
		 ORDER BY t.title LIMIT 30`, lk)
	if err == nil {
		seen := map[string]bool{}
		for rows.Next() {
			var t domain.SearchTrack
			rows.Scan(&t.ID, &t.AlbumID, &t.AlbumTitle, &t.Title, &t.TrackNum, &t.ArtistName, &t.DurationS, &t.ArtistID)
			if !seen[t.ID] {
				seen[t.ID] = true
				result.Tracks = append(result.Tracks, t)
			}
		}
		rows.Close()
	}
	return result, nil
}

