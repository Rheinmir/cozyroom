package api

import (
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"cozyroom/internal/domain"
	"cozyroom/internal/hls"
	"cozyroom/internal/transcode"
	"cozyroom/internal/usecase"
)

type VideoHandlers struct {
	uc           *usecase.VideoUsecase
	hlsMgr       *hls.Manager
	trickplayDir string
	posterDir    string
}

func (h *VideoHandlers) listVideos(w http.ResponseWriter, r *http.Request) {
	videos, err := h.uc.ListVideos(r.Context())
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	if videos == nil {
		videos = []domain.Video{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(videos)
}

// streamVideo serves non-TS files directly with Range request support.
// TS files should use the /hls/ endpoint instead.
func (h *VideoHandlers) streamVideo(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	v, err := h.uc.GetVideo(r.Context(), id)
	if err != nil || v == nil {
		http.NotFound(w, r)
		return
	}
	f, err := os.Open(v.FilePath)
	if err != nil {
		http.Error(w, "File not found", 404)
		return
	}
	defer f.Close()
	http.ServeContent(w, r, v.Title, time.Time{}, f)
}

// smartStream redirects to direct play or HLS based on the client's User-Agent.
func (h *VideoHandlers) smartStream(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	v, err := h.uc.GetVideo(r.Context(), id)
	if err != nil || v == nil {
		http.NotFound(w, r)
		return
	}
	if transcode.CanDirectPlay(r.Header.Get("User-Agent"), v.FilePath) {
		http.Redirect(w, r, "/stream-video/"+id, http.StatusFound)
		return
	}
	http.Redirect(w, r, "/hls/"+id+"/index.m3u8", http.StatusFound)
}

// videoPoster serves a cached movie poster image.
func (h *VideoHandlers) videoPoster(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	posterPath := filepath.Join(h.posterDir, id+".jpg")

	if _, err := os.Stat(posterPath); os.IsNotExist(err) {
		v, err := h.uc.GetVideo(r.Context(), id)
		if err == nil && v != nil {
			os.MkdirAll(h.posterDir, 0755)
			cmd := exec.CommandContext(r.Context(), "ffmpeg", "-y", "-ss", "00:00:10", "-i", v.FilePath, "-vframes", "1", "-q:v", "2", "-vf", "scale=800:-1", posterPath)
			cmd.Run()
		}
	}

	http.ServeFile(w, r, posterPath)
}

// serveHLS handles GET /hls/{id}/index.m3u8 and GET /hls/{id}/{seg}.
func (h *VideoHandlers) serveHLS(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	file := r.PathValue("file")

	if !hls.ValidFile.MatchString(file) {
		http.NotFound(w, r)
		return
	}

	v, err := h.uc.GetVideo(r.Context(), id)
	if err != nil || v == nil {
		http.NotFound(w, r)
		return
	}

	dir := h.hlsMgr.Dir(id)

	if file == "index.m3u8" {
		if err := h.hlsMgr.EnsureReady(r.Context(), id, v.FilePath); err != nil {
			http.Error(w, "transcoding unavailable", 503)
			return
		}
		data, err := os.ReadFile(filepath.Join(dir, "index.m3u8"))
		if err != nil {
			http.Error(w, "playlist not ready", 503)
			return
		}
		w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Write(data)
		return
	}

	segPath := filepath.Join(dir, file)
	if err := hls.WaitSegment(r.Context(), segPath); err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "video/mp2t")
	http.ServeFile(w, r, segPath)
}
