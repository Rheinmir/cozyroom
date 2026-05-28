package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"cozyroom/internal/metrics"
	"cozyroom/internal/transcode"
	"cozyroom/internal/usecase"
	xdraw "golang.org/x/image/draw"
)

type handlers struct {
	lib          *usecase.LibraryUsecase
	lyrics       *usecase.LyricsUsecase
	settings     *usecase.SettingsUsecase
	playback     *usecase.PlaybackUsecase
	scanDB       *sql.DB // only for scanner/enricher (own internal TXs)
	dbPath       string
	musicPath    string
	filmsPath    string
	coversDir    string
	artistImgDir string
	lyricsDir    string
	lastfmKey    string
	lastfmSecret string
	video        *usecase.VideoUsecase
	ebook        *usecase.EbookUsecase
	ebooksPath   string
	ebookCoversDir string
}

var hexID = regexp.MustCompile(`^[0-9a-f]{16}$`)

var resizeWhitelist = map[int]bool{80: true, 200: true, 300: true, 400: true, 512: true}

// serveResizedImage serves id+".jpg" from imgDir, optionally resizing to ?w=N.
// Resized copies are cached in imgDir/resized/. Always sets a 7-day Cache-Control.
func serveResizedImage(w http.ResponseWriter, r *http.Request, imgDir, id string) {
	filePath := filepath.Join(imgDir, id+".jpg")
	w.Header().Set("Cache-Control", "public, max-age=604800")

	width, err := strconv.Atoi(r.URL.Query().Get("w"))
	if err != nil || !resizeWhitelist[width] {
		http.ServeFile(w, r, filePath)
		return
	}

	resizedDir := filepath.Join(imgDir, "resized")
	resizedPath := filepath.Join(resizedDir, fmt.Sprintf("%s_%d.jpg", id, width))

	if _, statErr := os.Stat(resizedPath); statErr == nil {
		http.ServeFile(w, r, resizedPath)
		return
	}

	f, openErr := os.Open(filePath)
	if openErr != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()

	srcImg, decErr := jpeg.Decode(f)
	if decErr != nil {
		http.ServeFile(w, r, filePath)
		return
	}

	bounds := srcImg.Bounds()
	if width >= bounds.Dx() {
		http.ServeFile(w, r, filePath)
		return
	}

	newH := bounds.Dy() * width / bounds.Dx()
	dst := image.NewRGBA(image.Rect(0, 0, width, newH))
	xdraw.BiLinear.Scale(dst, dst.Bounds(), srcImg, bounds, xdraw.Over, nil)

	if mkErr := os.MkdirAll(resizedDir, 0755); mkErr != nil {
		log.Printf("serveResizedImage mkdir %s: %v", resizedDir, mkErr)
		http.ServeFile(w, r, filePath)
		return
	}

	out, createErr := os.Create(resizedPath)
	if createErr != nil {
		log.Printf("serveResizedImage create %s: %v", resizedPath, createErr)
		http.ServeFile(w, r, filePath)
		return
	}

	if encErr := jpeg.Encode(out, dst, &jpeg.Options{Quality: 75}); encErr != nil {
		out.Close()
		os.Remove(resizedPath)
		log.Printf("serveResizedImage encode %s: %v", resizedPath, encErr)
		http.ServeFile(w, r, filePath)
		return
	}
	out.Close()

	http.ServeFile(w, r, resizedPath)
}

func (h *handlers) health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "version": "0.1.0"})
}

func (h *handlers) stats(w http.ResponseWriter, r *http.Request) {
	s, err := h.lib.GetStats(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

func (h *handlers) scan(w http.ResponseWriter, r *http.Request) {
	// Scan still uses the library package directly — it has its own internal
	// transaction via UoW (see library/scanner.go refactor).
	scanLibrary(h, w)
}

func (h *handlers) cover(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if strings.HasPrefix(id, "yt:") {
		ytID := id[3:]
		if len(ytID) != 11 {
			http.NotFound(w, r)
			return
		}
		cachePath := filepath.Join(h.coversDir, "yt_"+ytID+".jpg")
		if _, err := os.Stat(cachePath); os.IsNotExist(err) {
			client := &http.Client{Timeout: 8 * time.Second}
			urls := []string{
				"https://i.ytimg.com/vi/" + ytID + "/mqdefault.jpg",
				"https://i.ytimg.com/vi/" + ytID + "/hqdefault.jpg",
				"https://img.youtube.com/vi/" + ytID + "/mqdefault.jpg",
			}
			var saved bool
			for _, u := range urls {
				ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
				req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
				resp, err := client.Do(req)
				cancel()
				if err != nil || resp.StatusCode != http.StatusOK {
					if resp != nil {
						resp.Body.Close()
					}
					continue
				}
				f, err := os.Create(cachePath)
				if err != nil {
					resp.Body.Close()
					break
				}
				_, copyErr := io.Copy(f, resp.Body)
				f.Close()
				resp.Body.Close()
				if copyErr == nil {
					saved = true
				} else {
					os.Remove(cachePath)
				}
				break
			}
			if !saved {
				http.NotFound(w, r)
				return
			}
		}
		http.ServeFile(w, r, cachePath)
		return
	}
	if !hexID.MatchString(id) {
		http.NotFound(w, r)
		return
	}
	serveResizedImage(w, r, h.coversDir, id)
}

func (h *handlers) artistImage(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !hexID.MatchString(id) {
		http.NotFound(w, r)
		return
	}
	serveResizedImage(w, r, h.artistImgDir, id)
}

func (h *handlers) artistDetail(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !hexID.MatchString(id) {
		http.NotFound(w, r)
		return
	}
	detail, err := h.lib.ArtistDetail(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if detail == nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(detail)
}

func (h *handlers) listArtists(w http.ResponseWriter, r *http.Request) {
	artists, err := h.lib.ListArtists(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(artists)
}

func (h *handlers) listAlbums(w http.ResponseWriter, r *http.Request) {
	artistID := r.URL.Query().Get("artist_id")
	albums, err := h.lib.ListAlbums(r.Context(), artistID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(albums)
}

func (h *handlers) listTracks(w http.ResponseWriter, r *http.Request) {
	albumID := r.URL.Query().Get("album_id")
	tracks, err := h.lib.ListTracks(r.Context(), albumID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tracks)
}

func (h *handlers) stream(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	filePath, err := h.lib.TrackFilePath(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if filePath == "" {
		http.NotFound(w, r)
		return
	}

	// ?q=320 → transcode lossless to 320 kbps MP3 on the fly via ffmpeg
	if r.URL.Query().Get("q") == "320" && transcode.IsLossless(filePath) {
		w.Header().Set("Content-Type", "audio/mpeg")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("X-Quality", "320kbps-mp3")
		metrics.StreamsTotal.WithLabelValues("320kbps").Inc()
		if err := transcode.ToMP3_320(r.Context(), filePath, w); err != nil {
			log.Printf("transcode %s: %v", id, err)
			metrics.StreamErrorsTotal.WithLabelValues("320kbps", "transcode_failed").Inc()
		}
		return
	}

	// Default: serve file with Range support (lossless passthrough)
	metrics.StreamsTotal.WithLabelValues("lossless").Inc()
	w.Header().Set("X-Quality", "lossless")
	http.ServeFile(w, r, filePath)
}

func (h *handlers) smartQueue(w http.ResponseWriter, r *http.Request) {
	trackID := r.URL.Query().Get("track_id")
	if !hexID.MatchString(trackID) {
		http.Error(w, "invalid track_id", http.StatusBadRequest)
		return
	}
	metrics.SmartQueueTotal.Inc()
	limit := 30
	if n, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && n > 0 && n <= 100 {
		limit = n
	}

	tracks, err := h.lib.SmartQueue(r.Context(), trackID, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if tracks == nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tracks)
}

func (h *handlers) search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(q) >= 2 {
		metrics.SearchesTotal.Inc()
	}
	if len(q) < 2 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"artists": []any{}, "albums": []any{}, "tracks": []any{},
		})
		return
	}

	result, err := h.lib.SearchAll(r.Context(), q)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
