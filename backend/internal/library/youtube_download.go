package library

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// ErrYouTubeFileNotFound is returned when yt-dlp reports success but the
// expected downloaded audio file cannot be located on disk.
var ErrYouTubeFileNotFound = errors.New("downloaded audio file not found")

// DownloadYouTubeAudio downloads audio for a YouTube video via yt-dlp, resolves
// the uploader name, copies the thumbnail into coversDir, and indexes the
// result into the library. It returns the resulting track ID (usable directly
// with add_to_playlist) plus the resolved title/artist.
//
// This is the single place that runs the yt-dlp download — used by both the
// HTTP POST /api/youtube/download handler and the MCP download_youtube tool.
// Keep them in sync by editing only here.
func DownloadYouTubeAudio(ctx context.Context, db *sql.DB, dlPath, coversDir, videoID, title, artist string) (trackID, resolvedTitle, resolvedArtist string, err error) {
	cmd := exec.CommandContext(ctx, "yt-dlp",
		"-f", "bestaudio",
		"-x", "--audio-format", "best",
		"--embed-metadata",            // embed title, artist, album, date into file tags
		"--write-thumbnail",           // save thumbnail as separate file (ytID.jpg or .webp)
		"--convert-thumbnails", "jpg", // normalize to jpg
		"--paths", dlPath,
		"-o", "%(id)s.%(ext)s",
		"https://www.youtube.com/watch?v="+videoID,
	)
	output, cmdErr := cmd.CombinedOutput()
	if cmdErr != nil {
		return "", "", "", fmt.Errorf("yt-dlp download %s: %w\n%s", videoID, cmdErr, string(output))
	}

	// Find the downloaded audio file
	var filePath string
	for _, ext := range []string{".opus", ".webm", ".m4a", ".mp3"} {
		testPath := filepath.Join(dlPath, videoID+ext)
		if _, statErr := os.Stat(testPath); statErr == nil {
			filePath = testPath
			break
		}
	}
	if filePath == "" {
		return "", "", "", fmt.Errorf("%w: %s in %s", ErrYouTubeFileNotFound, videoID, dlPath)
	}

	// Resolve uploader — prefer artist, skip second yt-dlp call if already clean
	uploader := strings.TrimSpace(artist)
	if uploader == "" || (strings.HasPrefix(uploader, "UC") && len(uploader) == 24) {
		// artist is a channel ID, not a name — fetch friendly name
		cmdU := exec.CommandContext(ctx, "yt-dlp", "--print", "uploader",
			"https://www.youtube.com/watch?v="+videoID)
		if outU, errU := cmdU.Output(); errU == nil {
			if name := strings.TrimSpace(string(outU)); name != "" {
				uploader = name
			}
		}
	}

	// Copy yt-dlp-written thumbnail into covers dir so it shows up immediately
	// yt-dlp writes it as <id>.jpg (after --convert-thumbnails jpg)
	thumbSrc := filepath.Join(dlPath, videoID+".jpg")
	if _, statErr := os.Stat(thumbSrc); statErr == nil {
		// Derive albumID the same way indexFileWithMetadata does
		artistID := id8(uploader)
		albumID := id8(artistID + strings.TrimSpace(title))
		thumbDst := filepath.Join(coversDir, albumID+".jpg")
		if _, statErr := os.Stat(thumbDst); os.IsNotExist(statErr) {
			if data, readErr := os.ReadFile(thumbSrc); readErr == nil {
				if mkErr := os.MkdirAll(coversDir, 0755); mkErr == nil {
					_ = os.WriteFile(thumbDst, data, 0644)
					log.Printf("[yt-dlp] cover saved: %s -> %s", thumbSrc, thumbDst)
				}
			}
		}
		os.Remove(thumbSrc) // clean up from music dir
	}

	log.Printf("[yt-dlp] indexing %s (title=%q artist=%q)", filePath, title, uploader)
	if idxErr := IndexFileWithMetadata(db, filePath, coversDir, title, uploader, title); idxErr != nil {
		log.Printf("[yt-dlp] index error: %v", idxErr)
	}

	return id8(filePath), title, uploader, nil
}
