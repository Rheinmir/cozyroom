package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// POST and DELETE /api/lyrics/{id} are owner only. The check runs before any track lookup,
// so a handler without a library proves the guard: refused = 401, passed = it goes on (and panics on nil lib).
func TestLyricsWriteNeedsOwner(t *testing.T) {
	ownerEnv(t, testOwnerPw)
	const id = "0123456789abcdef"
	call := func(method, pw string) (code int, passed bool) {
		defer func() {
			if recover() != nil {
				passed = true
			}
		}()
		req := httptest.NewRequest(method, "/api/lyrics/"+id, nil)
		req.SetPathValue("id", id)
		if pw != "" {
			req.Header.Set("X-Owner-Password", pw)
		}
		w := httptest.NewRecorder()
		(&handlers{}).lyricsHandler(w, req)
		return w.Code, false
	}
	for _, m := range []string{http.MethodPost, http.MethodDelete} {
		for _, pw := range []string{"", "wrong"} {
			if code, passed := call(m, pw); passed || code != http.StatusUnauthorized {
				t.Fatalf("%s pw=%q: want 401, got %d passed=%v", m, pw, code, passed)
			}
		}
		if code, passed := call(m, testOwnerPw); !passed && code == http.StatusUnauthorized {
			t.Fatalf("%s right pw: refused with %d", m, code)
		}
	}
}
