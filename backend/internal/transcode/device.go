package transcode

import (
	"path/filepath"
	"strings"
)

// CanDirectPlay returns true when the client's User-Agent suggests it can
// play the given video file natively without server-side transcoding.
//
// Decision table:
//   - .mp4 / .m4v  → all modern browsers support H264+AAC in MP4
//   - .mkv / .webm → Chrome and Firefox support these; Safari does not
//   - other        → require HLS transcoding
func CanDirectPlay(userAgent, filePath string) bool {
	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".mp4", ".m4v":
		return true
	case ".mkv", ".webm":
		ua := strings.ToLower(userAgent)
		return strings.Contains(ua, "chrome") || strings.Contains(ua, "firefox")
	}
	return false
}
