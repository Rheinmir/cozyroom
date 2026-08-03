package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// GET /api/ai/music-insight — a short AI-written blurb about listening habits,
// generated from the top-played tracks. Reuses whichever AI provider is
// already configured for the chat assistant (selectProvider's priority:
// DeepSeek > Anthropic > Gemini > OpenRouter) — no separate API key needed.
// Cached per day in the settings table so repeat page visits don't re-call
// the model. Degrades silently to an empty insight (never an error) if no
// provider is configured, there's no play data yet, or the call fails — this
// is a narrative flourish on top of the real chart data, never something the
// page depends on.
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

	provider, err := h.selectProvider("")
	if err != nil {
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

	provider.SetSystemPrompt("")
	msgs := provider.initMessages(nil, prompt)
	text, _, _, _, _, err := provider.call(msgs, nil)
	text = strings.TrimSpace(text)
	if err != nil || text == "" {
		json.NewEncoder(w).Encode(map[string]string{"insight": ""})
		return
	}

	cacheJSON, _ := json.Marshal(map[string]string{"date": today, "text": text})
	h.db.ExecContext(r.Context(),
		`INSERT INTO settings (key, value) VALUES ('music_insight_cache', $1)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`, string(cacheJSON))

	json.NewEncoder(w).Encode(map[string]string{"insight": text})
}
