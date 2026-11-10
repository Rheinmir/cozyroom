package api

import (
	"log"
	"net/http"
	"path/filepath"
	"strings"

	"cozyroom/internal/audiohls"
	"cozyroom/internal/transcode"
)

// audioHLS handles GET /hls-audio/{id}/{file...} — the iOS player's stream
// (see PlayerContext.tsx streamUrl). master.m3u8 builds the package on first
// request; everything else is a plain file of a finished package.
func (h *handlers) audioHLS(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	file := r.PathValue("file")
	if h.audioHLSMgr == nil || !hexID.MatchString(id) || !audiohls.ValidFile.MatchString(file) {
		http.NotFound(w, r)
		return
	}

	if file == "master.m3u8" {
		filePath, err := h.lib.TrackFilePath(r.Context(), id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if filePath == "" {
			http.NotFound(w, r)
			return
		}
		if err := h.audioHLSMgr.Ensure(r.Context(), id, filePath, transcode.IsLossless(filePath)); err != nil {
			log.Printf("audio hls %s: %v", id, err)
			http.Error(w, "packaging failed", http.StatusServiceUnavailable)
			return
		}
	}

	switch {
	case strings.HasSuffix(file, ".m3u8"):
		w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
	case strings.HasSuffix(file, ".m4s"):
		w.Header().Set("Content-Type", "audio/iso.segment")
	default:
		w.Header().Set("Content-Type", "audio/mp4")
	}
	// A finished package never changes, so the CF edge may keep every file.
	w.Header().Set("Cache-Control", "public, max-age=86400")
	http.ServeFile(w, r, filepath.Join(h.audioHLSMgr.Dir(id), filepath.FromSlash(file)))
}
