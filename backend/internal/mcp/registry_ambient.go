package mcp

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func ambientDir() string {
	if d := os.Getenv("AMBIENT_SOUNDS_DIR"); d != "" {
		return d
	}
	return "./sounds/ambient"
}

func listAmbientSoundsTool(_ ToolDeps) Tool {
	return Tool{
		Name:        "list_ambient_sounds",
		Description: "List available background ambient sounds (rain, ocean, fire, etc.).",
		InputSchema: map[string]any{"type": "object", "properties": map[string]any{}},
		Handler: func(_ map[string]any) (any, error) {
			entries, err := os.ReadDir(ambientDir())
			if err != nil {
				return map[string]any{"sounds": []any{}}, nil
			}
			labelMap := map[string]string{
				"ocean":  "Ocean",
				"rain":   "Rain",
				"stream": "Stream",
				"night":  "Night",
				"fire":   "Fire",
			}
			sounds := make([]map[string]any, 0)
			for _, e := range entries {
				if e.IsDir() {
					continue
				}
				ext := strings.ToLower(filepath.Ext(e.Name()))
				if ext != ".m4a" && ext != ".mp3" && ext != ".ogg" && ext != ".wav" && ext != ".aac" {
					continue
				}
				base := strings.TrimSuffix(e.Name(), filepath.Ext(e.Name()))
				label := labelMap[base]
				if label == "" {
					label = base
				}
				sounds = append(sounds, map[string]any{"name": base, "label": label})
			}
			return map[string]any{"sounds": sounds}, nil
		},
	}
}

func playAmbientSoundTool(_ ToolDeps) Tool {
	return Tool{
		Name:        "play_ambient_sound",
		Description: "Play a background ambient sound. Use list_ambient_sounds to get available names.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"name":   map[string]any{"type": "string", "description": "Sound name (e.g. rain, ocean, fire)"},
				"volume": map[string]any{"type": "number", "description": "Volume 0.0–1.0 (default 0.3)"},
			},
			"required": []string{"name"},
		},
		Handler: func(input map[string]any) (any, error) {
			name := strInput(input, "name")
			if name == "" {
				return nil, fmt.Errorf("name required")
			}
			volume := 0.3
			if v, ok := input["volume"].(float64); ok && v >= 0 && v <= 1 {
				volume = v
			}
			return map[string]any{
				"_frontend_action": "play_ambient_sound",
				"name":             name,
				"volume":           volume,
			}, nil
		},
	}
}

func stopAmbientSoundTool(_ ToolDeps) Tool {
	return Tool{
		Name:        "stop_ambient_sound",
		Description: "Stop the currently playing background ambient sound.",
		InputSchema: map[string]any{"type": "object", "properties": map[string]any{}},
		Handler: func(_ map[string]any) (any, error) {
			return map[string]any{"_frontend_action": "stop_ambient_sound"}, nil
		},
	}
}
