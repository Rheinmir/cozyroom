package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWriteJSONETag304(t *testing.T) {
	r := httptest.NewRequest("GET", "/api/tracks", nil)
	w := httptest.NewRecorder()
	writeJSONETag(w, r, []int{1, 2})
	etag := w.Header().Get("ETag")
	if w.Code != 200 || etag == "" || w.Body.String() != "[1,2]\n" {
		t.Fatalf("first: code=%d etag=%q body=%q", w.Code, etag, w.Body.String())
	}
	r2 := httptest.NewRequest("GET", "/api/tracks", nil)
	r2.Header.Set("If-None-Match", etag)
	w2 := httptest.NewRecorder()
	writeJSONETag(w2, r2, []int{1, 2})
	if w2.Code != http.StatusNotModified || w2.Body.Len() != 0 {
		t.Fatalf("second: code=%d len=%d", w2.Code, w2.Body.Len())
	}
}
