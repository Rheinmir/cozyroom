package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"cozyroom/internal/db"
	"cozyroom/internal/library"
)

var reYouTubeID = regexp.MustCompile(`^[a-zA-Z0-9_-]{11}$`)

type YouTubeHandlers struct {
	db        *db.RDB
	musicPath string
	coversDir string
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

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func (h *YouTubeHandlers) stream(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !reYouTubeID.MatchString(id) {
		http.Error(w, "invalid video id", http.StatusBadRequest)
		return
	}

	cmd := exec.CommandContext(r.Context(), "yt-dlp", "-g", "-f", "bestaudio",
		"https://www.youtube.com/watch?v="+id,
	)
	out, err := cmd.Output()
	if err != nil {
		log.Printf("yt-dlp stream: %v", err)
		http.Error(w, "stream unavailable", http.StatusInternalServerError)
		return
	}

	streamURL := strings.TrimSpace(string(out))
	if streamURL == "" {
		http.NotFound(w, r)
		return
	}

	http.Redirect(w, r, streamURL, http.StatusFound)
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

	cmd := exec.CommandContext(r.Context(), "yt-dlp",
		"-f", "bestaudio",
		"-x", "--audio-format", "best",
		"--paths", h.musicPath,
		"-o", "%(id)s.%(ext)s",
		"https://www.youtube.com/watch?v="+body.ID,
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("yt-dlp download: %v\n%s", err, string(output))
		http.Error(w, "download failed", http.StatusInternalServerError)
		return
	}

	// Find the downloaded file
	var filePath string
	for _, ext := range []string{".opus", ".webm", ".m4a", ".mp3"} {
		testPath := filepath.Join(h.musicPath, body.ID+ext)
		if _, err := os.Stat(testPath); err == nil {
			filePath = testPath
			break
		}
	}

	if filePath != "" {
		uploader := strings.TrimSpace(body.Artist)
		if uploader == "" || (strings.HasPrefix(uploader, "UC") && len(uploader) == 24) {
			cmdUploader := exec.CommandContext(r.Context(), "yt-dlp", "--print", "uploader", "https://www.youtube.com/watch?v="+body.ID)
			outUploader, err := cmdUploader.Output()
			if err == nil {
				friendlyName := strings.TrimSpace(string(outUploader))
				if friendlyName != "" {
					uploader = friendlyName
				}
			}
		}
		log.Printf("youtube download: indexing single file %s with metadata (Title: %q, Artist: %q, Album: %q)", filePath, body.Title, uploader, body.Title)
		if err := library.IndexFileWithMetadata(h.db.DB, filePath, h.coversDir, body.Title, uploader, body.Title); err != nil {
			log.Printf("error indexing single file: %v", err)
		}
	} else {
		log.Printf("youtube download: could not find downloaded file in %s", h.musicPath)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"status":         "ok",
		"tracks_scanned": 1,
	})
}

// DownloadYT downloads a YouTube video, indexes it into the library, and returns the track ID.
// Used by the MCP download_youtube tool for synchronous server-side downloads.
func DownloadYT(db *db.RDB, musicPath, coversDir, id, title, artist string) (string, error) {
	if !reYouTubeID.MatchString(id) {
		return "", fmt.Errorf("invalid video id")
	}
	cmd := exec.Command("yt-dlp",
		"-f", "bestaudio",
		"-x", "--audio-format", "best",
		"--paths", musicPath,
		"-o", "%(id)s.%(ext)s",
		"https://www.youtube.com/watch?v="+id,
	)
	if out, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("yt-dlp: %w\n%s", err, string(out))
	}
	var filePath string
	for _, ext := range []string{".opus", ".webm", ".m4a", ".mp3"} {
		p := filepath.Join(musicPath, id+ext)
		if _, err := os.Stat(p); err == nil {
			filePath = p
			break
		}
	}
	if filePath == "" {
		return "", fmt.Errorf("downloaded file not found in %s", musicPath)
	}
	uploader := strings.TrimSpace(artist)
	if uploader == "" || (strings.HasPrefix(uploader, "UC") && len(uploader) == 24) {
		uploader = "Unknown Artist"
	}
	if err := library.IndexFileWithMetadata(db.DB, filePath, coversDir, title, uploader, title); err != nil {
		log.Printf("DownloadYT: index error: %v", err)
	}
	// Synchronously fetch YouTube thumbnail so cover is ready immediately.
	albumID := library.AlbumID(uploader, title)
	thumbnailDest := filepath.Join(coversDir, albumID+".jpg")
	if _, err := os.Stat(thumbnailDest); os.IsNotExist(err) {
		library.DownloadYTThumbnail(id, thumbnailDest)
	}
	return library.TrackIDFromPath(filePath), nil
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
