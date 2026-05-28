package api

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"cozyroom/internal/repository/postgres"
)

type EHCachedHandler struct {
	pool      *HeadlessEHPool
	cache     *postgres.ComicsCacheRepo
	apiMu     sync.Mutex
	apiRate   time.Time
	cloakURL  string
	ehLatestC *latestCache
}

func NewEHCachedHandler(db *sql.DB, cloakURL string) *EHCachedHandler {
	return &EHCachedHandler{
		pool:      NewHeadlessEHPool(),
		cache:     &postgres.ComicsCacheRepo{DB: db},
		cloakURL:  cloakURL,
		ehLatestC: newLatestCache(30 * time.Minute),
	}
}

// fetchHTML fetches a page's HTML, routing through the cloak proxy if configured.
func (h *EHCachedHandler) fetchHTML(pageURL string) (string, error) {
	if h.cloakURL != "" {
		payload, _ := json.Marshal(map[string]string{"url": pageURL})
		resp, err := http.Post(h.cloakURL+"/fetch", "application/json", bytes.NewReader(payload))
		if err != nil {
			return "", fmt.Errorf("cloak-proxy: %w", err)
		}
		defer resp.Body.Close()
		var result struct {
			HTML  string `json:"html"`
			Error string `json:"error"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			return "", err
		}
		if result.Error != "" {
			return "", fmt.Errorf("cloak-proxy: %s", result.Error)
		}
		return result.HTML, nil
	}
	// Direct fallback (no cloak proxy configured)
	req, err := http.NewRequest("GET", pageURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req.Header.Set("Referer", "https://e-hentai.org/")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	return string(body), err
}

// fetchImageViaProxy fetches raw image bytes, routing through the cloak proxy when configured.
func (h *EHCachedHandler) fetchImageViaProxy(imageURL string) ([]byte, error) {
	if h.cloakURL != "" {
		payload, _ := json.Marshal(map[string]string{"url": imageURL})
		resp, err := http.Post(h.cloakURL+"/fetch-binary", "application/json", bytes.NewReader(payload))
		if err != nil {
			return nil, fmt.Errorf("cloak-proxy binary: %w", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 400 {
			return nil, fmt.Errorf("cloak-proxy binary: HTTP %d", resp.StatusCode)
		}
		// If proxy returns JSON error, detect it
		ct := resp.Header.Get("Content-Type")
		if strings.Contains(ct, "application/json") {
			var result struct{ Error string `json:"error"` }
			json.NewDecoder(resp.Body).Decode(&result)
			if result.Error != "" {
				return nil, fmt.Errorf("cloak-proxy: %s", result.Error)
			}
		}
		return io.ReadAll(resp.Body)
	}
	// Direct fallback
	req, err := http.NewRequest("GET", imageURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req.Header.Set("Referer", "https://e-hentai.org/")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d for %s", resp.StatusCode, imageURL)
	}
	return io.ReadAll(resp.Body)
}

var (
	linkRe   = regexp.MustCompile(`/g/(\d+)/([a-z0-9]+)`)
	glinkRe  = regexp.MustCompile(`class="glink">([^<]+)</div>`)
	coverRe  = regexp.MustCompile(`(?s)class="glthumb"[^>]*>.*?<img[^>]*src="([^"]+)"`)
	trRe     = regexp.MustCompile(`(?s)<tr>(.*?)</tr>`)
	pageRe   = regexp.MustCompile(`ptt_d">\s*<a[^>]*page=(\d+)`)
)

func (h *EHCachedHandler) ehSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		http.Error(w, "missing q param", 400)
		return
	}
	page := r.URL.Query().Get("page")
	if page == "" {
		page = "0"
	}
	key := q + ":" + page

	cached, err := h.cache.GetSearch("eh", key, 6*time.Hour)
	if err == nil && len(cached) > 0 {
		w.Header().Set("Content-Type", "application/json")
		w.Write(cached)
		return
	}

	html, err := h.fetchHTML(fmt.Sprintf("https://e-hentai.org/?f_search=%s&page=%s", q, page))
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}

	if ehHTMLIsBanned(html) {
		h.pool.markBanned()
		http.Error(w, "rate limited", 429)
		return
	}

	trMatches := trRe.FindAllStringSubmatch(html, -1)

	var results []map[string]any
	for _, row := range trMatches {
		if len(row) < 2 {
			continue
		}
		content := row[1]
		lm := linkRe.FindStringSubmatch(content)
		if len(lm) < 2 {
			continue
		}
		glm := glinkRe.FindStringSubmatch(content)
		cm := coverRe.FindStringSubmatch(content)

		name := ""
		if len(glm) > 1 {
			name = glm[1]
		}
		cover := ""
		if len(cm) > 1 {
			cover = cm[1]
		}

		results = append(results, map[string]any{
			"id":    lm[1],
			"token": lm[2],
			"name":  name,
			"cover": cover,
			"link":  "https://e-hentai.org/g/" + lm[1] + "/" + lm[2],
		})
	}

	var nextPage int
	pm := pageRe.FindAllStringSubmatch(html, -1)
	for _, p := range pm {
		var pg int
		fmt.Sscanf(p[1], "%d", &pg)
		if pg > nextPage {
			nextPage = pg
		}
	}

	if results == nil {
		results = []map[string]any{}
	}

	resp := map[string]any{"results": results, "nextPage": nextPage}
	data, _ := json.Marshal(resp)
	h.cache.SaveSearch("eh", key, data)

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func (h *EHCachedHandler) ehLatest(w http.ResponseWriter, r *http.Request) {
	data, err := h.ehLatestC.Get(h.fetchEHLatest)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

// ehHomepageRe matches the homepage gallery layout:
// href="/g/{id}/{token}/"><img ... alt="{name}" ... src="{cover}">
var ehHomepageRe = regexp.MustCompile(`/g/(\d+)/([a-z0-9]+)/"><img[^>]*alt="([^"]+)"[^>]*src="(https://ehgt\.org/[^"]+)"`)

func (h *EHCachedHandler) fetchEHLatest() ([]byte, error) {
	html, err := h.fetchHTML("https://e-hentai.org/")
	if err != nil {
		return nil, err
	}
	if ehHTMLIsBanned(html) {
		h.pool.markBanned()
		return nil, fmt.Errorf("e-hentai rate limited")
	}

	matches := ehHomepageRe.FindAllStringSubmatch(html, -1)
	seen := make(map[string]bool)
	var results []map[string]any
	for _, m := range matches {
		id, token, name, rawCover := m[1], m[2], m[3], m[4]
		key := id + "/" + token
		if seen[key] {
			continue
		}
		seen[key] = true
		cover := "/api/scraper/eh/image?url=" + url.QueryEscape(rawCover)
		results = append(results, map[string]any{
			"id":    id,
			"token": token,
			"name":  name,
			"cover": cover,
			"link":  "https://e-hentai.org/g/" + id + "/" + token,
		})
	}
	if results == nil {
		results = []map[string]any{}
	}
	return json.Marshal(map[string]any{"results": results})
}

func (h *EHCachedHandler) ehDetail(w http.ResponseWriter, r *http.Request) {
	url := r.URL.Query().Get("url")
	if url == "" {
		http.Error(w, "missing url", 400)
		return
	}
	re := regexp.MustCompile(`/g/(\d+)/([a-z0-9]+)`)
	m := re.FindStringSubmatch(url)
	if len(m) < 2 {
		http.Error(w, "invalid url", 400)
		return
	}
	gid, token := m[1], m[2]

	cached, err := h.cache.GetGallery(gid, token, 24*time.Hour)
	if err == nil && len(cached) > 0 {
		w.Header().Set("Content-Type", "application/json")
		w.Write(cached)
		return
	}

	data, err := h.fetchEHAPI(gid, token)
	if err != nil {
		html, err := h.fetchHTML(url)
		if err != nil {
			http.Error(w, err.Error(), 502)
			return
		}
		if ehHTMLIsBanned(html) {
			h.pool.markBanned()
			http.Error(w, "rate limited", 429)
			return
		}
		data = []byte(parseEHTMLDetail(html, url))
	}

	h.cache.SaveGallery(gid, token, data)
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func (h *EHCachedHandler) ehPages(w http.ResponseWriter, r *http.Request) {
	url := r.URL.Query().Get("url")
	if url == "" {
		http.Error(w, "missing url", 400)
		return
	}
	re := regexp.MustCompile(`/g/(\d+)/([a-z0-9]+)`)
	m := re.FindStringSubmatch(url)
	if len(m) < 2 {
		http.Error(w, "invalid url", 400)
		return
	}
	gid := m[1]

	if cached, err := h.cache.GetChapterPages(gid+"_pages", 24*time.Hour); err == nil && len(cached) > 0 {
		w.Header().Set("Content-Type", "application/json")
		w.Write(cached)
		return
	}

	html, err := h.fetchHTML(url)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	if ehHTMLIsBanned(html) {
		h.pool.markBanned()
		http.Error(w, "rate limited", 429)
		return
	}

	pages := parseEHPages(html, gid)

	data, _ := json.Marshal(pages)
	h.cache.SaveChapterPages(gid, gid+"_pages", data)
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func (h *EHCachedHandler) fetchEHAPI(gid, token string) ([]byte, error) {
	h.apiMu.Lock()
	defer h.apiMu.Unlock()
	if !h.apiRate.IsZero() {
		if elapsed := time.Since(h.apiRate); elapsed < 5*time.Second {
			time.Sleep(5*time.Second - elapsed)
		}
	}

	gidInt, _ := strconv.ParseInt(gid, 10, 64)
	payload, _ := json.Marshal(map[string]any{
		"method":    "gdata",
		"gidlist":   [][]any{{gidInt, token}},
		"namespace": 1,
	})

	req, err := http.NewRequest("POST", "https://api.e-hentai.org/api.php", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	h.apiRate = time.Now()

	bodyBytes, _ := io.ReadAll(resp.Body)

	var apiResp struct {
		Gmetadata []struct {
			Gid          int64    `json:"gid"`
			Token        string   `json:"token"`
			Title        string   `json:"title"`
			TitleJpn     string   `json:"title_jpn"`
			Cat          string   `json:"category"`
			Thumb        string   `json:"thumb"`
			Uploader     string   `json:"uploader"`
			Posted       string   `json:"posted"`
			Filesize     int64    `json:"filesize"`
			Filecount    string   `json:"filecount"`
			Rating       string   `json:"rating"`
			Tags         []string `json:"tags"`
			Torrentcount string   `json:"torrentcount"`
		} `json:"gmetadata"`
	}

	if err := json.Unmarshal(bodyBytes, &apiResp); err != nil {
		return nil, fmt.Errorf("json decode: %w", err)
	}

	if len(apiResp.Gmetadata) == 0 {
		return nil, fmt.Errorf("no gallery data")
	}

	g := apiResp.Gmetadata[0]
	gidStr := strconv.FormatInt(g.Gid, 10)
	filesize := g.Filesize
	pages, _ := strconv.Atoi(g.Filecount)

	detail := map[string]any{
		"id":           gidStr,
		"token":        g.Token,
		"name":         g.Title,
		"nameJP":       g.TitleJpn,
		"cover":        g.Thumb,
		"uploader":     g.Uploader,
		"posted":       g.Posted,
		"fileSize":     filesize,
		"pages":        pages,
		"rating":       g.Rating,
		"tags":         g.Tags,
		"torrentCount": g.Torrentcount,
		"link":         fmt.Sprintf("https://e-hentai.org/g/%s/%s/", gidStr, g.Token),
	}
	return json.Marshal(detail)
}

func (h *EHCachedHandler) fetchPagesViaAPI(gid, token string) ([]map[string]any, error) {
	h.apiMu.Lock()
	defer h.apiMu.Unlock()
	if !h.apiRate.IsZero() {
		if elapsed := time.Since(h.apiRate); elapsed < 5*time.Second {
			time.Sleep(5*time.Second - elapsed)
		}
	}

	pagesURL := fmt.Sprintf("https://e-hentai.org/g/%s/%s/", gid, token)
	fmt.Printf("[fetchPagesViaAPI] fetching %s\n", pagesURL)

	html, err := h.fetchHTML(pagesURL)
	if err != nil {
		return nil, err
	}

	re := regexp.MustCompile(`(?s)<a href="(/s/[a-f0-9]+/\d+-\d+)"[^>]*>`)
	matches := re.FindAllStringSubmatch(html, -1)
	fmt.Printf("[fetchPagesViaAPI] HTML len=%d matches=%d\n", len(html), len(matches))

	pages := make([]map[string]any, 0, len(matches))
	for i, m := range matches {
		pages = append(pages, map[string]any{
			"index": i + 1,
			"url":   "https://e-hentai.org" + m[1],
		})
	}

	h.apiRate = time.Now()
	return pages, nil
}

// FetchImageURLFromPage extracts the actual image URL from an EH page-viewer URL.
func (h *EHCachedHandler) FetchImageURLFromPage(pageViewerURL string) (string, error) {
	html, err := h.fetchHTML(pageViewerURL)
	if err != nil {
		return "", err
	}
	if ehHTMLIsBanned(html) {
		return "", fmt.Errorf("e-hentai banned")
	}
	m := regexp.MustCompile(`id="img"\s+src="([^"]+)"`).FindStringSubmatch(html)
	if len(m) < 2 {
		return "", fmt.Errorf("img src not found on page")
	}
	return m[1], nil
}

func (h *EHCachedHandler) Close() {
	h.pool.close()
}

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}

func ehHTMLIsBanned(html string) bool {
	return containsAny(html,
		"IP address has been temporarily banned",
		"You have been banned",
		"Too Many Requests",
		"exceeded your daily",
	)
}

func parseEHSearch(html string) ([]map[string]any, int) {
	var results []map[string]any
	var nextPage int

	linkRe := regexp.MustCompile(`/g/(\d+)/([a-z0-9]+)`)
	glinkRe := regexp.MustCompile(`class="glink"[^>]*>([^<]+)</a>`)
	coverRe := regexp.MustCompile(`(?s)class="glthumb"[^>]*>.*?<img[^>]*src="([^"]+)"`)

	trRe := regexp.MustCompile(`(?s)<tr>(.*?)</tr>`)
	trMatches := trRe.FindAllStringSubmatch(html, -1)

	for _, row := range trMatches {
		if len(row) < 2 {
			continue
		}
		content := row[1]

		glink := glinkRe.FindStringSubmatch(content)
		if len(glink) < 2 {
			continue
		}
		name := glink[1]

		cm := coverRe.FindStringSubmatch(content)
		cover := ""
		if len(cm) > 1 {
			cover = cm[1]
		}

		lm := linkRe.FindStringSubmatch(content)
		if len(lm) < 2 {
			continue
		}

		results = append(results, map[string]any{
			"id":    lm[1],
			"token": lm[2],
			"name":  name,
			"cover": cover,
			"link":  "https://e-hentai.org/g/" + lm[1] + "/" + lm[2],
		})
	}

	if results == nil {
		results = []map[string]any{}
	}

	pageRe := regexp.MustCompile(`ptt_d">\s*<a[^>]*page=(\d+)`)
	pm := pageRe.FindAllStringSubmatch(html, -1)
	for _, p := range pm {
		var pg int
		fmt.Sscanf(p[1], "%d", &pg)
		if pg > nextPage {
			nextPage = pg
		}
	}

	return results, nextPage
}

func parseEHTMLDetail(html, url string) string {
	re := regexp.MustCompile(`/g/(\d+)/([a-z0-9]+)`)
	m := re.FindStringSubmatch(url)
	gid, token := "", ""
	if len(m) > 1 {
		gid, token = m[1], m[2]
	}

	nm := pickMatch(`<h1 id="gn">([^<]+)</h1>`, html)
	um := pickMatch(`id="gdn">\s*<a[^>]*>([^<]+)</a>`, html)
	cm := pickMatch(`style="background-image:url\('([^']+)'\)`, html)
	pm := pickMatch(`Posted:</td><td class="gdt1">([^<]+)</td>`, html)
	lm := pickMatch(`Language:</td><td class="gdt1">([^<]+)</td>`, html)
	sm := pickMatch(`File Size:</td><td class="gdt1">([^<]+)</td>`, html)
	pagesm := pickMatch(`Length:</td><td class="gdt1">(\d+)`, html)

	var pages int
	fmt.Sscanf(pagesm, "%d", &pages)

	detail := map[string]any{
		"id":       gid,
		"token":    token,
		"name":     nm,
		"cover":    cm,
		"uploader": um,
		"posted":   pm,
		"language": lm,
		"fileSize": sm,
		"pages":    pages,
		"link":     url,
	}
	data, _ := json.Marshal(detail)
	return string(data)
}

func parseEHPages(html, gid string) []map[string]any {
	var pages []map[string]any
	re := regexp.MustCompile(`/s/([a-f0-9]+)/(\d+)-(\d+)"`)
	matches := re.FindAllStringSubmatch(html, -1)
	for _, m := range matches {
		pages = append(pages, map[string]any{
			"index": len(pages) + 1,
			"link":  fmt.Sprintf("https://e-hentai.org/s/%s/%s-%s", m[1], m[2], m[3]),
		})
	}
	if pages == nil {
		pages = []map[string]any{}
	}
	return pages
}

func pickMatch(reStr, html string) string {
	re := regexp.MustCompile(reStr)
	m := re.FindStringSubmatch(html)
	return pick(m, 1)
}

func pick(m []string, i int) string {
	if len(m) > i {
		return m[i]
	}
	return ""
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
