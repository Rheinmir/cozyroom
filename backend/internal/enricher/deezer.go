package enricher

import (
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"cozyroom/internal/domain"
	"golang.org/x/image/draw"
)

// DeezerProvider implements ArtistImageProvider via the Deezer public API.
type DeezerProvider struct{}

type deezerResp struct {
	Data []struct {
		Name       string `json:"name"`
		PictureXL  string `json:"picture_xl"`
		PictureBig string `json:"picture_big"`
		PictureMed string `json:"picture_medium"`
	} `json:"data"`
}

func (DeezerProvider) ArtistImageURL(ctx context.Context, artistName string) (string, error) {
	apiURL := "https://api.deezer.com/search/artist?q=" + url.QueryEscape(artistName) + "&limit=1"
	resp, err := http.Get(apiURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var dr deezerResp
	if err := json.NewDecoder(resp.Body).Decode(&dr); err != nil {
		return "", err
	}
	if len(dr.Data) == 0 {
		return "", fmt.Errorf("no results")
	}

	da := dr.Data[0]
	for _, u := range []string{da.PictureXL, da.PictureBig, da.PictureMed} {
		if u != "" {
			return u, nil
		}
	}
	return "", fmt.Errorf("no picture URL")
}

// separators for multi-artist names (ordered by priority)
var artistSeparators = []string{", ", "; ", " & ", " feat. ", " ft. ", " vs. ", " x "}

// splitArtists splits a combined artist name by common separators.
// Returns up to 4 individual names; nil if no separator found.
func splitArtists(name string) []string {
	// First pass: try separators with surrounding spaces (highest priority)
	for _, sep := range artistSeparators {
		parts := strings.Split(name, sep)
		if len(parts) > 1 {
			var result []string
			for _, p := range parts {
				p = strings.TrimSpace(p)
				if p != "" {
					result = append(result, p)
					if len(result) >= 4 {
						break
					}
				}
			}
			return result
		}
	}

	// Second pass: trim trailing separator (e.g. "Alan Walker;" → "Alan Walker")
	trimmed := strings.TrimRight(name, ",;&")
	if trimmed != name {
		return []string{strings.TrimSpace(trimmed)}
	}

	// Third pass: try bare separators (no space) as fallback
	for _, bare := range []string{",", ";", "&"} {
		parts := strings.Split(name, bare)
		if len(parts) > 1 {
			var result []string
			for _, p := range parts {
				p = strings.TrimSpace(p)
				if p != "" {
					result = append(result, p)
					if len(result) >= 4 {
						break
					}
				}
			}
			return result
		}
	}

	return nil
}

// compositeImages composites a grid image from individual artist images.
func compositeImages(images []image.Image, destPath string) error {
	if len(images) == 1 {
		f, err := os.Create(destPath)
		if err != nil {
			return err
		}
		defer f.Close()
		return jpeg.Encode(f, images[0], &jpeg.Options{Quality: 90})
	}

	// Cell size = largest dimension across all images
	cellW, cellH := 0, 0
	for _, img := range images {
		b := img.Bounds()
		if b.Dx() > cellW {
			cellW = b.Dx()
		}
		if b.Dy() > cellH {
			cellH = b.Dy()
		}
	}

	// Layout: 1-3 artists = single row, 4 artists = 2x2 grid
	cols := len(images)
	rows := 1
	if len(images) == 4 {
		cols, rows = 2, 2
	}

	dst := image.NewRGBA(image.Rect(0, 0, cellW*cols, cellH*rows))

	for i, img := range images {
		col := i % cols
		row := i / cols
		x := col * cellW
		y := row * cellH

		// Resize each to cell size
		rs := image.NewRGBA(image.Rect(0, 0, cellW, cellH))
		draw.ApproxBiLinear.Scale(rs, rs.Bounds(), img, img.Bounds(), draw.Over, nil)

		draw.Draw(dst, image.Rect(x, y, x+cellW, y+cellH), rs, image.Point{}, draw.Over)
	}

	f, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer f.Close()
	return jpeg.Encode(f, dst, &jpeg.Options{Quality: 90})
}

// FetchArtistImages queries provider for each artist missing a local image,
// downloads the photo to imagesDir, and updates artists.image_path.
// Also re-fetches artists whose DB path is set but the file no longer exists on disk.
// Rate-limited to ~3 req/sec to stay polite.
func FetchArtistImages(provider ArtistImageProvider, repo domain.ArtistRepository, imagesDir string) {
	if err := os.MkdirAll(imagesDir, 0755); err != nil {
		log.Printf("enricher: mkdir: %v", err)
		return
	}

	ctx := context.Background()
	artists, err := repo.ListWithoutImage(ctx)
	if err != nil {
		log.Printf("enricher: query: %v", err)
		return
	}

	// Also collect artists whose DB path is set but the file is missing (e.g. after volume wipe).
	allArtists, err := repo.List(ctx)
	if err == nil {
		for _, a := range allArtists {
			if a.ImageURL == "" {
				continue
			}
			dest := filepath.Join(imagesDir, a.ID+".jpg")
			if _, statErr := os.Stat(dest); os.IsNotExist(statErr) {
				// File gone — reset DB so enricher will re-fetch.
				_ = repo.SetImagePath(ctx, a.ID, "")
				artists = append(artists, domain.Artist{ID: a.ID, Name: a.Name})
			}
		}
	}

	log.Printf("enricher: fetching images for %d artists", len(artists))
	ok := 0
	for i, a := range artists {
		if fetchArtistImage(provider, repo, a.ID, a.Name, imagesDir) == nil {
			ok++
		}
		if i < len(artists)-1 {
			time.Sleep(350 * time.Millisecond)
		}
	}
	log.Printf("enricher: done — %d/%d images fetched", ok, len(artists))
}

func fetchArtistImage(provider ArtistImageProvider, repo domain.ArtistRepository, artistID, name, imagesDir string) error {
	ctx := context.Background()
	parts := splitArtists(name)

	// Single artist — original direct-download flow
	if len(parts) <= 1 {
		picURL, err := provider.ArtistImageURL(ctx, name)
		if err != nil {
			return err
		}
		if err := downloadImage(picURL, filepath.Join(imagesDir, artistID+".jpg")); err != nil {
			return err
		}
		return repo.SetImagePath(ctx, artistID, "/api/artist-images/"+artistID)
	}

	// Multi-artist — fetch each individual image, then composite
	_ = os.MkdirAll(filepath.Join(imagesDir, "parts"), 0755)
	var images []image.Image
	for _, part := range parts {
		picURL, err := provider.ArtistImageURL(ctx, part)
		if err != nil {
			log.Printf("enricher: no image for '%s' (part of '%s'): %v", part, name, err)
			continue
		}
		imgResp, err := http.Get(picURL)
		if err != nil {
			log.Printf("enricher: download failed for '%s': %v", part, err)
			continue
		}
		img, _, err := image.Decode(imgResp.Body)
		imgResp.Body.Close()
		if err != nil {
			log.Printf("enricher: decode failed for '%s': %v", part, err)
			continue
		}
		images = append(images, img)
	}

	if len(images) == 0 {
		return fmt.Errorf("no images found for any artist in '%s'", name)
	}

	dest := filepath.Join(imagesDir, artistID+".jpg")
	if err := compositeImages(images, dest); err != nil {
		return fmt.Errorf("composite: %w", err)
	}
	return repo.SetImagePath(ctx, artistID, "/api/artist-images/"+artistID)
}

func downloadImage(picURL, dest string) error {
	resp, err := http.Get(picURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	f, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, resp.Body)
	return err
}
