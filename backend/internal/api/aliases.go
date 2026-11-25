package api

import (
	"net/http"
	"strings"
)

// aliasPrefixes maps the canonical public paths to the paths the mux registers.
// /api/v1/* is the canonical API path; /media/* groups every byte stream and image
// under one prefix. The old paths keep working (nothing is removed). The rewrite
// happens before the mux, the metrics and the request log, so handlers, metrics
// labels and the debug log all keep seeing the old path: no route is duplicated.
// Keep in sync with the `rewrite` lines in nginx.conf.
var aliasPrefixes = []struct{ from, to string }{
	{"/api/v1/", "/api/"},
	{"/media/audio/", "/stream/"},
	{"/media/video/", "/stream-video/"},
	{"/media/hls/", "/hls/"},
	{"/media/covers/", "/api/covers/"},
	{"/media/track-covers/", "/api/track-covers/"},
	{"/media/artist-images/", "/api/artist-images/"},
	{"/media/video-posters/", "/api/video-posters/"},
	{"/media/ebook-covers/", "/api/ebook-covers/"},
	{"/media/youtube/", "/api/youtube/stream/"},
}

func aliasPaths(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for _, a := range aliasPrefixes {
			if strings.HasPrefix(r.URL.Path, a.from) {
				// Copy: never mutate the caller's request or URL. Query, headers (Range!) and body are kept.
				r2 := new(http.Request)
				*r2 = *r
				u := *r.URL
				u.Path = a.to + strings.TrimPrefix(r.URL.Path, a.from)
				if u.RawPath != "" {
					u.RawPath = a.to + strings.TrimPrefix(u.RawPath, a.from)
				}
				r2.URL = &u
				next.ServeHTTP(w, r2)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
