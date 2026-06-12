package api

import (
	"encoding/json"
	"log"
	"net/http"

	"cozyroom/internal/domain"
)

func (h *handlers) logPlaybackError(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TrackID      string `json:"track_id"`
		Src          string `json:"src"`
		ErrorCode    int    `json:"error_code"`
		ErrorMessage string `json:"error_message"`
		UserAgent    string `json:"user_agent"`
		Version      string `json:"version"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	log.Printf("[PLAYBACK_ERROR] Version: %s, Track: %s, Src: %s, Code: %d, Message: %q, UA: %q",
		body.Version, body.TrackID, body.Src, body.ErrorCode, body.ErrorMessage, body.UserAgent)

	w.WriteHeader(http.StatusOK)
}

func (h *handlers) getPlaybackProgress(w http.ResponseWriter, r *http.Request) {
	itemType := r.PathValue("type")
	itemID := r.PathValue("id")
	if itemType != "track" && itemType != "video" {
		http.Error(w, "invalid type: must be track or video", http.StatusBadRequest)
		return
	}
	if !hexID.MatchString(itemID) {
		http.NotFound(w, r)
		return
	}

	p, err := h.playback.Get(r.Context(), itemType, itemID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if p == nil {
		p = &domain.PlaybackProgress{ItemType: itemType, ItemID: itemID, PositionS: 0}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func (h *handlers) setPlaybackProgress(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ItemType  string  `json:"item_type"`
		ItemID    string  `json:"item_id"`
		PositionS float64 `json:"position_s"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	if body.ItemType != "track" && body.ItemType != "video" {
		http.Error(w, "invalid item_type", http.StatusBadRequest)
		return
	}
	if !hexID.MatchString(body.ItemID) {
		http.Error(w, "invalid item_id", http.StatusBadRequest)
		return
	}

	if err := h.playback.Set(r.Context(), domain.PlaybackProgress{
		ItemType:  body.ItemType,
		ItemID:    body.ItemID,
		PositionS: body.PositionS,
	}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
