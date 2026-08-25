package enricher

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"

	cozydb "cozyroom/internal/db"
)

type TrendingRepo struct {
	ID          string
	Name        string
	URL         string
	Description string
	Language    string
	Topics      []string
	Stars       int
	StarDelta   int
}

func FetchTrendingRepos(githubToken string) ([]TrendingRepo, error) {
	cloakURL := os.Getenv("CLOAK_PROXY_URL")
	targetURL := "https://github.com/trending"

	var htmlContent string
	var err error

	if cloakURL != "" {
		payload, err := json.Marshal(map[string]string{"url": targetURL})
		if err == nil {
			var resp *http.Response
			resp, err = http.Post(cloakURL+"/fetch", "application/json", bytes.NewReader(payload))
			if err == nil {
				defer resp.Body.Close()
				var result struct {
					HTML  string `json:"html"`
					Error string `json:"error"`
				}
				if err = json.NewDecoder(resp.Body).Decode(&result); err == nil {
					if result.Error != "" {
						err = fmt.Errorf("cloak-proxy: %s", result.Error)
					} else {
						htmlContent = result.HTML
					}
				}
			}
		}
		if err != nil {
			fmt.Printf("[WARN] cloak-proxy fetch failed: %v, trying direct HTTP\n", err)
		}
	}

	if htmlContent == "" {
		req, err := http.NewRequestWithContext(context.Background(), "GET", targetURL, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
		req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
		req.Header.Set("Accept-Language", "en-US,en;q=0.5")

		client := &http.Client{Timeout: 15 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		if resp.StatusCode != 200 {
			return nil, fmt.Errorf("direct fetch github: status %d", resp.StatusCode)
		}

		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}
		htmlContent = string(bodyBytes)
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(htmlContent))
	if err != nil {
		return nil, err
	}

	var repos []TrendingRepo
	starReg := regexp.MustCompile(`([\d,]+)\s+stars?`)

	doc.Find("article.Box-row").Each(func(i int, s *goquery.Selection) {
		aLink := s.Find("h2.h3 a, h1.h3 a").First()
		href, _ := aLink.Attr("href")
		if href == "" {
			return
		}
		repoPath := strings.TrimPrefix(href, "/")
		repoPath = strings.TrimSpace(repoPath)
		url := "https://github.com" + href

		desc := strings.TrimSpace(s.Find("p.col-9, p").First().Text())
		lang := strings.TrimSpace(s.Find("[itemprop='programmingLanguage']").First().Text())

		starsText := s.Find("a[href*='/stargazers']").First().Text()
		if starsText == "" {
			starsText = s.Find("a.Link--muted").First().Text()
		}
		starsText = strings.ReplaceAll(strings.TrimSpace(starsText), ",", "")
		starsText = strings.ReplaceAll(starsText, "\n", "")
		var stars int
		fmt.Sscanf(starsText, "%d", &stars)

		deltaText := strings.TrimSpace(s.Find(".float-sm-right, span.d-inline-block.float-sm-right").First().Text())
		deltaText = strings.ReplaceAll(deltaText, ",", "")
		var delta int
		matches := starReg.FindStringSubmatch(deltaText)
		if len(matches) > 1 {
			fmt.Sscanf(matches[1], "%d", &delta)
		}

		repos = append(repos, TrendingRepo{
			ID:          repoPath,
			Name:        repoPath,
			URL:         url,
			Description: desc,
			Language:    lang,
			Stars:       stars,
			StarDelta:   delta,
		})
	})

	if len(repos) < 10 {
		return nil, fmt.Errorf("layout mismatch: found only %d repositories (expected at least 10)", len(repos))
	}

	// Fetch topics via GitHub API for each repository
	client := &http.Client{Timeout: 5 * time.Second}
	for i := range repos {
		r := &repos[i]
		topics, err := fetchRepoTopics(client, r.ID, githubToken)
		if err == nil {
			r.Topics = topics
		} else {
			fmt.Printf("[WARN] Failed to fetch topics for %s: %v\n", r.ID, err)
			r.Topics = []string{}
		}
		// Brief sleep to avoid hitting secondary rate limits
		time.Sleep(50 * time.Millisecond)
	}

	return repos, nil
}

// BackfillStarHistory fills in daily star-count snapshots for the past 7 days
// by paginating the GitHub Stargazers API from the most recent page backwards.
// Runs once per repo until it has 7 distinct daily records.
func BackfillStarHistory(db *sql.DB, repos []TrendingRepo, githubToken string) {
	if githubToken == "" {
		githubToken = os.Getenv("GITHUB_TOKEN")
	}
	client := &http.Client{Timeout: 10 * time.Second}

	for _, r := range repos {
		var dayCount int
		if err := db.QueryRow(`
			SELECT COUNT(DISTINCT substr(sampled_at,1,10))
			FROM trending_star_history WHERE repo_id=$1
		`, r.ID).Scan(&dayCount); err != nil || dayCount >= 7 {
			continue
		}

		timestamps, err := fetchRecentStargazers(client, r.ID, r.Stars, githubToken)
		if err != nil || len(timestamps) == 0 {
			continue
		}

		now := time.Now().UTC()
		for d := 1; d <= 7; d++ {
			dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -d)
			starsAfter := 0
			for _, t := range timestamps {
				if t.After(dayStart) {
					starsAfter++
				}
			}
			estimated := r.Stars - starsAfter
			if estimated < 0 {
				estimated = 0
			}
			db.Exec(`
				INSERT INTO trending_star_history (repo_id, sampled_at, stars)
				VALUES ($1, $2, $3)
				ON CONFLICT(repo_id, sampled_at) DO NOTHING
			`, r.ID, dayStart.Format("2006-01-02")+"T12:00:00Z", estimated)
		}
	}
}

func fetchRecentStargazers(client *http.Client, fullName string, currentStars int, token string) ([]time.Time, error) {
	type sg struct {
		StarredAt string `json:"starred_at"`
	}

	now := time.Now().UTC()
	cutoff := now.AddDate(0, 0, -8)
	totalPages := currentStars/100 + 1

	var timestamps []time.Time
	const maxPages = 60

	for i := 0; i < maxPages; i++ {
		page := totalPages - i
		if page < 1 {
			break
		}
		url := fmt.Sprintf(
			"https://api.github.com/repos/%s/stargazers?per_page=100&page=%d",
			fullName, page,
		)
		req, err := http.NewRequestWithContext(context.Background(), "GET", url, nil)
		if err != nil {
			break
		}
		req.Header.Set("Accept", "application/vnd.github.v3.star+json")
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}

		resp, err := client.Do(req)
		if err != nil {
			break
		}
		var items []sg
		json.NewDecoder(resp.Body).Decode(&items)
		resp.Body.Close()

		if resp.StatusCode != http.StatusOK || len(items) == 0 {
			break
		}

		oldest := now
		for _, item := range items {
			t, err := time.Parse(time.RFC3339, item.StarredAt)
			if err != nil {
				continue
			}
			timestamps = append(timestamps, t)
			if t.Before(oldest) {
				oldest = t
			}
		}
		if oldest.Before(cutoff) {
			break
		}
		time.Sleep(110 * time.Millisecond)
	}
	return timestamps, nil
}

func SaveTrendingSnapshot(db *sql.DB, repos []TrendingRepo) error {
	today := time.Now().UTC().Format("2006-01-02")
	now := time.Now().UTC().Format("2006-01-02T15:04:05Z")

	return cozydb.Transact(db, func(tx *sql.Tx) error {
		return saveTrendingSnapshot(tx, repos, today, now)
	})
}

func saveTrendingSnapshot(tx *sql.Tx, repos []TrendingRepo, today, now string) error {
	for i := range repos {
		r := &repos[i]

		topicsJSON := "[]"
		if len(r.Topics) > 0 {
			b, _ := json.Marshal(r.Topics)
			topicsJSON = string(b)
		}

		if _, err := tx.Exec(`
			INSERT INTO trending_repos (id, name, url, description, language, topics)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT(id) DO UPDATE SET
			  name=excluded.name, url=excluded.url, description=excluded.description,
			  language=excluded.language, topics=excluded.topics
		`, r.ID, r.Name, r.URL, r.Description, r.Language, topicsJSON); err != nil {
			return err
		}

		if _, err := tx.Exec(`
			INSERT INTO trending_star_history (repo_id, sampled_at, stars)
			VALUES ($1, $2, $3)
			ON CONFLICT(repo_id, sampled_at) DO NOTHING
		`, r.ID, now, r.Stars); err != nil {
			return err
		}

		// Star delta vs most recent snapshot strictly before this one
		var prevStars int
		err := tx.QueryRow(`
			SELECT stars FROM trending_star_history
			WHERE repo_id = $1 AND sampled_at < $2
			ORDER BY sampled_at DESC LIMIT 1
		`, r.ID, now).Scan(&prevStars)
		if err == nil {
			r.StarDelta = r.Stars - prevStars
		}

		if _, err := tx.Exec(`
			INSERT INTO trending_daily (repo_id, date, stars, star_delta)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT(repo_id, date) DO UPDATE SET
			  stars=excluded.stars, star_delta=excluded.star_delta
		`, r.ID, today, r.Stars, r.StarDelta); err != nil {
			return err
		}
	}

	return nil
}

func fetchRepoTopics(client *http.Client, fullName string, token string) ([]string, error) {
	if token == "" {
		token = os.Getenv("GITHUB_TOKEN")
	}
	url := fmt.Sprintf("https://api.github.com/repos/%s", fullName)
	req, err := http.NewRequestWithContext(context.Background(), "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}

	var result struct {
		Topics []string `json:"topics"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Topics, nil
}

