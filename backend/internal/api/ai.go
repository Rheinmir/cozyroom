package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"cozyroom/internal/mcp"
)

const aiSystemPromptBase = `Assistant cho Cozyroom music app. Dùng tools để tìm nhạc, phát bài, tải YouTube, quản lý playlist. Trả lời tiếng Việt nếu user nói tiếng Việt.
Sau khi gọi tool xong, LUÔN viết 1 câu thông báo kết quả cho user bằng tiếng Việt. Không được trả lời rỗng.
Khi get_trending trả về markdown table (bắt đầu bằng "| # |"), copy NGUYÊN VĂN bảng đó vào response — KHÔNG tóm tắt, KHÔNG đổi thành danh sách.
Khi user nói sở thích, thói quen, hoặc bạn học được điều quan trọng về user → dùng remember() để lưu ngay (scope="user" mặc định).
Khi muốn lưu thứ gì chỉ cho cuộc hội thoại hiện tại → remember() với scope="session".
Khi muốn lưu cài đặt toàn app (tất cả users) → remember() với scope="app".
Context về user đã được tự động inject vào prompt — KHÔNG cần gọi recall() trước mỗi câu trả lời.
QUAN TRỌNG về playlist:
- create_playlist trả về playlist_id — KHÔNG phải track id, KHÔNG dùng làm input cho play_track.
- Để tạo playlist và phát: (1) create_playlist → lấy playlist_id, (2) search_music → lấy track id thật, (3) add_to_playlist với track id thật, (4) play_playlist với playlist_id.
- play_track chỉ nhận track id từ search_music hoặc list_tracks.`

// aiSystemPrompt returns base prompt + memories + optional now-playing context.
func (h *AIHandlers) aiSystemPromptWith(np *nowPlayingInfo) string {
	base := h.aiSystemPrompt()
	vn := time.FixedZone("UTC+7", 7*3600)
	base += "\n\nThời gian hiện tại: " + time.Now().In(vn).Format("2006-01-02 15:04 (UTC+7, Monday)")
	if np != nil && np.ID != "" {
		base += fmt.Sprintf("\nĐang phát: \"%s\" — %s (id: %s). Dùng next_track/prev_track để chuyển bài.", np.Title, np.Artist, np.ID)
	}
	return base
}

// aiSystemPrompt returns base prompt + user memories + app-wide settings injected.
func (h *AIHandlers) aiSystemPrompt() string {
	if h.db == nil {
		return aiSystemPromptBase
	}
	// User-scoped memories (most recent 8)
	userRows, err := h.db.Query(
		`SELECT key, value FROM agent_state WHERE scope='user' AND scope_id='default' ORDER BY updated_at DESC LIMIT 8`)
	if err != nil {
		return aiSystemPromptBase
	}
	defer userRows.Close()
	var userParts []string
	for userRows.Next() {
		var k, v string
		userRows.Scan(&k, &v)
		userParts = append(userParts, k+": "+v)
	}
	// App-wide settings
	appRows, _ := h.db.Query(
		`SELECT key, value FROM agent_state WHERE scope='app' AND scope_id='global' ORDER BY updated_at DESC LIMIT 5`)
	var appParts []string
	if appRows != nil {
		defer appRows.Close()
		for appRows.Next() {
			var k, v string
			appRows.Scan(&k, &v)
			appParts = append(appParts, k+": "+v)
		}
	}
	result := aiSystemPromptBase
	if len(userParts) > 0 {
		result += "\n\nBạn nhớ về user:\n- " + strings.Join(userParts, "\n- ")
	}
	if len(appParts) > 0 {
		result += "\n\nCài đặt ứng dụng:\n- " + strings.Join(appParts, "\n- ")
	}
	return result
}

type AIHandlers struct {
	anthropicKey  string
	geminiKey     string
	openRouterKey string
	deepseekKey   string
	tools         []mcp.Tool
	db            *sql.DB
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type nowPlayingInfo struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Artist string `json:"artist"`
}

type chatRequest struct {
	Message    string          `json:"message"`
	History    []ChatMessage   `json:"history"`
	Model      string          `json:"model"`
	NowPlaying *nowPlayingInfo `json:"now_playing"`
	SessionID  string          `json:"session_id"`
}

type chatResponse struct {
	Text      string           `json:"text"`
	Actions   []map[string]any `json:"actions"`
	Model     string           `json:"model"`
	Provider  string           `json:"provider"`
	TokensIn  int              `json:"tokens_in"`
	TokensOut int              `json:"tokens_out"`
	LogID     string           `json:"log_id"`
}

type toolCall struct {
	ID    string
	Name  string
	Input map[string]any
}

// aiProvider is a single-provider interface for the agentic loop.
type aiProvider interface {
	initMessages(history []ChatMessage, userMsg string) any
	call(msgs any, tools []mcp.Tool) (text string, calls []toolCall, tokIn int, tokOut int, done bool, err error)
	appendAssistant(msgs any, text string, calls []toolCall) any
	appendToolResults(msgs any, calls []toolCall, results []string) any
	ModelID() string
	Provider() string
	SetSystemPrompt(s string)
}

// POST /api/ai/chat
func (h *AIHandlers) chat(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	var req chatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.Message == "" {
		http.Error(w, "message required", http.StatusBadRequest)
		return
	}

	provider, err := h.selectProvider(req.Model)
	if err != nil {
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	}
	provider.SetSystemPrompt(h.aiSystemPromptWith(req.NowPlaying))

	byName := make(map[string]*mcp.Tool, len(h.tools))
	for i := range h.tools {
		byName[h.tools[i].Name] = &h.tools[i]
	}

	// cap history to save input tokens
	hist := req.History
	if len(hist) > 8 {
		hist = hist[len(hist)-8:]
	}
	msgs := provider.initMessages(hist, req.Message)
	var finalText string
	var actions []map[string]any
	var toolErrors []string
	var totalIn, totalOut int

	for i := 0; i < 6; i++ {
		text, calls, tokIn, tokOut, done, err := provider.call(msgs, h.tools)
		if err != nil {
			errStr := err.Error()
			if strings.Contains(errStr, "429") {
				http.Error(w, "Model đang bị rate-limit. Thử lại sau vài giây, hoặc nhập model khác.", http.StatusTooManyRequests)
			} else {
				http.Error(w, fmt.Sprintf("AI error: %v", err), http.StatusInternalServerError)
			}
			return
		}
		totalIn += tokIn
		totalOut += tokOut
		if text != "" {
			finalText = text
		}
		if done || len(calls) == 0 {
			break
		}

		results := make([]string, len(calls))
		for j, tc := range calls {
			tool, found := byName[tc.Name]
			if !found {
				msg := tc.Name + ": tool not found"
				toolErrors = append(toolErrors, msg)
				results[j] = fmt.Sprintf(`{"error":"tool %s not found"}`, tc.Name)
				continue
			}
			result, err := tool.Handler(tc.Input)
			if err != nil {
				toolErrors = append(toolErrors, tc.Name+": "+err.Error())
				results[j] = fmt.Sprintf(`{"error":"%s"}`, err.Error())
				continue
			}
			if rm, ok := result.(map[string]any); ok {
				if action, ok := rm["_frontend_action"].(string); ok {
					actions = append(actions, map[string]any{
						"type":       action,
						"id":         rm["id"],
						"title":      rm["title"],
						"artist":     rm["artist"],
						"album_id":   rm["album_id"],
						"duration_s": rm["duration_s"],
						"mode":       rm["mode"],
						"tracks":     rm["tracks"],
					})
				}
			}
			b, _ := json.Marshal(result)
			results[j] = string(b)
		}

		msgs = provider.appendAssistant(msgs, text, calls)
		msgs = provider.appendToolResults(msgs, calls, results)
	}

	// fallback: model called tools but returned no text
	if finalText == "" {
		for _, a := range actions {
			if a["type"] == "play_track" {
				title, _ := a["title"].(string)
				artist, _ := a["artist"].(string)
				if title != "" {
					if artist != "" {
						finalText = fmt.Sprintf("Đang phát \"%s\" của %s.", title, artist)
					} else {
						finalText = fmt.Sprintf("Đang phát \"%s\".", title)
					}
				}
			}
		}
		if finalText == "" {
			finalText = "Xong rồi!"
		}
	}

	modelID := provider.ModelID()
	providerName := provider.Provider()

	logID := h.saveLog(req.Message, finalText, actions, toolErrors, modelID, providerName, req.SessionID, totalIn, totalOut, int(time.Since(start).Milliseconds()))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(chatResponse{
		Text:      finalText,
		Actions:   actions,
		Model:     modelID,
		Provider:  providerName,
		TokensIn:  totalIn,
		TokensOut: totalOut,
		LogID:     logID,
	})
}

var toolStatusVN = map[string]string{
	"search_music":     "Đang tìm kiếm nhạc...",
	"play_track":       "Đang chuẩn bị phát nhạc...",
	"list_artists":     "Đang lấy danh sách nghệ sĩ...",
	"get_artist":       "Đang xem thông tin nghệ sĩ...",
	"list_albums":      "Đang lấy danh sách album...",
	"list_tracks":      "Đang lấy danh sách bài hát...",
	"search_youtube":   "Đang tìm trên YouTube...",
	"download_youtube": "Đang tải từ YouTube...",
	"list_playlists":   "Đang lấy playlist...",
	"create_playlist":  "Đang tạo playlist...",
	"add_to_playlist":  "Đang thêm vào playlist...",
	"get_trending":     "Đang lấy xu hướng GitHub...",
	"scan_library":     "Đang quét thư viện nhạc...",
	"get_stats":        "Đang lấy thống kê...",
	"remember":         "Đang ghi nhớ...",
	"recall":           "Đang tìm trong bộ nhớ...",
	"forget":           "Đang xóa khỏi bộ nhớ...",
}

// POST /api/ai/chat/stream — Server-Sent Events version with live status updates.
func (h *AIHandlers) chatStream(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	send := func(v any) {
		b, _ := json.Marshal(v)
		fmt.Fprintf(w, "data: %s\n\n", b)
		flusher.Flush()
	}

	var req chatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		send(map[string]any{"error": "invalid request"})
		return
	}
	if req.Message == "" {
		send(map[string]any{"error": "message required"})
		return
	}

	provider, err := h.selectProvider(req.Model)
	if err != nil {
		send(map[string]any{"error": err.Error()})
		return
	}
	provider.SetSystemPrompt(h.aiSystemPromptWith(req.NowPlaying))

	// wire status callback for openrouter fallback chain
	if orP, ok := provider.(*openRouterProvider); ok {
		orP.onStatus = func(s string) { send(map[string]any{"status": s}) }
	} else {
		send(map[string]any{"status": "Đang kết nối model..."})
	}

	hist := req.History
	if len(hist) > 8 {
		hist = hist[len(hist)-8:]
	}

	byName := make(map[string]*mcp.Tool, len(h.tools))
	for i := range h.tools {
		byName[h.tools[i].Name] = &h.tools[i]
	}

	msgs := provider.initMessages(hist, req.Message)
	var finalText string
	var actions []map[string]any
	var toolErrors []string
	var totalIn, totalOut int

	for i := 0; i < 6; i++ {
		text, calls, tokIn, tokOut, done, err := provider.call(msgs, h.tools)
		if err != nil {
			if strings.Contains(err.Error(), "429") {
				send(map[string]any{"error": "Model đang bị rate-limit. Thử lại sau vài giây."})
			} else {
				send(map[string]any{"error": fmt.Sprintf("AI error: %v", err)})
			}
			return
		}
		totalIn += tokIn
		totalOut += tokOut
		if text != "" {
			finalText = text
		}
		if done || len(calls) == 0 {
			break
		}

		results := make([]string, len(calls))
		for j, tc := range calls {
			if s, ok := toolStatusVN[tc.Name]; ok {
				send(map[string]any{"status": s})
			}
			tool, found := byName[tc.Name]
			if !found {
				msg := tc.Name + ": tool not found"
				toolErrors = append(toolErrors, msg)
				send(map[string]any{"status": "⚠️ " + msg})
				results[j] = fmt.Sprintf(`{"error":"tool %s not found"}`, tc.Name)
				continue
			}
			result, err := tool.Handler(tc.Input)
			if err != nil {
				msg := tc.Name + ": " + err.Error()
				toolErrors = append(toolErrors, msg)
				send(map[string]any{"status": "⚠️ Lỗi " + tc.Name + ": " + err.Error()})
				results[j] = fmt.Sprintf(`{"error":"%s"}`, err.Error())
				continue
			}
			if rm, ok := result.(map[string]any); ok {
				if action, ok := rm["_frontend_action"].(string); ok {
					actions = append(actions, map[string]any{
						"type":       action,
						"id":         rm["id"],
						"title":      rm["title"],
						"artist":     rm["artist"],
						"album_id":   rm["album_id"],
						"duration_s": rm["duration_s"],
						"mode":       rm["mode"],
						"tracks":     rm["tracks"],
					})
				}
			}
			b, _ := json.Marshal(result)
			results[j] = string(b)
		}
		msgs = provider.appendAssistant(msgs, text, calls)
		msgs = provider.appendToolResults(msgs, calls, results)
	}

	if finalText == "" {
		for _, a := range actions {
			if a["type"] == "play_track" {
				title, _ := a["title"].(string)
				artist, _ := a["artist"].(string)
				if title != "" {
					if artist != "" {
						finalText = fmt.Sprintf("Đang phát \"%s\" của %s.", title, artist)
					} else {
						finalText = fmt.Sprintf("Đang phát \"%s\".", title)
					}
				}
			}
		}
		if finalText == "" {
			finalText = "Xong rồi!"
		}
	}

	modelID := provider.ModelID()
	providerName := provider.Provider()
	logID := h.saveLog(req.Message, finalText, actions, toolErrors, modelID, providerName, req.SessionID, totalIn, totalOut, int(time.Since(start).Milliseconds()))

	send(map[string]any{
		"text":       finalText,
		"actions":    actions,
		"model":      modelID,
		"provider":   providerName,
		"tokens_in":  totalIn,
		"tokens_out": totalOut,
		"log_id":     logID,
	})
}

// GET /api/ai/memory
func (h *AIHandlers) memoryList(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		http.Error(w, "no db", http.StatusServiceUnavailable)
		return
	}
	rows, err := h.db.QueryContext(r.Context(),
		`SELECT scope, scope_id, key, value, updated_at FROM agent_state ORDER BY updated_at DESC`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	type fact struct {
		Scope     string `json:"scope"`
		ScopeID   string `json:"scope_id"`
		Key       string `json:"key"`
		Value     string `json:"value"`
		UpdatedAt string `json:"updated_at"`
	}
	var facts []fact
	for rows.Next() {
		var f fact
		rows.Scan(&f.Scope, &f.ScopeID, &f.Key, &f.Value, &f.UpdatedAt)
		facts = append(facts, f)
	}
	if facts == nil {
		facts = []fact{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"facts": facts})
}

// PUT /api/ai/memory — bulk import (replaces all user-scoped state)
func (h *AIHandlers) memoryImport(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		http.Error(w, "no db", http.StatusServiceUnavailable)
		return
	}
	var body struct {
		Facts []struct {
			Key   string `json:"key"`
			Value string `json:"value"`
		} `json:"facts"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	tx, err := h.db.Begin()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()
	tx.Exec(`DELETE FROM agent_state WHERE scope='user' AND scope_id='default'`)
	now := time.Now().UTC().Add(7 * time.Hour).Format("2006-01-02 15:04:05")
	for _, f := range body.Facts {
		if strings.TrimSpace(f.Key) == "" {
			continue
		}
		tx.Exec(`INSERT INTO agent_state (scope, scope_id, key, value, updated_at) VALUES ($1, $2, $3, $4, $5)`,
			"user", "default", strings.TrimSpace(f.Key), f.Value, now)
	}
	if err := tx.Commit(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"ok": true, "imported": len(body.Facts)})
}

// DELETE /api/ai/memory/{key}
func (h *AIHandlers) memoryDelete(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		http.Error(w, "no db", http.StatusServiceUnavailable)
		return
	}
	key := r.PathValue("key")
	if key == "" {
		http.Error(w, "key required", http.StatusBadRequest)
		return
	}
	// Delete from user scope (default); frontend only manages user-scoped state
	h.db.ExecContext(r.Context(),
		`DELETE FROM agent_state WHERE scope='user' AND scope_id='default' AND key=$1`, key)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"ok": true})
}

// GET /api/ai/logs?failed=1&limit=50&offset=0
func (h *AIHandlers) logs(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		http.Error(w, "no db", http.StatusServiceUnavailable)
		return
	}
	failedOnly := r.URL.Query().Get("failed") == "1"
	limit := 50
	offset := 0
	if v, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && v > 0 {
		limit = v
	}
	if v, err := strconv.Atoi(r.URL.Query().Get("offset")); err == nil && v >= 0 {
		offset = v
	}

	base := `SELECT id, created_at, model, provider, user_msg, ai_msg, actions, failed, fail_reason, tokens_in, tokens_out, COALESCE(tool_errors,'[]') FROM chat_logs`
	var rows *sql.Rows
	var err error
	if failedOnly {
		rows, err = h.db.QueryContext(r.Context(), base+` WHERE failed=1 ORDER BY created_at DESC LIMIT $1 OFFSET $2`, limit, offset)
	} else {
		rows, err = h.db.QueryContext(r.Context(), base+` ORDER BY created_at DESC LIMIT $1 OFFSET $2`, limit, offset)
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type logEntry struct {
		ID         string `json:"id"`
		CreatedAt  string `json:"created_at"`
		Model      string `json:"model"`
		Provider   string `json:"provider"`
		UserMsg    string `json:"user_msg"`
		AiMsg      string `json:"ai_msg"`
		Actions    string `json:"actions"`
		Failed     int    `json:"failed"`
		FailReason string `json:"fail_reason"`
		TokensIn   int    `json:"tokens_in"`
		TokensOut  int    `json:"tokens_out"`
		ToolErrors string `json:"tool_errors"`
	}
	var entries []logEntry
	for rows.Next() {
		var e logEntry
		rows.Scan(&e.ID, &e.CreatedAt, &e.Model, &e.Provider, &e.UserMsg, &e.AiMsg, &e.Actions, &e.Failed, &e.FailReason, &e.TokensIn, &e.TokensOut, &e.ToolErrors)
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []logEntry{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"logs": entries, "count": len(entries)})
}

// GET /api/ai/stats — aggregated analytics for charts.
func (h *AIHandlers) stats(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		http.Error(w, "no db", http.StatusServiceUnavailable)
		return
	}

	type dayStat struct {
		Date      string  `json:"date"`
		Count     int     `json:"count"`
		Failed    int     `json:"failed"`
		TokensIn  int     `json:"tokens_in"`
		TokensOut int     `json:"tokens_out"`
		AvgMs     float64 `json:"avg_ms"`
	}
	type kv struct {
		Name  string `json:"name"`
		Count int    `json:"count"`
	}
	type hourStat struct {
		Hour  int `json:"hour"`
		Count int `json:"count"`
	}
	type summary struct {
		Total     int     `json:"total"`
		Failed    int     `json:"failed"`
		TokensIn  int     `json:"tokens_in"`
		TokensOut int     `json:"tokens_out"`
		AvgMs     float64 `json:"avg_ms"`
	}

	// daily stats last 30 days
	var daily []dayStat
	rows, err := h.db.QueryContext(r.Context(),
		`SELECT substr(created_at,1,10) d, COUNT(*) c, SUM(failed), SUM(tokens_in), SUM(tokens_out), AVG(NULLIF(response_ms,0))
		 FROM chat_logs WHERE created_at >= date('now','-30 days') GROUP BY d ORDER BY d`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var s dayStat
			var avgMs sql.NullFloat64
			rows.Scan(&s.Date, &s.Count, &s.Failed, &s.TokensIn, &s.TokensOut, &avgMs)
			if avgMs.Valid {
				s.AvgMs = avgMs.Float64
			}
			daily = append(daily, s)
		}
	}
	if daily == nil {
		daily = []dayStat{}
	}

	// model distribution
	var models []kv
	rows2, err := h.db.QueryContext(r.Context(),
		`SELECT CASE WHEN model='' THEN 'unknown' ELSE model END, COUNT(*) FROM chat_logs GROUP BY model ORDER BY 2 DESC LIMIT 10`)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var k kv
			rows2.Scan(&k.Name, &k.Count)
			models = append(models, k)
		}
	}
	if models == nil {
		models = []kv{}
	}

	// provider distribution
	var providers []kv
	rows3, err := h.db.QueryContext(r.Context(),
		`SELECT CASE WHEN provider='' THEN 'unknown' ELSE provider END, COUNT(*) FROM chat_logs GROUP BY provider ORDER BY 2 DESC`)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var k kv
			rows3.Scan(&k.Name, &k.Count)
			providers = append(providers, k)
		}
	}
	if providers == nil {
		providers = []kv{}
	}

	// failure reasons
	var failures []kv
	rows4, err := h.db.QueryContext(r.Context(),
		`SELECT CASE WHEN fail_reason='' THEN 'success' ELSE fail_reason END, COUNT(*) FROM chat_logs GROUP BY fail_reason ORDER BY 2 DESC LIMIT 10`)
	if err == nil {
		defer rows4.Close()
		for rows4.Next() {
			var k kv
			rows4.Scan(&k.Name, &k.Count)
			failures = append(failures, k)
		}
	}
	if failures == nil {
		failures = []kv{}
	}

	// hourly distribution
	hourly := make([]hourStat, 24)
	for i := range hourly {
		hourly[i].Hour = i
	}
	rows5, err := h.db.QueryContext(r.Context(),
		`SELECT CAST(substr(created_at,12,2) AS INTEGER) h, COUNT(*) FROM chat_logs GROUP BY h`)
	if err == nil {
		defer rows5.Close()
		for rows5.Next() {
			var h2, cnt int
			rows5.Scan(&h2, &cnt)
			if h2 >= 0 && h2 < 24 {
				hourly[h2].Count = cnt
			}
		}
	}

	// action type distribution — parse from recent 500 logs in Go
	actionCounts := map[string]int{}
	rows6, err := h.db.QueryContext(r.Context(), `SELECT actions FROM chat_logs WHERE actions != 'null' AND actions != '[]' ORDER BY created_at DESC LIMIT 500`)
	if err == nil {
		defer rows6.Close()
		for rows6.Next() {
			var actJSON string
			rows6.Scan(&actJSON)
			var acts []map[string]any
			if json.Unmarshal([]byte(actJSON), &acts) == nil {
				for _, a := range acts {
					if t, ok := a["type"].(string); ok && t != "" {
						actionCounts[t]++
					}
				}
			}
		}
	}
	var actions []kv
	for t, cnt := range actionCounts {
		actions = append(actions, kv{t, cnt})
	}
	// sort desc
	for i := 0; i < len(actions); i++ {
		for j := i + 1; j < len(actions); j++ {
			if actions[j].Count > actions[i].Count {
				actions[i], actions[j] = actions[j], actions[i]
			}
		}
	}
	if actions == nil {
		actions = []kv{}
	}

	// summary
	var sum summary
	h.db.QueryRowContext(r.Context(),
		`SELECT COUNT(*), SUM(failed), SUM(tokens_in), SUM(tokens_out), AVG(NULLIF(response_ms,0)) FROM chat_logs`).
		Scan(&sum.Total, &sum.Failed, &sum.TokensIn, &sum.TokensOut, &sum.AvgMs)

	// all distinct models (no limit) — for pricing table
	var allModels []kv
	rows7, err7 := h.db.QueryContext(r.Context(),
		`SELECT CASE WHEN model='' THEN 'unknown' ELSE model END, COUNT(*) FROM chat_logs GROUP BY model ORDER BY 2 DESC`)
	if err7 == nil {
		defer rows7.Close()
		for rows7.Next() {
			var k kv
			rows7.Scan(&k.Name, &k.Count)
			allModels = append(allModels, k)
		}
	}
	if allModels == nil {
		allModels = []kv{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"daily":      daily,
		"models":     models,
		"all_models": allModels,
		"providers":  providers,
		"failures":   failures,
		"hourly":     hourly,
		"actions":    actions,
		"summary":    sum,
	})
}

// GET /api/ai/extremes?model=&from=YYYY-MM-DD&to=YYYY-MM-DD
func (h *AIHandlers) extremes(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		http.Error(w, "no db", http.StatusServiceUnavailable)
		return
	}
	type extremeLog struct {
		ID         string `json:"id"`
		CreatedAt  string `json:"created_at"`
		Model      string `json:"model"`
		TokensIn   int    `json:"tokens_in"`
		TokensOut  int    `json:"tokens_out"`
		ResponseMs int    `json:"response_ms"`
		UserMsg    string `json:"user_msg"`
		AiMsg      string `json:"ai_msg"`
	}

	q := r.URL.Query()
	modelF := q.Get("model")
	fromF  := q.Get("from")
	toF    := q.Get("to")

	where := "WHERE tokens_in > 0"
	args  := []any{}
	n := 1
	if modelF != "" { where += fmt.Sprintf(" AND model = $%d", n); args = append(args, modelF); n++ }
	if fromF  != "" { where += fmt.Sprintf(" AND created_at >= $%d", n); args = append(args, fromF); n++ }
	if toF    != "" { where += fmt.Sprintf(" AND created_at <= $%d", n); args = append(args, toF+" 23:59:59"); n++ }
	_ = n

	scanLog := func(log *extremeLog, extra string, extraArgs ...any) {
		a := append(args, extraArgs...)
		h.db.QueryRowContext(r.Context(),
			`SELECT id, created_at, COALESCE(model,''), tokens_in, tokens_out, COALESCE(response_ms,0), COALESCE(user_msg,''), COALESCE(ai_msg,'')
			 FROM chat_logs `+where+extra+` LIMIT 1`, a...).
			Scan(&log.ID, &log.CreatedAt, &log.Model, &log.TokensIn, &log.TokensOut, &log.ResponseMs, &log.UserMsg, &log.AiMsg)
	}

	var mostExpensive, cheapest extremeLog
	scanLog(&mostExpensive, " ORDER BY (tokens_in+tokens_out) DESC")
	scanLog(&cheapest, " AND tokens_out > 0 ORDER BY (tokens_in+tokens_out) ASC")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"most_expensive": mostExpensive,
		"cheapest":       cheapest,
	})
}

// POST /api/ai/ocr-pricing — vision model extracts model prices from a screenshot.
func (h *AIHandlers) ocrPricing(w http.ResponseWriter, r *http.Request) {
	if h.openRouterKey == "" {
		http.Error(w, "no OpenRouter key", http.StatusServiceUnavailable)
		return
	}
	var req struct {
		ImageB64 string `json:"image_b64"`
		Mime     string `json:"mime"`
		Prompt   string `json:"prompt"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ImageB64 == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	mime := req.Mime
	if mime == "" {
		mime = "image/png"
	}
	prompt := req.Prompt
	if prompt == "" {
		prompt = `Extract model pricing from this image. Return ONLY a JSON array (no markdown, no explanation): [{"model":"<exact model id>","input_per_1m":<number>,"output_per_1m":<number>}]. Prices in USD per 1 million tokens. Only include rows you can clearly read.`
	}
	dataURL := "data:" + mime + ";base64," + req.ImageB64
	bodyMap := map[string]any{
		"model": "google/gemini-2.0-flash-001",
		"messages": []map[string]any{{
			"role": "user",
			"content": []map[string]any{
				{"type": "image_url", "image_url": map[string]string{"url": dataURL}},
				{"type": "text", "text": prompt},
			},
		}},
	}
	ocrBody, _ := json.Marshal(bodyMap)
	req2, err := http.NewRequestWithContext(r.Context(), http.MethodPost, "https://openrouter.ai/api/v1/chat/completions", strings.NewReader(string(ocrBody)))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	req2.Header.Set("Authorization", "Bearer "+h.openRouterKey)
	req2.Header.Set("content-type", "application/json")
	req2.Header.Set("HTTP-Referer", "https://cozyroom.app")
	resp, err := aiHTTPClient.Do(req2)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		http.Error(w, fmt.Sprintf("openrouter %d: %s", resp.StatusCode, raw), http.StatusBadGateway)
		return
	}
	var parsed struct {
		Choices []struct {
			Message struct{ Content string `json:"content"` } `json:"message"`
		} `json:"choices"`
	}
	json.Unmarshal(raw, &parsed)
	content := ""
	if len(parsed.Choices) > 0 {
		content = parsed.Choices[0].Message.Content
	}
	// strip markdown code fences if present
	content = strings.TrimSpace(content)
	if idx := strings.Index(content, "["); idx >= 0 {
		content = content[idx:]
	}
	if idx := strings.LastIndex(content, "]"); idx >= 0 {
		content = content[:idx+1]
	}
	var prices []map[string]any
	if err := json.Unmarshal([]byte(content), &prices); err != nil {
		prices = []map[string]any{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"prices": prices})
}

// GET /api/ai/model-prices
func (h *AIHandlers) modelPricesList(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		http.Error(w, "no db", http.StatusServiceUnavailable)
		return
	}
	type priceRow struct {
		Model    string  `json:"model"`
		PriceIn  float64 `json:"price_in"`
		PriceOut float64 `json:"price_out"`
	}
	rows, err := h.db.QueryContext(r.Context(), `SELECT model, price_in, price_out FROM ai_model_prices ORDER BY model`)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]priceRow{})
		return
	}
	defer rows.Close()
	list := []priceRow{}
	for rows.Next() {
		var p priceRow
		rows.Scan(&p.Model, &p.PriceIn, &p.PriceOut)
		list = append(list, p)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

// PUT /api/ai/model-prices — upsert all
func (h *AIHandlers) modelPricesUpsert(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		http.Error(w, "no db", http.StatusServiceUnavailable)
		return
	}
	var prices []struct {
		Model    string  `json:"model"`
		PriceIn  float64 `json:"price_in"`
		PriceOut float64 `json:"price_out"`
	}
	if err := json.NewDecoder(r.Body).Decode(&prices); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	now := time.Now().UTC().Add(7 * time.Hour).Format("2006-01-02 15:04:05")
	for _, p := range prices {
		if p.Model == "" {
			continue
		}
		h.db.ExecContext(r.Context(),
			`INSERT INTO ai_model_prices(model, price_in, price_out, updated_at) VALUES($1,$2,$3,$4)
			 ON CONFLICT(model) DO UPDATE SET price_in=excluded.price_in, price_out=excluded.price_out, updated_at=excluded.updated_at`,
			p.Model, p.PriceIn, p.PriceOut, now)
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/ai/stats/daily?from=&to=
func (h *AIHandlers) statsDaily(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		http.Error(w, "no db", http.StatusServiceUnavailable)
		return
	}
	q := r.URL.Query()
	from := q.Get("from")
	to   := q.Get("to")
	where := "WHERE 1=1"
	args  := []any{}
	n2 := 1
	if from != "" { where += fmt.Sprintf(" AND created_at >= $%d", n2); args = append(args, from); n2++ }
	if to   != "" { where += fmt.Sprintf(" AND created_at <= $%d", n2); args = append(args, to+" 23:59:59"); n2++ }
	_ = n2
	rows, err := h.db.QueryContext(r.Context(),
		`SELECT substr(created_at,1,10) d, COALESCE(NULLIF(model,''),'unknown'), SUM(tokens_in), SUM(tokens_out)
		 FROM chat_logs `+where+` GROUP BY d, model ORDER BY d`, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	type row struct {
		Date      string `json:"date"`
		Model     string `json:"model"`
		TokensIn  int    `json:"tokens_in"`
		TokensOut int    `json:"tokens_out"`
	}
	list := []row{}
	for rows.Next() {
		var r row
		rows.Scan(&r.Date, &r.Model, &r.TokensIn, &r.TokensOut)
		list = append(list, r)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

// saveLog persists a chat turn to chat_logs in UTC+7 and returns the log ID.
func (h *AIHandlers) saveLog(userMsg, aiMsg string, actions []map[string]any, toolErrors []string, model, provider, sessionID string, tokIn, tokOut, responseMs int) string {
	if h.db == nil {
		return ""
	}
	failed, failReason := detectFailure(aiMsg, actions, toolErrors)
	actionsJSON, _ := json.Marshal(actions)
	if toolErrors == nil {
		toolErrors = []string{}
	}
	toolErrorsJSON, _ := json.Marshal(toolErrors)
	now := time.Now().UTC().Add(7 * time.Hour)
	id := fmt.Sprintf("%d", now.UnixNano())
	createdAt := now.Format("2006-01-02 15:04:05")
	h.db.Exec(
		`INSERT INTO chat_logs (id, created_at, model, provider, user_msg, ai_msg, actions, failed, fail_reason, tokens_in, tokens_out, tool_errors, response_ms, session_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
		id, createdAt, model, provider, userMsg, aiMsg, string(actionsJSON), btoi(failed), failReason, tokIn, tokOut, string(toolErrorsJSON), responseMs, sessionID,
	)
	return id
}

// GET /api/ai/sessions — list sessions (grouped), most recent first.
func (h *AIHandlers) sessions(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		http.Error(w, "no db", http.StatusServiceUnavailable)
		return
	}
	rows, err := h.db.QueryContext(r.Context(), `
		SELECT session_id,
		       MIN(user_msg) AS preview,
		       MAX(created_at) AS last_at,
		       COUNT(*) AS turns
		FROM chat_logs
		WHERE session_id != ''
		GROUP BY session_id
		ORDER BY last_at DESC
		LIMIT 50`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	type sessionRow struct {
		SessionID string `json:"session_id"`
		Preview   string `json:"preview"`
		LastAt    string `json:"last_at"`
		Turns     int    `json:"turns"`
	}
	var list []sessionRow
	for rows.Next() {
		var s sessionRow
		rows.Scan(&s.SessionID, &s.Preview, &s.LastAt, &s.Turns)
		list = append(list, s)
	}
	if list == nil {
		list = []sessionRow{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"sessions": list})
}

// GET /api/ai/sessions/{id}/messages — all turns of a session in order.
func (h *AIHandlers) sessionMessages(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		http.Error(w, "no db", http.StatusServiceUnavailable)
		return
	}
	sid := r.PathValue("id")
	if sid == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	rows, err := h.db.QueryContext(r.Context(), `
		SELECT id, created_at, model, provider, user_msg, ai_msg, actions,
		       tokens_in, tokens_out
		FROM chat_logs WHERE session_id = $1 ORDER BY created_at ASC`, sid)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	type msgRow struct {
		ID        string `json:"id"`
		CreatedAt string `json:"created_at"`
		Model     string `json:"model"`
		Provider  string `json:"provider"`
		UserMsg   string `json:"user_msg"`
		AiMsg     string `json:"ai_msg"`
		Actions   string `json:"actions"`
		TokensIn  int    `json:"tokens_in"`
		TokensOut int    `json:"tokens_out"`
	}
	var msgs []msgRow
	for rows.Next() {
		var m msgRow
		rows.Scan(&m.ID, &m.CreatedAt, &m.Model, &m.Provider, &m.UserMsg, &m.AiMsg, &m.Actions, &m.TokensIn, &m.TokensOut)
		msgs = append(msgs, m)
	}
	if msgs == nil {
		msgs = []msgRow{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"messages": msgs})
}

// POST /api/ai/logs/{id}/dislike — user marks a response as wrong.
func (h *AIHandlers) dislike(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		http.Error(w, "no db", http.StatusServiceUnavailable)
		return
	}
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	_, err := h.db.ExecContext(r.Context(),
		`UPDATE chat_logs SET failed=1, fail_reason='user_dislike' WHERE id=$1`, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"ok": true})
}

// detectFailure returns true when AI couldn't fulfill the request.
func detectFailure(aiMsg string, actions []map[string]any, toolErrors []string) (bool, string) {
	if len(toolErrors) > 0 {
		return true, "tool_error"
	}
	if len(actions) > 0 {
		return false, ""
	}
	lower := strings.ToLower(aiMsg)
	checks := []struct{ pat, reason string }{
		{"không tìm thấy", "not_found"},
		{"không thể", "cannot"},
		{"không tìm được", "not_found"},
		{"không có bài", "no_track"},
		{"không có thông tin", "no_info"},
		{"xin lỗi", "apology"},
		{"rất tiếc", "apology"},
		{"not found", "not_found"},
		{"unable to", "cannot"},
		{"can't find", "not_found"},
		{"cannot find", "not_found"},
		{"no results", "no_results"},
		{"no tracks", "no_track"},
	}
	for _, c := range checks {
		if strings.Contains(lower, c.pat) {
			return true, c.reason
		}
	}
	return false, ""
}

func btoi(b bool) int {
	if b {
		return 1
	}
	return 0
}

// selectProvider picks a provider based on model name prefix and available API keys.
func (h *AIHandlers) selectProvider(model string) (aiProvider, error) {
	log.Printf("[AI] selectProvider: model=%q deepseekKey=%v openRouterKey=%v geminiKey=%v anthropicKey=%v",
		model, h.deepseekKey != "", h.openRouterKey != "", h.geminiKey != "", h.anthropicKey != "")
	if model == "" {
		switch {
		case h.deepseekKey != "":
			ds := &deepseekProvider{key: h.deepseekKey, model: "deepseek-v4-flash", disableThinking: true}
			if h.openRouterKey != "" {
				ds.fallback = &openRouterProvider{key: h.openRouterKey, model: "deepseek/deepseek-v4-flash:free"}
			}
			return ds, nil
		case h.anthropicKey != "":
			return &anthropicProvider{key: h.anthropicKey, model: "claude-haiku-4-5-20251001"}, nil
		case h.geminiKey != "":
			return &geminiProvider{key: h.geminiKey, model: "gemini-2.0-flash"}, nil
		case h.openRouterKey != "":
			return &openRouterProvider{key: h.openRouterKey, model: "deepseek/deepseek-v4-flash:free"}, nil
		default:
			return nil, fmt.Errorf("no AI API key configured")
		}
	}

	switch {
	case strings.HasPrefix(model, "deepseek-"):
		if h.deepseekKey == "" {
			return nil, fmt.Errorf("DEEPSEEK_API_KEY not set")
		}
		ds := &deepseekProvider{key: h.deepseekKey, model: model, disableThinking: true}
		if h.openRouterKey != "" {
			ds.fallback = &openRouterProvider{key: h.openRouterKey, model: "deepseek/deepseek-v4-flash:free"}
		}
		return ds, nil
	case strings.HasPrefix(model, "claude-"):
		if h.anthropicKey == "" {
			return nil, fmt.Errorf("ANTHROPIC_API_KEY not set")
		}
		return &anthropicProvider{key: h.anthropicKey, model: model}, nil
	case strings.HasPrefix(model, "gemini-"):
		if h.geminiKey == "" {
			return nil, fmt.Errorf("GEMINI_API_KEY not set")
		}
		return &geminiProvider{key: h.geminiKey, model: model}, nil
	default:
		if h.openRouterKey == "" {
			return nil, fmt.Errorf("OPENROUTER_API_KEY not set for model %q", model)
		}
		return &openRouterProvider{key: h.openRouterKey, model: model}, nil
	}
}

// ExecutePrompt executes a chat prompt programmatically, bypassing HTTP, for Cron or Telegram.
func (h *AIHandlers) ExecutePrompt(sessionID, message string, history []ChatMessage, model string) (string, []map[string]any, error) {
	start := time.Now()
	provider, err := h.selectProvider(model)
	if err != nil {
		return "", nil, err
	}
	provider.SetSystemPrompt(h.aiSystemPrompt())

	byName := make(map[string]*mcp.Tool, len(h.tools))
	for i := range h.tools {
		byName[h.tools[i].Name] = &h.tools[i]
	}

	hist := history
	if len(hist) > 8 {
		hist = hist[len(hist)-8:]
	}
	msgs := provider.initMessages(hist, message)
	var finalText string
	var actions []map[string]any
	var toolErrors []string
	var totalIn, totalOut int

	for i := 0; i < 6; i++ {
		text, calls, tokIn, tokOut, done, err := provider.call(msgs, h.tools)
		if err != nil {
			return "", nil, err
		}
		totalIn += tokIn
		totalOut += tokOut
		if text != "" {
			finalText = text
		}
		if done || len(calls) == 0 {
			break
		}

		results := make([]string, len(calls))
		for j, tc := range calls {
			tool, found := byName[tc.Name]
			if !found {
				msg := tc.Name + ": tool not found"
				toolErrors = append(toolErrors, msg)
				results[j] = fmt.Sprintf(`{"error":"tool %s not found"}`, tc.Name)
				continue
			}
			result, err := tool.Handler(tc.Input)
			if err != nil {
				toolErrors = append(toolErrors, tc.Name+": "+err.Error())
				results[j] = fmt.Sprintf(`{"error":"%s"}`, err.Error())
				continue
			}
			if rm, ok := result.(map[string]any); ok {
				if action, ok := rm["_frontend_action"].(string); ok {
					actions = append(actions, map[string]any{
						"type":       action,
						"id":         rm["id"],
						"title":      rm["title"],
						"artist":     rm["artist"],
						"album_id":   rm["album_id"],
						"duration_s": rm["duration_s"],
						"mode":       rm["mode"],
						"tracks":     rm["tracks"],
					})
				}
			}
			b, _ := json.Marshal(result)
			results[j] = string(b)
		}

		msgs = provider.appendAssistant(msgs, text, calls)
		msgs = provider.appendToolResults(msgs, calls, results)
	}

	if finalText == "" {
		for _, a := range actions {
			if a["type"] == "play_track" {
				title, _ := a["title"].(string)
				artist, _ := a["artist"].(string)
				if title != "" {
					if artist != "" {
						finalText = fmt.Sprintf("Đang phát \"%s\" của %s.", title, artist)
					} else {
						finalText = fmt.Sprintf("Đang phát \"%s\".", title)
					}
				}
			}
		}
		if finalText == "" {
			finalText = "Xong rồi!"
		}
	}

	modelID := provider.ModelID()
	providerName := provider.Provider()

	h.saveLog(message, finalText, actions, toolErrors, modelID, providerName, sessionID, totalIn, totalOut, int(time.Since(start).Milliseconds()))

	return finalText, actions, nil
}
