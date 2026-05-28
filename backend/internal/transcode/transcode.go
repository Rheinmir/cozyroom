package transcode

import (
	"context"
	"io"
	"os/exec"
	"path/filepath"
	"strings"
)

var losslessExts = map[string]bool{
	".flac": true, ".wav": true, ".aiff": true, ".aif": true,
}

// IsLossless returns true when the file is a lossless audio format.
func IsLossless(path string) bool {
	return losslessExts[strings.ToLower(filepath.Ext(path))]
}

// ToMP3_320 pipes the audio file through ffmpeg and writes 320 kbps MP3 to w.
// The ffmpeg process is killed when ctx is cancelled (e.g. client disconnects).
func ToMP3_320(ctx context.Context, path string, w io.Writer) error {
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-hide_banner", "-loglevel", "error",
		"-i", path,
		"-c:a", "libmp3lame", "-b:a", "320k",
		"-f", "mp3",
		"pipe:1",
	)
	cmd.Stdout = w
	return cmd.Run()
}

// ToFragmentedMP4 remuxes a video file to a fragmented MP4 stream suitable for
// progressive HTTP delivery. Video is copied without re-encoding; audio is
// re-encoded to AAC for browser compatibility (MPEG-TS often carries AC3/MP2).
// The ffmpeg process is killed when ctx is cancelled (e.g. client disconnects).
func ToFragmentedMP4(ctx context.Context, path string, w io.Writer) error {
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-hide_banner", "-loglevel", "error",
		"-i", path,
		"-c:v", "copy",
		"-c:a", "aac", "-b:a", "192k",
		"-movflags", "frag_keyframe+empty_moov+default_base_moof",
		"-f", "mp4",
		"pipe:1",
	)
	cmd.Stdout = w
	return cmd.Run()
}
