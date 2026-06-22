package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func ambientDir() string {
	if d := os.Getenv("AMBIENT_SOUNDS_DIR"); d != "" {
		return d
	}
	return "./sounds/ambient"
}

type ambientSoundItem struct {
	Name  string `json:"name"`
	Label string `json:"label"`
}

var ambientLabelMap = map[string]string{
	"ocean":  "Ocean",
	"rain":   "Rain",
	"stream": "Stream",
	"night":  "Night",
	"fire":   "Fire",
}

func (h *handlers) listAmbientSounds(w http.ResponseWriter, r *http.Request) {
	entries, err := os.ReadDir(ambientDir())
	if err != nil {
		// Directory doesn't exist — return empty list (noise types still work client-side)
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "public, max-age=60")
		json.NewEncoder(w).Encode([]ambientSoundItem{})
		return
	}

	sounds := make([]ambientSoundItem, 0)
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		ext := strings.ToLower(filepath.Ext(e.Name()))
		if ext != ".m4a" && ext != ".mp3" && ext != ".ogg" && ext != ".wav" && ext != ".aac" {
			continue
		}
		base := strings.TrimSuffix(e.Name(), filepath.Ext(e.Name()))
		label := ambientLabelMap[base]
		if label == "" {
			label = base
		}
		sounds = append(sounds, ambientSoundItem{Name: base, Label: label})
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=60")
	json.NewEncoder(w).Encode(sounds)
}

func (h *handlers) serveAmbientSound(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	// Reject anything that isn't simple alphanumeric/hyphen/underscore — no path traversal
	for _, c := range name {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_') {
			http.NotFound(w, r)
			return
		}
	}

	dir := ambientDir()
	for _, ext := range []string{".m4a", ".mp3", ".ogg", ".wav", ".aac"} {
		path := filepath.Join(dir, name+ext)
		if _, err := os.Stat(path); err == nil {
			// ServeFile handles Content-Type, Range requests, and ETags automatically
			http.ServeFile(w, r, path)
			return
		}
	}

	http.NotFound(w, r)
}
