package api

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

type epubPageInfo struct {
	Index int    `json:"index"`
	Type  string `json:"type"` // "image" or "html"
}

func (h *handlers) ebookPages(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ebook, err := h.ebook.GetEbookByID(r.Context(), id)
	if err != nil || ebook == nil {
		http.NotFound(w, r)
		return
	}
	if ebook.Format != "epub" {
		http.Error(w, "not an epub", http.StatusBadRequest)
		return
	}
	pages, err := listEpubPages(ebook.FilePath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pages)
}

func (h *handlers) ebookPage(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	n, err := strconv.Atoi(r.PathValue("n"))
	if err != nil || n < 0 {
		http.Error(w, "invalid page", http.StatusBadRequest)
		return
	}
	ebook, err := h.ebook.GetEbookByID(r.Context(), id)
	if err != nil || ebook == nil {
		http.NotFound(w, r)
		return
	}
	data, ct, err := serveEpubPage(ebook.FilePath, n, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Write(data)
}

func (h *handlers) ebookAsset(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	assetPath := r.URL.Query().Get("path")
	if assetPath == "" {
		http.Error(w, "missing path", http.StatusBadRequest)
		return
	}
	ebook, err := h.ebook.GetEbookByID(r.Context(), id)
	if err != nil || ebook == nil {
		http.NotFound(w, r)
		return
	}
	zr, err := zip.OpenReader(ebook.FilePath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer zr.Close()
	data, err := readFromEpub(buildEpubFileMap(zr.File), assetPath)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", mimeByExt(filepath.Ext(assetPath)))
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Write(data)
}

// --- epub parsing ---

var (
	reEpubViewport = regexp.MustCompile(`(?i)name="viewport"[^>]*content="[^"]*width\s*=\s*\d+`)
	reEpubImgSrc   = regexp.MustCompile(`(?i)<img[^>]+src=["']([^"'#?]+)["']`)
	reSvgImageHref = regexp.MustCompile(`(?i)<image[^>]+(?:href|xlink:href)=["']([^"'#?]+)["']`)
)

func listEpubPages(epubPath string) ([]epubPageInfo, error) {
	r, err := zip.OpenReader(epubPath)
	if err != nil {
		return nil, err
	}
	defer r.Close()

	fileMap := buildEpubFileMap(r.File)
	spine, err := parseEpubSpine(fileMap)
	if err != nil {
		return nil, err
	}

	pages := make([]epubPageInfo, len(spine))
	for i, zipPath := range spine {
		pageType := "html"
		b, err := readFromEpub(fileMap, zipPath)
		if err == nil && epubHasImgRef(b) {
			if reEpubViewport.Match(b) || epubBodyIsImageOnly(epubExtractBody(string(b))) {
				pageType = "image"
			}
		}
		pages[i] = epubPageInfo{Index: i, Type: pageType}
	}
	return pages, nil
}

func serveEpubPage(epubPath string, n int, ebookID string) ([]byte, string, error) {
	r, err := zip.OpenReader(epubPath)
	if err != nil {
		return nil, "", err
	}
	defer r.Close()

	fileMap := buildEpubFileMap(r.File)
	spine, err := parseEpubSpine(fileMap)
	if err != nil {
		return nil, "", err
	}
	if n >= len(spine) {
		return nil, "", fmt.Errorf("page %d out of range (total %d)", n, len(spine))
	}

	zipPath := spine[n]
	b, err := readFromEpub(fileMap, zipPath)
	if err != nil {
		return nil, "", err
	}

	// Fixed-layout page: extract and serve the embedded image directly
	if reEpubViewport.Match(b) {
		if imgZipPath := epubResolveImgPath(b, zipPath); imgZipPath != "" {
			imgBytes, err := readFromEpub(fileMap, imgZipPath)
			if err == nil {
				return imgBytes, mimeByExt(filepath.Ext(imgZipPath)), nil
			}
		}
	}

	// Reflowable HTML: return the <body> inner content with img src rewritten
	body := epubExtractBody(string(b))

	// Fallback: body contains only an image reference (no viewport meta, but still an image page)
	if epubBodyIsImageOnly(body) {
		if imgZipPath := epubResolveImgPath(b, zipPath); imgZipPath != "" {
			imgBytes, err := readFromEpub(fileMap, imgZipPath)
			if err == nil {
				return imgBytes, mimeByExt(filepath.Ext(imgZipPath)), nil
			}
		}
	}

	body = rewriteEpubImgSrc(body, zipPath, ebookID)
	return []byte(body), "text/html; charset=utf-8", nil
}

// rewriteEpubImgSrc rewrites relative img src paths in body HTML to server asset URLs.
func rewriteEpubImgSrc(body, pageZipPath, ebookID string) string {
	dir := filepath.ToSlash(filepath.Dir(pageZipPath))
	resolve := func(rel string) string {
		rel, _ = url.PathUnescape(rel)
		zipPath := filepath.ToSlash(filepath.Join(dir, rel))
		return "/api/ebooks/" + ebookID + "/asset?path=" + url.QueryEscape(zipPath)
	}
	body = reEpubImgSrc.ReplaceAllStringFunc(body, func(tag string) string {
		m := reEpubImgSrc.FindStringSubmatch(tag)
		if len(m) < 2 {
			return tag
		}
		return strings.Replace(tag, m[1], resolve(m[1]), 1)
	})
	body = reSvgImageHref.ReplaceAllStringFunc(body, func(tag string) string {
		m := reSvgImageHref.FindStringSubmatch(tag)
		if len(m) < 2 {
			return tag
		}
		return strings.Replace(tag, m[1], resolve(m[1]), 1)
	})
	return body
}

// epubBodyIsImageOnly returns true when the body fragment contains an image
// reference but no meaningful text — handles KCC pages without viewport meta.
func epubBodyIsImageOnly(body string) bool {
	if !reEpubImgSrc.MatchString(body) && !reSvgImageHref.MatchString(body) {
		return false
	}
	// Strip all tags, collapse whitespace; if nothing remains it's image-only.
	reTag := regexp.MustCompile(`<[^>]+>`)
	text := strings.TrimSpace(reTag.ReplaceAllString(body, ""))
	return text == ""
}

func epubHasImgRef(b []byte) bool {
	return reEpubImgSrc.Match(b) || reSvgImageHref.Match(b)
}

func epubResolveImgPath(b []byte, pageZipPath string) string {
	var rel string
	if m := reEpubImgSrc.FindSubmatch(b); len(m) > 1 {
		rel = string(m[1])
	} else if m := reSvgImageHref.FindSubmatch(b); len(m) > 1 {
		rel = string(m[1])
	}
	if rel == "" {
		return ""
	}
	rel, _ = url.PathUnescape(rel)
	dir := filepath.ToSlash(filepath.Dir(pageZipPath))
	return filepath.ToSlash(filepath.Join(dir, rel))
}

func epubExtractBody(html string) string {
	low := strings.ToLower(html)
	bodyStart := strings.Index(low, "<body")
	if bodyStart < 0 {
		return html
	}
	closeTag := strings.Index(html[bodyStart:], ">")
	if closeTag < 0 {
		return html
	}
	contentStart := bodyStart + closeTag + 1
	bodyEnd := strings.LastIndex(low, "</body>")
	if bodyEnd <= contentStart {
		return html[contentStart:]
	}
	return html[contentStart:bodyEnd]
}

// --- zip helpers ---

func buildEpubFileMap(files []*zip.File) map[string]*zip.File {
	m := make(map[string]*zip.File, len(files))
	for _, f := range files {
		m[f.Name] = f
	}
	return m
}

func readFromEpub(fileMap map[string]*zip.File, name string) ([]byte, error) {
	f, ok := fileMap[name]
	if !ok {
		return nil, fmt.Errorf("not found in epub: %s", name)
	}
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	return io.ReadAll(rc)
}

func parseEpubSpine(fileMap map[string]*zip.File) ([]string, error) {
	containerBytes, err := readFromEpub(fileMap, "META-INF/container.xml")
	if err != nil {
		return nil, fmt.Errorf("container.xml missing from epub")
	}

	reOPF := regexp.MustCompile(`full-path="([^"]+)"`)
	m := reOPF.FindSubmatch(containerBytes)
	if len(m) < 2 {
		return nil, fmt.Errorf("OPF path not found in container.xml")
	}
	opfPath := string(m[1])
	opfDir := filepath.ToSlash(filepath.Dir(opfPath))
	if opfDir == "." {
		opfDir = ""
	}

	opfBytes, err := readFromEpub(fileMap, opfPath)
	if err != nil {
		return nil, fmt.Errorf("OPF file not found: %s", opfPath)
	}

	// Build manifest: item id -> resolved zip path
	reItem := regexp.MustCompile(`(?i)<item\s[^>]*\bid="([^"]+)"[^>]*\bhref="([^"]+)"`)
	manifest := make(map[string]string)
	for _, match := range reItem.FindAllSubmatch(opfBytes, -1) {
		itemID := string(match[1])
		href := string(match[2])
		href, _ = url.PathUnescape(href)
		if opfDir != "" {
			href = opfDir + "/" + href
		}
		manifest[itemID] = href
	}

	// Parse spine order
	reSpine := regexp.MustCompile(`(?is)<spine[^>]*>(.*?)</spine>`)
	reItemRef := regexp.MustCompile(`(?i)<itemref[^>]+\bidref="([^"]+)"`)

	sc := reSpine.FindSubmatch(opfBytes)
	if len(sc) < 2 {
		return nil, fmt.Errorf("spine not found in OPF")
	}

	var spine []string
	for _, mr := range reItemRef.FindAllSubmatch(sc[1], -1) {
		idref := string(mr[1])
		if href, ok := manifest[idref]; ok {
			spine = append(spine, href)
		}
	}
	return spine, nil
}

// TocEntry is one chapter entry in the table of contents.
type TocEntry struct {
	Label      string `json:"label"`
	SpineIndex int    `json:"spineIndex"`
}

func (h *handlers) ebookTOC(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ebook, err := h.ebook.GetEbookByID(r.Context(), id)
	if err != nil || ebook == nil {
		http.NotFound(w, r)
		return
	}
	if ebook.Format != "epub" {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("[]"))
		return
	}
	entries, err := parseTOC(ebook.FilePath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if entries == nil {
		entries = []TocEntry{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

func parseTOC(epubPath string) ([]TocEntry, error) {
	r, err := zip.OpenReader(epubPath)
	if err != nil {
		return nil, err
	}
	defer r.Close()

	fileMap := buildEpubFileMap(r.File)
	spine, err := parseEpubSpine(fileMap)
	if err != nil {
		return nil, err
	}

	spineIdx := make(map[string]int, len(spine))
	for i, p := range spine {
		spineIdx[p] = i
	}

	containerBytes, err := readFromEpub(fileMap, "META-INF/container.xml")
	if err != nil {
		return nil, err
	}
	reOPF := regexp.MustCompile(`full-path="([^"]+)"`)
	m := reOPF.FindSubmatch(containerBytes)
	if len(m) < 2 {
		return nil, fmt.Errorf("OPF path not found")
	}
	opfPath := string(m[1])
	opfDir := filepath.ToSlash(filepath.Dir(opfPath))
	if opfDir == "." {
		opfDir = ""
	}

	opfBytes, err := readFromEpub(fileMap, opfPath)
	if err != nil {
		return nil, err
	}

	resolve := func(href, baseDir string) string {
		href, _ = url.PathUnescape(href)
		if i := strings.Index(href, "#"); i >= 0 {
			href = href[:i]
		}
		href = strings.TrimSpace(href)
		if href == "" {
			return ""
		}
		if baseDir != "" {
			return filepath.ToSlash(filepath.Join(baseDir, href))
		}
		return href
	}

	// Try EPUB3 nav document first
	reNavProp := regexp.MustCompile(`(?i)<item\s[^>]*(?:properties="[^"]*\bnav\b[^"]*"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*properties="[^"]*\bnav\b[^"]*")`)
	if nm := reNavProp.FindSubmatch(opfBytes); len(nm) > 1 {
		navHref := string(nm[1])
		if navHref == "" {
			navHref = string(nm[2])
		}
		navZipPath := resolve(navHref, opfDir)
		navDir := filepath.ToSlash(filepath.Dir(navZipPath))
		if navDir == "." {
			navDir = ""
		}
		if entries := parseNavXHTML(fileMap, navZipPath, navDir, spineIdx, resolve); len(entries) > 0 {
			return entries, nil
		}
	}

	// Fall back to EPUB2 NCX
	reNCXMedia := regexp.MustCompile(`(?i)<item\s[^>]*(?:media-type="application/x-dtbncx\+xml"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*media-type="application/x-dtbncx\+xml")`)
	if nm := reNCXMedia.FindSubmatch(opfBytes); len(nm) > 1 {
		ncxHref := string(nm[1])
		if ncxHref == "" {
			ncxHref = string(nm[2])
		}
		ncxZipPath := resolve(ncxHref, opfDir)
		ncxDir := filepath.ToSlash(filepath.Dir(ncxZipPath))
		if ncxDir == "." {
			ncxDir = ""
		}
		if entries := parseNCX(fileMap, ncxZipPath, ncxDir, spineIdx, resolve); len(entries) > 0 {
			return entries, nil
		}
	}

	return nil, nil
}

func parseNavXHTML(fileMap map[string]*zip.File, navPath, navDir string, spineIdx map[string]int, resolve func(string, string) string) []TocEntry {
	b, err := readFromEpub(fileMap, navPath)
	if err != nil {
		return nil
	}

	reTocNav := regexp.MustCompile(`(?is)<nav[^>]+epub:type=["'][^"']*\btoc\b[^"']*["'][^>]*>(.*?)</nav>`)
	sec := reTocNav.FindSubmatch(b)
	if sec == nil {
		reTocNav2 := regexp.MustCompile(`(?is)<nav[^>]+type=["'][^"']*\btoc\b[^"']*["'][^>]*>(.*?)</nav>`)
		sec = reTocNav2.FindSubmatch(b)
	}
	if sec == nil {
		return nil
	}

	reAnchor := regexp.MustCompile(`(?is)<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)</a>`)
	reTag := regexp.MustCompile(`<[^>]+>`)
	var entries []TocEntry
	seen := make(map[int]bool)
	for _, m := range reAnchor.FindAllSubmatch(sec[1], -1) {
		href := string(m[1])
		label := strings.TrimSpace(reTag.ReplaceAllString(string(m[2]), ""))
		if label == "" || href == "" {
			continue
		}
		zipPath := resolve(href, navDir)
		idx, ok := spineIdx[zipPath]
		if !ok || seen[idx] {
			continue
		}
		seen[idx] = true
		entries = append(entries, TocEntry{Label: label, SpineIndex: idx})
	}
	return entries
}

func parseNCX(fileMap map[string]*zip.File, ncxPath, ncxDir string, spineIdx map[string]int, resolve func(string, string) string) []TocEntry {
	b, err := readFromEpub(fileMap, ncxPath)
	if err != nil {
		return nil
	}

	reNavLabel := regexp.MustCompile(`(?is)<navLabel[^>]*>\s*<text[^>]*>(.*?)</text>`)
	reContentSrc := regexp.MustCompile(`(?i)<content[^>]+src=["']([^"']+)["']`)
	reTag := regexp.MustCompile(`<[^>]+>`)

	labels := reNavLabel.FindAllSubmatch(b, -1)
	srcs := reContentSrc.FindAllSubmatch(b, -1)
	count := len(labels)
	if len(srcs) < count {
		count = len(srcs)
	}

	var entries []TocEntry
	seen := make(map[int]bool)
	for i := 0; i < count; i++ {
		label := strings.TrimSpace(reTag.ReplaceAllString(string(labels[i][1]), ""))
		src := string(srcs[i][1])
		if label == "" || src == "" {
			continue
		}
		zipPath := resolve(src, ncxDir)
		idx, ok := spineIdx[zipPath]
		if !ok || seen[idx] {
			continue
		}
		seen[idx] = true
		entries = append(entries, TocEntry{Label: label, SpineIndex: idx})
	}
	return entries
}

func mimeByExt(ext string) string {
	ext = strings.ToLower(ext)
	if t := mime.TypeByExtension(ext); t != "" {
		return t
	}
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	}
	return "application/octet-stream"
}
