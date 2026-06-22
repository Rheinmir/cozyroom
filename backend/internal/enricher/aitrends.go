package enricher

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

type aiRequest struct {
	Model    string      `json:"model"`
	Messages []aiMessage `json:"messages"`
}
type aiMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}
type aiResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

type aiSlot struct {
	baseURL string
	apiKey  string
	model   string
}

// buildSlots returns the ordered list of (provider, model) to try.
// Each Gemini key gets all 3 models; keys are interleaved before OpenRouter fallback.
func buildSlots(geminiKeys []string, openRouterKey string) []aiSlot {
	var slots []aiSlot
	for _, key := range geminiKeys {
		if key == "" {
			continue
		}
		for _, m := range []string{
			"gemini-2.5-flash",
			"gemini-2.0-flash-lite",
			"gemini-1.5-flash",
		} {
			slots = append(slots, aiSlot{
				baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
				apiKey:  key,
				model:   m,
			})
		}
	}
	if openRouterKey != "" {
		for _, m := range []string{
			"openai/gpt-4o-mini",
			"google/gemini-flash-1.5",
			"deepseek/deepseek-v4-flash:free",
		} {
			slots = append(slots, aiSlot{
				baseURL: "https://openrouter.ai/api/v1",
				apiKey:  openRouterKey,
				model:   m,
			})
		}
	}
	return slots
}

func EnrichWithAI(db *sql.DB, geminiKeys []string, openRouterKey string) {
	enrich(db, geminiKeys, openRouterKey, false)
}

// EnrichWithAIForce bypasses the advisory lock (for manual trigger when lock is stuck).
func EnrichWithAIForce(db *sql.DB, geminiKeys []string, openRouterKey string) {
	enrich(db, geminiKeys, openRouterKey, true)
}

func enrich(db *sql.DB, geminiKeys []string, openRouterKey string, force bool) {
	slots := buildSlots(geminiKeys, openRouterKey)
	if len(slots) == 0 {
		log.Printf("aitrends: no API keys configured")
		return
	}
	slotIdx := 0

	if !force {
		// advisory lock — only 1 pod enriches at a time; auto-released on pod crash
		var locked bool
		if err := db.QueryRow(`SELECT pg_try_advisory_lock(hashtext('ai-enrich')::bigint)`).Scan(&locked); err != nil {
			log.Printf("aitrends: advisory lock query: %v — skipping", err)
			return
		}
		if !locked {
			log.Printf("aitrends: lock not acquired (another pod running) — skipping")
			return
		}
		defer func() { db.QueryRow(`SELECT pg_advisory_unlock(hashtext('ai-enrich')::bigint)`).Scan(new(bool)) }()
	}

	today := time.Now().Format("2006-01-02")

	// T2: early-exit if today already fully enriched
	var pending int
	if err := db.QueryRow(`SELECT COUNT(*) FROM trending_daily WHERE date=$1 AND problem_solved IS NULL`, today).Scan(&pending); err != nil {
		log.Printf("aitrends: pending check: %v", err)
		return
	}
	if pending == 0 {
		log.Printf("aitrends: all repos already enriched for %s — skipping", today)
		return
	}

	rows, err := db.Query(`
		SELECT r.id, r.name, r.description, r.language, r.topics
		FROM trending_repos r
		JOIN trending_daily d ON r.id = d.repo_id
		WHERE d.date = $1 AND d.problem_solved IS NULL
	`, today)
	if err != nil {
		log.Printf("aitrends: query: %v", err)
		return
	}

	type target struct{ id, name, description, language, topicsJSON string }
	var targets []target
	for rows.Next() {
		var t target
		if err := rows.Scan(&t.id, &t.name, &t.description, &t.language, &t.topicsJSON); err == nil {
			targets = append(targets, t)
		}
	}
	rows.Close()

	log.Printf("aitrends: enriching %d repos with %d slots", len(targets), len(slots))
	for _, t := range targets {
		var topics []string
		json.Unmarshal([]byte(t.topicsJSON), &topics)

		var analysis [5]string
		var callErr error
		for attempt := 0; attempt < len(slots)+2; attempt++ {
			if slotIdx >= len(slots) {
				log.Printf("aitrends: all providers exhausted")
				return
			}
			s := slots[slotIdx]
			analysis, callErr = callAI(s.baseURL, s.apiKey, s.model, t.name, t.description, t.language, topics)
			if callErr == nil && (analysis[0] != "" || analysis[1] != "" || analysis[2] != "") {
				break
			}
			if callErr != nil {
				log.Printf("aitrends: %s [%s %s]: %v", t.id, s.baseURL, s.model, callErr)
				// Rate limit or quota → advance to next slot
				if isRateLimit(callErr) {
					slotIdx++
					continue
				}
			} else {
				log.Printf("aitrends: %s [%s]: empty parse, trying next slot", t.id, s.model)
				slotIdx++
				continue
			}
			time.Sleep(3 * time.Second)
		}
		if callErr != nil || (analysis[0] == "" && analysis[1] == "" && analysis[2] == "") {
			log.Printf("aitrends: %s: giving up", t.id)
			time.Sleep(2 * time.Second)
			continue
		}

		score := 0
		for _, c := range analysis[3] {
			if c >= '0' && c <= '9' {
				score = score*10 + int(c-'0')
			}
		}
		if score > 10 {
			score = 10
		}
		db.Exec(`
			UPDATE trending_daily SET problem_solved=$1, tech_used=$2, simple_flow=$3, impact_score=$4, impact_label=$5
			WHERE repo_id=$6 AND date=$7
		`, analysis[0], analysis[1], analysis[2], score, analysis[4], t.id, today)

		log.Printf("aitrends: ok %s [%s]", t.id, slots[slotIdx].model)
		time.Sleep(500 * time.Millisecond)
	}
	log.Printf("aitrends: done")
}

func isRateLimit(err error) bool {
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "rate limit") || strings.Contains(msg, "quota") ||
		strings.Contains(msg, "resource_exhausted") || strings.Contains(msg, "429")
}

func callAI(baseURL, apiKey, model, name, description, language string, topics []string) ([5]string, error) {
	desc := description
	if desc == "" {
		desc = name
	}
	prompt := fmt.Sprintf(
		"Repo: %s\nDescription: %s\nLanguage: %s\nTopics: %s\n\n"+
			"Current industry pain points (2025-2026):\n"+
			"- LLM/AI: context limits, hallucination, agent reliability, RAG quality\n"+
			"- DevOps: IaC complexity, observability gaps, multi-cloud drift\n"+
			"- Security: supply chain attacks, secrets sprawl, SBOM compliance\n"+
			"- DX: build speed, monorepo tooling, type safety across stack\n"+
			"- Data: real-time pipelines, vector DBs, streaming consistency\n\n"+
			"Reply in Vietnamese (fallback English if unsure). NEVER use Chinese, Japanese, or Korean.\n"+
			"Reply with EXACTLY 5 lines, no other text:\n"+
			"Solved: <vấn đề repo giải quyết, ≤12 từ>\n"+
			"Technology: <tech stack, ≤10 từ>\n"+
			"Flow: <tóm tắt kiến trúc, ≤10 từ>\n"+
			"Impact: <điểm 1-10 mức độ ảnh hưởng ngành hiện tại, chỉ số>\n"+
			"Label: <transformative|significant|incremental|niche>",
		name, desc, language, strings.Join(topics, ", "),
	)

	body, _ := json.Marshal(aiRequest{
		Model:    model,
		Messages: []aiMessage{{Role: "user", Content: prompt}},
	})

	req, err := http.NewRequest("POST", baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return [5]string{}, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	if strings.Contains(baseURL, "openrouter") {
		req.Header.Set("HTTP-Referer", "https://cozyroom.local")
		req.Header.Set("X-Title", "Cozyroom Trending")
	}

	resp, err := (&http.Client{Timeout: 90 * time.Second}).Do(req)
	if err != nil {
		return [5]string{}, err
	}
	defer resp.Body.Close()

	var ar aiResponse
	if err := json.NewDecoder(resp.Body).Decode(&ar); err != nil {
		return [5]string{}, err
	}
	if ar.Error != nil {
		return [5]string{}, fmt.Errorf("%s", ar.Error.Message)
	}
	if len(ar.Choices) == 0 || ar.Choices[0].Message.Content == "" {
		return [5]string{}, fmt.Errorf("empty response (status %d)", resp.StatusCode)
	}

	content := ar.Choices[0].Message.Content
	// Strip reasoning/thinking blocks (DeepSeek, o1, etc.)
	if idx := strings.Index(content, "</think>"); idx != -1 {
		content = strings.TrimSpace(content[idx+8:])
	}
	result := parseLines(content)
	// Reject if any field contains CJK characters (Chinese/Japanese/Korean)
	for _, s := range result {
		if containsCJK(s) {
			return [5]string{}, fmt.Errorf("response contains CJK characters, retrying")
		}
	}
	return result, nil
}

func containsCJK(s string) bool {
	for _, r := range s {
		if (r >= 0x4E00 && r <= 0x9FFF) || // CJK Unified Ideographs
			(r >= 0x3400 && r <= 0x4DBF) || // CJK Extension A
			(r >= 0x3000 && r <= 0x303F) { // CJK Symbols
			return true
		}
	}
	return false
}

func parseLines(text string) [5]string {
	var result [5]string
	prefixGroups := [][2]string{
		{"Solved:", "Giải quyết:"},
		{"Technology:", "Công nghệ:"},
		{"Flow:", "Luồng:"},
		{"Impact:", "Điểm:"},
		{"Label:", "Nhãn:"},
	}
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		for i, group := range prefixGroups {
			for _, p := range group {
				if after, ok := strings.CutPrefix(line, p); ok {
					if result[i] == "" {
						result[i] = strings.TrimSpace(after)
					}
					break
				}
			}
		}
	}
	// Fallback: first 5 non-empty lines stripped of any "key: " prefix
	if result[0] == "" && result[1] == "" && result[2] == "" {
		i := 0
		for _, line := range strings.Split(text, "\n") {
			line = strings.TrimSpace(line)
			if line != "" && i < 5 {
				if idx := strings.Index(line, ": "); idx != -1 && idx < 20 {
					line = strings.TrimSpace(line[idx+2:])
				}
				result[i] = line
				i++
			}
		}
	}
	return result
}
