// Package audiohls packages a music track as Apple-style HLS for iOS:
// fMP4 segments in three variants (AAC 64k, AAC 256k, ALAC for lossless
// sources) behind one master playlist, so Safari's native player picks the
// variant that fits the network. Output is a complete VOD (#EXT-X-ENDLIST)
// built in a temp dir and renamed into place, so a half-written package is
// never served. Packages stay on disk and are reused on later plays.
package audiohls

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ValidFile matches the only paths (relative to a track's dir) this package serves.
var ValidFile = regexp.MustCompile(`^(master\.m3u8|[0-2]/(index\.m3u8|init_[0-2]\.mp4|seg_\d{5}\.m4s))$`)

type variant struct {
	codecArgs []string
	codecs    string // RFC 6381 CODECS value for the master playlist
}

var (
	aac64  = variant{[]string{"aac", "-b:a:%d", "64k"}, "mp4a.40.2"}
	aac256 = variant{[]string{"aac", "-b:a:%d", "256k"}, "mp4a.40.2"}
	alac   = variant{[]string{"alac"}, "alac"}
)

type job struct {
	done chan struct{}
	err  error
}

// Manager builds and tracks per-track HLS packages under baseDir.
type Manager struct {
	mu      sync.Mutex
	running map[string]*job
	baseDir string
}

func New(baseDir string) *Manager {
	return &Manager{running: make(map[string]*job), baseDir: baseDir}
}

func (m *Manager) Dir(id string) string {
	return filepath.Join(m.baseDir, id)
}

// Ensure builds the package for id if it is not on disk yet and blocks until
// it is complete. Concurrent callers for the same id share one ffmpeg run.
func (m *Manager) Ensure(ctx context.Context, id, filePath string, lossless bool) error {
	if _, err := os.Stat(filepath.Join(m.Dir(id), "master.m3u8")); err == nil {
		return nil
	}
	m.mu.Lock()
	j, ok := m.running[id]
	if !ok {
		j = &job{done: make(chan struct{})}
		m.running[id] = j
		go func() {
			j.err = m.build(id, filePath, lossless)
			m.mu.Lock()
			delete(m.running, id)
			m.mu.Unlock()
			close(j.done)
		}()
	}
	m.mu.Unlock()

	select {
	case <-j.done:
		return j.err
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (m *Manager) build(id, filePath string, lossless bool) error {
	// Not tied to the request context: a client that gives up should not
	// waste the work, the next play reuses the finished package.
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	variants := []variant{aac64, aac256}
	if lossless {
		variants = append(variants, alac) // ALAC from a lossy source only wastes bytes
	}

	if err := os.MkdirAll(m.baseDir, 0755); err != nil {
		return err
	}
	tmp, err := os.MkdirTemp(m.baseDir, "."+id+"-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmp) // no-op after a successful rename

	args := []string{"-hide_banner", "-loglevel", "error", "-i", filePath,
		"-vn", "-map_metadata", "-1"}
	var streamMap []string
	for i := range variants {
		args = append(args, "-map", "0:a:0")
		streamMap = append(streamMap, fmt.Sprintf("a:%d", i))
	}
	args = append(args, "-ac", "2")
	for i, v := range variants {
		args = append(args, fmt.Sprintf("-c:a:%d", i), v.codecArgs[0])
		if len(v.codecArgs) == 3 {
			args = append(args, fmt.Sprintf(v.codecArgs[1], i), v.codecArgs[2])
		}
	}
	args = append(args,
		"-f", "hls",
		"-hls_time", "6",
		"-hls_playlist_type", "vod",
		"-hls_segment_type", "fmp4",
		"-hls_flags", "independent_segments",
		"-hls_segment_filename", filepath.Join(tmp, "%v", "seg_%05d.m4s"),
		"-var_stream_map", strings.Join(streamMap, " "),
		filepath.Join(tmp, "%v", "index.m3u8"),
	)

	start := time.Now()
	if out, err := exec.CommandContext(ctx, "ffmpeg", args...).CombinedOutput(); err != nil {
		return fmt.Errorf("ffmpeg: %v: %s", err, strings.TrimSpace(string(out)))
	}

	master, err := masterPlaylist(tmp, variants)
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(tmp, "master.m3u8"), []byte(master), 0644); err != nil {
		return err
	}
	if err := os.Rename(tmp, m.Dir(id)); err != nil {
		return err
	}
	log.Printf("[audiohls] packaged %s: %d variants in %v", id, len(variants), time.Since(start).Round(time.Millisecond))
	return nil
}

// masterPlaylist writes our own master instead of ffmpeg's so that BANDWIDTH
// is measured from the real output (ALAC varies a lot per track) and CODECS
// is always present: Safari skips variants whose codec it can't tell.
func masterPlaylist(dir string, variants []variant) (string, error) {
	var b strings.Builder
	b.WriteString("#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-INDEPENDENT-SEGMENTS\n")
	for i, v := range variants {
		peak, avg, err := bandwidth(filepath.Join(dir, strconv.Itoa(i)))
		if err != nil {
			return "", err
		}
		fmt.Fprintf(&b, "#EXT-X-STREAM-INF:BANDWIDTH=%d,AVERAGE-BANDWIDTH=%d,CODECS=\"%s\"\n%d/index.m3u8\n",
			peak, avg, v.codecs, i)
	}
	return b.String(), nil
}

// bandwidth returns peak and average bits per second of one variant's segments.
func bandwidth(dir string) (peak, avg int64, err error) {
	data, err := os.ReadFile(filepath.Join(dir, "index.m3u8"))
	if err != nil {
		return 0, 0, err
	}
	var total int64
	var totalDur, dur float64
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "#EXTINF:") {
			dur, _ = strconv.ParseFloat(strings.TrimSuffix(strings.TrimPrefix(line, "#EXTINF:"), ","), 64)
			continue
		}
		if line == "" || strings.HasPrefix(line, "#") || dur <= 0 {
			continue
		}
		fi, err := os.Stat(filepath.Join(dir, line))
		if err != nil {
			return 0, 0, err
		}
		total += fi.Size()
		totalDur += dur
		if bps := int64(float64(fi.Size()*8) / dur); bps > peak {
			peak = bps
		}
		dur = 0
	}
	if totalDur == 0 {
		return 0, 0, fmt.Errorf("no segments in %s", dir)
	}
	return peak, int64(float64(total*8) / totalDur), nil
}
