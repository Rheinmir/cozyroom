package transcode

import (
	"bufio"
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
	// 32 KB (~0.8s of 320kbps audio) smooths ffmpeg's bursty write pattern
	// without holding back the client's first byte for several seconds —
	// a large buffer here directly adds to perceived playback start latency.
	bw := bufio.NewWriterSize(w, 32*1024)
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-hide_banner", "-loglevel", "error",
		"-i", path,
		"-vn",                 // disable video/picture streams (embedded cover art)
		"-map_metadata", "-1", // strip metadata to prevent corrupt tags crashing browser demuxers (like PTS not defined)
		"-c:a", "libmp3lame", "-b:a", "320k",
		"-ac", "2",            // force stereo — files with mixed mono/stereo frames break Chrome's pipeline
		"-f", "mp3",
		"pipe:1",
	)
	cmd.Stdout = bw
	err := cmd.Run()
	bw.Flush()
	return err
}

// ToCleanFLAC re-encodes a lossless audio file to FLAC, stripping metadata and
// normalising to stereo. Uses FLAC re-encode (not stream copy) so that files
// with mixed mono/stereo frames — which cause Chrome PIPELINE_ERROR_DECODE —
// are normalised to a consistent channel layout.
func ToCleanFLAC(ctx context.Context, path string, w io.Writer) error {
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-hide_banner", "-loglevel", "error",
		"-i", path,
		"-vn",                 // disable video/picture streams (embedded cover art)
		"-map_metadata", "-1", // strip metadata to prevent corrupt tags crashing browser demuxers (like PTS not defined)
		"-c:a", "flac",
		"-ac", "2",            // force stereo — files with mixed mono/stereo frames break Chrome's pipeline
		"-f", "flac",
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
