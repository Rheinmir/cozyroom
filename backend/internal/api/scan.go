package api

import (
	"encoding/json"
	"net/http"

	"cozyroom/internal/library"
)

// scanLibrary triggers a library scan using the handler's config.
func scanLibrary(h *handlers, w http.ResponseWriter) {
	// Music scan
	res, err := library.Scan(h.scanDB.DB, h.musicPath, h.coversDir)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Video scan
	if h.filmsPath != "" {
		_ = library.ScanVideos(h.scanDB.DB, h.filmsPath)
	}

	// Ebook scan
	if h.ebooksPath != "" {
		_ = library.ScanEbooks(h.scanDB.DB, h.ebooksPath, h.ebookCoversDir)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{
		"music_scanned": res.Tracks,
		"music_errors":  res.Errors,
	})
}
