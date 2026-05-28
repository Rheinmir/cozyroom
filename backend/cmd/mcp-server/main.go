// mcp-server exposes Cozyroom's MCP tools over stdio.
// It delegates tool calls to a running Cozyroom backend via HTTP.
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"

	"cozyroom/internal/mcp"
)

func main() {
	baseURL := envOr("COZYROOM_URL", "http://localhost:18080")
	baseURL = strings.TrimRight(baseURL, "/")

	tools := buildHTTPTools(baseURL)
	fmt.Fprintf(os.Stderr, "cozyroom-mcp: stdio ready, backend=%s, tools=%d\n", baseURL, len(tools))
	mcp.RunStdio(tools)
}

// buildHTTPTools creates tools that call the running Cozyroom backend HTTP API.
func buildHTTPTools(base string) []mcp.Tool {
	get := func(path string) (any, error) {
		resp, err := http.Get(base + path)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		raw, _ := io.ReadAll(resp.Body)
		var result any
		json.Unmarshal(raw, &result)
		return result, nil
	}
	post := func(path string, body map[string]any) (any, error) {
		b, _ := json.Marshal(body)
		resp, err := http.Post(base+path, "application/json", strings.NewReader(string(b)))
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		raw, _ := io.ReadAll(resp.Body)
		var result any
		json.Unmarshal(raw, &result)
		return result, nil
	}

	str := func(m map[string]any, k string) string {
		if v, ok := m[k]; ok {
			if s, ok := v.(string); ok {
				return s
			}
		}
		return ""
	}

	return []mcp.Tool{
		{
			Name: "search_music", Description: "Search music: artists+albums+tracks. Returns top 20.",
			InputSchema: map[string]any{"type": "object", "properties": map[string]any{"query": map[string]any{"type": "string"}}, "required": []string{"query"}},
			Handler: func(input map[string]any) (any, error) {
				q := str(input, "query")
				return get("/api/search?q=" + url.QueryEscape(q))
			},
		},
		{
			Name: "list_artists", Description: "List all artists. Returns ≤50 + total.",
			InputSchema: map[string]any{"type": "object", "properties": map[string]any{}},
			Handler: func(input map[string]any) (any, error) {
				return get("/api/artists")
			},
		},
		{
			Name: "get_stats", Description: "Get library stats: artists, albums, tracks count.",
			InputSchema: map[string]any{"type": "object", "properties": map[string]any{}},
			Handler: func(input map[string]any) (any, error) {
				return get("/api/stats")
			},
		},
		{
			Name: "search_youtube", Description: "Search YouTube. Returns ≤8 videos.",
			InputSchema: map[string]any{"type": "object", "properties": map[string]any{"query": map[string]any{"type": "string"}}, "required": []string{"query"}},
			Handler: func(input map[string]any) (any, error) {
				q := str(input, "query")
				return get("/api/youtube/search?q=" + url.QueryEscape(q))
			},
		},
		{
			Name: "list_playlists", Description: "List all playlists.",
			InputSchema: map[string]any{"type": "object", "properties": map[string]any{}},
			Handler: func(input map[string]any) (any, error) {
				return get("/api/playlists")
			},
		},
		{
			Name: "get_trending", Description: "Get trending GitHub repos. Returns ≤15.",
			InputSchema: map[string]any{"type": "object", "properties": map[string]any{"date": map[string]any{"type": "string"}}},
			Handler: func(input map[string]any) (any, error) {
				path := "/api/trending"
				if d := str(input, "date"); d != "" {
					path += "?date=" + d
				}
				return get(path)
			},
		},
		{
			Name: "download_youtube", Description: "Download YouTube audio to library.",
			InputSchema: map[string]any{"type": "object", "properties": map[string]any{"id": map[string]any{"type": "string"}, "title": map[string]any{"type": "string"}, "artist": map[string]any{"type": "string"}}, "required": []string{"id", "title"}},
			Handler: func(input map[string]any) (any, error) {
				return post("/api/youtube/download", input)
			},
		},
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
