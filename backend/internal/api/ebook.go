package api

import (
	"encoding/json"
	"net/http"
)

func (h *handlers) listEbooks(w http.ResponseWriter, r *http.Request) {
	ebooks, err := h.ebook.ListEbooks(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ebooks)
}


func (h *handlers) ebookContent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ebook, err := h.ebook.GetEbookByID(r.Context(), id)
	if err != nil || ebook == nil {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, ebook.FilePath)
}

func (h *handlers) ebookCover(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	serveResizedImage(w, r, h.ebookCoversDir, id)
}

func (h *handlers) setEbookNSFW(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		IsNSFW   bool   `json:"is_nsfw"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	if req.Password != "owner712002" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	if err := h.ebook.SetNSFW(r.Context(), id, req.IsNSFW); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *handlers) setEbookProgress(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		Progress string `json:"progress"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	if err := h.ebook.SetProgress(r.Context(), id, req.Progress); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *handlers) setEbookCollection(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		Collection string `json:"collection"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	if err := h.ebook.SetCollection(r.Context(), id, req.Collection); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
