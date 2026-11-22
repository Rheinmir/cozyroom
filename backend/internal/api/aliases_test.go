package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAliasPaths(t *testing.T) {
	var gotPath, gotRaw, gotQuery, gotRange string
	h := aliasPaths(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath, gotRaw, gotQuery, gotRange = r.URL.Path, r.URL.RawPath, r.URL.RawQuery, r.Header.Get("Range")
		w.WriteHeader(http.StatusNoContent)
	}))
	cases := []struct{ in, want string }{
		{"/api/v1/albums", "/api/albums"},
		{"/api/v1/ai/chat/stream", "/api/ai/chat/stream"},
		{"/api/v1/notes/42/comments", "/api/notes/42/comments"},
		{"/media/audio/abc123", "/stream/abc123"},
		{"/media/video/v1", "/stream-video/v1"},
		{"/media/hls/v1/seg0.ts", "/hls/v1/seg0.ts"},
		{"/media/covers/a1", "/api/covers/a1"},
		{"/media/artist-images/r1", "/api/artist-images/r1"},
		{"/media/video-posters/v1", "/api/video-posters/v1"},
		{"/media/ebook-covers/e1", "/api/ebook-covers/e1"},
		{"/media/youtube/dQw4w9WgXcQ", "/api/youtube/stream/dQw4w9WgXcQ"},
		// untouched: old paths, other prefixes, near misses
		{"/api/albums", "/api/albums"},
		{"/stream/abc123", "/stream/abc123"},
		{"/api/v1", "/api/v1"},
		{"/api/v10/albums", "/api/v10/albums"},
		{"/media/other/x", "/media/other/x"},
		{"/media", "/media"},
		{"/music/albums/a1", "/music/albums/a1"},
	}
	for _, c := range cases {
		req := httptest.NewRequest("GET", c.in+"?w=512&q=1", nil)
		req.Header.Set("Range", "bytes=0-99")
		h.ServeHTTP(httptest.NewRecorder(), req)
		if gotPath != c.want {
			t.Errorf("%s -> %s, want %s", c.in, gotPath, c.want)
		}
		if gotQuery != "w=512&q=1" || gotRange != "bytes=0-99" {
			t.Errorf("%s: query/Range lost: %q %q", c.in, gotQuery, gotRange)
		}
		if req.URL.Path != c.in {
			t.Errorf("%s: caller's request was mutated: %s", c.in, req.URL.Path)
		}
	}
	// an encoded id keeps its raw form
	req := httptest.NewRequest("GET", "/media/audio/a%2Fb", nil)
	h.ServeHTTP(httptest.NewRecorder(), req)
	if gotPath != "/stream/a/b" || gotRaw != "/stream/a%2Fb" {
		t.Errorf("encoded id: path %q raw %q", gotPath, gotRaw)
	}
}

// A protected route must be exactly as protected through /api/v1 as through /api.
// Auth lives inside the handlers (verifyOwnerPassword), so it cannot depend on the path;
// this proves it with the same wrapper chain NewRouter uses.
func TestAliasKeepsAuth(t *testing.T) {
	ph := &PlaylistHandlers{} // auth is checked before any dependency is touched
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/playlists", ph.createPlaylist)
	mux.HandleFunc("DELETE /api/playlists/{id}", ph.deletePlaylist)
	h := aliasPaths(metricsMiddleware(panicRecovery(mux)))

	do := func(method, target, pw string, viaQuery bool) int {
		if viaQuery && pw != "" {
			target += "?password=" + pw
		}
		req := httptest.NewRequest(method, target, strings.NewReader("not json"))
		if !viaQuery && pw != "" {
			req.Header.Set("X-Owner-Password", pw)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	for _, base := range []string{"/api", "/api/v1"} {
		for _, c := range []struct {
			name, method, path string
		}{{"create", "POST", base + "/playlists"}, {"delete", "DELETE", base + "/playlists/p1"}} {
			if got := do(c.method, c.path, "", false); got != http.StatusUnauthorized {
				t.Errorf("%s %s without password: %d, want 401", c.name, c.path, got)
			}
			if got := do(c.method, c.path, "wrong", false); got != http.StatusUnauthorized {
				t.Errorf("%s %s wrong header password: %d, want 401", c.name, c.path, got)
			}
			if got := do(c.method, c.path, "wrong", true); got != http.StatusUnauthorized {
				t.Errorf("%s %s wrong query password: %d, want 401", c.name, c.path, got)
			}
		}
		// the right password gets past auth (create then fails on the bad body: 400, not 401)
		if got := do("POST", base+"/playlists", OwnerPassword, false); got != http.StatusBadRequest {
			t.Errorf("POST %s/playlists with the right header password: %d, want 400 (auth passed)", base, got)
		}
		if got := do("POST", base+"/playlists", OwnerPassword, true); got != http.StatusBadRequest {
			t.Errorf("POST %s/playlists with the right query password: %d, want 400 (auth passed)", base, got)
		}
	}
}
