package api

import (
	"encoding/json"
	"net/http"
	"sync"
)

const ringSize = 500

type RequestEntry struct {
	Time       int64   `json:"time"` // unix millis
	Method     string  `json:"method"`
	Path       string  `json:"path"`
	Status     int     `json:"status"`
	DurationMS float64 `json:"duration_ms"`
}

type ringBuffer struct {
	mu      sync.Mutex
	entries [ringSize]RequestEntry
	head    int
	count   int
}

var globalRing ringBuffer

func (r *ringBuffer) push(e RequestEntry) {
	r.mu.Lock()
	r.entries[r.head] = e
	r.head = (r.head + 1) % ringSize
	if r.count < ringSize {
		r.count++
	}
	r.mu.Unlock()
}

// snapshot returns entries oldest-first.
func (r *ringBuffer) snapshot() []RequestEntry {
	r.mu.Lock()
	defer r.mu.Unlock()
	n := r.count
	out := make([]RequestEntry, n)
	start := (r.head - n + ringSize) % ringSize
	for i := 0; i < n; i++ {
		out[i] = r.entries[(start+i)%ringSize]
	}
	return out
}

func handleRequestLog(w http.ResponseWriter, _ *http.Request) {
	entries := globalRing.snapshot()
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(entries); err != nil {
		http.Error(w, "encode error", http.StatusInternalServerError)
	}
}
