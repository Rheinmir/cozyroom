package api

import (
	"context"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/dhowden/tag"
)

// trackCover serves the picture embedded in one track's audio file. Compilation albums
// (one folder, many singers) have a different picture per track, and the album cover is
// only the first track's picture (or none). Extracted once to coversDir/t_<id>.jpg.
// No embedded picture: falls back to the album cover given in ?album=<id>.
func (h *handlers) trackCover(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !hexID.MatchString(id) {
		http.NotFound(w, r)
		return
	}
	name := "t_" + id
	cached := filepath.Join(h.coversDir, name+".jpg")
	if _, err := os.Stat(cached); os.IsNotExist(err) {
		coverSF.Do("track:"+id, func() (any, error) {
			fp, err := h.lib.TrackFilePath(r.Context(), id)
			if err != nil || fp == "" {
				return nil, nil
			}
			f, err := os.Open(fp)
			if err != nil {
				return nil, nil
			}
			defer f.Close()
			tmp := cached + ".tmp"
			if m, _ := tag.ReadFrom(f); m != nil && m.Picture() != nil && len(m.Picture().Data) > 0 {
				if os.WriteFile(tmp, m.Picture().Data, 0644) == nil {
					os.Rename(tmp, cached)
				}
				return nil, nil
			}
			// dhowden/tag cannot parse some files that do carry a front cover (foobar2000
			// shows it; seen on the HONG KONG compilation). ffmpeg reads the attached picture.
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()
			cmd := exec.CommandContext(ctx, "ffmpeg", "-v", "error", "-y", "-i", fp,
				"-map", "0:v:0", "-frames:v", "1", "-c:v", "mjpeg", "-f", "image2", tmp)
			if cmd.Run() == nil {
				if st, err := os.Stat(tmp); err == nil && st.Size() > 0 {
					os.Rename(tmp, cached)
					return nil, nil
				}
			}
			os.Remove(tmp)
			return nil, nil
		})
	}
	if _, err := os.Stat(cached); err == nil {
		serveResizedImage(w, r, h.coversDir, name)
		return
	}
	if album := r.URL.Query().Get("album"); hexID.MatchString(album) {
		serveResizedImage(w, r, h.coversDir, album)
		return
	}
	http.NotFound(w, r)
}
