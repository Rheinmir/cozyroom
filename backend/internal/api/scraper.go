package api

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/PuerkitoBio/goquery"
)

type ScraperHandlers struct {
	ehState      *EHState
	cloakURL     string
	mdLatestC    *latestCache
}

type EHState struct {
	mu          sync.Mutex
	lastReq     time.Time
	consecutive int
	bannedUntil time.Time
	client      *http.Client
}

func NewScraperHandlers(cloakURL string) *ScraperHandlers {
	return &ScraperHandlers{
		cloakURL:  cloakURL,
		mdLatestC: newLatestCache(10 * time.Minute),
		ehState: &EHState{
			lastReq: time.Time{},
			consecutive: 0,
			bannedUntil: time.Time{},
			client: &http.Client{
				Timeout: 30 * time.Second,
				Transport: &http.Transport{
					MaxIdleConns:        5,
					IdleConnTimeout:     120 * time.Second,
					TLSClientConfig:    &tls.Config{MinVersion: tls.VersionTLS12},
					DisableKeepAlives:   true,
				},
			},
		},
	}
}

func (s *EHState) waitForCooldown() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.consecutive > 0 && s.consecutive%3 == 0 {
		delay := time.Duration(s.consecutive/3) * 45 * time.Second
		if delay > 5*time.Minute {
			delay = 5 * time.Minute
		}
		if s.lastReq.IsZero() == false {
			elapsed := time.Since(s.lastReq)
			if elapsed < delay {
				time.Sleep(delay - elapsed)
			}
		}
	}
}

func (s *EHState) recordReq(errMsg string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if strings.Contains(errMsg, "403") || strings.Contains(errMsg, "429") || strings.Contains(errMsg, "banned") {
		s.consecutive++
		s.bannedUntil = time.Now().Add(time.Duration(s.consecutive) * 15 * time.Minute)
	} else {
		if s.consecutive > 0 {
			s.consecutive--
		}
		s.bannedUntil = time.Time{}
	}
	s.lastReq = time.Now()
}

func (s *EHState) isBanned() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return !s.bannedUntil.IsZero() && time.Now().Before(s.bannedUntil)
}

func (s *EHState) reset() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.consecutive = 0
	s.bannedUntil = time.Time{}
	s.lastReq = time.Time{}
}

type RateLimiter struct {
	lastReq time.Time
	minGap  time.Duration
	mu      sync.Mutex
}

func newRateLimiter(requestsPerMinute int) *RateLimiter {
	return &RateLimiter{
		lastReq: time.Time{},
		minGap:  time.Duration(60000/requestsPerMinute) * time.Millisecond,
	}
}

func (rl *RateLimiter) wait() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	if !rl.lastReq.IsZero() {
		elapsed := time.Since(rl.lastReq)
		if elapsed < rl.minGap {
			time.Sleep(rl.minGap - elapsed)
		}
	}
	rl.lastReq = time.Now()
}

func (sh *ScraperHandlers) mdLatest(w http.ResponseWriter, r *http.Request) {
	data, err := sh.mdLatestC.Get(sh.fetchMDLatest)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func (sh *ScraperHandlers) fetchMDLatest() ([]byte, error) {
	raw, err := mdFetch(
		"/manga?limit=20&order[latestUploadedChapter]=desc&includes[]=author&contentRating[]=safe&contentRating[]=suggestive",
	)
	if err != nil {
		return nil, err
	}
	var res mdSearchResp
	if err := json.Unmarshal(raw, &res); err != nil {
		return nil, err
	}

	type coverResult struct {
		id  string
		url string
	}
	sem := make(chan struct{}, 5)
	ch := make(chan coverResult, len(res.Data))
	var wg sync.WaitGroup
	for _, d := range res.Data {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			atHomeURL := mdFetchFirstPage(id)
			var proxyURL string
			if atHomeURL != "" {
				proxyURL = "/api/scraper/md/img?url=" + url.QueryEscape(atHomeURL)
			}
			ch <- coverResult{id, proxyURL}
		}(d.ID)
	}
	wg.Wait()
	close(ch)

	covers := make(map[string]string)
	for r := range ch {
		if r.url != "" {
			covers[r.id] = r.url
		}
	}

	results := make([]map[string]any, 0, len(res.Data))
	for _, d := range res.Data {
		title := mdPickTitle(d.Attributes.Title)
		var author string
		for _, rel := range d.Relationships {
			if rel.Type == "author" || rel.Type == "artist" {
				if n, ok := rel.Attributes["name"].(string); ok && n != "" {
					author = n
					break
				}
			}
		}
		var desc string
		if v, ok := d.Attributes.Description["vi"]; ok {
			desc = v
		} else if v, ok := d.Attributes.Description["en"]; ok {
			desc = v
		}
		results = append(results, map[string]any{
			"id":          d.ID,
			"title":       title,
			"cover":       covers[d.ID],
			"author":      author,
			"description": desc,
			"status":      d.Attributes.Status,
			"year":        d.Attributes.Year,
			"link":        "https://mangadex.org/title/" + d.ID,
		})
	}
	return json.Marshal(map[string]any{"results": results})
}

func mdFetchFirstPage(mangaID string) string {
	data, err := mdFetch(fmt.Sprintf(
		"/chapter?manga=%s&limit=1&order[publishAt]=desc",
		mangaID,
	))
	if err != nil {
		return ""
	}
	var res struct {
		Data []struct{ ID string `json:"id"` } `json:"data"`
	}
	if err := json.Unmarshal(data, &res); err != nil || len(res.Data) == 0 {
		return ""
	}
	atHomeData, err := mdFetch("/at-home/server/" + res.Data[0].ID)
	if err != nil {
		return ""
	}
	var atHome struct {
		BaseURL string `json:"baseUrl"`
		Chapter struct {
			Hash string   `json:"hash"`
			Data []string `json:"data"`
		} `json:"chapter"`
	}
	if err := json.Unmarshal(atHomeData, &atHome); err != nil || atHome.BaseURL == "" || len(atHome.Chapter.Data) == 0 {
		return ""
	}
	return fmt.Sprintf("%s/data/%s/%s", atHome.BaseURL, atHome.Chapter.Hash, atHome.Chapter.Data[0])
}

func (sh *ScraperHandlers) mdImg(w http.ResponseWriter, r *http.Request) {
	imgURL := r.URL.Query().Get("url")
	if imgURL == "" {
		http.Error(w, "missing url param", 400)
		return
	}
	resp, err := http.Get(imgURL)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	defer resp.Body.Close()
	ct := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "image/") {
		http.Error(w, "not an image", 502)
		return
	}
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Cache-Control", "public, max-age=600")
	io.Copy(w, resp.Body)
}

func mdBuildResults(data []mdMangaData) ([]map[string]any, error) {
	covers := make(map[string]string)
	for _, d := range data {
		for _, rel := range d.Relationships {
			if rel.Type != "cover_art" {
				continue
			}
			// Fast path: filename may be inlined when includes[]=cover_art
			if fn, ok := rel.Attributes["fileName"].(string); ok && fn != "" {
				covers[d.ID] = fmt.Sprintf("https://uploads.mangadex.org/covers/%s/%s.256.jpg", d.ID, fn)
				break
			}
			// Fallback: individual cover fetch
			cb, _ := mdFetch("/cover/" + rel.ID)
			var cbD struct {
				Data struct {
					Attributes struct {
						FileName string `json:"fileName"`
					} `json:"attributes"`
				} `json:"data"`
			}
			if json.Unmarshal(cb, &cbD) == nil && cbD.Data.Attributes.FileName != "" {
				covers[d.ID] = fmt.Sprintf("https://uploads.mangadex.org/covers/%s/%s.256.jpg", d.ID, cbD.Data.Attributes.FileName)
			}
			break
		}
	}
	results := make([]map[string]any, 0, len(data))
	for _, d := range data {
		title := mdPickTitle(d.Attributes.Title)
		var author string
		for _, rel := range d.Relationships {
			if rel.Type == "author" || rel.Type == "artist" {
				if n, ok := rel.Attributes["name"].(string); ok && n != "" {
					author = n
					break
				}
			}
		}
		var desc string
		if v, ok := d.Attributes.Description["vi"]; ok {
			desc = v
		} else if v, ok := d.Attributes.Description["en"]; ok {
			desc = v
		}
		results = append(results, map[string]any{
			"id":          d.ID,
			"title":       title,
			"cover":       covers[d.ID],
			"author":      author,
			"description": desc,
			"status":      d.Attributes.Status,
			"year":        d.Attributes.Year,
			"link":        "https://mangadex.org/title/" + d.ID,
		})
	}
	return results, nil
}

func (sh *ScraperHandlers) mdSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		http.Error(w, "missing q param", 400)
		return
	}
	data, err := mdFetch(fmt.Sprintf(
		"/manga?title=%s&limit=20&includes[]=cover_art&includes[]=author&contentRating[]=safe&contentRating[]=suggestive",
		url.QueryEscape(q),
	))
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	var res mdSearchResp
	if err := json.Unmarshal(data, &res); err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	results, err := mdBuildResults(res.Data)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	json.NewEncoder(w).Encode(map[string]any{"results": results})
}

func (sh *ScraperHandlers) mdChapters(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", 400)
		return
	}
	data, err := mdFetch(fmt.Sprintf(
		"/chapter?manga=%s&limit=100&translatedLanguage[]=vi&translatedLanguage[]=en&includes[]=scanlation_group&order[chapter]=asc",
		id,
	))
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	var res struct {
		Result string `json:"result"`
		Data []struct {
			ID         string `json:"id"`
			Attributes struct {
				Chapter   string `json:"chapter"`
				Title     string `json:"title"`
				Volume    string `json:"volume"`
				PublishAt string `json:"publishAt"`
			} `json:"attributes"`
			Relationships []struct {
				Type string `json:"type"`
				ID   string `json:"id"`
			} `json:"relationships"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &res); err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	chapters := make([]map[string]any, 0, len(res.Data))
	for _, c := range res.Data {
		var group string
		for _, rel := range c.Relationships {
			if rel.Type == "scanlation_group" {
				gb, _ := mdFetch("/group/" + rel.ID)
				var gr struct {
					Data struct {
						Attributes struct {
							Name string `json:"name"`
						} `json:"attributes"`
					} `json:"data"`
				}
				json.Unmarshal(gb, &gr)
				group = gr.Data.Attributes.Name
				break
			}
		}
		uploaded := c.Attributes.PublishAt
		if len(uploaded) > 10 {
			uploaded = uploaded[:10]
		}
		chapters = append(chapters, map[string]any{
			"id":      c.ID,
			"chapter": c.Attributes.Chapter,
			"title":   c.Attributes.Title,
			"volume":  c.Attributes.Volume,
			"group":   group,
			"uploaded": uploaded,
		})
	}
	json.NewEncoder(w).Encode(chapters)
}

func (sh *ScraperHandlers) mdPages(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", 400)
		return
	}

	if entry, ok := getCachedAtHome(id); ok {
		pages := make([]string, len(entry.Data))
		for i, p := range entry.Data {
			pages[i] = fmt.Sprintf("%s/data/%s/%s", entry.BaseURL, entry.Hash, p)
		}
		json.NewEncoder(w).Encode(pages)
		return
	}

	atHomeData, err := mdFetch("/at-home/server/" + id)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	var atHome struct {
		Result  string `json:"result"`
		BaseURL string `json:"baseUrl"`
		Chapter struct {
			Hash string   `json:"hash"`
			Data []string `json:"data"`
		} `json:"chapter"`
	}
	if err := json.Unmarshal(atHomeData, &atHome); err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	if atHome.Result == "error" || atHome.BaseURL == "" {
		http.Error(w, "chapter not found or unavailable", 404)
		return
	}
	setCachedAtHome(id, atHomeCacheEntry{
		BaseURL: atHome.BaseURL,
		Hash:    atHome.Chapter.Hash,
		Data:    atHome.Chapter.Data,
		expires: time.Now().Add(1 * time.Hour),
	})
	pages := make([]string, len(atHome.Chapter.Data))
	for i, p := range atHome.Chapter.Data {
		pages[i] = fmt.Sprintf("%s/data/%s/%s", atHome.BaseURL, atHome.Chapter.Hash, p)
	}
	json.NewEncoder(w).Encode(pages)
}

func mdPickTitle(titles map[string]string) string {
	if v, ok := titles["vi"]; ok && v != "" {
		return v
	}
	if v, ok := titles["en"]; ok && v != "" {
		return v
	}
	for _, v := range titles {
		if v != "" {
			return v
		}
	}
	return ""
}

func mdFetch(path string) ([]byte, error) {
	u := path
	if !strings.HasPrefix(u, "http") {
		u = "https://api.mangadex.org" + path
	}
	resp, err := http.Get(u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

type mdSearchResp struct {
	Result string       `json:"result"`
	Data  []mdMangaData `json:"data"`
	Limit int          `json:"limit"`
	Total int          `json:"total"`
}

type mdMangaData struct {
	ID         string `json:"id"`
	Attributes struct {
		Title       map[string]string `json:"title"`
		Description map[string]string `json:"description"`
		Status      string            `json:"status"`
		Year        int               `json:"year"`
	} `json:"attributes"`
	Relationships []struct {
		ID         string                 `json:"id"`
		Type       string                 `json:"type"`
		Attributes map[string]interface{} `json:"attributes"`
	} `json:"relationships"`
}

// ---- E-Hentai ----

var (
	ehRateLimiter = newRateLimiter(6)
	ehReqMutex   sync.Mutex
	ehBanned     bool
	ehBannedTime time.Time
	ehReqCount   int
	ehReqWindow  time.Time
)

func isEHBanned() bool {
	ehReqMutex.Lock()
	defer ehReqMutex.Unlock()
	if !ehBannedTime.IsZero() && time.Since(ehBannedTime) > 5*time.Minute {
		ehBanned = false
		ehBannedTime = time.Time{}
	}
	return ehBanned
}

func recordEHReq(statusCode int) {
	ehReqMutex.Lock()
	defer ehReqMutex.Unlock()
	now := time.Now()
	if ehReqWindow.IsZero() || now.Sub(ehReqWindow) > time.Minute {
		ehReqWindow = now
		ehReqCount = 0
	}
	ehReqCount++
	if statusCode == 403 || statusCode == 429 || ehReqCount > 30 {
		ehBanned = true
		ehBannedTime = now
	}
}

func doEHRequest(client *http.Client, req *http.Request) (*http.Response, error) {
	ehRateLimiter.wait()
	ehReqMutex.Lock()
	resp, err := client.Do(req)
	recordEHReq(0)
	if resp != nil {
		recordEHReq(resp.StatusCode)
	}
	ehReqMutex.Unlock()
	return resp, err
}

// ehFetchHTML fetches a URL via cloak-proxy (if configured) or plain HTTP fallback.
func (sh *ScraperHandlers) ehFetchHTML(pageURL string) (string, error) {
	if sh.cloakURL != "" {
		payload, _ := json.Marshal(map[string]string{"url": pageURL})
		resp, err := http.Post(sh.cloakURL+"/fetch", "application/json", bytes.NewReader(payload))
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
	// Fallback: plain HTTP
	req, err := http.NewRequest("GET", pageURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.5")
	req.Header.Set("Cookie", "nw=1; sl=dm_2")
	req.Header.Set("Referer", "https://e-hentai.org/")
	resp, err := doEHRequest(sh.ehState.client, req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 403 || resp.StatusCode == 429 {
		recordEHReq(resp.StatusCode)
		return "", fmt.Errorf("E-Hentai rate limited (%d)", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	return string(body), nil
}

func (sh *ScraperHandlers) ehSearch(w http.ResponseWriter, r *http.Request) {
	if isEHBanned() {
		http.Error(w, "E-Hentai rate limited. Try again later.", 429)
		return
	}
	q := r.URL.Query().Get("q")
	if q == "" {
		http.Error(w, "missing q param", 400)
		return
	}
	page := r.URL.Query().Get("page")
	if page == "" {
		page = "0"
	}
	pageURL := fmt.Sprintf("https://e-hentai.org/?f_search=%s&page=%s", url.QueryEscape(q), page)

	bodyStr, err := sh.ehFetchHTML(pageURL)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}

	if strings.Contains(bodyStr, "banned") || strings.Contains(bodyStr, "429") {
		ehReqMutex.Lock()
		ehBanned = true
		ehBannedTime = time.Now()
		ehReqMutex.Unlock()
		http.Error(w, "E-Hentai IP banned", 429)
		return
	}

	doc, err := parseHTML(bodyStr)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}

	var results []map[string]any
	var nextPage int
	doc.Find(".itg.gltc tr").Each(func(i int, tr *goquery.Selection) {
		if i == 0 {
			tr.Find("td.ptds + td a").Each(func(_ int, a *goquery.Selection) {
				var p int
				fmt.Sscanf(a.Text(), "%d", &p)
				if p > nextPage {
					nextPage = p
				}
			})
			return
		}
		name := text(tr.Find(".glink").First().Text())
		if name == "" {
			return
		}
		link, _ := tr.Find(".gl3c.glname a").First().Attr("href")
		cover, _ := tr.Find(".glthumb img").Attr("data-src")
		if cover == "" {
			cover, _ = tr.Find(".glthumb img").Attr("src")
		}
		desc := text(tr.Find(".gl4c.glhide").First().Text())

		re := regexp.MustCompile(`/g/(\d+)/([a-z0-9]+)`)
		m := re.FindStringSubmatch(link)

		results = append(results, map[string]any{
			"id":    getOrEmpty(m, 1),
			"token": getOrEmpty(m, 2),
			"name":  name,
			"cover": cover,
			"tags":  desc,
			"link":  link,
		})
	})

	json.NewEncoder(w).Encode(map[string]any{"results": results, "nextPage": nextPage})
}

func (sh *ScraperHandlers) ehDetail(w http.ResponseWriter, r *http.Request) {
	if isEHBanned() {
		http.Error(w, "E-Hentai rate limited. Try again later.", 429)
		return
	}
	galleryURL := r.URL.Query().Get("url")
	if galleryURL == "" {
		http.Error(w, "missing url param", 400)
		return
	}

	bodyStr, err := sh.ehFetchHTML(galleryURL)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}

	if strings.Contains(bodyStr, "banned") || strings.Contains(bodyStr, "429 Too Many") {
		ehReqMutex.Lock()
		ehBanned = true
		ehBannedTime = time.Now()
		ehReqMutex.Unlock()
		http.Error(w, "E-Hentai IP banned", 429)
		return
	}

	doc, err := parseHTML(bodyStr)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}

	name := doc.Find("#gn").First().Text()
	uploader := ""
	doc.Find("#gdn a").Each(func(_ int, a *goquery.Selection) {
		if uploader == "" {
			uploader = a.Text()
		}
	})
	cover := ""
	doc.Find("#gd1").Each(func(_ int, s *goquery.Selection) {
		h, _ := s.Html()
		re := regexp.MustCompile(`url\((https?://[^)]+)\)`)
		m := re.FindStringSubmatch(h)
		if len(m) > 1 {
			cover = m[1]
		}
	})
	var tags, posted, lang, fileSize string
	var pages int
	doc.Find("#gdd table tr").Each(func(_ int, tr *goquery.Selection) {
		label := strings.TrimSpace(tr.Find(".gdt1").Text())
		val := strings.TrimSpace(tr.Find(".gdt2").Text())
		switch label {
		case "Posted:":
			posted = val
		case "Language:":
			lang = val
		case "File Size:":
			fileSize = val
		case "Length:":
			fmt.Sscanf(val, "%d pages", &pages)
		default:
			tags += label + ": " + val + "\n"
		}
	})
	re := regexp.MustCompile(`/g/(\d+)/([a-z0-9]+)`)
	m := re.FindStringSubmatch(galleryURL)

	json.NewEncoder(w).Encode(map[string]any{
		"id":        getOrEmpty(m, 1),
		"token":     getOrEmpty(m, 2),
		"name":      name,
		"cover":     cover,
		"uploader":  uploader,
		"tags":      tags,
		"posted":   posted,
		"language":  lang,
		"fileSize":  fileSize,
		"pages":     pages,
		"link":      galleryURL,
	})
}

func (sh *ScraperHandlers) ehPages(w http.ResponseWriter, r *http.Request) {
	galleryURL := r.URL.Query().Get("url")
	if galleryURL == "" {
		http.Error(w, "missing url param", 400)
		return
	}

	var allPages []map[string]any
	page := 0
	pageRe := regexp.MustCompile(`/s/([a-f0-9]+)/(\d+)-(\d+)`)

	for {
		pageURL := galleryURL
		if page > 0 {
			pageURL = fmt.Sprintf("%s/?p=%d", galleryURL, page)
		}

		bodyStr, err := sh.ehFetchHTML(pageURL)
		if err != nil {
			break
		}
		doc, err := parseHTML(bodyStr)
		if err != nil {
			break
		}

		hasAny := false
		doc.Find("#gdt a").Each(func(_ int, a *goquery.Selection) {
			href, _ := a.Attr("href")
			if pageRe.MatchString(href) {
				hasAny = true
				allPages = append(allPages, map[string]any{
					"index": len(allPages) + 1,
					"link":  href,
				})
			}
		})
		if !hasAny {
			break
		}
		page++
	}

	json.NewEncoder(w).Encode(allPages)
}

var ehImageLimiter = newRateLimiter(10)

func (sh *ScraperHandlers) ehImage(w http.ResponseWriter, r *http.Request) {
	imgURL := r.URL.Query().Get("url")
	if imgURL == "" {
		http.Error(w, "missing url param", 400)
		return
	}

	req, err := http.NewRequest("GET", imgURL, nil)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Referer", "https://e-hentai.org/")

	ehImageLimiter.wait()

	resp, err := sh.ehState.client.Do(req)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 403 || resp.StatusCode == 429 {
		recordEHReq(resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	contentType := resp.Header.Get("Content-Type")

	if !strings.Contains(contentType, "image") {
		imgRe := regexp.MustCompile(`id="img" src="([^"]+)"`)
		m := imgRe.FindStringSubmatch(string(body))
		if len(m) < 2 {
			http.Error(w, "no image found in response", 502)
			return
		}
		imgFullURL := m[1]
		imgReq, _ := http.NewRequest("GET", imgFullURL, nil)
		imgReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
		imgReq.Header.Set("Referer", "https://e-hentai.org/")
		imgResp, err := sh.ehState.client.Do(imgReq)
		if err != nil {
			http.Error(w, err.Error(), 502)
			return
		}
		defer imgResp.Body.Close()
		w.Header().Set("Content-Type", imgResp.Header.Get("Content-Type"))
		w.Header().Set("Cache-Control", "public, max-age=86400")
		io.Copy(w, imgResp.Body)
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.Write(body)
}

func getOrEmpty(m []string, i int) string {
	if len(m) > i {
		return m[i]
	}
	return ""
}

func text(html string) string {
	re := regexp.MustCompile(`<[^>]+>`)
	return strings.TrimSpace(re.ReplaceAllString(html, " "))
}

func parseHTML(html string) (*goquery.Document, error) {
	return goquery.NewDocumentFromReader(strings.NewReader(html))
}

func bytesToString(b []byte) string {
	return string(b)
}

// ---- At-Home Cache (1 hour TTL) ----
type atHomeCacheEntry struct {
	BaseURL string
	Hash    string
	Data    []string
	expires time.Time
}

var atHomeMu sync.RWMutex
var atHomeCache = make(map[string]atHomeCacheEntry)

func getCachedAtHome(id string) (atHomeCacheEntry, bool) {
	atHomeMu.RLock()
	defer atHomeMu.RUnlock()
	e, ok := atHomeCache[id]
	if ok && time.Now().Before(e.expires) {
		return e, true
	}
	return atHomeCacheEntry{}, false
}

func setCachedAtHome(id string, entry atHomeCacheEntry) {
	atHomeMu.Lock()
	defer atHomeMu.Unlock()
	entry.expires = time.Now().Add(1 * time.Hour)
	atHomeCache[id] = entry
}