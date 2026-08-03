package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// GET /api/ai/music-insight — a short AI-written blurb about listening habits,
// generated from the top-played tracks. Cached per day in the settings table
// so repeat page visits don't re-call Claude. Degrades silently to an empty
// insight (never an error) if there's no Anthropic key, no play data yet, or
// the call fails — this is a narrative flourish on top of the real chart
// data, never something the page depends on.
func (h *AIHandlers) musicInsight(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	today := time.Now().UTC().Add(7 * time.Hour).Format("2006-01-02")

	var cacheRaw string
	if h.db.QueryRowContext(r.Context(),
		`SELECT value FROM settings WHERE key = 'music_insight_cache'`).Scan(&cacheRaw) == nil {
		var cached struct{ Date, Text string }
		if json.Unmarshal([]byte(cacheRaw), &cached) == nil && cached.Date == today && cached.Text != "" {
			json.NewEncoder(w).Encode(map[string]string{"insight": cached.Text})
			return
		}
	}

	if h.anthropicKey == "" {
		json.NewEncoder(w).Encode(map[string]string{"insight": ""})
		return
	}

	type topTrack struct {
		Title, Artist string
		Plays         int
	}
	var top []topTrack
	rows, err := h.db.QueryContext(r.Context(), `
		SELECT t.title, ar.name, t.lastfm_backfill_count + COUNT(tp.id) AS total_plays
		FROM tracks t
		JOIN albums al ON al.id = t.album_id
		JOIN artists ar ON ar.id = al.artist_id
		LEFT JOIN track_plays tp ON tp.track_id = t.id
		GROUP BY t.id, ar.name
		HAVING t.lastfm_backfill_count + COUNT(tp.id) > 0
		ORDER BY total_plays DESC LIMIT 5`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var tt topTrack
			if rows.Scan(&tt.Title, &tt.Artist, &tt.Plays) == nil {
				top = append(top, tt)
			}
		}
	}
	if len(top) == 0 {
		json.NewEncoder(w).Encode(map[string]string{"insight": ""})
		return
	}

	lines := make([]string, len(top))
	for i, tt := range top {
		lines[i] = fmt.Sprintf("%s - %s: %d lượt nghe", tt.Title, tt.Artist, tt.Plays)
	}
	prompt := "Top 5 bài hát nghe nhiều nhất của user trong app nghe nhạc cá nhân:\n" +
		strings.Join(lines, "\n") +
		"\n\nViết đúng 1-2 câu tiếng Việt ngắn gọn, giọng thân thiện, nhận xét thú vị về gu nghe nhạc này. " +
		"Không dùng markdown, không liệt kê lại danh sách, không mở đầu bằng \"Dựa trên\"."

	text, err := callClaudeText(h.anthropicKey, "claude-haiku-4-5-20251001", prompt)
	if err != nil || strings.TrimSpace(text) == "" {
		json.NewEncoder(w).Encode(map[string]string{"insight": ""})
		return
	}
	text = strings.TrimSpace(text)

	cacheJSON, _ := json.Marshal(map[string]string{"date": today, "text": text})
	h.db.ExecContext(r.Context(),
		`INSERT INTO settings (key, value) VALUES ('music_insight_cache', $1)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`, string(cacheJSON))

	json.NewEncoder(w).Encode(map[string]string{"insight": text})
}

// callClaudeText makes a minimal, non-agentic single-turn completion call —
// no tools, no history. Reuses aiHTTPClient (declared in ai_providers.go).
func callClaudeText(apiKey, model, prompt string) (string, error) {
	body := map[string]any{
		"model":      model,
		"max_tokens": 200,
		"messages":   []map[string]any{{"role": "user", "content": prompt}},
	}
	b, _ := json.Marshal(body)
	req, err := http.NewRequest(http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(b))
	if err != nil {
		return "", err
	}
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("content-type", "application/json")

	resp, err := aiHTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("anthropic %d: %s", resp.StatusCode, raw)
	}

	var parsed struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	for _, block := range parsed.Content {
		if block.Type == "text" {
			return block.Text, nil
		}
	}
	return "", nil
}
