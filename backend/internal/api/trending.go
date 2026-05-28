package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"sync/atomic"
	"time"

	"cozyroom/internal/enricher"
)

type TrendingHandlers struct {
	db            *sql.DB
	geminiKey     string
	openRouterKey string
	githubToken   string
	running       atomic.Bool
}

type trendingRepoJSON struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	URL           string   `json:"url"`
	Language      string   `json:"language"`
	Topics        []string `json:"topics"`
	Stars         int      `json:"stars"`
	StarDelta     int      `json:"star_delta"`
	ProblemSolved string   `json:"problem_solved"`
	TechUsed      string   `json:"tech_used"`
	SimpleFlow    string   `json:"simple_flow"`
	ImpactScore   int      `json:"impact_score"`
	ImpactLabel   string   `json:"impact_label"`
}

type starPointJSON struct {
	SampledAt string `json:"sampled_at"`
	Stars     int    `json:"stars"`
}

func (h *TrendingHandlers) listTrending(w http.ResponseWriter, r *http.Request) {
	date := r.URL.Query().Get("date")
	if date == "" {
		row := h.db.QueryRow(`SELECT date FROM trending_daily ORDER BY date DESC LIMIT 1`)
		if err := row.Scan(&date); err != nil {
			date = time.Now().Format("2006-01-02")
		}
	}

	rows, err := h.db.Query(`
		SELECT r.id, r.name, r.url,
		       r.language, r.topics,
		       d.stars,
		       MAX(0, d.stars - COALESCE((
		         SELECT stars FROM trending_star_history
		         WHERE repo_id = r.id
		         ORDER BY sampled_at ASC LIMIT 1
		       ), d.stars)) AS star_delta,
		       COALESCE(d.problem_solved,''), COALESCE(d.tech_used,''), COALESCE(d.simple_flow,''),
		       COALESCE(d.impact_score,0), COALESCE(d.impact_label,'')
		FROM trending_daily d
		JOIN trending_repos r ON r.id = d.repo_id
		WHERE d.date = ?
		ORDER BY d.impact_score DESC, star_delta DESC, d.stars DESC
	`, date)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	defer rows.Close()

	result := make([]trendingRepoJSON, 0)
	for rows.Next() {
		var rep trendingRepoJSON
		var topicsJSON string
		if err := rows.Scan(
			&rep.ID, &rep.Name, &rep.URL, &rep.Language, &topicsJSON,
			&rep.Stars, &rep.StarDelta,
			&rep.ProblemSolved, &rep.TechUsed, &rep.SimpleFlow,
			&rep.ImpactScore, &rep.ImpactLabel,
		); err != nil {
			continue
		}
		if err := json.Unmarshal([]byte(topicsJSON), &rep.Topics); err != nil {
			rep.Topics = []string{}
		}
		result = append(result, rep)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (h *TrendingHandlers) listDates(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`SELECT DISTINCT date FROM trending_daily ORDER BY date DESC`)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	defer rows.Close()

	dates := make([]string, 0)
	for rows.Next() {
		var d string
		if err := rows.Scan(&d); err == nil {
			dates = append(dates, d)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dates)
}

func (h *TrendingHandlers) refresh(w http.ResponseWriter, r *http.Request) {
	if h.running.Load() {
		w.WriteHeader(http.StatusConflict)
		w.Write([]byte(`{"status":"already running"}`))
		return
	}
	go func() {
		h.running.Store(true)
		defer h.running.Store(false)
		repos, err := enricher.FetchTrendingRepos(h.githubToken)
		if err != nil {
			return
		}
		enricher.SaveTrendingSnapshot(h.db, repos)
		enricher.BackfillStarHistory(h.db, repos, h.githubToken)
		if h.geminiKey != "" || h.openRouterKey != "" {
			enricher.EnrichWithAI(h.db, h.geminiKey, h.openRouterKey)
		}
	}()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	w.Write([]byte(`{"status":"started"}`))
}

func (h *TrendingHandlers) repoHistory(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "missing id", 400)
		return
	}

	rows, err := h.db.Query(`
		SELECT sampled_at, stars FROM trending_star_history
		WHERE repo_id = ? ORDER BY sampled_at ASC
	`, id)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	defer rows.Close()

	points := make([]starPointJSON, 0)
	for rows.Next() {
		var p starPointJSON
		if err := rows.Scan(&p.SampledAt, &p.Stars); err == nil {
			points = append(points, p)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(points)
}
