package hls

import (
	"bufio"
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

// ValidFile matches the only filenames this package serves.
var ValidFile = regexp.MustCompile(`^(index\.m3u8|\d{5}\.ts)$`)

type job struct {
	ready chan struct{} // closed when index.m3u8 first appears on disk
	dir   string
}

// Manager starts and tracks per-video ffmpeg HLS jobs.
// Completed outputs are kept on disk; ffmpeg is not re-run if ENDLIST is present.
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

// EnsureReady starts HLS generation if needed, then blocks until index.m3u8
// is available (i.e. the first 4-second segment has been written).
func (m *Manager) EnsureReady(ctx context.Context, id, filePath string) error {
	dir := m.Dir(id)
	m3u8 := filepath.Join(dir, "index.m3u8")

	if isComplete(m3u8) {
		return nil
	}

	m.mu.Lock()
	j, ok := m.running[id]
	if !ok {
		j = &job{ready: make(chan struct{}), dir: dir}
		m.running[id] = j
		go m.run(id, filePath, m3u8, j)
	}
	m.mu.Unlock()

	select {
	case <-j.ready:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (m *Manager) run(id, filePath, m3u8 string, j *job) {
	pollCtx, stopPoll := context.WithCancel(context.Background())
	defer stopPoll()
	defer func() {
		m.mu.Lock()
		delete(m.running, id)
		m.mu.Unlock()
		// Unblock any waiters even on failure so they get a 503, not a hang.
		select {
		case <-j.ready:
		default:
			close(j.ready)
		}
	}()

	if err := os.MkdirAll(j.dir, 0755); err != nil {
		return
	}

	cmd := exec.Command("ffmpeg",
		"-hide_banner", "-loglevel", "error",
		"-i", filePath,
		"-c:v", "copy",
		"-c:a", "aac", "-b:a", "192k",
		"-f", "hls",
		"-hls_time", "4",
		"-hls_list_size", "0",
		"-hls_flags", "independent_segments",
		"-hls_segment_filename", filepath.Join(j.dir, "%05d.ts"),
		m3u8,
	)

	if err := cmd.Start(); err != nil {
		return
	}

	// Signal ready as soon as index.m3u8 first appears (first segment written).
	go func() {
		for {
			if _, err := os.Stat(m3u8); err == nil {
				select {
				case <-j.ready:
				default:
					close(j.ready)
				}
				return
			}
			select {
			case <-pollCtx.Done():
				return
			case <-time.After(300 * time.Millisecond):
			}
		}
	}()

	cmd.Wait()
}

// WaitSegment blocks until path exists on disk or ctx is cancelled.
func WaitSegment(ctx context.Context, path string) error {
	for {
		if _, err := os.Stat(path); err == nil {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(300 * time.Millisecond):
		}
	}
}

func isComplete(m3u8 string) bool {
	f, err := os.Open(m3u8)
	if err != nil {
		return false
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	for s.Scan() {
		if strings.TrimSpace(s.Text()) == "#EXT-X-ENDLIST" {
			return true
		}
	}
	return false
}
