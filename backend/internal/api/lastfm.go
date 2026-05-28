package api

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

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
