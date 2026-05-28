package enricher

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"time"

	"cozyroom/internal/domain"
)

// TMDbProvider implements VideoPosterProvider via The Movie Database API.
// Requires a valid API key set via TMDB_API_KEY environment variable.
type TMDbProvider struct {
	APIKey string
}

type tmdbSearchResp struct {
	Results []struct {
		PosterPath string `json:"poster_path"`
	} `json:"results"`
}

func (p TMDbProvider) VideoPosterURL(ctx context.Context, title string) (string, error) {
	apiURL := "https://api.themoviedb.org/3/search/movie?api_key=" +
		url.QueryEscape(p.APIKey) + "&query=" + url.QueryEscape(title) + "&limit=1"
	resp, err := http.Get(apiURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var sr tmdbSearchResp
	if err := json.NewDecoder(resp.Body).Decode(&sr); err != nil {
		return "", err
	}
	if len(sr.Results) == 0 || sr.Results[0].PosterPath == "" {
		return "", fmt.Errorf("no poster found for %q", title)
	}
	return "https://image.tmdb.org/t/p/w500" + sr.Results[0].PosterPath, nil
}

// FetchVideoPosters queries provider for each video without a poster, downloads
// the image to postersDir, and updates videos.poster_path via repo.
// Rate-limited to ~2 req/sec.
func FetchVideoPosters(provider VideoPosterProvider, repo domain.VideoRepository, postersDir string) {
	if err := os.MkdirAll(postersDir, 0755); err != nil {
		log.Printf("enricher/tmdb: mkdir: %v", err)
		return
	}

	ctx := context.Background()
	videos, err := repo.List(ctx)
	if err != nil {
		log.Printf("enricher/tmdb: query: %v", err)
		return
	}

	// only process videos that have no poster yet
	var missing []domain.Video
	for _, v := range videos {
		if v.PosterURL == "" {
			missing = append(missing, v)
		}
	}
	if len(missing) == 0 {
		return
	}

	log.Printf("enricher/tmdb: fetching posters for %d videos", len(missing))
	ok := 0
	for i, v := range missing {
		if fetchVideoPoster(ctx, provider, repo, v.ID, v.Title, postersDir) == nil {
			ok++
		}
		if i < len(missing)-1 {
			time.Sleep(500 * time.Millisecond)
		}
	}
	log.Printf("enricher/tmdb: done — %d/%d posters fetched", ok, len(missing))
}

func fetchVideoPoster(ctx context.Context, provider VideoPosterProvider, repo domain.VideoRepository, videoID, title, postersDir string) error {
	posterURL, err := provider.VideoPosterURL(ctx, title)
	if err != nil {
		return err
	}

	img, err := http.Get(posterURL)
	if err != nil {
		return err
	}
	defer img.Body.Close()

	dest := filepath.Join(postersDir, videoID+".jpg")
	f, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer f.Close()
	if _, err := io.Copy(f, img.Body); err != nil {
		return err
	}

	return repo.SetPosterPath(ctx, videoID, "/api/video-posters/"+videoID)
}
