package hls

import (
	"bufio"
	"context"
	"log"
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
	ready     chan struct{} // closed when index.m3u8 first appears on disk
	dir       string
	startedAt time.Time
	cmd       *exec.Cmd // kept for watcher to check liveness
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

// Watch runs a background goroutine that logs and cleans up stuck ffmpeg jobs.
// Call once after New(). A job is considered stuck if it has been running for
// over 3 hours without completing (covers even the longest films).
func (m *Manager) Watch(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				m.mu.Lock()
				for id, j := range m.running {
					age := time.Since(j.startedAt)
					if age > 3*time.Hour {
						log.Printf("[hls] watcher: job %s stuck for %v — killing ffmpeg", id, age.Round(time.Second))
						if j.cmd != nil && j.cmd.Process != nil {
							j.cmd.Process.Kill()
						}
						delete(m.running, id)
					}
				}
				activeJobs := len(m.running)
				m.mu.Unlock()
				if activeJobs > 0 {
					log.Printf("[hls] watcher: %d active transcode job(s)", activeJobs)
				}
			}
		}
	}()
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
		j = &job{ready: make(chan struct{}), dir: dir, startedAt: time.Now()}
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
	// 2-hour hard timeout — covers even very long films. Prevents goroutine
	// leaks when ffmpeg hangs on a corrupt/unreadable file.
	ffmpegCtx, cancelFFmpeg := context.WithTimeout(context.Background(), 2*time.Hour)
	defer cancelFFmpeg()

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
		log.Printf("[hls] mkdir %s: %v", j.dir, err)
		return
	}

	cmd := exec.CommandContext(ffmpegCtx,
		"ffmpeg",
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
	j.cmd = cmd // expose to watcher

	if err := cmd.Start(); err != nil {
		log.Printf("[hls] ffmpeg start %s: %v", id, err)
		return
	}
	log.Printf("[hls] transcode started: %s", id)

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

	if err := cmd.Wait(); err != nil {
		log.Printf("[hls] ffmpeg done %s: %v", id, err)
	} else {
		log.Printf("[hls] transcode complete: %s", id)
	}
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
