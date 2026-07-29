package transcode

import (
	"context"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"golang.org/x/sync/singleflight"
)

// CacheDir is where transcoded audio is persisted so replays and gapless
// preloads of the same track+quality serve as a plain seekable file instead
// of re-running ffmpeg every time. Set once at startup by cmd/server.
var CacheDir string

// encodeGroup collapses concurrent EncodeAndCache calls for the same
// track+quality into a single ffmpeg process. Without this, two overlapping
// requests each open their own tmp file and run their own encode; whichever
// finishes first renames it into place, and the other's context is then
// cancelled or its rename target has vanished — logged as "signal: killed"
// followed by "rename ...: no such file or directory". To the listener this
// sounds like the track restarting from an earlier point mid-stream.
var encodeGroup singleflight.Group

func CachePath(trackID, quality, ext string) string {
	return filepath.Join(CacheDir, trackID+"-"+quality+"."+ext)
}

// Cached reports whether a transcoded copy already exists on disk.
func Cached(trackID, quality, ext string) (path string, ok bool) {
	p := CachePath(trackID, quality, ext)
	if _, err := os.Stat(p); err == nil {
		return p, true
	}
	return "", false
}

// EncodeAndCache runs encode, writing its output to both w (the live HTTP
// response) and a cache file at the same time — the first play still streams
// progressively, and every later play of the same track+quality hits the
// cache via a plain (Range-seekable) file instead of re-running ffmpeg.
// The cache file is written to a per-request temp path and renamed atomically
// on success, so a failed or killed encode never leaves a partial file that a
// later request could serve as if it were complete.
//
// Concurrent calls for the same track+quality (e.g. gapless preload racing
// the active track, or two devices playing the same song) are collapsed via
// encodeGroup: only one of them actually runs ffmpeg. The others block until
// that encode finishes, then serve the now-complete cache file directly to
// their own w — no second ffmpeg process, no race on the same tmp path.
func EncodeAndCache(ctx context.Context, w io.Writer, trackID, quality, ext string, encode func(context.Context, io.Writer) error) error {
	path := CachePath(trackID, quality, ext)
	key := trackID + "-" + quality + "." + ext

	ranOwnEncode := false
	_, err, _ := encodeGroup.Do(key, func() (any, error) {
		ranOwnEncode = true
		tmp := path + ".tmp"
		f, ferr := os.Create(tmp)
		if ferr != nil {
			// Cache dir unavailable — degrade to streaming without caching rather than failing playback.
			return nil, encode(ctx, w)
		}
		encErr := encode(ctx, io.MultiWriter(w, f))
		f.Close()
		if encErr != nil {
			os.Remove(tmp)
			return nil, encErr
		}
		return nil, os.Rename(tmp, path)
	})
	if ranOwnEncode || err != nil {
		// Either we did the encode ourselves (already streamed to w above), or
		// the shared encode failed — nothing further to serve on our side.
		return err
	}

	// We joined an in-flight encode driven by a different request's w. The
	// cache file is complete now; serve our own copy of it.
	cachedPath, ok := Cached(trackID, quality, ext)
	if !ok {
		// The leader hit the no-cache-dir fallback and never wrote a cache
		// file — fall back the same way for this request.
		return encode(ctx, w)
	}
	f, ferr := os.Open(cachedPath)
	if ferr != nil {
		return ferr
	}
	defer f.Close()
	_, err = io.Copy(w, f)
	return err
}

// CleanupCache deletes the oldest (by mtime) files in CacheDir until total
// size is back under maxBytes. Leftover .tmp files from a killed/failed
// encode (server restarted mid-transcode) are always removed regardless of
// size, since a partial file is never valid to serve.
func CleanupCache(maxBytes int64) {
	entries, err := os.ReadDir(CacheDir)
	if err != nil {
		log.Printf("transcode cache cleanup: read dir: %v", err)
		return
	}

	type fileInfo struct {
		path    string
		size    int64
		modTime int64
	}
	var files []fileInfo
	var total int64
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		path := filepath.Join(CacheDir, e.Name())
		if strings.HasSuffix(e.Name(), ".tmp") {
			os.Remove(path) // orphaned from a killed/failed encode — never valid to serve
			continue
		}
		files = append(files, fileInfo{path, info.Size(), info.ModTime().UnixNano()})
		total += info.Size()
	}
	if total <= maxBytes {
		return
	}

	sort.Slice(files, func(i, j int) bool { return files[i].modTime < files[j].modTime })
	removed := 0
	for _, f := range files {
		if total <= maxBytes {
			break
		}
		if err := os.Remove(f.path); err != nil {
			log.Printf("transcode cache cleanup: remove %s: %v", f.path, err)
			continue
		}
		total -= f.size
		removed++
	}
	if removed > 0 {
		log.Printf("transcode cache cleanup: removed %d file(s), now %.1f MB", removed, float64(total)/1024/1024)
	}
}
