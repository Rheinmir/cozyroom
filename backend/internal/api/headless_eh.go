package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/chromedp/chromedp"
	"github.com/PuerkitoBio/goquery"
)

type HeadlessEHPool struct {
	allocCtx   context.Context
	allocCancel context.CancelFunc
	rateMu     sync.Mutex
	rateTime   time.Time
	delay      time.Duration
	banned     bool
	bannedTime time.Time
	bannedMu   sync.Mutex
}

func NewHeadlessEHPool() *HeadlessEHPool {
	ctx, cancel := chromedp.NewExecAllocator(context.Background(),
		chromedp.Flag("headless", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-setuid-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("disable-background-networking", true),
		chromedp.Flag("disable-sync", true),
		chromedp.Flag("disable-translate", true),
		chromedp.Flag("hide-scrollbars", true),
		chromedp.Flag("mute-audio", true),
	)
	return &HeadlessEHPool{
		allocCtx:   ctx,
		allocCancel: cancel,
		delay:      6 * time.Second,
	}
}

func (p *HeadlessEHPool) isBanned() bool {
	p.bannedMu.Lock()
	defer p.bannedMu.Unlock()
	if p.banned && time.Since(p.bannedTime) > 5*time.Minute {
		p.banned = false
	}
	return p.banned
}

func (p *HeadlessEHPool) markBanned() {
	p.bannedMu.Lock()
	defer p.bannedMu.Unlock()
	p.banned = true
	p.bannedTime = time.Now()
}

func (p *HeadlessEHPool) waitRate() {
	p.bannedMu.Lock()
	if p.banned {
		sleepTime := 5*time.Minute - time.Since(p.bannedTime)
		if sleepTime > 0 {
			p.bannedMu.Unlock()
			time.Sleep(sleepTime)
			p.bannedMu.Lock()
			p.banned = false
		} else {
			p.banned = false
		}
	}
	p.bannedMu.Unlock()

	p.rateMu.Lock()
	defer p.rateMu.Unlock()
	if !p.rateTime.IsZero() {
		elapsed := time.Since(p.rateTime)
		if elapsed < p.delay {
			time.Sleep(p.delay - elapsed)
		}
	}
	p.rateTime = time.Now()
}

func (p *HeadlessEHPool) fetchHTML(url string) (string, error) {
	p.waitRate()

	ctx, cancel := chromedp.NewContext(p.allocCtx)
	defer cancel()

	tctx, tcancel := context.WithTimeout(ctx, 60*time.Second)
	defer tcancel()

	var html string
	err := chromedp.Run(tctx,
		chromedp.Navigate(url),
		chromedp.Sleep(3*time.Second),
		chromedp.Sleep(5*time.Second),
		chromedp.Evaluate(`document.documentElement.outerHTML`, &html),
	)
	if err != nil {
		return "", fmt.Errorf("headless fetch: %w", err)
	}
	return html, nil
}

func (p *HeadlessEHPool) close() {
	p.allocCancel()
}

type HeadlessHandler struct {
	pool *HeadlessEHPool
}

func NewHeadlessHandler() *HeadlessHandler {
	return &HeadlessHandler{
		pool: NewHeadlessEHPool(),
	}
}

func (h *HeadlessHandler) ehSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		http.Error(w, "missing q param", 400)
		return
	}
	page := r.URL.Query().Get("page")
	if page == "" {
		page = "0"
	}

	url := fmt.Sprintf("https://e-hentai.org/?f_search=%s&page=%s", strings.ReplaceAll(q, " ", "+"), page)

	html, err := h.pool.fetchHTML(url)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}

	bodyStr := string([]byte(html))
	if strings.Contains(bodyStr, "banned") || strings.Contains(bodyStr, "429") {
		h.pool.markBanned()
		http.Error(w, "E-Hentai rate limited", 429)
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

func (h *HeadlessHandler) ehDetail(w http.ResponseWriter, r *http.Request) {
	galleryURL := r.URL.Query().Get("url")
	if galleryURL == "" {
		http.Error(w, "missing url param", 400)
		return
	}

	html, err := h.pool.fetchHTML(galleryURL)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}

	bodyStr := string([]byte(html))
	if strings.Contains(bodyStr, "banned") || strings.Contains(bodyStr, "429") {
		h.pool.markBanned()
		http.Error(w, "E-Hentai rate limited", 429)
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
		"posted":    posted,
		"language":  lang,
		"fileSize":  fileSize,
		"pages":     pages,
		"link":      galleryURL,
	})
}

func (h *HeadlessHandler) ehPages(w http.ResponseWriter, r *http.Request) {
	galleryURL := r.URL.Query().Get("url")
	if galleryURL == "" {
		http.Error(w, "missing url param", 400)
		return
	}

	html, err := h.pool.fetchHTML(galleryURL)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}

	bodyStr := string(html)
	if strings.Contains(bodyStr, "banned") || strings.Contains(bodyStr, "429") {
		h.pool.markBanned()
		http.Error(w, "E-Hentai rate limited", 429)
		return
	}

	doc, err := parseHTML(bodyStr)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}

	var allPages []map[string]any
	pageRe := regexp.MustCompile(`/s/([a-f0-9]+)/(\d+)-(\d+)`)
	doc.Find("#gdt a").Each(func(_ int, a *goquery.Selection) {
		href, _ := a.Attr("href")
		if pageRe.MatchString(href) {
			allPages = append(allPages, map[string]any{
				"index": len(allPages) + 1,
				"link":  href,
			})
		}
	})

	json.NewEncoder(w).Encode(allPages)
}

func (h *HeadlessHandler) Close() {
	h.pool.close()
}