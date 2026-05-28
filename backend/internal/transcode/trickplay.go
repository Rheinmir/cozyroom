package transcode

import (
	"context"
	"fmt"
	"os/exec"
)

// TrickplayCols is the number of columns in the generated sprite sheet.
const TrickplayCols = 10

// TrickplayFrameWidth and TrickplayFrameHeight are the dimensions of each thumbnail cell.
const TrickplayFrameWidth = 160
const TrickplayFrameHeight = 90

// TrickplayIntervalS is the interval between captured frames in seconds.
const TrickplayIntervalS = 10

// GenerateTrickplay extracts one frame every TrickplayIntervalS seconds from
// videoPath, scales each to 160×90, and tiles them into a single PNG sprite
// sheet at outputPath with TrickplayCols columns. The process respects ctx
// cancellation.
func GenerateTrickplay(ctx context.Context, videoPath, outputPath string) error {
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-hide_banner", "-loglevel", "error",
		"-i", videoPath,
		"-vf", fmt.Sprintf("fps=1/%d,scale=%d:%d,tile=%dx999",
			TrickplayIntervalS, TrickplayFrameWidth, TrickplayFrameHeight, TrickplayCols),
		"-vframes", "1",
		"-y",
		outputPath,
	)
	return cmd.Run()
}
