package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"cozyroom/internal/metrics"

	"github.com/dhowden/tag"
)

type LyricLine struct {
	Time float64 `json:"time"`
	Text string  `json:"text"`
}

type LyricsResp struct {
	Synced []LyricLine `json:"synced"`
	Plain  string      `json:"plain"`
	Source string      `json:"source"`
}

type SourceInfo struct {
	Source string `json:"source"`
	Found  bool   `json:"found"`
	Lines  int    `json:"lines"`
	Err    string `json:"err,omitempty"`
}

type LyricsMultiResp struct {
	Results []LyricsResp `json:"results"`
	Sources []SourceInfo `json:"sources"`
	Cached  bool         `json:"cached"`
}

// stripInlineTags removes Enhanced LRC word-level timestamps (<MM:SS.cc>) from text
// and returns the first timestamp found (-1 if none).
func stripInlineTags(text string) (firstTime float64, clean string) {
	firstTime = -1
	var sb strings.Builder
	rest := text
	for {
		start := strings.Index(rest, "<")
		if start < 0 {
			sb.WriteString(rest)
			break
		}
		end := strings.Index(rest[start:], ">")
		if end < 0 {
			sb.WriteString(rest)
			break
		}
		end += start
		sb.WriteString(rest[:start])
		inner := rest[start+1 : end]
		colon := strings.Index(inner, ":")
		dot := strings.Index(inner, ".")
		if colon >= 0 && dot > colon {
			min, err1 := strconv.ParseFloat(inner[:colon], 64)
			sec, err2 := strconv.ParseFloat(inner[colon+1:dot], 64)
			fracStr := inner[dot+1:]
			frac, _ := strconv.ParseFloat(fracStr, 64)
			if len(fracStr) == 3 {
				frac /= 10
			}
			if err1 == nil && err2 == nil && firstTime < 0 {
				firstTime = min*60 + sec + frac/100
			}
			// valid timestamp tag — drop it (don't write to sb)
		} else {
			// not a timestamp, keep the original tag text
			sb.WriteString(rest[start : end+1])
		}
		rest = rest[end+1:]
	}
	return firstTime, strings.TrimSpace(sb.String())
}

func parseLRC(lrc string) []LyricLine {
	out := []LyricLine{}
	for _, raw := range strings.Split(lrc, "\n") {
		raw = strings.TrimSpace(raw)
		times := []float64{}
		rest := raw
		for strings.HasPrefix(rest, "[") {
			end := strings.Index(rest, "]")
			if end < 0 {
				break
			}
			tag := rest[1:end]
			rest = rest[end+1:]
			colon := strings.Index(tag, ":")
			dot := strings.Index(tag, ".")
			if colon < 0 {
				break
			}
			min, err1 := strconv.ParseFloat(tag[:colon], 64)
			if err1 != nil {
				break
			}
			var sec, frac float64
			if dot > colon {
				sec, _ = strconv.ParseFloat(tag[colon+1:dot], 64)
				fracStr := tag[dot+1:]
				frac, _ = strconv.ParseFloat(fracStr, 64)
				if len(fracStr) == 3 {
					frac /= 10
				}
			} else {
				sec, _ = strconv.ParseFloat(tag[colon+1:], 64)
			}
			times = append(times, min*60+sec+frac/100)
		}
		text := strings.TrimSpace(rest)
		// Strip Enhanced LRC inline word timestamps and recover line time if missing
		if strings.Contains(text, "<") {
			inlineTime, cleaned := stripInlineTags(text)
			text = cleaned
			if len(times) == 0 && inlineTime >= 0 {
				times = append(times, inlineTime)
			}
		}
		if text == "" || len(times) == 0 {
			continue
		}
		for _, t := range times {
			out = append(out, LyricLine{Time: t, Text: text})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Time < out[j].Time })
	return out
}

func fetchSidecar(filePath, lyricsDir, trackID string) (*LyricsResp, error) {
	// Check user-saved dir first (writable), then fall back to file adjacent to audio
	candidates := []string{
		filepath.Join(lyricsDir, trackID+".lrc"),
		strings.TrimSuffix(filePath, filepath.Ext(filePath)) + ".lrc",
	}
	for _, p := range candidates {
		data, err := os.ReadFile(p)
		if err == nil {
			return &LyricsResp{Source: "sidecar", Plain: string(data), Synced: parseLRC(string(data))}, nil
		}
	}
	return nil, os.ErrNotExist
}

func fetchEmbedded(filePath string) (*LyricsResp, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	m, err := tag.ReadFrom(f)
	if err != nil || m == nil {
		return nil, nil
	}

	// Vorbis (FLAC/OGG) stores keys lowercase; ID3v2 uses USLT; M4A uses ©lyr.
	raw := m.Raw()
	for _, key := range []string{"LYRICS", "lyrics", "USLT", "©lyr"} {
		val, ok := raw[key]
		if !ok {
			continue
		}
		var text string
		switch v := val.(type) {
		case string:
			text = strings.TrimSpace(v)
		case []string:
			if len(v) > 0 {
				text = strings.TrimSpace(v[0])
			}
		}
		if text != "" {
			return &LyricsResp{Source: "embedded", Plain: text, Synced: parseLRC(text)}, nil
		}
	}
	return nil, nil
}

// writeEmbedded writes lrc into the audio file's LYRICS metadata tag via ffmpeg.
// Returns an error if the format is unsupported or the write fails.
func writeEmbedded(filePath, lrc string) error {
	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".flac", ".mp3", ".ogg", ".m4a", ".aac":
	default:
		return fmt.Errorf("format %s does not support embedded lyrics", ext)
	}

	dir := filepath.Dir(filePath)
	tmp := filepath.Join(dir, ".tmp_"+filepath.Base(filePath))
	cmd := exec.Command("ffmpeg", "-y",
		"-i", filePath,
		"-metadata", "LYRICS="+lrc,
		"-c", "copy",
		tmp)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		os.Remove(tmp)
		return fmt.Errorf("ffmpeg: %w: %s", err, strings.TrimSpace(stderr.String()))
	}
	if err := os.Rename(tmp, filePath); err != nil {
		os.Remove(tmp)
		return err
	}
	return nil
}

func fetchLRCLIB(title, artist, album string, duration int) (*LyricsResp, error) {
	q := url.Values{}
	q.Set("track_name", title)
	q.Set("artist_name", artist)
	q.Set("album_name", album)
	if duration > 0 {
		q.Set("duration", strconv.Itoa(duration))
	}
	client := &http.Client{Timeout: 6 * time.Second}
	resp, err := client.Get("https://lrclib.net/api/get?" + q.Encode())
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 404 {
		return nil, nil
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("lrclib status %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	var payload struct {
		SyncedLyrics string `json:"syncedLyrics"`
		PlainLyrics  string `json:"plainLyrics"`
		Instrumental bool   `json:"instrumental"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	if payload.Instrumental {
		return &LyricsResp{Source: "lrclib", Plain: "[Instrumental]"}, nil
	}
	out := &LyricsResp{Source: "lrclib", Plain: payload.PlainLyrics}
	if payload.SyncedLyrics != "" {
		out.Synced = parseLRC(payload.SyncedLyrics)
	}
	return out, nil
}

func fetchNetEase(title, artist string) (*LyricsResp, error) {
	form := url.Values{}
	form.Set("s", title+" "+artist)
	form.Set("type", "1")
	form.Set("limit", "5")
	form.Set("offset", "0")

	client := &http.Client{Timeout: 8 * time.Second}
	req, err := http.NewRequest("POST", "https://music.163.com/api/search/get",
		strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Referer", "https://music.163.com")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var searchResp struct {
		Result struct {
			Songs []struct {
				ID int64 `json:"id"`
			} `json:"songs"`
		} `json:"result"`
	}
	body, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(body, &searchResp); err != nil {
		return nil, err
	}
	if len(searchResp.Result.Songs) == 0 {
		return nil, nil
	}

	songID := searchResp.Result.Songs[0].ID
	lyrURL := fmt.Sprintf("https://music.163.com/api/song/lyric?id=%d&lv=1&kv=1&tv=-1", songID)
	req2, _ := http.NewRequest("GET", lyrURL, nil)
	req2.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req2.Header.Set("Referer", "https://music.163.com")

	resp2, err := client.Do(req2)
	if err != nil {
		return nil, err
	}
	defer resp2.Body.Close()

	var lyrResp struct {
		Lrc struct {
			Lyric string `json:"lyric"`
		} `json:"lrc"`
	}
	body2, _ := io.ReadAll(resp2.Body)
	if err := json.Unmarshal(body2, &lyrResp); err != nil {
		return nil, err
	}
	if lyrResp.Lrc.Lyric == "" {
		return nil, nil
	}
	synced := parseLRC(lyrResp.Lrc.Lyric)
	return &LyricsResp{Source: "netease", Plain: lyrResp.Lrc.Lyric, Synced: synced}, nil
}

// stripJSONP removes a JSONP wrapper like `callback({...})` or `MusicJsonCallback({...})`.
// Returns the original slice unchanged if no wrapper is detected.
func stripJSONP(b []byte) []byte {
	b = bytes.TrimSpace(b)
	if i := bytes.IndexByte(b, '('); i > 0 && i < 40 {
		if j := bytes.LastIndexByte(b, ')'); j > i {
			return bytes.TrimSpace(b[i+1 : j])
		}
	}
	return b
}

func fetchQQMusic(title, artist string) (*LyricsResp, error) {
	q := url.Values{}
	q.Set("w", title+" "+artist)
	q.Set("n", "5")
	q.Set("format", "json")
	q.Set("p", "1")
	q.Set("t", "0")
	q.Set("cr", "1")
	q.Set("new_json", "1")

	client := &http.Client{Timeout: 8 * time.Second}
	req, err := http.NewRequest("GET",
		"https://c.y.qq.com/soso/fcgi-bin/client_search_cp?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Referer", "https://y.qq.com")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var searchResp struct {
		Data struct {
			Song struct {
				List []struct {
					SongMid string `json:"songmid"`
				} `json:"list"`
			} `json:"song"`
		} `json:"data"`
	}
	body, _ := io.ReadAll(resp.Body)
	body = stripJSONP(body)
	if err := json.Unmarshal(body, &searchResp); err != nil {
		return nil, nil
	}
	if len(searchResp.Data.Song.List) == 0 {
		return nil, nil
	}

	mid := searchResp.Data.Song.List[0].SongMid
	lyrURL := fmt.Sprintf(
		"https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=%s&format=json&nobase64=1", mid)
	req2, _ := http.NewRequest("GET", lyrURL, nil)
	req2.Header.Set("Referer", "https://y.qq.com")
	req2.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp2, err := client.Do(req2)
	if err != nil {
		return nil, err
	}
	defer resp2.Body.Close()

	var lyrResp struct {
		Lyric string `json:"lyric"`
	}
	body2, _ := io.ReadAll(resp2.Body)
	body2 = stripJSONP(body2)
	if err := json.Unmarshal(body2, &lyrResp); err != nil {
		return nil, nil
	}
	if lyrResp.Lyric == "" {
		return nil, nil
	}
	synced := parseLRC(lyrResp.Lyric)
	return &LyricsResp{Source: "qqmusic", Plain: lyrResp.Lyric, Synced: synced}, nil
}

var mxmCache struct {
	sync.Mutex
	token   string
	fetchAt time.Time
}

func mxmToken() (string, error) {
	mxmCache.Lock()
	defer mxmCache.Unlock()
	if mxmCache.token != "" && time.Since(mxmCache.fetchAt) < 20*time.Hour {
		return mxmCache.token, nil
	}

	client := &http.Client{Timeout: 8 * time.Second}
	url := "https://apic-desktop.musixmatch.com/ws/1.1/token.get?app_id=web-desktop-app-v1.0"
	resp, err := client.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var tResp struct {
		Message struct {
			Body struct {
				UserToken string `json:"user_token"`
			} `json:"body"`
		} `json:"message"`
	}
	if err := json.Unmarshal(body, &tResp); err != nil {
		return "", err
	}
	if tResp.Message.Body.UserToken == "" {
		return "", fmt.Errorf("musixmatch: token not found in response")
	}

	mxmCache.token = tResp.Message.Body.UserToken
	mxmCache.fetchAt = time.Now()
	return mxmCache.token, nil
}

func mxmSign(rawURL string) (string, error) {
	token, err := mxmToken()
	if err != nil {
		return "", err
	}
	return rawURL + "&usertoken=" + url.QueryEscape(token), nil
}

func fetchMusixmatch(title, artist string, duration int) (*LyricsResp, error) {
	ua := "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36"
	client := &http.Client{Timeout: 8 * time.Second}

	// 1. Search for track
	sq := url.Values{}
	sq.Set("app_id", "web-desktop-app-v1.0")
	sq.Set("format", "json")
	sq.Set("q", title+" "+artist)
	sq.Set("f_has_lyrics", "true")
	sq.Set("page_size", "5")
	sq.Set("page", "1")
	searchURL, err := mxmSign("https://apic-desktop.musixmatch.com/ws/1.1/track.search?" + sq.Encode())
	if err != nil {
		return nil, err
	}
	req, _ := http.NewRequest("GET", searchURL, nil)
	req.Header.Set("User-Agent", ua)
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var searchResp struct {
		Message struct {
			Header struct{ StatusCode int `json:"status_code"` } `json:"header"`
			Body   struct {
				TrackList []struct {
					Track struct{ TrackID int `json:"track_id"` } `json:"track"`
				} `json:"track_list"`
			} `json:"body"`
		} `json:"message"`
	}
	if err := json.Unmarshal(body, &searchResp); err != nil || searchResp.Message.Header.StatusCode != 200 {
		return nil, nil
	}
	if len(searchResp.Message.Body.TrackList) == 0 {
		return nil, nil
	}
	trackID := searchResp.Message.Body.TrackList[0].Track.TrackID

	// 2. Try richsync (word-level synced lyrics)
	rq := url.Values{}
	rq.Set("app_id", "web-desktop-app-v1.0")
	rq.Set("format", "json")
	rq.Set("track_id", strconv.Itoa(trackID))
	if duration > 0 {
		rq.Set("f_richsync_length", strconv.Itoa(duration))
		rq.Set("f_richsync_length_max_deviation", "10")
	}
	richURL, err := mxmSign("https://apic-desktop.musixmatch.com/ws/1.1/track.richsync.get?" + rq.Encode())
	if err != nil {
		return nil, err
	}
	req2, _ := http.NewRequest("GET", richURL, nil)
	req2.Header.Set("User-Agent", ua)
	resp2, err := client.Do(req2)
	if err != nil {
		return nil, err
	}
	defer resp2.Body.Close()
	body2, _ := io.ReadAll(resp2.Body)

	var richResp struct {
		Message struct {
			Header struct{ StatusCode int `json:"status_code"` } `json:"header"`
			Body   struct {
				Richsync struct{ RichsyncBody string `json:"richsync_body"` } `json:"richsync"`
			} `json:"body"`
		} `json:"message"`
	}
	if err := json.Unmarshal(body2, &richResp); err == nil &&
		richResp.Message.Header.StatusCode == 200 &&
		richResp.Message.Body.Richsync.RichsyncBody != "" {
		var lines []struct {
			Ts float64 `json:"ts"`
			X  string  `json:"x"`
		}
		if err := json.Unmarshal([]byte(richResp.Message.Body.Richsync.RichsyncBody), &lines); err == nil {
			synced := make([]LyricLine, 0, len(lines))
			var pb strings.Builder
			for _, l := range lines {
				if l.X == "" {
					continue
				}
				synced = append(synced, LyricLine{Time: l.Ts, Text: l.X})
				pb.WriteString(l.X + "\n")
			}
			if len(synced) > 0 {
				return &LyricsResp{Source: "musixmatch", Plain: strings.TrimSpace(pb.String()), Synced: synced}, nil
			}
		}
	}

	// 3. Fall back to plain lyrics
	lq := url.Values{}
	lq.Set("app_id", "web-desktop-app-v1.0")
	lq.Set("format", "json")
	lq.Set("track_id", strconv.Itoa(trackID))
	lyrURL, err := mxmSign("https://apic-desktop.musixmatch.com/ws/1.1/track.lyrics.get?" + lq.Encode())
	if err != nil {
		return nil, err
	}
	req3, _ := http.NewRequest("GET", lyrURL, nil)
	req3.Header.Set("User-Agent", ua)
	resp3, err := client.Do(req3)
	if err != nil {
		return nil, err
	}
	defer resp3.Body.Close()
	body3, _ := io.ReadAll(resp3.Body)

	var lyrResp struct {
		Message struct {
			Header struct{ StatusCode int `json:"status_code"` } `json:"header"`
			Body   struct {
				Lyrics struct{ LyricsBody string `json:"lyrics_body"` } `json:"lyrics"`
			} `json:"body"`
		} `json:"message"`
	}
	if err := json.Unmarshal(body3, &lyrResp); err != nil || lyrResp.Message.Header.StatusCode != 200 {
		return nil, nil
	}
	plain := strings.TrimSpace(lyrResp.Message.Body.Lyrics.LyricsBody)
	if plain == "" {
		return nil, nil
	}
	if idx := strings.Index(plain, "\n****"); idx > 0 {
		plain = strings.TrimSpace(plain[:idx])
	}
	return &LyricsResp{Source: "musixmatch", Plain: plain}, nil
}

func (h *handlers) lyricsHandler(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !hexID.MatchString(id) {
		http.NotFound(w, r)
		return
	}

	meta, err := h.lib.TrackMeta(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if meta == nil {
		http.NotFound(w, r)
		return
	}

	if r.Method == http.MethodPost {
		h.saveLyrics(w, r, id, meta.FilePath)
		return
	}
	if r.Method == http.MethodDelete {
		h.lyrics.DeleteCached(r.Context(), id)
		w.WriteHeader(http.StatusNoContent)
		return
	}

	results := make([]LyricsResp, 0, 4)
	sources := make([]SourceInfo, 0, 5)
	fromCache := false

	// 1. Embedded tag lyrics — highest priority, always read fresh
	embedded, _ := fetchEmbedded(meta.FilePath)
	if embedded != nil {
		results = append(results, *embedded)
		sources = append(sources, SourceInfo{Source: "embedded", Found: true, Lines: len(embedded.Synced)})
	} else {
		sources = append(sources, SourceInfo{Source: "embedded", Found: false})
	}

	// 2. Sidecar .lrc — always read fresh
	sidecar, _ := fetchSidecar(meta.FilePath, h.lyricsDir, id)
	if sidecar != nil {
		results = append(results, *sidecar)
		sources = append(sources, SourceInfo{Source: "sidecar", Found: true, Lines: len(sidecar.Synced)})
	} else {
		sources = append(sources, SourceInfo{Source: "sidecar", Found: false})
	}


	// 3. Online sources — serve from DB cache if available
	cachedJSON, _ := h.lyrics.GetCached(r.Context(), id)

	if cachedJSON != "" {
		var cached []LyricsResp
		if json.Unmarshal([]byte(cachedJSON), &cached) == nil {
			results = append(results, cached...)
			fromCache = true
			foundSources := map[string]bool{}
			for _, c := range cached {
				foundSources[c.Source] = true
				sources = append(sources, SourceInfo{Source: c.Source, Found: true, Lines: len(c.Synced)})
			}
			for _, name := range []string{"lrclib", "netease", "qqmusic", "musixmatch"} {
				if !foundSources[name] {
					sources = append(sources, SourceInfo{Source: name, Found: false})
				}
			}
		}
	} else {
		online, onlineSrc := fetchOnlineSources(meta.Title, meta.Artist, meta.Album, meta.DurationS)
		sources = append(sources, onlineSrc...)
		if b, err := json.Marshal(online); err == nil {
			h.lyrics.SetCached(context.Background(), id, string(b))
		}
		results = append(results, online...)
	}

	cachedLabel := "false"
	if fromCache {
		cachedLabel = "true"
	}
	metrics.LyricsTotal.WithLabelValues(cachedLabel).Inc()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(LyricsMultiResp{Results: results, Sources: sources, Cached: fromCache})
}

// fetchOnlineSources runs LRCLIB / NetEase / QQ Music in parallel and returns
// ordered results plus per-source status info.
func fetchOnlineSources(title, artist, album string, duration int) ([]LyricsResp, []SourceInfo) {
	type job struct {
		source string
		fn     func() (*LyricsResp, error)
	}
	jobs := []job{
		{"lrclib", func() (*LyricsResp, error) { return fetchLRCLIB(title, artist, album, duration) }},
		{"netease", func() (*LyricsResp, error) { return fetchNetEase(title, artist) }},
		{"qqmusic", func() (*LyricsResp, error) { return fetchQQMusic(title, artist) }},
		{"musixmatch", func() (*LyricsResp, error) { return fetchMusixmatch(title, artist, duration) }},
	}
	type result struct {
		resp *LyricsResp
		err  error
		idx  int
	}
	ch := make(chan result, len(jobs))
	var wg sync.WaitGroup
	for i, j := range jobs {
		wg.Add(1)
		go func(idx int, j job) {
			defer wg.Done()
			resp, err := j.fn()
			ch <- result{resp, err, idx}
		}(i, j)
	}
	go func() { wg.Wait(); close(ch) }()

	ordered := make([]result, len(jobs))
	for r := range ch {
		ordered[r.idx] = r
	}

	online := make([]LyricsResp, 0, len(jobs))
	srcInfo := make([]SourceInfo, 0, len(jobs))
	for i, r := range ordered {
		name := jobs[i].source
		if r.resp != nil && (len(r.resp.Synced) > 0 || r.resp.Plain != "") {
			online = append(online, *r.resp)
			srcInfo = append(srcInfo, SourceInfo{Source: name, Found: true, Lines: len(r.resp.Synced)})
		} else if r.err != nil {
			srcInfo = append(srcInfo, SourceInfo{Source: name, Found: false, Err: r.err.Error()})
		} else {
			srcInfo = append(srcInfo, SourceInfo{Source: name, Found: false})
		}
	}
	return online, srcInfo
}

// translateLines sends all lines as one block to Google Translate and returns
// an index-aligned slice of translated strings.
func translateLines(lines []string, targetLang string) ([]string, error) {
	if len(lines) == 0 {
		return nil, nil
	}
	text := strings.Join(lines, "\n")
	apiURL := "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" +
		url.QueryEscape(targetLang) + "&dt=t&q=" + url.QueryEscape(text)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(apiURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	// Response: [[[seg_translated, seg_orig, ...], ...], ...]
	var raw []json.RawMessage
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("translate parse: %w", err)
	}
	if len(raw) == 0 {
		return lines, nil
	}
	var segments [][]json.RawMessage
	if err := json.Unmarshal(raw[0], &segments); err != nil {
		return nil, err
	}
	var sb strings.Builder
	for _, seg := range segments {
		if len(seg) > 0 {
			var s string
			if json.Unmarshal(seg[0], &s) == nil {
				sb.WriteString(s)
			}
		}
	}

	translated := strings.Split(sb.String(), "\n")
	result := make([]string, len(lines))
	for i := range result {
		if i < len(translated) {
			result[i] = strings.TrimSpace(translated[i])
		}
	}
	return result, nil
}

func (h *handlers) translateLyricsHandler(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !hexID.MatchString(id) {
		http.NotFound(w, r)
		return
	}
	lang := r.URL.Query().Get("lang")
	if lang == "" {
		lang = "vi"
	}

	// Check cache
	var cachedJSON string
	h.scanDB.QueryRowContext(r.Context(),
		`SELECT lines_json FROM lyrics_translations WHERE track_id=$1 AND lang=$2`, id, lang,
	).Scan(&cachedJSON)
	if cachedJSON != "" {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(cachedJSON))
		return
	}

	// Get track meta to read local lyrics
	meta, err := h.lib.TrackMeta(r.Context(), id)
	if err != nil || meta == nil {
		http.NotFound(w, r)
		return
	}

	// Collect best synced lines: sidecar > embedded > online cache
	var synced []LyricLine
	if sc, _ := fetchSidecar(meta.FilePath, h.lyricsDir, id); sc != nil && len(sc.Synced) > 0 {
		synced = sc.Synced
	} else if emb, _ := fetchEmbedded(meta.FilePath); emb != nil && len(emb.Synced) > 0 {
		synced = emb.Synced
	} else if cached, _ := h.lyrics.GetCached(r.Context(), id); cached != "" {
		var results []LyricsResp
		if json.Unmarshal([]byte(cached), &results) == nil {
			for _, res := range results {
				if len(res.Synced) > 0 {
					synced = res.Synced
					break
				}
			}
		}
	}
	if len(synced) == 0 {
		http.Error(w, "no synced lyrics available", http.StatusNotFound)
		return
	}

	// Extract original lines — skip same-timestamp translation lines (bilingual pairs)
	origLines := make([]string, 0, len(synced)/2+1)
	for i, l := range synced {
		if i > 0 && l.Time == synced[i-1].Time {
			continue
		}
		origLines = append(origLines, l.Text)
	}

	translated, err := translateLines(origLines, lang)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	out := map[string]interface{}{"lines": translated}
	b, _ := json.Marshal(out)

	// Cache in DB
	h.scanDB.ExecContext(context.Background(),
		`INSERT INTO lyrics_translations(track_id,lang,lines_json) VALUES($1,$2,$3) ON CONFLICT(track_id,lang) DO UPDATE SET lines_json=excluded.lines_json`,
		id, lang, string(b),
	)

	w.Header().Set("Content-Type", "application/json")
	w.Write(b)
}

// warmOnlineCache fetches online sources in the background and persists via usecase.
func (h *handlers) warmOnlineCache(trackID, title, artist, album string, duration int) {
	online, _ := fetchOnlineSources(title, artist, album, duration)
	if b, err := json.Marshal(online); err == nil {
		h.lyrics.SetCached(context.Background(), trackID, string(b))
	}
}

func (h *handlers) saveLyrics(w http.ResponseWriter, r *http.Request, trackID, filePath string) {
	var body struct {
		LRC string `json:"lrc"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.LRC == "" {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	// Write to both embedded tag and sidecar .lrc simultaneously.
	embErr := writeEmbedded(filePath, body.LRC)
	if embErr != nil {
		log.Printf("embedded write failed (%s): %v", filepath.Base(filePath), embErr)
	}
	lrcPath := filepath.Join(h.lyricsDir, trackID+".lrc")
	lrcErr := os.WriteFile(lrcPath, []byte(body.LRC), 0644)
	if lrcErr != nil {
		log.Printf("sidecar write failed (%s): %v", filepath.Base(lrcPath), lrcErr)
	}
	if embErr != nil && lrcErr != nil {
		http.Error(w, "failed to write lyrics to both embedded tag and .lrc", http.StatusInternalServerError)
		return
	}

	// Invalidate DB cache so next GET re-reads fresh embedded/sidecar data.
	h.lyrics.DeleteCached(r.Context(), trackID)
	w.WriteHeader(http.StatusNoContent)
}
