package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	pg "cozyroom/internal/repository/postgres"
)

// ComicsDownloader discovers EH/MD covers every 6h, and downloads galleries/chapters
// on user request. Each download is routed through the cloak proxy (EH) or the
// MangaDex at-home CDN (MD).
type ComicsDownloader struct {
	db        *pg.ComicsDownloadsRepo
	comicsDir string
	maxBytes  int64
	eh        *EHCachedHandler
	ehLim     *RateLimiter // page-viewer fetches: 6/min
	mdLim     *RateLimiter // MD image downloads: 30/min
	ctx       context.Context
}

func newComicsDownloader(
	db *pg.ComicsDownloadsRepo,
	comicsDir string,
	maxGB int64,
	eh *EHCachedHandler,
) *ComicsDownloader {
	_ = os.MkdirAll(comicsDir, 0755)
	return &ComicsDownloader{
		db:        db,
		comicsDir: comicsDir,
		maxBytes:  maxGB * 1024 * 1024 * 1024,
		eh:        eh,
		ehLim:     newRateLimiter(6),
		mdLim:     newRateLimiter(30),
	}
}

// Start resets interrupted downloads, runs a one-time DB cleanup, runs one discovery
// cycle immediately, then repeats discovery every 6 hours.
func (d *ComicsDownloader) Start(ctx context.Context) {
	d.ctx = ctx
	d.db.CleanupV1()
	d.db.ResetDownloading()
	log.Printf("[comics] downloader started (comicsDir=%s maxGB=%d)", d.comicsDir, d.maxBytes>>30)
	d.discover(ctx)

	ticker := time.NewTicker(6 * time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			d.discover(ctx)
		}
	}
}

func (d *ComicsDownloader) discover(ctx context.Context) {
	log.Printf("[comics] discover cycle")
	d.discoverEH()
	d.discoverMD()
	go d.backfillMDCovers()
	// Only process items that were explicitly queued by the user (not auto-discovery)
	d.processQueue(ctx)
}

// ── Discovery (cover + metadata only, no auto-download) ──────────────────────

func (d *ComicsDownloader) discoverEH() {
	raw, err := d.eh.fetchEHLatest()
	if err != nil {
		log.Printf("[comics] discoverEH fetchLatest: %v", err)
		return
	}
	var resp struct {
		Results []struct {
			ID    string `json:"id"`
			Name  string `json:"name"`
			Cover string `json:"cover"`
			Token string `json:"token"`
		} `json:"results"`
	}
	if json.Unmarshal(raw, &resp) != nil {
		return
	}
	for _, r := range resp.Results {
		id := "eh_" + r.ID
		cover := r.Cover
		if raw, err := url.QueryUnescape(strings.TrimPrefix(cover, "/api/scraper/eh/image?url=")); err == nil && strings.HasPrefix(raw, "http") {
			cover = raw
		}
		d.db.InsertCover(pg.ComicsDownload{
			ID:     id,
			Source: "eh",
			Title:  r.Name,
			Cover:  cover,
			Token:  r.Token,
		})
	}
}

func (d *ComicsDownloader) discoverMD() {
	raw, err := mdFetch(
		"/manga?limit=20&order[latestUploadedChapter]=desc&includes[]=author&includes[]=cover_art" +
			"&contentRating[]=safe&contentRating[]=suggestive",
	)
	if err != nil {
		log.Printf("[comics] discoverMD fetch: %v", err)
		return
	}
	var resp struct {
		Data []struct {
			ID         string `json:"id"`
			Attributes struct {
				Title map[string]string `json:"title"`
			} `json:"attributes"`
			Relationships []struct {
				Type       string                 `json:"type"`
				ID         string                 `json:"id"`
				Attributes map[string]interface{} `json:"attributes"`
			} `json:"relationships"`
		} `json:"data"`
	}
	if json.Unmarshal(raw, &resp) != nil {
		return
	}
	for _, m := range resp.Data {
		id := "md_" + m.ID
		title := mdPickTitle(m.Attributes.Title)
		cover := ""
		for _, rel := range m.Relationships {
			if rel.Type == "cover_art" {
				if fn, ok := rel.Attributes["fileName"].(string); ok {
					cover = fmt.Sprintf("/api/scraper/md/img?url=%s",
						"https://uploads.mangadex.org/covers/"+m.ID+"/"+fn+".256.jpg")
				}
				break
			}
		}
		d.db.InsertCover(pg.ComicsDownload{
			ID:     id,
			Source: "md",
			Title:  title,
			Cover:  cover,
		})
	}
}

func (d *ComicsDownloader) backfillMDCovers() {
	entries, err := d.db.GetEmptyCover("md")
	if err != nil {
		log.Printf("[comics] backfillMDCovers query error: %v", err)
		return
	}
	if len(entries) == 0 {
		return
	}
	log.Printf("[comics] backfilling covers for %d MD entries", len(entries))
	for _, e := range entries {
		mangaID := strings.TrimPrefix(e.ID, "md_")
		raw, err := mdFetch("/manga/" + mangaID + "?includes[]=cover_art")
		if err != nil {
			continue
		}
		var resp struct {
			Data struct {
				Relationships []struct {
					Type       string                 `json:"type"`
					Attributes map[string]interface{} `json:"attributes"`
				} `json:"relationships"`
			} `json:"data"`
		}
		if json.Unmarshal(raw, &resp) != nil {
			continue
		}
		for _, rel := range resp.Data.Relationships {
			if rel.Type == "cover_art" {
				if fn, ok := rel.Attributes["fileName"].(string); ok {
					cover := fmt.Sprintf("/api/scraper/md/img?url=%s",
						"https://uploads.mangadex.org/covers/"+mangaID+"/"+fn+".256.jpg")
					d.db.UpdateCover(e.ID, cover)
				}
				break
			}
		}
		time.Sleep(200 * time.Millisecond)
	}
	log.Printf("[comics] cover backfill done")
}

// ── Queue processing ─────────────────────────────────────────────────────────

func (d *ComicsDownloader) processQueue(ctx context.Context) {
	queued, err := d.db.GetQueued()
	if err != nil || len(queued) == 0 {
		return
	}
	log.Printf("[comics] processing %d queued items", len(queued))
	for _, item := range queued {
		if ctx.Err() != nil {
			return
		}
		if d.overLimit() {
			log.Printf("[comics] disk limit reached, pausing queue")
			return
		}
		d.db.SetStatus(item.ID, "downloading", "")
		var dlErr error
		if item.Source == "eh" {
			dlErr = d.downloadEH(ctx, item)
		} else {
			dlErr = d.downloadMD(ctx, item)
		}
		if dlErr != nil {
			log.Printf("[comics] download %s failed: %v", item.ID, dlErr)
			d.db.SetStatus(item.ID, "failed", dlErr.Error())
		} else {
			d.db.SetStatus(item.ID, "done", "")
			log.Printf("[comics] done: %s", item.ID)
		}
	}
}

// ── EH download ──────────────────────────────────────────────────────────────

func (d *ComicsDownloader) downloadEH(ctx context.Context, item pg.ComicsDownload) error {
	gid := strings.TrimPrefix(item.ID, "eh_")

	pages, err := d.eh.fetchPagesViaAPI(gid, item.Token)
	if err != nil {
		return fmt.Errorf("fetchPages: %w", err)
	}
	if len(pages) == 0 {
		return fmt.Errorf("no pages found for gallery %s", gid)
	}

	localDir := filepath.Join(d.comicsDir, "eh", gid)
	if err := os.MkdirAll(localDir, 0755); err != nil {
		return err
	}
	d.db.SetLocalDir(item.ID, localDir)

	downloaded := 0
	for i, page := range pages {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		pageURL, _ := page["url"].(string)
		if pageURL == "" {
			continue
		}

		d.ehLim.wait()

		imgURL, err := d.eh.FetchImageURLFromPage(pageURL)
		if err != nil {
			log.Printf("[comics] EH page %d extract err: %v", i+1, err)
			continue
		}

		ext := filepath.Ext(imgURL)
		if ext == "" || len(ext) > 5 {
			ext = ".jpg"
		}
		destPath := filepath.Join(localDir, fmt.Sprintf("%04d%s", i+1, ext))

		data, err := d.eh.fetchImageViaProxy(imgURL)
		if err != nil {
			log.Printf("[comics] EH img %d proxy err: %v", i+1, err)
			continue
		}
		if err := os.WriteFile(destPath, data, 0644); err != nil {
			log.Printf("[comics] EH img %d write err: %v", i+1, err)
			continue
		}
		if !verifyImage(destPath) {
			log.Printf("[comics] EH img %d failed verification, removing", i+1)
			os.Remove(destPath)
			continue
		}

		downloaded++
		d.db.SetProgress(item.ID, downloaded, len(pages))
	}

	if downloaded == 0 {
		return fmt.Errorf("all %d pages failed to download (proxy may lack EH session)", len(pages))
	}
	return nil
}

// ── MD download (all chapters) ───────────────────────────────────────────────

func (d *ComicsDownloader) downloadMD(ctx context.Context, item pg.ComicsDownload) error {
	mangaID := strings.TrimPrefix(item.ID, "md_")

	// Fetch full chapter list (paginate)
	type chapterInfo struct {
		id   string
		num  string
		lang string
	}
	var chapters []chapterInfo

	offset := 0
	for {
		chapData, err := mdFetch(fmt.Sprintf(
			"/chapter?manga=%s&limit=100&offset=%d&translatedLanguage[]=vi&translatedLanguage[]=en&order[chapter]=asc",
			mangaID, offset,
		))
		if err != nil {
			return fmt.Errorf("fetch chapters: %w", err)
		}
		var chapResp struct {
			Data []struct {
				ID         string `json:"id"`
				Attributes struct {
					Chapter         string `json:"chapter"`
					TranslatedLang  string `json:"translatedLanguage"`
				} `json:"attributes"`
			} `json:"data"`
			Total int `json:"total"`
		}
		if json.Unmarshal(chapData, &chapResp) != nil || len(chapResp.Data) == 0 {
			break
		}
		for _, c := range chapResp.Data {
			chapters = append(chapters, chapterInfo{
				id:   c.ID,
				num:  c.Attributes.Chapter,
				lang: c.Attributes.TranslatedLang,
			})
		}
		offset += len(chapResp.Data)
		if offset >= chapResp.Total {
			break
		}
	}

	if len(chapters) == 0 {
		return fmt.Errorf("no chapters found for manga %s", mangaID)
	}

	mangaDir := filepath.Join(d.comicsDir, "md", mangaID)
	if err := os.MkdirAll(mangaDir, 0755); err != nil {
		return err
	}
	d.db.SetLocalDir(item.ID, mangaDir)

	totalDownloaded := 0
	// Count total pages across all chapters (estimated; update as we go)
	totalPages := 0

	for ci, ch := range chapters {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if d.overLimit() {
			log.Printf("[comics] MD disk limit reached after chapter %d", ci+1)
			break
		}

		atHomeData, err := mdFetch("/at-home/server/" + ch.id)
		if err != nil {
			log.Printf("[comics] MD ch %s at-home err: %v", ch.id, err)
			continue
		}
		var atHome struct {
			BaseURL string `json:"baseUrl"`
			Chapter struct {
				Hash string   `json:"hash"`
				Data []string `json:"data"`
			} `json:"chapter"`
		}
		if json.Unmarshal(atHomeData, &atHome) != nil || atHome.BaseURL == "" {
			log.Printf("[comics] MD ch %s invalid at-home response", ch.id)
			continue
		}

		chDir := filepath.Join(mangaDir, ch.id)
		if err := os.MkdirAll(chDir, 0755); err != nil {
			log.Printf("[comics] MD ch %s mkdir err: %v", ch.id, err)
			continue
		}

		pages := atHome.Chapter.Data
		totalPages += len(pages)

		for i, filename := range pages {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			d.mdLim.wait()

			imgURL := fmt.Sprintf("%s/data/%s/%s", atHome.BaseURL, atHome.Chapter.Hash, filename)
			ext := filepath.Ext(filename)
			if ext == "" {
				ext = ".jpg"
			}
			destPath := filepath.Join(chDir, fmt.Sprintf("%04d%s", i+1, ext))

			if err := downloadFile(imgURL, destPath, "https://mangadex.org/"); err != nil {
				log.Printf("[comics] MD img %s/%d download err: %v", ch.id, i+1, err)
				continue
			}
			if !verifyImage(destPath) {
				log.Printf("[comics] MD img %s/%d failed verification, removing", ch.id, i+1)
				os.Remove(destPath)
				continue
			}

			totalDownloaded++
			d.db.SetProgress(item.ID, totalDownloaded, totalPages)
		}

		log.Printf("[comics] MD manga %s chapter %d/%d (%s) done", mangaID, ci+1, len(chapters), ch.num)
	}

	if totalDownloaded == 0 {
		return fmt.Errorf("all pages failed to download for manga %s", mangaID)
	}
	return nil
}

// ── Image verification ────────────────────────────────────────────────────────

// verifyImage returns true if the file exists, is at least 1KB, and starts with
// a valid JPEG (FFD8) or PNG (89504E47) magic signature.
func verifyImage(path string) bool {
	f, err := os.Open(path)
	if err != nil {
		return false
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil || info.Size() < 1024 {
		return false
	}

	header := make([]byte, 4)
	if _, err := io.ReadFull(f, header); err != nil {
		return false
	}

	isJPEG := header[0] == 0xFF && header[1] == 0xD8
	isPNG := header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47
	isWEBP := false // webp has RIFF header, check separately
	if len(header) >= 4 && header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46 {
		isWEBP = true
	}

	return isJPEG || isPNG || isWEBP
}

// ── Disk limit ────────────────────────────────────────────────────────────────

func (d *ComicsDownloader) overLimit() bool {
	if d.maxBytes <= 0 {
		return false
	}
	var size int64
	filepath.Walk(d.comicsDir, func(_ string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			size += info.Size()
		}
		return nil
	})
	return size >= d.maxBytes
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────

func (d *ComicsDownloader) listDownloads(w http.ResponseWriter, r *http.Request) {
	items, err := d.db.GetAll()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	if items == nil {
		items = []pg.ComicsDownload{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func (d *ComicsDownloader) deleteDownload(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	item, err := d.db.GetByID(id)
	if err != nil || item == nil {
		http.NotFound(w, r)
		return
	}
	if item.LocalDir != "" {
		os.RemoveAll(item.LocalDir)
	}
	d.db.Delete(id)
	w.WriteHeader(http.StatusNoContent)
}

func (d *ComicsDownloader) retryDownload(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	item, err := d.db.GetByID(id)
	if err != nil || item == nil {
		http.NotFound(w, r)
		return
	}
	if err := d.db.Requeue(id); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	ctx := d.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	go d.processQueue(ctx)
	w.WriteHeader(http.StatusNoContent)
}

// enqueueEH queues a specific EH gallery for download.
// POST /api/scraper/enqueue/eh/{gid}/{token}
func (d *ComicsDownloader) enqueueEH(w http.ResponseWriter, r *http.Request) {
	gid := r.PathValue("gid")
	token := r.PathValue("token")
	if gid == "" || token == "" {
		http.Error(w, "missing gid or token", 400)
		return
	}
	id := "eh_" + gid

	existing, _ := d.db.GetByID(id)
	title := gid
	cover := ""
	if existing != nil {
		if existing.Status == "done" || existing.Status == "downloading" || existing.Status == "queued" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		title = existing.Title
		cover = existing.Cover
	}

	if err := d.db.Enqueue(pg.ComicsDownload{
		ID:     id,
		Source: "eh",
		Title:  title,
		Cover:  cover,
		Token:  token,
	}); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	ctx := d.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	go d.processQueue(ctx)
	w.WriteHeader(http.StatusNoContent)
}

// enqueueMD queues all chapters of a MangaDex manga for download.
// POST /api/scraper/enqueue/md/{mangaId}
func (d *ComicsDownloader) enqueueMD(w http.ResponseWriter, r *http.Request) {
	mangaID := r.PathValue("mangaId")
	if mangaID == "" {
		http.Error(w, "missing mangaId", 400)
		return
	}
	id := "md_" + mangaID

	existing, _ := d.db.GetByID(id)
	if existing != nil && (existing.Status == "done" || existing.Status == "downloading" || existing.Status == "queued") {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	title := mangaID
	cover := ""
	if existing != nil {
		title = existing.Title
		cover = existing.Cover
	}

	if err := d.db.Enqueue(pg.ComicsDownload{
		ID:     id,
		Source: "md",
		Title:  title,
		Cover:  cover,
	}); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	ctx := d.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	go d.processQueue(ctx)
	w.WriteHeader(http.StatusNoContent)
}

// serveLocalFile serves a downloaded image file. For MD manga the file parameter
// includes the chapter subdirectory, e.g. "chapterID/0001.jpg".
// The filename is always requested as .jpg but the handler globs for any extension,
// so webp/png downloads are served transparently.
func (d *ComicsDownloader) serveLocalFile(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	file := r.PathValue("file")

	item, err := d.db.GetByID(id)
	if err != nil || item == nil || item.LocalDir == "" {
		http.NotFound(w, r)
		return
	}

	// Allow one level of subdirectory (chapter subdirs for MD)
	clean := filepath.Clean(file)
	if strings.Contains(clean, "..") {
		http.Error(w, "forbidden", 403)
		return
	}
	exact := filepath.Join(item.LocalDir, clean)

	if _, statErr := os.Stat(exact); statErr == nil {
		w.Header().Set("Cache-Control", "public, max-age=604800")
		http.ServeFile(w, r, exact)
		return
	}

	// Strip extension and try any extension (handles webp/png saved as .jpg request)
	base := strings.TrimSuffix(clean, filepath.Ext(clean))
	matches, _ := filepath.Glob(filepath.Join(item.LocalDir, base+".*"))
	if len(matches) > 0 {
		w.Header().Set("Cache-Control", "public, max-age=604800")
		http.ServeFile(w, r, matches[0])
		return
	}

	http.NotFound(w, r)
}

// listChapters returns chapter subdirectories for a downloaded MD manga.
// GET /api/scraper/local/{id}/chapters
func (d *ComicsDownloader) listChapters(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	item, err := d.db.GetByID(id)
	if err != nil || item == nil || item.LocalDir == "" || item.Source != "md" {
		http.NotFound(w, r)
		return
	}

	entries, err := os.ReadDir(item.LocalDir)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	var chapters []map[string]any
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		// Count image files in chapter dir
		chDir := filepath.Join(item.LocalDir, e.Name())
		imgs, _ := filepath.Glob(filepath.Join(chDir, "*.*"))
		chapters = append(chapters, map[string]any{
			"id":         e.Name(),
			"page_count": len(imgs),
		})
	}
	if chapters == nil {
		chapters = []map[string]any{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(chapters)
}

// ── Shared helpers ────────────────────────────────────────────────────────────

func downloadFile(url, destPath, referer string) error {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	if referer != "" {
		req.Header.Set("Referer", referer)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	f, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, resp.Body)
	return err
}
