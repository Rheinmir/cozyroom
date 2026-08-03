package api

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"cozyroom/internal/domain"
	"cozyroom/internal/metrics"
)

const lfmAPI = "https://ws.audioscrobbler.com/2.0/"

// lastfmLogin authenticates via auth.getMobileSession (username + password, no redirect needed).
func (h *handlers) lastfmLogin(w http.ResponseWriter, r *http.Request) {
	if h.lastfmKey == "" {
		http.Error(w, "Last.fm not configured", http.StatusServiceUnavailable)
		return
	}

	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Username == "" || body.Password == "" {
		http.Error(w, "username and password required", http.StatusBadRequest)
		return
	}

	// authToken = MD5(lowercase(username) + MD5(password))
	passMD5 := fmt.Sprintf("%x", md5.Sum([]byte(body.Password)))
	authToken := fmt.Sprintf("%x", md5.Sum([]byte(strings.ToLower(body.Username)+passMD5)))

	params := map[string]string{
		"method":    "auth.getMobileSession",
		"api_key":   h.lastfmKey,
		"username":  body.Username,
		"authToken": authToken,
	}
	params["api_sig"] = lfmSign(params, h.lastfmSecret)

	resp, err := http.PostForm(lfmAPI, lfmValues(params))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	var result struct {
		Session struct {
			Name string `json:"name"`
			Key  string `json:"key"`
		} `json:"session"`
		Error   int    `json:"error"`
		Message string `json:"message"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	if result.Error != 0 || result.Session.Key == "" {
		http.Error(w, result.Message, http.StatusUnauthorized)
		return
	}

	h.settings.Set(r.Context(), "lastfm_session_key", result.Session.Key)
	h.settings.Set(r.Context(), "lastfm_username", result.Session.Name)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"username": result.Session.Name})
}

func (h *handlers) lastfmDisconnect(w http.ResponseWriter, r *http.Request) {
	h.settings.Delete(r.Context(), "lastfm_session_key", "lastfm_username")
	w.WriteHeader(http.StatusNoContent)
}

func (h *handlers) lastfmStatus(w http.ResponseWriter, r *http.Request) {
	username, _ := h.settings.Get(r.Context(), "lastfm_username")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"connected":  username != "",
		"username":   username,
		"configured": h.lastfmKey != "",
	})
}

func (h *handlers) lastfmNowPlaying(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Artist string `json:"artist"`
		Track  string `json:"track"`
		Album  string `json:"album"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Track == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	sessionKey, err := h.lfmSession(r)
	if err != nil {
		http.Error(w, "not connected to Last.fm", http.StatusUnauthorized)
		return
	}

	params := map[string]string{
		"method":  "track.updateNowPlaying",
		"api_key": h.lastfmKey,
		"sk":      sessionKey,
		"artist":  body.Artist,
		"track":   body.Track,
		"album":   body.Album,
	}
	params["api_sig"] = lfmSign(params, h.lastfmSecret)

	resp, err := http.PostForm(lfmAPI, lfmValues(params))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	resp.Body.Close()
	metrics.NowPlayingTotal.Inc()
	w.WriteHeader(http.StatusNoContent)
}

func (h *handlers) lastfmScrobble(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Artist    string `json:"artist"`
		Track     string `json:"track"`
		Album     string `json:"album"`
		Timestamp int64  `json:"timestamp"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Track == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	sessionKey, err := h.lfmSession(r)
	if err != nil {
		http.Error(w, "not connected to Last.fm", http.StatusUnauthorized)
		return
	}

	ts := body.Timestamp
	if ts == 0 {
		ts = time.Now().Unix()
	}

	params := map[string]string{
		"method":       "track.scrobble",
		"api_key":      h.lastfmKey,
		"sk":           sessionKey,
		"artist[0]":    body.Artist,
		"track[0]":     body.Track,
		"album[0]":     body.Album,
		"timestamp[0]": fmt.Sprintf("%d", ts),
	}
	params["api_sig"] = lfmSign(params, h.lastfmSecret)

	resp, err := http.PostForm(lfmAPI, lfmValues(params))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	resp.Body.Close()
	metrics.ScrobblesTotal.Inc()
	w.WriteHeader(http.StatusNoContent)
}

func (h *handlers) lfmSession(r *http.Request) (string, error) {
	key, err := h.settings.Get(r.Context(), "lastfm_session_key")
	if err != nil || key == "" {
		return "", fmt.Errorf("no session")
	}
	return key, nil
}

func lfmSign(params map[string]string, secret string) string {
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var sb strings.Builder
	for _, k := range keys {
		sb.WriteString(k)
		sb.WriteString(params[k])
	}
	sb.WriteString(secret)

	return fmt.Sprintf("%x", md5.Sum([]byte(sb.String())))
}

func lfmValues(params map[string]string) url.Values {
	v := url.Values{}
	for k, val := range params {
		v.Set(k, val)
	}
	v.Set("format", "json")
	return v
}

// ── Play-count backfill from Last.fm ───────────────────────────────────────
// One-off, user-triggered job: pulls each track's lifetime Last.fm
// userplaycount as a baseline (see track_plays vs lastfm_backfill_count split
// in db.go). Runs in the background because rate-limiting a request per
// track can take minutes for a real library — the HTTP handler only starts
// the job and returns; progress is polled via lastfmBackfillStatus.

type lfmBackfillState struct {
	Running bool   `json:"running"`
	Done    int    `json:"done"`
	Total   int    `json:"total"`
	Error   string `json:"error"`
}

var (
	backfillMu    sync.Mutex
	backfillState lfmBackfillState
)

func (h *handlers) lastfmBackfillPlayCounts(w http.ResponseWriter, r *http.Request) {
	username, _ := h.settings.Get(r.Context(), "lastfm_username")
	if username == "" {
		http.Error(w, "not connected to Last.fm", http.StatusServiceUnavailable)
		return
	}

	backfillMu.Lock()
	if backfillState.Running {
		backfillMu.Unlock()
		http.Error(w, "backfill already running", http.StatusConflict)
		return
	}
	backfillState = lfmBackfillState{Running: true}
	backfillMu.Unlock()

	tracks, err := h.lib.ListTracks(r.Context(), "")
	if err != nil {
		backfillMu.Lock()
		backfillState.Running = false
		backfillState.Error = err.Error()
		backfillMu.Unlock()
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	backfillMu.Lock()
	backfillState.Total = len(tracks)
	backfillMu.Unlock()

	go h.runLastfmBackfill(tracks, username)

	w.WriteHeader(http.StatusAccepted)
}

func (h *handlers) runLastfmBackfill(tracks []domain.Track, username string) {
	for _, t := range tracks {
		count, err := lfmTrackPlayCount(h.lastfmKey, t.ArtistName, t.Title, username)
		if err != nil {
			log.Printf("lastfm backfill %s - %s: %v", t.ArtistName, t.Title, err)
		} else if count > 0 {
			if _, err := h.scanDB.Exec(
				`UPDATE tracks SET lastfm_backfill_count = GREATEST(lastfm_backfill_count, $1) WHERE id = $2`,
				count, t.ID); err != nil {
				log.Printf("lastfm backfill update %s: %v", t.ID, err)
			}
		}
		backfillMu.Lock()
		backfillState.Done++
		backfillMu.Unlock()
		time.Sleep(250 * time.Millisecond) // stay well under Last.fm's rate limit
	}
	backfillMu.Lock()
	backfillState.Running = false
	backfillMu.Unlock()
}

// lfmTrackPlayCount calls track.getInfo — a public read method, no api_sig or
// session key needed — and returns userplaycount for artist/track under the
// given (already-connected) username.
func lfmTrackPlayCount(apiKey, artist, track, username string) (int, error) {
	v := url.Values{}
	v.Set("method", "track.getInfo")
	v.Set("api_key", apiKey)
	v.Set("artist", artist)
	v.Set("track", track)
	v.Set("username", username)
	v.Set("format", "json")

	resp, err := http.Get(lfmAPI + "?" + v.Encode())
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	var result struct {
		Track struct {
			UserPlayCount string `json:"userplaycount"`
		} `json:"track"`
		Error int `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, err
	}
	if result.Error != 0 {
		return 0, nil // not found on Last.fm — skip, not a hard error
	}
	count, _ := strconv.Atoi(result.Track.UserPlayCount)
	return count, nil
}

func (h *handlers) lastfmBackfillStatus(w http.ResponseWriter, r *http.Request) {
	backfillMu.Lock()
	defer backfillMu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(backfillState)
}
