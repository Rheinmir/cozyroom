package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"time"

	"cozyroom/internal/library"
)

var reYouTubeID = regexp.MustCompile(`^[a-zA-Z0-9_-]{11}$`)

// streamURLCache caches yt-dlp signed stream URLs to avoid re-fetching on
// every play request. YouTube signed URLs are valid ~6h; we use 4h TTL.
type streamURLEntry struct {
	url       string
	expiresAt time.Time
}

var (
	streamCacheMu sync.Mutex
	streamCache   = make(map[string]streamURLEntry)
)

type searchCacheEntry struct {
	results   []youtubeSearchResult
	expiresAt time.Time
}

var (
	searchCacheMu sync.Mutex
	searchCache   = make(map[string]searchCacheEntry)
)

func getCachedStreamURL(id string) (string, bool) {
	streamCacheMu.Lock()
	defer streamCacheMu.Unlock()
	e, ok := streamCache[id]
	if !ok || time.Now().After(e.expiresAt) {
		delete(streamCache, id)
		return "", false
	}
	return e.url, true
}

func setCachedStreamURL(id, url string) {
	streamCacheMu.Lock()
	defer streamCacheMu.Unlock()
	streamCache[id] = streamURLEntry{url: url, expiresAt: time.Now().Add(4 * time.Hour)}
}


type YouTubeHandlers struct {
	db              *sql.DB
	musicPath       string
	ytDownloadPath  string // writable dir for yt-dlp downloads (separate from read-only musicPath)
	coversDir       string
	cloakProxyURL   string // for thumbnail fetching
}

type youtubeSearchResult struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	Duration   int    `json:"duration"`
	Thumbnail  string `json:"thumbnail"`
	Uploader   string `json:"uploader"`
	ChannelURL string `json:"channel_url"`
}

type ytdlpPlaylist struct {
	Entries []ytdlpEntry `json:"entries"`
}

type ytdlpEntry struct {
	ID         string   `json:"id"`
	Title      string   `json:"title"`
	Duration   *float64 `json:"duration"`
	Thumbnail  string   `json:"thumbnail"`
	Uploader   string   `json:"uploader"`
	ChannelURL string   `json:"channel_url"`
	UploaderID string   `json:"uploader_id"`
}

func (h *YouTubeHandlers) search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		http.Error(w, "missing query", http.StatusBadRequest)
		return
	}

	// Return cached results if still fresh (5 min TTL)
	cacheKey := strings.ToLower(q)
	searchCacheMu.Lock()
	if e, ok := searchCache[cacheKey]; ok && time.Now().Before(e.expiresAt) {
		results := e.results
		searchCacheMu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(results)
		return
	}
	searchCacheMu.Unlock()

	cmd := exec.CommandContext(r.Context(), "yt-dlp",
		"--flat-playlist", "--dump-single-json",
		"ytsearch10:"+q,
	)
	out, err := cmd.Output()
	if err != nil {
		log.Printf("yt-dlp search: %v", err)
		http.Error(w, "search failed", http.StatusInternalServerError)
		return
	}

	var playlist ytdlpPlaylist
	if err := json.Unmarshal(out, &playlist); err != nil {
		log.Printf("yt-dlp parse: %v", err)
		http.Error(w, "parse failed", http.StatusInternalServerError)
		return
	}

	results := make([]youtubeSearchResult, 0, len(playlist.Entries))
	for _, e := range playlist.Entries {
		dur := 0
		if e.Duration != nil {
			dur = int(*e.Duration)
		}
		chURL := e.ChannelURL
		if chURL == "" && e.UploaderID != "" {
			chURL = "https://www.youtube.com/@" + e.UploaderID
		}
		results = append(results, youtubeSearchResult{
			ID:         e.ID,
			Title:      e.Title,
			Duration:   dur,
			Thumbnail:  e.Thumbnail,
			Uploader:   e.Uploader,
			ChannelURL: chURL,
		})
	}

	if results == nil {
		results = []youtubeSearchResult{}
	}

	searchCacheMu.Lock()
	searchCache[cacheKey] = searchCacheEntry{results: results, expiresAt: time.Now().Add(5 * time.Minute)}
	searchCacheMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func (h *YouTubeHandlers) fetchStreamURL(ctx context.Context, id string) (string, error) {
	cmd := exec.CommandContext(ctx, "yt-dlp", "-g", "-f", "bestaudio",
		"https://www.youtube.com/watch?v="+id,
	)
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	streamURL := strings.TrimSpace(string(out))
	if streamURL == "" {
		return "", fmt.Errorf("empty stream URL")
	}
	setCachedStreamURL(id, streamURL)
	return streamURL, nil
}

func (h *YouTubeHandlers) proxyStream(w http.ResponseWriter, r *http.Request, id, streamURL string) error {
	req, err := http.NewRequestWithContext(r.Context(), "GET", streamURL, nil)
	if err != nil {
		return err
	}

	// Forward Range header to support seeking
	if rangeHeader := r.Header.Get("Range"); rangeHeader != "" {
		req.Header.Set("Range", rangeHeader)
	}
	// User-Agent
	if ua := r.Header.Get("User-Agent"); ua != "" {
		req.Header.Set("User-Agent", ua)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("http status %d", resp.StatusCode)
	}

	// Copy headers
	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	if cl := resp.Header.Get("Content-Length"); cl != "" {
		w.Header().Set("Content-Length", cl)
	}
	if cr := resp.Header.Get("Content-Range"); cr != "" {
		w.Header().Set("Content-Range", cr)
	}
	if ar := resp.Header.Get("Accept-Ranges"); ar != "" {
		w.Header().Set("Accept-Ranges", ar)
	}

	w.WriteHeader(resp.StatusCode)
	_, err = io.Copy(w, resp.Body)
	return err
}

func (h *YouTubeHandlers) stream(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !reYouTubeID.MatchString(id) {
		http.Error(w, "invalid video id", http.StatusBadRequest)
		return
	}

	var streamURL string
	fromCache := false
	if cached, ok := getCachedStreamURL(id); ok {
		streamURL = cached
		fromCache = true
	} else {
		var err error
		streamURL, err = h.fetchStreamURL(r.Context(), id)
		if err != nil {
			log.Printf("[yt-dlp] stream %s: %v", id, err)
			http.Error(w, "stream unavailable", http.StatusInternalServerError)
			return
		}
	}

	err := h.proxyStream(w, r, id, streamURL)
	if err != nil {
		if fromCache {
			log.Printf("[proxy] cached stream URL expired or failed for %s (%v), retrying with fresh URL...", id, err)
			streamCacheMu.Lock()
			delete(streamCache, id)
			streamCacheMu.Unlock()

			freshURL, fetchErr := h.fetchStreamURL(r.Context(), id)
			if fetchErr != nil {
				log.Printf("[yt-dlp] stream retry %s: %v", id, fetchErr)
				http.Error(w, "stream unavailable", http.StatusInternalServerError)
				return
			}
			
			err = h.proxyStream(w, r, id, freshURL)
			if err != nil {
				log.Printf("[proxy] stream retry %s failed: %v", id, err)
			}
		} else {
			log.Printf("[proxy] stream %s failed: %v", id, err)
			http.Error(w, "stream unavailable", http.StatusInternalServerError)
		}
	}
}

func (h *YouTubeHandlers) download(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID     string `json:"id"`
		Title  string `json:"title"`
		Artist string `json:"artist"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	if !reYouTubeID.MatchString(body.ID) {
		http.Error(w, "invalid video id", http.StatusBadRequest)
		return
	}

	dlPath := h.ytDownloadPath
	if dlPath == "" {
		dlPath = h.musicPath
	}

	if _, _, _, err := library.DownloadYouTubeAudio(r.Context(), h.db, dlPath, h.coversDir, body.ID, body.Title, body.Artist); err != nil {
		if errors.Is(err, library.ErrYouTubeFileNotFound) {
			log.Printf("[yt-dlp] download %s: could not find audio file in %s", body.ID, dlPath)
			http.Error(w, "download failed: file not found", http.StatusInternalServerError)
			return
		}
		log.Printf("[yt-dlp] download %s: %v", body.ID, err)
		http.Error(w, "download failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"status":         "ok",
		"tracks_scanned": 1,
	})
}

// channel fetches latest videos from a YouTube channel URL, or searches within it.
// Query params:
//   - url    = channel URL (required)
//   - q      = search query within the channel (optional; disables offset pagination)
//   - offset = 0-based page offset for /videos mode, default 0
func (h *YouTubeHandlers) channel(w http.ResponseWriter, r *http.Request) {
	rawURL := strings.TrimSpace(r.URL.Query().Get("url"))
	if rawURL == "" {
		http.Error(w, "missing url", http.StatusBadRequest)
		return
	}

	searchQuery := strings.TrimSpace(r.URL.Query().Get("q"))
	baseURL := strings.TrimRight(rawURL, "/")
	// Strip any trailing /videos or /search suffix to get the clean channel base
	baseURL = strings.TrimSuffix(baseURL, "/videos")
	baseURL = strings.TrimSuffix(baseURL, "/search")

	var channelURL string
	var cmdArgs []string

	if searchQuery != "" {
		// Search mode: use YouTube channel search page
		channelURL = baseURL + "/search?query=" + strings.ReplaceAll(searchQuery, " ", "+")
		cmdArgs = []string{
			"--flat-playlist", "--dump-single-json",
			"--playlist-end", "20",
			channelURL,
		}
	} else {
		// Browse mode: paginated /videos
		offset := 0
		if s := r.URL.Query().Get("offset"); s != "" {
			fmt.Sscanf(s, "%d", &offset)
			if offset < 0 {
				offset = 0
			}
		}
		start := offset + 1
		end := offset + 20
		channelURL = baseURL + "/videos"
		cmdArgs = []string{
			"--flat-playlist", "--dump-single-json",
			"--playlist-start", fmt.Sprintf("%d", start),
			"--playlist-end", fmt.Sprintf("%d", end),
			channelURL,
		}
	}

	cmd := exec.CommandContext(r.Context(), "yt-dlp", cmdArgs...)

	out, err := cmd.Output()
	if err != nil {
		log.Printf("yt-dlp channel: %v", err)
		http.Error(w, "channel fetch failed", http.StatusInternalServerError)
		return
	}

	var playlist ytdlpPlaylist
	if err := json.Unmarshal(out, &playlist); err != nil {
		log.Printf("yt-dlp channel parse: %v", err)
		http.Error(w, "parse failed", http.StatusInternalServerError)
		return
	}

	results := make([]youtubeSearchResult, 0, len(playlist.Entries))
	for _, e := range playlist.Entries {
		dur := 0
		if e.Duration != nil {
			dur = int(*e.Duration)
		}
		chURL := e.ChannelURL
		if chURL == "" && e.UploaderID != "" {
			chURL = fmt.Sprintf("https://www.youtube.com/@%s", e.UploaderID)
		}
		thumbnail := e.Thumbnail
		if thumbnail == "" && e.ID != "" {
			thumbnail = fmt.Sprintf("https://i.ytimg.com/vi/%s/mqdefault.jpg", e.ID)
		}
		uploader := e.Uploader
		if uploader == "" {
			// derive from the channel URL we were given
			parts := strings.Split(strings.TrimRight(rawURL, "/"), "/")
			if len(parts) > 0 {
				uploader = strings.TrimPrefix(parts[len(parts)-1], "@")
			}
		}
		results = append(results, youtubeSearchResult{
			ID:         e.ID,
			Title:      e.Title,
			Duration:   dur,
			Thumbnail:  thumbnail,
			Uploader:   uploader,
			ChannelURL: chURL,
		})
	}

	if results == nil {
		results = []youtubeSearchResult{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func (h *YouTubeHandlers) updateTools(w http.ResponseWriter, r *http.Request) {
	cmd := exec.CommandContext(r.Context(), "yt-dlp", "-U")
	out, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("yt-dlp update: %v\n%s", err, string(out))
		http.Error(w, "update failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
		"output": strings.TrimSpace(string(out)),
	})
}
