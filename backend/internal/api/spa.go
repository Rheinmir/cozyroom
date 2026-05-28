package api

import (
	"net/http"
	"os"
	"path/filepath"
)

type spaHandler struct{ root string }

func (s spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := filepath.Join(s.root, filepath.Clean("/"+r.URL.Path))
	if _, err := os.Stat(path); os.IsNotExist(err) {
		http.ServeFile(w, r, filepath.Join(s.root, "index.html"))
		return
	}
	http.FileServer(http.Dir(s.root)).ServeHTTP(w, r)
}
