package audiohls

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func sine(t *testing.T, dir, name string) string {
	t.Helper()
	p := filepath.Join(dir, name)
	out, err := exec.Command("ffmpeg", "-hide_banner", "-loglevel", "error",
		"-f", "lavfi", "-i", "sine=frequency=440:duration=14", p).CombinedOutput()
	if err != nil {
		t.Fatalf("make %s: %v: %s", name, err, out)
	}
	return p
}

func TestEnsure(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not installed")
	}
	src := t.TempDir()
	m := New(filepath.Join(t.TempDir(), "audio"))

	cases := []struct {
		id, file string
		lossless bool
		want     []string
	}{
		{"aaaaaaaaaaaaaaaa", "a.flac", true, []string{`CODECS="mp4a.40.2"`, `CODECS="mp4a.40.2"`, `CODECS="alac"`}},
		{"bbbbbbbbbbbbbbbb", "b.mp3", false, []string{`CODECS="mp4a.40.2"`, `CODECS="mp4a.40.2"`}},
	}
	for _, c := range cases {
		if err := m.Ensure(context.Background(), c.id, sine(t, src, c.file), c.lossless); err != nil {
			t.Fatalf("%s: %v", c.file, err)
		}
		master, err := os.ReadFile(filepath.Join(m.Dir(c.id), "master.m3u8"))
		if err != nil {
			t.Fatal(err)
		}
		if got := strings.Count(string(master), "#EXT-X-STREAM-INF:"); got != len(c.want) {
			t.Fatalf("%s: %d variants, want %d:\n%s", c.file, got, len(c.want), master)
		}
		for i, w := range c.want {
			if !strings.Contains(string(master), w) {
				t.Errorf("%s: variant %d lacks %s", c.file, i, w)
			}
			idx, err := os.ReadFile(filepath.Join(m.Dir(c.id), string(rune('0'+i)), "index.m3u8"))
			if err != nil || !strings.Contains(string(idx), "#EXT-X-ENDLIST") || !strings.Contains(string(idx), "init_") {
				t.Errorf("%s: variant %d playlist incomplete: %v\n%s", c.file, i, err, idx)
			}
		}
	}

	// Served paths of a finished package all pass ValidFile.
	filepath.Walk(m.Dir("aaaaaaaaaaaaaaaa"), func(p string, fi os.FileInfo, err error) error {
		if err == nil && !fi.IsDir() {
			rel, _ := filepath.Rel(m.Dir("aaaaaaaaaaaaaaaa"), p)
			if !ValidFile.MatchString(filepath.ToSlash(rel)) {
				t.Errorf("package file %s is not servable", rel)
			}
		}
		return nil
	})
	// A second Ensure reuses the package instead of running ffmpeg again.
	if err := m.Ensure(context.Background(), "aaaaaaaaaaaaaaaa", "/missing.flac", true); err != nil {
		t.Errorf("reuse: %v", err)
	}
}

func TestValidFile(t *testing.T) {
	for _, bad := range []string{"../x", "3/index.m3u8", "0/../../etc/passwd", "0/seg_1.m4s", "index.m3u8", "0/init_0.mp4/x"} {
		if ValidFile.MatchString(bad) {
			t.Errorf("ValidFile accepts %q", bad)
		}
	}
}
