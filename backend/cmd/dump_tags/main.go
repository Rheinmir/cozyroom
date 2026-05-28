package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/dhowden/tag"
)

func main() {
	musicDir := "/music/mp3"
	files, err := os.ReadDir(musicDir)
	if err != nil {
		fmt.Printf("Error reading dir: %v\n", err)
		return
	}

	fmt.Println("Dumping MP3 tags:")
	for _, f := range files {
		if f.IsDir() || !strings.HasSuffix(strings.ToLower(f.Name()), ".mp3") {
			continue
		}
		path := filepath.Join(musicDir, f.Name())
		file, err := os.Open(path)
		if err != nil {
			continue
		}
		m, err := tag.ReadFrom(file)
		file.Close()
		if err != nil {
			fmt.Printf("File: %s -> Error: %v\n", f.Name(), err)
			continue
		}
		trackNum, _ := m.Track()
		fmt.Printf("File: %s\n", f.Name())
		fmt.Printf("  Title:  %q\n", m.Title())
		fmt.Printf("  Artist: %q\n", m.Artist())
		fmt.Printf("  Album:  %q\n", m.Album())
		fmt.Printf("  Track:  %v\n", trackNum)
	}
}
