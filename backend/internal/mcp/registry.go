package mcp

import (
	"bytes"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"cozyroom/internal/usecase"
)

func randomHexID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x", b)
}

// ToolDeps are the dependencies needed to handle MCP tool calls natively.
type ToolDeps struct {
	Lib           *usecase.LibraryUsecase
	DB            *sql.DB
	ScanFunc      func() (int, error) // triggers library.Scan; nil = no-op
	CloakProxyURL string
	ReloadCronFunc func() error // reloads cron tasks
}

// NewRegistry returns all MCP tools wired to native backend services.
func NewRegistry(d ToolDeps) []Tool {
	return []Tool{
		searchMusicTool(d),
		listArtistsTool(d),
		getArtistTool(d),
		listAlbumsTool(d),
		listTracksTool(d),
		playTrackTool(d),
		togglePlayTool(d),
		nextTrackTool(d),
		prevTrackTool(d),
		searchYouTubeTool(d),
		playYouTubeStreamTool(d),
		downloadYouTubeTool(d),
		setShuffleModeTool(d),
		setRepeatTool(d),
		listPlaylistsTool(d),
		createPlaylistTool(d),
		addToPlaylistTool(d),
		playPlaylistTool(d),
		removeFromPlaylistTool(d),
		deletePlaylistTool(d),
		getTrendingTool(d),
		scanLibraryTool(d),
		getStatsTool(d),
		rememberTool(d),
		recallTool(d),
		forgetTool(d),
		getAIAnalyticsTool(d),
		getAILogsTool(d),
		getAIExtremesTool(d),
		webSearchTool(d),
		browseURLTool(d),
		createCustomSkillTool(d),
		scheduleAgentTaskTool(d),
		getScheduledTasksTool(d),
		deleteScheduledTaskTool(d),
	}
}

func strInput(input map[string]any, key string) string {
	if v, ok := input[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// fetchViaCloak fetches a URL through the cloak proxy service.
func fetchViaCloak(cloakURL, targetURL string) (string, error) {
	payload, _ := json.Marshal(map[string]string{"url": targetURL})
	resp, err := http.Post(cloakURL+"/fetch", "application/json", bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("cloak proxy: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	var result struct {
		HTML  string `json:"html"`
		Error string `json:"error"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}
	if result.Error != "" {
		return "", fmt.Errorf("cloak proxy: %s", result.Error)
	}
	return result.HTML, nil
}

func webSearchTool(d ToolDeps) Tool {
	return Tool{
		Name:        "web_search",
		Description: "Search the web via DuckDuckGo. Returns abstract, results, and related topics.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"query": map[string]any{"type": "string", "description": "Search query"},
			},
			"required": []string{"query"},
		},
		Handler: func(input map[string]any) (any, error) {
			q := strInput(input, "query")
			if q == "" {
				return nil, fmt.Errorf("query required")
			}
			if d.CloakProxyURL == "" {
				return nil, fmt.Errorf("cloak proxy not configured")
			}
			searchURL := fmt.Sprintf("https://api.duckduckgo.com/?q=%s&format=json&no_html=1&skip_disambig=1", url.QueryEscape(q))
			raw, err := fetchViaCloak(d.CloakProxyURL, searchURL)
			if err != nil {
				return nil, err
			}
			var ddg struct {
				AbstractText     string `json:"AbstractText"`
				AbstractURL      string `json:"AbstractURL"`
				AbstractTitle    string `json:"AbstractTitle"`
				AbstractSource   string `json:"AbstractSource"`
				Type             string `json:"Type"`
				Image            string `json:"Image"`
				Definition       string `json:"Definition"`
				DefinitionURL    string `json:"DefinitionURL"`
				DefinitionSource string `json:"DefinitionSource"`
				Answer           string `json:"Answer"`
				AnswerType       string `json:"AnswerType"`
				Results          []struct {
					Text     string `json:"Text"`
					FirstURL string `json:"FirstURL"`
					Result   string `json:"Result"`
				} `json:"Results"`
				RelatedTopics []any `json:"RelatedTopics"`
			}
			if err := json.Unmarshal([]byte(raw), &ddg); err != nil {
				return nil, fmt.Errorf("parse duckduckgo response: %w", err)
			}
			out := map[string]any{
				"abstract_text":   ddg.AbstractText,
				"abstract_url":    ddg.AbstractURL,
				"abstract_title":  ddg.AbstractTitle,
				"abstract_source": ddg.AbstractSource,
				"type":            ddg.Type,
				"image":           ddg.Image,
				"answer":          ddg.Answer,
				"answer_type":     ddg.AnswerType,
				"definition":      ddg.Definition,
				"definition_url":  ddg.DefinitionURL,
				"definition_source": ddg.DefinitionSource,
			}
			if len(ddg.Results) > 0 {
				results := make([]map[string]any, 0, len(ddg.Results))
				for _, r := range ddg.Results {
					results = append(results, map[string]any{
						"title":     r.Text,
						"url":       r.FirstURL,
						"snippet":   r.Result,
					})
				}
				out["results"] = results
			}
			if len(ddg.RelatedTopics) > 0 {
				var topics []map[string]any
				for _, t := range ddg.RelatedTopics {
					switch v := t.(type) {
					case map[string]any:
						if text, ok := v["Text"].(string); ok {
							topics = append(topics, map[string]any{
								"title": text,
								"url":   v["FirstURL"],
							})
						}
						if sub, ok := v["Topics"].([]any); ok {
							for _, st := range sub {
								if stm, ok := st.(map[string]any); ok {
									if text, ok := stm["Text"].(string); ok {
										topics = append(topics, map[string]any{
											"title": text,
											"url":   stm["FirstURL"],
										})
									}
								}
							}
						}
					}
				}
				out["related_topics"] = topics
			}
			return out, nil
		},
	}
}

func browseURLTool(d ToolDeps) Tool {
	return Tool{
		Name:        "browse_url",
		Description: "Fetch a URL and extract readable text content.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"url": map[string]any{"type": "string", "description": "URL to fetch"},
			},
			"required": []string{"url"},
		},
		Handler: func(input map[string]any) (any, error) {
			targetURL := strInput(input, "url")
			if targetURL == "" {
				return nil, fmt.Errorf("url required")
			}
			if d.CloakProxyURL == "" {
				return nil, fmt.Errorf("cloak proxy not configured")
			}
			raw, err := fetchViaCloak(d.CloakProxyURL, targetURL)
			if err != nil {
				return nil, err
			}
			re := regexp.MustCompile(`<[^>]+>`)
			clean := re.ReplaceAllString(raw, "")
			re2 := regexp.MustCompile(`\s{2,}`)
			clean = re2.ReplaceAllString(clean, " ")
			clean = strings.TrimSpace(clean)
			if len(clean) > 5000 {
				clean = clean[:5000] + "..."
			}
			return map[string]any{
				"url":  targetURL,
				"text": clean,
			}, nil
		},
	}
}

func searchMusicTool(d ToolDeps) Tool {
	return Tool{
		Name:        "search_music",
		Description: "Search music: artists+albums+tracks. Returns top 20.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"query": map[string]any{"type": "string", "description": "search term"},
			},
			"required": []string{"query"},
		},
		Handler: func(input map[string]any) (any, error) {
			q := strInput(input, "query")
			if q == "" {
				return nil, fmt.Errorf("query required")
			}
			res, err := d.Lib.SearchAll(context.Background(), q)
			if err != nil {
				return nil, err
			}
			artists, _ := Paginate(res.Artists, 5)
			albums, _ := Paginate(res.Albums, 8)
			tracks, totalTracks := Paginate(res.Tracks, 20)

			ta := make([]map[string]any, len(artists))
			for i, a := range artists {
				ta[i] = TrimArtist(a.ID, a.Name)
			}
			tal := make([]map[string]any, len(albums))
			for i, al := range albums {
				tal[i] = map[string]any{"id": al.ID, "t": al.Title, "ar": al.ArtistName, "y": al.Year}
			}
			ttr := make([]map[string]any, len(tracks))
			for i, tr := range tracks {
				ttr[i] = TrimTrack(tr.ID, tr.Title, tr.ArtistName, tr.AlbumTitle, tr.DurationS)
			}
			out := map[string]any{"artists": ta, "albums": tal, "tracks": ttr}
			if totalTracks > 20 {
				out["tracks_total"] = totalTracks
			}
			return out, nil
		},
	}
}

func listArtistsTool(d ToolDeps) Tool {
	return Tool{
		Name:        "list_artists",
		Description: "List all artists. Returns ≤50 + total.",
		InputSchema: map[string]any{"type": "object", "properties": map[string]any{}},
		Handler: func(input map[string]any) (any, error) {
			all, err := d.Lib.ListArtists(context.Background())
			if err != nil {
				return nil, err
			}
			page, total := Paginate(all, 50)
			result := make([]map[string]any, len(page))
			for i, a := range page {
				result[i] = TrimArtist(a.ID, a.Name)
			}
			return map[string]any{
				"artists": result,
				"total":   total,
				"hint":    "use search_music to narrow results",
			}, nil
		},
	}
}

func getArtistTool(d ToolDeps) Tool {
	return Tool{
		Name:        "get_artist",
		Description: "Get artist detail: album_count, track_count, genres.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"id": map[string]any{"type": "string"},
			},
			"required": []string{"id"},
		},
		Handler: func(input map[string]any) (any, error) {
			id := strInput(input, "id")
			if id == "" {
				return nil, fmt.Errorf("id required")
			}
			detail, err := d.Lib.ArtistDetail(context.Background(), id)
			if err != nil {
				return nil, err
			}
			return map[string]any{
				"id":     detail.ID,
				"name":   detail.Name,
				"albums": detail.AlbumCount,
				"tracks": detail.TrackCount,
				"genres": detail.Genres,
			}, nil
		},
	}
}

func listAlbumsTool(d ToolDeps) Tool {
	return Tool{
		Name:        "list_albums",
		Description: "List albums. Optionally filter by artist_id. Returns ≤20.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"artist_id": map[string]any{"type": "string"},
			},
		},
		Handler: func(input map[string]any) (any, error) {
			artistID := strInput(input, "artist_id")
			all, err := d.Lib.ListAlbums(context.Background(), artistID)
			if err != nil {
				return nil, err
			}
			page, total := Paginate(all, 20)
			result := make([]map[string]any, len(page))
			for i, al := range page {
				result[i] = map[string]any{"id": al.ID, "t": al.Title, "ar": al.ArtistName, "y": al.Year}
			}
			return map[string]any{"albums": result, "total": total}, nil
		},
	}
}

func listTracksTool(d ToolDeps) Tool {
	return Tool{
		Name:        "list_tracks",
		Description: "List tracks of an album.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"album_id": map[string]any{"type": "string"},
			},
			"required": []string{"album_id"},
		},
		Handler: func(input map[string]any) (any, error) {
			albumID := strInput(input, "album_id")
			if albumID == "" {
				return nil, fmt.Errorf("album_id required")
			}
			all, err := d.Lib.ListTracks(context.Background(), albumID)
			if err != nil {
				return nil, err
			}
			result := make([]map[string]any, len(all))
			for i, tr := range all {
				result[i] = TrimTrack(tr.ID, tr.Title, tr.ArtistName, "", tr.DurationS)
			}
			return map[string]any{"tracks": result}, nil
		},
	}
}

func playTrackTool(d ToolDeps) Tool {
	return Tool{
		Name:        "play_track",
		Description: "Play a track. Use id from search_music/list_tracks.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"id":     map[string]any{"type": "string"},
				"title":  map[string]any{"type": "string"},
				"artist": map[string]any{"type": "string"},
			},
			"required": []string{"id"},
		},
		Handler: func(input map[string]any) (any, error) {
			id := strInput(input, "id")
			title := strInput(input, "title")
			artist := strInput(input, "artist")

			var realID, albumID, realTitle, realArtist, albumTitle string
			var durS, albumYear int
			if d.DB != nil {
				// verify ID exists in DB; if not, fall back to title search
				err := d.DB.QueryRowContext(context.Background(),
					`SELECT t.id, t.album_id, t.title, COALESCE(ar.name,''), COALESCE(t.duration_s,0)
					 FROM tracks t
					 LEFT JOIN albums al ON al.id = t.album_id
					 LEFT JOIN artists ar ON ar.id = al.artist_id
					 WHERE t.id = $1`, id).Scan(&realID, &albumID, &realTitle, &realArtist, &durS)
				if err != nil && title != "" {
					// model may have passed wrong id — search by title
					tL, tU := strings.ToLower(title), strings.ToUpper(title)
					d.DB.QueryRowContext(context.Background(),
						`SELECT t.id, t.album_id, t.title, COALESCE(ar.name,''), COALESCE(t.duration_s,0)
						 FROM tracks t
						 LEFT JOIN albums al ON al.id = t.album_id
						 LEFT JOIN artists ar ON ar.id = al.artist_id
						 WHERE t.title LIKE $1 OR t.title LIKE $2 OR t.title LIKE $3
						 LIMIT 1`, "%"+title+"%", "%"+tL+"%", "%"+tU+"%").
						Scan(&realID, &albumID, &realTitle, &realArtist, &durS)
				}
			}
			if realID == "" {
				realID = id
			}
			if realTitle == "" {
				realTitle = title
			}
			if realArtist == "" {
				realArtist = artist
			}
			if albumID != "" && d.DB != nil {
				d.DB.QueryRowContext(context.Background(),
					`SELECT COALESCE(title,''), COALESCE(year,0) FROM albums WHERE id = $1`, albumID).
					Scan(&albumTitle, &albumYear)
			}
			return map[string]any{
				"_frontend_action": "play_track",
				"id":               realID,
				"title":            realTitle,
				"artist":           realArtist,
				"album_id":         albumID,
				"album_title":      albumTitle,
				"year":             albumYear,
				"duration_s":       durS,
			}, nil
		},
	}
}

func searchYouTubeTool(d ToolDeps) Tool {
	return Tool{
		Name:        "search_youtube",
		Description: "Search YouTube. Returns ≤8 videos.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"query": map[string]any{"type": "string"},
			},
			"required": []string{"query"},
		},
		Handler: func(input map[string]any) (any, error) {
			q := strInput(input, "query")
			if q == "" {
				return nil, fmt.Errorf("query required")
			}
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			cmd := exec.CommandContext(ctx, "yt-dlp",
				"--flat-playlist", "--dump-single-json",
				"ytsearch8:"+q,
			)
			out, err := cmd.Output()
			if err != nil {
				return nil, fmt.Errorf("yt-dlp: %w", err)
			}
			var pl struct {
				Entries []struct {
					ID        string   `json:"id"`
					Title     string   `json:"title"`
					Duration  *float64 `json:"duration"`
					Thumbnail string   `json:"thumbnail"`
					Uploader  string   `json:"uploader"`
				} `json:"entries"`
			}
			if err := json.Unmarshal(out, &pl); err != nil {
				return nil, fmt.Errorf("yt-dlp parse: %w", err)
			}
			results := make([]map[string]any, 0, len(pl.Entries))
			for _, e := range pl.Entries {
				dur := 0.0
				if e.Duration != nil {
					dur = *e.Duration
				}
				results = append(results, map[string]any{
					"id":        e.ID,
					"title":     e.Title,
					"duration":  dur,
					"thumbnail": e.Thumbnail,
					"uploader":  e.Uploader,
				})
			}
			return map[string]any{"results": results, "count": len(results)}, nil
		},
	}
}

func downloadYouTubeTool(d ToolDeps) Tool {
	return Tool{
		Name:        "download_youtube",
		Description: "Download YouTube audio to library (async, no immediate playback). Use play_youtube_stream to play immediately.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"id":     map[string]any{"type": "string"},
				"title":  map[string]any{"type": "string"},
				"artist": map[string]any{"type": "string"},
			},
			"required": []string{"id", "title"},
		},
		Handler: func(input map[string]any) (any, error) {
			return map[string]any{
				"_frontend_action": "download_youtube",
				"id":               strInput(input, "id"),
				"title":            strInput(input, "title"),
				"artist":           strInput(input, "artist"),
			}, nil
		},
	}
}

func playYouTubeStreamTool(d ToolDeps) Tool {
	return Tool{
		Name:        "play_youtube_stream",
		Description: "Stream and play a YouTube video immediately. Use id from search_youtube results.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"id":     map[string]any{"type": "string", "description": "YouTube video ID from search_youtube"},
				"title":  map[string]any{"type": "string"},
				"artist": map[string]any{"type": "string"},
			},
			"required": []string{"id"},
		},
		Handler: func(input map[string]any) (any, error) {
			id := strInput(input, "id")
			if id == "" {
				return nil, fmt.Errorf("id required")
			}
			return map[string]any{
				"_frontend_action": "play_track",
				"id":               "yt:" + id,
				"title":            strInput(input, "title"),
				"artist":           strInput(input, "artist"),
				"album_id":         "yt:" + id,
				"duration_s":       0,
			}, nil
		},
	}
}

func togglePlayTool(_ ToolDeps) Tool {
	return Tool{
		Name:        "toggle_play",
		Description: "Pause or resume playback. Call this when user says pause, stop, resume, or continue.",
		InputSchema: map[string]any{"type": "object", "properties": map[string]any{}},
		Handler: func(_ map[string]any) (any, error) {
			return map[string]any{"_frontend_action": "toggle_play"}, nil
		},
	}
}

func nextTrackTool(_ ToolDeps) Tool {
	return Tool{
		Name:        "next_track",
		Description: "Skip to next track in queue.",
		InputSchema: map[string]any{"type": "object", "properties": map[string]any{}},
		Handler: func(_ map[string]any) (any, error) {
			return map[string]any{"_frontend_action": "next_track"}, nil
		},
	}
}

func prevTrackTool(_ ToolDeps) Tool {
	return Tool{
		Name:        "prev_track",
		Description: "Go back to previous track.",
		InputSchema: map[string]any{"type": "object", "properties": map[string]any{}},
		Handler: func(_ map[string]any) (any, error) {
			return map[string]any{"_frontend_action": "prev_track"}, nil
		},
	}
}

func setShuffleModeTool(_ ToolDeps) Tool {
	return Tool{
		Name:        "set_shuffle_mode",
		Description: "Set shuffle/smart-radio mode. mode: off|shuffle|smart",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"mode": map[string]any{"type": "string", "enum": []string{"off", "shuffle", "smart"}},
			},
			"required": []string{"mode"},
		},
		Handler: func(input map[string]any) (any, error) {
			mode := strInput(input, "mode")
			if mode != "off" && mode != "shuffle" && mode != "smart" {
				return nil, fmt.Errorf("mode must be off|shuffle|smart")
			}
			return map[string]any{"_frontend_action": "set_shuffle_mode", "mode": mode}, nil
		},
	}
}

func setRepeatTool(_ ToolDeps) Tool {
	return Tool{
		Name:        "set_repeat",
		Description: "Set repeat mode. mode: off|one|all",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"mode": map[string]any{"type": "string", "enum": []string{"off", "one", "all"}},
			},
			"required": []string{"mode"},
		},
		Handler: func(input map[string]any) (any, error) {
			mode := strInput(input, "mode")
			if mode != "off" && mode != "one" && mode != "all" {
				return nil, fmt.Errorf("mode must be off|one|all")
			}
			return map[string]any{"_frontend_action": "set_repeat", "mode": mode}, nil
		},
	}
}

func listPlaylistsTool(d ToolDeps) Tool {
	return Tool{
		Name:        "list_playlists",
		Description: "List all playlists.",
		InputSchema: map[string]any{"type": "object", "properties": map[string]any{}},
		Handler: func(input map[string]any) (any, error) {
			rows, err := d.DB.QueryContext(context.Background(),
				`SELECT id, name FROM playlists ORDER BY name ASC`)
			if err != nil {
				return nil, err
			}
			defer rows.Close()
			type pl struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			}
			var result []pl
			for rows.Next() {
				var p pl
				if err := rows.Scan(&p.ID, &p.Name); err != nil {
					return nil, err
				}
				result = append(result, p)
			}
			if result == nil {
				result = []pl{}
			}
			return map[string]any{"playlists": result}, nil
		},
	}
}

func createPlaylistTool(d ToolDeps) Tool {
	return Tool{
		Name:        "create_playlist",
		Description: "Create a new playlist. Returns playlist id — this is NOT a track id, do NOT pass it to play_track.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"name": map[string]any{"type": "string"},
			},
			"required": []string{"name"},
		},
		Handler: func(input map[string]any) (any, error) {
			name := strings.TrimSpace(strInput(input, "name"))
			if name == "" {
				return nil, fmt.Errorf("name required")
			}
			id := randomHexID()
			_, err := d.DB.ExecContext(context.Background(),
				`INSERT INTO playlists (id, name) VALUES ($1, $2)`, id, name)
			if err != nil {
				return nil, err
			}
			return map[string]any{"id": id, "name": name}, nil
		},
	}
}

func playPlaylistTool(d ToolDeps) Tool {
	return Tool{
		Name:        "play_playlist",
		Description: "Load all tracks of a playlist into queue and play from first track.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"playlist_id": map[string]any{"type": "string"},
			},
			"required": []string{"playlist_id"},
		},
		Handler: func(input map[string]any) (any, error) {
			pid := strInput(input, "playlist_id")
			if pid == "" {
				return nil, fmt.Errorf("playlist_id required")
			}
			rows, err := d.DB.QueryContext(context.Background(),
				`SELECT t.id, t.album_id, t.title, COALESCE(ar.name,''), COALESCE(t.duration_s,0)
				 FROM playlist_tracks pt
				 JOIN tracks t ON t.id = pt.track_id
				 LEFT JOIN albums al ON al.id = t.album_id
				 LEFT JOIN artists ar ON ar.id = al.artist_id
				 WHERE pt.playlist_id = $1
				 ORDER BY pt.position ASC`, pid)
			if err != nil {
				return nil, err
			}
			defer rows.Close()
			type trackRow struct {
				ID         string `json:"id"`
				AlbumID    string `json:"album_id"`
				Title      string `json:"title"`
				ArtistName string `json:"artist_name"`
				DurS       int    `json:"duration_s"`
				TrackNum   int    `json:"track_num"`
			}
			var tracks []trackRow
			for rows.Next() {
				var tr trackRow
				if err := rows.Scan(&tr.ID, &tr.AlbumID, &tr.Title, &tr.ArtistName, &tr.DurS); err != nil {
					return nil, err
				}
				tracks = append(tracks, tr)
			}
			if len(tracks) == 0 {
				return nil, fmt.Errorf("playlist is empty — add tracks first with add_to_playlist")
			}
			return map[string]any{
				"_frontend_action": "play_queue",
				"tracks":           tracks,
			}, nil
		},
	}
}

func removeFromPlaylistTool(d ToolDeps) Tool {
	return Tool{
		Name:        "remove_from_playlist",
		Description: "Remove a track from a playlist.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"playlist_id": map[string]any{"type": "string"},
				"track_id":    map[string]any{"type": "string"},
			},
			"required": []string{"playlist_id", "track_id"},
		},
		Handler: func(input map[string]any) (any, error) {
			pid := strInput(input, "playlist_id")
			tid := strInput(input, "track_id")
			if pid == "" || tid == "" {
				return nil, fmt.Errorf("playlist_id and track_id required")
			}
			_, err := d.DB.ExecContext(context.Background(),
				`DELETE FROM playlist_tracks WHERE playlist_id=$1 AND track_id=$2`, pid, tid)
			if err != nil {
				return nil, err
			}
			return map[string]any{"ok": true}, nil
		},
	}
}

func deletePlaylistTool(d ToolDeps) Tool {
	return Tool{
		Name:        "delete_playlist",
		Description: "Delete a playlist and all its tracks.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"playlist_id": map[string]any{"type": "string"},
			},
			"required": []string{"playlist_id"},
		},
		Handler: func(input map[string]any) (any, error) {
			pid := strInput(input, "playlist_id")
			if pid == "" {
				return nil, fmt.Errorf("playlist_id required")
			}
			if _, err := d.DB.ExecContext(context.Background(), `DELETE FROM playlist_tracks WHERE playlist_id=$1`, pid); err != nil {
				return nil, err
			}
			_, err := d.DB.ExecContext(context.Background(), `DELETE FROM playlists WHERE id=$1`, pid)
			if err != nil {
				return nil, err
			}
			return map[string]any{"ok": true}, nil
		},
	}
}

func addToPlaylistTool(d ToolDeps) Tool {
	return Tool{
		Name:        "add_to_playlist",
		Description: "Add track to playlist. track_id must come from search_music or list_tracks, NOT from create_playlist.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"playlist_id": map[string]any{"type": "string"},
				"track_id":    map[string]any{"type": "string"},
			},
			"required": []string{"playlist_id", "track_id"},
		},
		Handler: func(input map[string]any) (any, error) {
			pid := strInput(input, "playlist_id")
			tid := strInput(input, "track_id")
			if pid == "" || tid == "" {
				return nil, fmt.Errorf("playlist_id and track_id required")
			}
			var pos int
			_ = d.DB.QueryRowContext(context.Background(),
				`SELECT COALESCE(MAX(position),0)+1 FROM playlist_tracks WHERE playlist_id=$1`, pid).Scan(&pos)
			_, err := d.DB.ExecContext(context.Background(),
				`INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES ($1,$2,$3) ON CONFLICT(playlist_id,track_id) DO NOTHING`,
				pid, tid, pos)
			if err != nil {
				return nil, err
			}
			return map[string]any{"ok": true}, nil
		},
	}
}

func getTrendingTool(d ToolDeps) Tool {
	return Tool{
		Name:        "get_trending",
		Description: "Get trending GitHub repos. Returns ≤15, sorted by impact.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"date": map[string]any{"type": "string"},
			},
		},
		Handler: func(input map[string]any) (any, error) {
			date := strInput(input, "date")
			if date == "" {
				row := d.DB.QueryRowContext(context.Background(),
					`SELECT date FROM trending_daily ORDER BY date DESC LIMIT 1`)
				if err := row.Scan(&date); err != nil {
					return nil, fmt.Errorf("no trending data")
				}
			}
			rows, err := d.DB.QueryContext(context.Background(), `
				SELECT r.name, r.language,
				       GREATEST(0, d.stars - COALESCE((
				         SELECT stars FROM trending_star_history WHERE repo_id=r.id ORDER BY sampled_at ASC LIMIT 1
				       ), d.stars)) AS star_delta,
				       COALESCE(d.problem_solved,''), COALESCE(d.impact_score,0)
				FROM trending_daily d
				JOIN trending_repos r ON r.id=d.repo_id
				WHERE d.date=$1
				ORDER BY d.impact_score DESC, star_delta DESC
				LIMIT 15
			`, date)
			if err != nil {
				return nil, err
			}
			defer rows.Close()
			var sb strings.Builder
			sb.WriteString("| # | Repo | ⭐ Tăng | Ngôn ngữ | Mô tả |\n")
			sb.WriteString("|---|------|---------|----------|-------|\n")
			rank := 1
			for rows.Next() {
				var name, lang, desc string
				var delta, imp int
				if err := rows.Scan(&name, &lang, &delta, &desc, &imp); err != nil {
					continue
				}
				deltaStr := fmt.Sprintf("+%s", formatDelta(delta))
				if delta > 5000 {
					deltaStr += " 🚀"
				}
				if desc == "" {
					desc = "—"
				}
				sb.WriteString(fmt.Sprintf("| %d | %s | %s | %s | %s |\n", rank, name, deltaStr, lang, desc))
				rank++
			}
			return sb.String(), nil
		},
	}
}

func scanLibraryTool(d ToolDeps) Tool {
	return Tool{
		Name:        "scan_library",
		Description: "Trigger library rescan. Returns count of tracks found.",
		InputSchema: map[string]any{"type": "object", "properties": map[string]any{}},
		Handler: func(input map[string]any) (any, error) {
			if d.ScanFunc == nil {
				return nil, fmt.Errorf("scan not configured")
			}
			n, err := d.ScanFunc()
			if err != nil {
				return nil, err
			}
			return map[string]any{"ok": true, "tracks_found": n}, nil
		},
	}
}

func getStatsTool(d ToolDeps) Tool {
	return Tool{
		Name:        "get_stats",
		Description: "Get library stats: artists, albums, tracks count.",
		InputSchema: map[string]any{"type": "object", "properties": map[string]any{}},
		Handler: func(input map[string]any) (any, error) {
			stats, err := d.Lib.GetStats(context.Background())
			if err != nil {
				return nil, err
			}
			return map[string]any{
				"artists": stats.Artists,
				"albums":  stats.Albums,
				"tracks":  stats.Tracks,
			}, nil
		},
	}
}

// ── AI Analytics Tools ───────────────────────────────────────────────────────

func getAIAnalyticsTool(d ToolDeps) Tool {
	return Tool{
		Name:        "get_ai_analytics",
		Description: "Get AI chat usage summary: total requests, failure rate, token totals, top models. Optional from/to date filter (YYYY-MM-DD).",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"from": map[string]any{"type": "string", "description": "Start date YYYY-MM-DD"},
				"to":   map[string]any{"type": "string", "description": "End date YYYY-MM-DD"},
			},
		},
		Handler: func(input map[string]any) (any, error) {
			from := strInput(input, "from")
			to   := strInput(input, "to")
			where := "WHERE 1=1"
			args  := []any{}
			n := 1
			if from != "" { where += fmt.Sprintf(" AND created_at >= $%d", n); args = append(args, from); n++ }
			if to   != "" { where += fmt.Sprintf(" AND created_at <= $%d", n); args = append(args, to+" 23:59:59"); n++ }
			_ = n

			var total, failed, tokIn, tokOut int
			var avgMs float64
			d.DB.QueryRowContext(context.Background(),
				`SELECT COUNT(*), SUM(failed), SUM(tokens_in), SUM(tokens_out), AVG(NULLIF(response_ms,0)) FROM chat_logs `+where, args...).
				Scan(&total, &failed, &tokIn, &tokOut, &avgMs)

			rows, err := d.DB.QueryContext(context.Background(),
				`SELECT COALESCE(NULLIF(model,''),'unknown'), COUNT(*) FROM chat_logs `+where+` GROUP BY model ORDER BY 2 DESC LIMIT 10`, args...)
			if err != nil {
				return nil, err
			}
			defer rows.Close()
			type mv struct{ Model string; Count int }
			var models []mv
			for rows.Next() {
				var m mv
				rows.Scan(&m.Model, &m.Count)
				models = append(models, m)
			}
			return map[string]any{
				"total": total, "failed": failed,
				"tokens_in": tokIn, "tokens_out": tokOut, "avg_ms": avgMs,
				"models": models,
			}, nil
		},
	}
}

func getAILogsTool(d ToolDeps) Tool {
	return Tool{
		Name:        "get_ai_logs",
		Description: "Get recent AI chat logs. Optional: model filter, failed_only flag, limit (default 10, max 50).",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"model":       map[string]any{"type": "string"},
				"failed_only": map[string]any{"type": "boolean"},
				"limit":       map[string]any{"type": "integer"},
			},
		},
		Handler: func(input map[string]any) (any, error) {
			model := strInput(input, "model")
			limit := 10
			if v, ok := input["limit"].(float64); ok && int(v) > 0 {
				limit = int(v)
				if limit > 50 { limit = 50 }
			}
			where := "WHERE 1=1"
			args  := []any{}
			n3 := 1
			if model != "" { where += fmt.Sprintf(" AND model LIKE $%d", n3); args = append(args, "%"+model+"%"); n3++ }
			if v, ok := input["failed_only"].(bool); ok && v { where += " AND failed=1" }
			args = append(args, limit)
			rows, err := d.DB.QueryContext(context.Background(),
				`SELECT id, created_at, model, user_msg, ai_msg, failed, fail_reason, tokens_in, tokens_out
				 FROM chat_logs `+where+fmt.Sprintf(` ORDER BY created_at DESC LIMIT $%d`, n3), args...)
			if err != nil {
				return nil, err
			}
			defer rows.Close()
			type logRow struct {
				ID         string `json:"id"`
				CreatedAt  string `json:"created_at"`
				Model      string `json:"model"`
				UserMsg    string `json:"user_msg"`
				AiMsg      string `json:"ai_msg"`
				Failed     int    `json:"failed"`
				FailReason string `json:"fail_reason"`
				TokensIn   int    `json:"tokens_in"`
				TokensOut  int    `json:"tokens_out"`
			}
			var list []logRow
			for rows.Next() {
				var r logRow
				rows.Scan(&r.ID, &r.CreatedAt, &r.Model, &r.UserMsg, &r.AiMsg, &r.Failed, &r.FailReason, &r.TokensIn, &r.TokensOut)
				if len(r.UserMsg) > 200 { r.UserMsg = r.UserMsg[:200] + "…" }
				if len(r.AiMsg)  > 200 { r.AiMsg  = r.AiMsg[:200]  + "…" }
				list = append(list, r)
			}
			if list == nil { list = []logRow{} }
			return list, nil
		},
	}
}

func getAIExtremesTool(d ToolDeps) Tool {
	return Tool{
		Name:        "get_ai_extremes",
		Description: "Get most expensive and cheapest AI requests by token count. Optional model/from/to filters.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"model": map[string]any{"type": "string"},
				"from":  map[string]any{"type": "string"},
				"to":    map[string]any{"type": "string"},
			},
		},
		Handler: func(input map[string]any) (any, error) {
			model := strInput(input, "model")
			from  := strInput(input, "from")
			to    := strInput(input, "to")
			where := "WHERE tokens_in > 0"
			args  := []any{}
			n2 := 1
			if model != "" { where += fmt.Sprintf(" AND model = $%d", n2); args = append(args, model); n2++ }
			if from  != "" { where += fmt.Sprintf(" AND created_at >= $%d", n2); args = append(args, from); n2++ }
			if to    != "" { where += fmt.Sprintf(" AND created_at <= $%d", n2); args = append(args, to+" 23:59:59"); n2++ }
			_ = n2

			type ex struct {
				ID        string `json:"id"`
				CreatedAt string `json:"created_at"`
				Model     string `json:"model"`
				TokensIn  int    `json:"tokens_in"`
				TokensOut int    `json:"tokens_out"`
				UserMsg   string `json:"user_msg"`
			}
			scan := func(order string) ex {
				var r ex
				a := append(args, []any{}...)
				d.DB.QueryRowContext(context.Background(),
					`SELECT id, created_at, COALESCE(model,''), tokens_in, tokens_out, COALESCE(user_msg,'')
					 FROM chat_logs `+where+order+` LIMIT 1`, a...).
					Scan(&r.ID, &r.CreatedAt, &r.Model, &r.TokensIn, &r.TokensOut, &r.UserMsg)
				if len(r.UserMsg) > 150 { r.UserMsg = r.UserMsg[:150] + "…" }
				return r
			}
			return map[string]any{
				"most_expensive": scan(" ORDER BY (tokens_in+tokens_out) DESC"),
				"cheapest":       scan(" AND tokens_out > 0 ORDER BY (tokens_in+tokens_out) ASC"),
			}, nil
		},
	}
}

// ── Agent State Tools (ADK-style scoped state) ────────────────────────────────
// Scopes: 'user' (default) persists across sessions, 'session' for current
// conversation, 'app' for global settings shared across all users.

func rememberTool(d ToolDeps) Tool {
	return Tool{
		Name: "remember",
		Description: "Save a fact. key=snake_case label, value=fact. " +
			"scope: 'user' (default, persists across sessions), " +
			"'session' (current conversation only), 'app' (global for all users).",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"key":   map[string]any{"type": "string"},
				"value": map[string]any{"type": "string"},
				"scope": map[string]any{
					"type":        "string",
					"enum":        []string{"user", "session", "app"},
					"description": "State scope. Default: user.",
				},
			},
			"required": []string{"key", "value"},
		},
		Handler: func(input map[string]any) (any, error) {
			key := strings.TrimSpace(strInput(input, "key"))
			value := strings.TrimSpace(strInput(input, "value"))
			if key == "" || value == "" {
				return nil, fmt.Errorf("key and value required")
			}
			scope := strInput(input, "scope")
			if scope != "session" && scope != "app" {
				scope = "user"
			}
			scopeID := "default"
			if scope == "app" {
				scopeID = "global"
			}
			now := time.Now().UTC().Add(7 * time.Hour).Format("2006-01-02 15:04:05")
			_, err := d.DB.ExecContext(context.Background(),
				`INSERT INTO agent_state (scope, scope_id, key, value, updated_at)
				 VALUES ($1, $2, $3, $4, $5)
				 ON CONFLICT (scope, scope_id, key)
				 DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
				scope, scopeID, key, value, now)
			if err != nil {
				return nil, err
			}
			return map[string]any{"ok": true, "key": key, "scope": scope}, nil
		},
	}
}

func recallTool(d ToolDeps) Tool {
	return Tool{
		Name:        "recall",
		Description: "Search persistent memory. Returns matching key-value facts across user and app scopes.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"query": map[string]any{"type": "string"},
			},
			"required": []string{"query"},
		},
		Handler: func(input map[string]any) (any, error) {
			q := strInput(input, "query")
			lk := "%" + q + "%"
			rows, err := d.DB.QueryContext(context.Background(),
				`SELECT scope, key, value FROM agent_state
				 WHERE scope IN ('user','app')
				   AND (key ILIKE $1 OR value ILIKE $1)
				 ORDER BY updated_at DESC LIMIT 10`,
				lk)
			if err != nil {
				return nil, err
			}
			defer rows.Close()
			var facts []map[string]any
			for rows.Next() {
				var scope, k, v string
				rows.Scan(&scope, &k, &v)
				facts = append(facts, map[string]any{"k": k, "v": v, "scope": scope})
			}
			if facts == nil {
				facts = []map[string]any{}
			}
			return map[string]any{"facts": facts}, nil
		},
	}
}

func forgetTool(d ToolDeps) Tool {
	return Tool{
		Name:        "forget",
		Description: "Delete a fact from state by key. Removes from user scope by default.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"key": map[string]any{"type": "string"},
				"scope": map[string]any{
					"type": "string", "enum": []string{"user", "session", "app"},
				},
			},
			"required": []string{"key"},
		},
		Handler: func(input map[string]any) (any, error) {
			key := strInput(input, "key")
			if key == "" {
				return nil, fmt.Errorf("key required")
			}
			scope := strInput(input, "scope")
			if scope != "session" && scope != "app" {
				scope = "user"
			}
			scopeID := "default"
			if scope == "app" {
				scopeID = "global"
			}
			res, err := d.DB.ExecContext(context.Background(),
				`DELETE FROM agent_state WHERE scope=$1 AND scope_id=$2 AND key=$3`,
				scope, scopeID, key)
			if err != nil {
				return nil, err
			}
			n, _ := res.RowsAffected()
			return map[string]any{"ok": true, "deleted": n}, nil
		},
	}
}

// ── Hermes Distilled Tools ───────────────────────────────────────────────────

func createCustomSkillTool(d ToolDeps) Tool {
	return Tool{
		Name:        "create_custom_skill",
		Description: "Create a new agent skill guide in llmwiki/skills/ and register it in manifest + README.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"name":        map[string]any{"type": "string", "description": "Skill name (kebab-case, e.g. clean-cache)"},
				"category":    map[string]any{"type": "string", "description": "dev-loop | wiki-loop | orchestrate | utils"},
				"description": map[string]any{"type": "string", "description": "Short explanation of purpose"},
				"steps": map[string]any{
					"type": "array",
					"items": map[string]any{"type": "string"},
					"description": "Numbered steps to execute",
				},
				"rules": map[string]any{
					"type": "array",
					"items": map[string]any{"type": "string"},
					"description": "Rules or constraints to follow",
				},
			},
			"required": []string{"name", "category", "description", "steps"},
		},
		Handler: func(input map[string]any) (any, error) {
			name := strings.TrimSpace(strInput(input, "name"))
			category := strings.TrimSpace(strInput(input, "category"))
			description := strings.TrimSpace(strInput(input, "description"))
			if name == "" || category == "" {
				return nil, fmt.Errorf("name and category are required")
			}

			// Validate category
			validCat := false
			for _, cat := range []string{"dev-loop", "wiki-loop", "orchestrate", "utils"} {
				if category == cat {
					validCat = true
					break
				}
			}
			if !validCat {
				return nil, fmt.Errorf("invalid category: must be dev-loop, wiki-loop, orchestrate, or utils")
			}

			// Parse steps
			var steps []string
			if rawSteps, ok := input["steps"].([]any); ok {
				for _, s := range rawSteps {
					if str, ok := s.(string); ok {
						steps = append(steps, str)
					}
				}
			}
			// Parse rules
			var rules []string
			if rawRules, ok := input["rules"].([]any); ok {
				for _, r := range rawRules {
					if str, ok := r.(string); ok {
						rules = append(rules, str)
					}
				}
			}

			// Construct markdown content
			var sb strings.Builder
			sb.WriteString("---\n")
			sb.WriteString(fmt.Sprintf("name: %s\n", name))
			sb.WriteString(fmt.Sprintf("description: %s\n", description))
			sb.WriteString("---\n\n")
			sb.WriteString(fmt.Sprintf("# Skill: %s\n\n", name))
			sb.WriteString("## Purpose\n")
			sb.WriteString(description + "\n\n")
			
			sb.WriteString("## Steps\n")
			for i, step := range steps {
				sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, step))
			}
			sb.WriteString("\n")

			if len(rules) > 0 {
				sb.WriteString("## Rules\n")
				for _, rule := range rules {
					sb.WriteString(fmt.Sprintf("- %s\n", rule))
				}
			}

			// Create directory if missing
			dirPath := fmt.Sprintf("llmwiki/skills/%s", category)
			if err := os.MkdirAll(dirPath, 0755); err != nil {
				return nil, fmt.Errorf("create directory failed: %w", err)
			}

			// Write markdown file
			filePath := fmt.Sprintf("%s/%s.md", dirPath, name)
			if err := os.WriteFile(filePath, []byte(sb.String()), 0644); err != nil {
				return nil, fmt.Errorf("write skill file failed: %w", err)
			}

			// 1. Update .template-manifest.json
			manifestBytes, err := os.ReadFile(".template-manifest.json")
			if err == nil {
				var manifest struct {
					Remote   string   `json:"remote"`
					Includes []string `json:"includes"`
					Excludes []string `json:"excludes"`
				}
				if err := json.Unmarshal(manifestBytes, &manifest); err == nil {
					newInclude := fmt.Sprintf("skills/%s/%s.md", category, name)
					alreadyIncluded := false
					for _, inc := range manifest.Includes {
						if inc == newInclude {
							alreadyIncluded = true
							break
						}
					}
					if !alreadyIncluded {
						manifest.Includes = append(manifest.Includes, newInclude)
						newManifestBytes, err := json.MarshalIndent(manifest, "", "  ")
						if err == nil {
							_ = os.WriteFile(".template-manifest.json", newManifestBytes, 0644)
						}
					}
				}
			}

			// 2. Update llmwiki/skills/README.md
			readmeBytes, err := os.ReadFile("llmwiki/skills/README.md")
			if err == nil {
				readmeContent := string(readmeBytes)
				lines := strings.Split(readmeContent, "\n")
				categoryHeader := "## " + category + "/"
				inserted := false
				for idx, line := range lines {
					if strings.TrimSpace(line) == categoryHeader {
						// Find the next table separator line to insert right after it
						for j := idx + 1; j < len(lines); j++ {
							if strings.Contains(lines[j], "|-------|---------|") || strings.Contains(lines[j], "|---|---|") {
								newRow := fmt.Sprintf("| `%s` | %s |", name, description)
								lines = append(lines[:j+1], append([]string{newRow}, lines[j+1:]...)...)
								inserted = true
								break
							}
						}
						if inserted {
							break
						}
					}
				}
				if inserted {
					_ = os.WriteFile("llmwiki/skills/README.md", []byte(strings.Join(lines, "\n")), 0644)
				}
			}

			return map[string]any{"ok": true, "file": filePath}, nil
		},
	}
}

func scheduleAgentTaskTool(d ToolDeps) Tool {
	return Tool{
		Name:        "schedule_agent_task",
		Description: "Schedule a recurring background prompt task for the agent using a Cron expression.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"cron_expression": map[string]any{"type": "string", "description": "Standard cron expression: minute hour day-of-month month day-of-week (e.g. '*/5 * * * *' for every 5 mins)"},
				"prompt":          map[string]any{"type": "string", "description": "Prompt for the agent to run (e.g. 'scan library')"},
			},
			"required": []string{"cron_expression", "prompt"},
		},
		Handler: func(input map[string]any) (any, error) {
			cronExpr := strings.TrimSpace(strInput(input, "cron_expression"))
			prompt := strings.TrimSpace(strInput(input, "prompt"))
			if cronExpr == "" || prompt == "" {
				return nil, fmt.Errorf("cron_expression and prompt are required")
			}

			id := randomHexID()
			nowStr := time.Now().Format("2006-01-02 15:04:05")

			_, err := d.DB.ExecContext(context.Background(),
				`INSERT INTO scheduled_tasks (id, cron_expression, prompt, last_run_at, created_at)
				 VALUES ($1, $2, $3, '', $4)`,
				id, cronExpr, prompt, nowStr)
			if err != nil {
				return nil, fmt.Errorf("failed to save task: %w", err)
			}

			// Reload cron manager
			if d.ReloadCronFunc != nil {
				if err := d.ReloadCronFunc(); err != nil {
					return nil, fmt.Errorf("task saved but failed to reload scheduler: %w", err)
				}
			}

			return map[string]any{"ok": true, "id": id, "cron_expression": cronExpr, "prompt": prompt}, nil
		},
	}
}

func getScheduledTasksTool(d ToolDeps) Tool {
	return Tool{
		Name:        "get_scheduled_tasks",
		Description: "List all scheduled background cron tasks.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{},
		},
		Handler: func(input map[string]any) (any, error) {
			rows, err := d.DB.QueryContext(context.Background(),
				`SELECT id, cron_expression, prompt, last_run_at, created_at FROM scheduled_tasks ORDER BY created_at DESC`)
			if err != nil {
				return nil, err
			}
			defer rows.Close()

			var tasks []map[string]any
			for rows.Next() {
				var id, expr, prompt, lastRun, created string
				if err := rows.Scan(&id, &expr, &prompt, &lastRun, &created); err == nil {
					tasks = append(tasks, map[string]any{
						"id":              id,
						"cron_expression": expr,
						"prompt":          prompt,
						"last_run_at":     lastRun,
						"created_at":      created,
					})
				}
			}
			if tasks == nil {
				tasks = []map[string]any{}
			}

			return map[string]any{"tasks": tasks}, nil
		},
	}
}

func deleteScheduledTaskTool(d ToolDeps) Tool {
	return Tool{
		Name:        "delete_scheduled_task",
		Description: "Delete a scheduled background cron task by its ID.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"id": map[string]any{"type": "string", "description": "The ID of the task to delete"},
			},
			"required": []string{"id"},
		},
		Handler: func(input map[string]any) (any, error) {
			id := strInput(input, "id")
			if id == "" {
				return nil, fmt.Errorf("id required")
			}

			res, err := d.DB.ExecContext(context.Background(),
				`DELETE FROM scheduled_tasks WHERE id = $1`, id)
			if err != nil {
				return nil, err
			}

			n, _ := res.RowsAffected()
			if n == 0 {
				return nil, fmt.Errorf("task not found")
			}

			// Reload cron manager
			if d.ReloadCronFunc != nil {
				_ = d.ReloadCronFunc()
			}

			return map[string]any{"ok": true, "deleted": id}, nil
		},
	}
}
