package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

// LyricsCandidate is one vendor-side match for a free-text lyrics search.
// ID is the vendor's own id, passed back to /api/lyrics/candidate to fetch
// the lyrics of exactly that match.
type LyricsCandidate struct {
	Source   string `json:"source"`
	ID       string `json:"id"`
	Title    string `json:"title"`
	Artist   string `json:"artist"`
	Album    string `json:"album"`
	Duration int    `json:"duration"`
}

type LyricsSearchResp struct {
	Candidates []LyricsCandidate `json:"candidates"`
	Sources    []SourceInfo      `json:"sources"`
}

const lyricsSearchLimit = 6

const browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

// ── LRCLIB ───────────────────────────────────────────────────────────────

func searchLRCLIB(q string, limit int) ([]LyricsCandidate, error) {
	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Get("https://lrclib.net/api/search?q=" + url.QueryEscape(q))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("lrclib status %d", resp.StatusCode)
	}
	var list []struct {
		ID         int64   `json:"id"`
		TrackName  string  `json:"trackName"`
		ArtistName string  `json:"artistName"`
		AlbumName  string  `json:"albumName"`
		Duration   float64 `json:"duration"`
	}
	body, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(body, &list); err != nil {
		return nil, err
	}
	out := make([]LyricsCandidate, 0, limit)
	for _, s := range list {
		if len(out) == limit {
			break
		}
		out = append(out, LyricsCandidate{Source: "lrclib", ID: strconv.FormatInt(s.ID, 10),
			Title: s.TrackName, Artist: s.ArtistName, Album: s.AlbumName, Duration: int(s.Duration)})
	}
	return out, nil
}

func lrclibByID(id string) (*LyricsResp, error) {
	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Get("https://lrclib.net/api/get/" + url.PathEscape(id))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("lrclib status %d", resp.StatusCode)
	}
	var payload struct {
		SyncedLyrics string `json:"syncedLyrics"`
		PlainLyrics  string `json:"plainLyrics"`
		Instrumental bool   `json:"instrumental"`
	}
	body, _ := io.ReadAll(resp.Body)
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

// ── NetEase ──────────────────────────────────────────────────────────────

func searchNetEase(q string, limit int) ([]LyricsCandidate, error) {
	form := url.Values{}
	form.Set("s", q)
	form.Set("type", "1")
	form.Set("limit", strconv.Itoa(limit))
	form.Set("offset", "0")

	client := &http.Client{Timeout: 8 * time.Second}
	req, err := http.NewRequest("POST", "https://music.163.com/api/search/get",
		strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", browserUA)
	req.Header.Set("Referer", "https://music.163.com")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var searchResp struct {
		Result struct {
			Songs []struct {
				ID       int64  `json:"id"`
				Name     string `json:"name"`
				Duration int    `json:"duration"` // ms
				Artists  []struct {
					Name string `json:"name"`
				} `json:"artists"`
				Album struct {
					Name string `json:"name"`
				} `json:"album"`
			} `json:"songs"`
		} `json:"result"`
	}
	body, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(body, &searchResp); err != nil {
		return nil, err
	}
	out := make([]LyricsCandidate, 0, len(searchResp.Result.Songs))
	for _, s := range searchResp.Result.Songs {
		names := make([]string, 0, len(s.Artists))
		for _, a := range s.Artists {
			names = append(names, a.Name)
		}
		out = append(out, LyricsCandidate{Source: "netease", ID: strconv.FormatInt(s.ID, 10),
			Title: s.Name, Artist: strings.Join(names, ", "), Album: s.Album.Name, Duration: s.Duration / 1000})
	}
	return out, nil
}

func neteaseLyric(id string) (*LyricsResp, error) {
	client := &http.Client{Timeout: 8 * time.Second}
	lyrURL := "https://music.163.com/api/song/lyric?id=" + url.QueryEscape(id) + "&lv=1&kv=1&tv=-1"
	req, _ := http.NewRequest("GET", lyrURL, nil)
	req.Header.Set("User-Agent", browserUA)
	req.Header.Set("Referer", "https://music.163.com")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var lyrResp struct {
		Lrc struct {
			Lyric string `json:"lyric"`
		} `json:"lrc"`
	}
	body, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(body, &lyrResp); err != nil {
		return nil, err
	}
	if lyrResp.Lrc.Lyric == "" {
		return nil, nil
	}
	return &LyricsResp{Source: "netease", Plain: lyrResp.Lrc.Lyric, Synced: parseLRC(lyrResp.Lrc.Lyric)}, nil
}

// ── QQ Music ─────────────────────────────────────────────────────────────

func searchQQMusic(q string, limit int) ([]LyricsCandidate, error) {
	v := url.Values{}
	v.Set("w", q)
	v.Set("n", strconv.Itoa(limit))
	v.Set("format", "json")
	v.Set("p", "1")
	v.Set("t", "0")
	v.Set("cr", "1")
	v.Set("new_json", "1")

	client := &http.Client{Timeout: 8 * time.Second}
	req, err := http.NewRequest("GET", "https://c.y.qq.com/soso/fcgi-bin/client_search_cp?"+v.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Referer", "https://y.qq.com")
	req.Header.Set("User-Agent", browserUA)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// new_json=1 shape: the song id is "mid" (the legacy shape called it
	// "songmid", which is always empty here).
	var searchResp struct {
		Data struct {
			Song struct {
				List []struct {
					Mid      string `json:"mid"`
					Name     string `json:"name"`
					Interval int    `json:"interval"` // seconds
					Singer   []struct {
						Name string `json:"name"`
					} `json:"singer"`
					Album struct {
						Name string `json:"name"`
					} `json:"album"`
				} `json:"list"`
			} `json:"song"`
		} `json:"data"`
	}
	body, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(stripJSONP(body), &searchResp); err != nil {
		return nil, err
	}
	out := make([]LyricsCandidate, 0, len(searchResp.Data.Song.List))
	for _, s := range searchResp.Data.Song.List {
		if s.Mid == "" {
			continue
		}
		names := make([]string, 0, len(s.Singer))
		for _, a := range s.Singer {
			names = append(names, a.Name)
		}
		out = append(out, LyricsCandidate{Source: "qqmusic", ID: s.Mid,
			Title: s.Name, Artist: strings.Join(names, ", "), Album: s.Album.Name, Duration: s.Interval})
	}
	return out, nil
}

func qqMusicLyric(mid string) (*LyricsResp, error) {
	client := &http.Client{Timeout: 8 * time.Second}
	lyrURL := "https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=" + url.QueryEscape(mid) + "&format=json&nobase64=1"
	req, _ := http.NewRequest("GET", lyrURL, nil)
	req.Header.Set("Referer", "https://y.qq.com")
	req.Header.Set("User-Agent", browserUA)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var lyrResp struct {
		Lyric string `json:"lyric"`
	}
	body, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(stripJSONP(body), &lyrResp); err != nil {
		return nil, nil
	}
	if lyrResp.Lyric == "" {
		return nil, nil
	}
	return &LyricsResp{Source: "qqmusic", Plain: lyrResp.Lyric, Synced: parseLRC(lyrResp.Lyric)}, nil
}

// ── Musixmatch ───────────────────────────────────────────────────────────

const mxmUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36"

func searchMusixmatch(q string, limit int) ([]LyricsCandidate, error) {
	sq := url.Values{}
	sq.Set("app_id", "web-desktop-app-v1.0")
	sq.Set("format", "json")
	sq.Set("q", q)
	sq.Set("f_has_lyrics", "true")
	sq.Set("page_size", strconv.Itoa(limit))
	sq.Set("page", "1")
	searchURL, err := mxmSign("https://apic-desktop.musixmatch.com/ws/1.1/track.search?" + sq.Encode())
	if err != nil {
		return nil, err
	}
	client := &http.Client{Timeout: 8 * time.Second}
	req, _ := http.NewRequest("GET", searchURL, nil)
	req.Header.Set("User-Agent", mxmUA)
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var searchResp struct {
		Message struct {
			Header struct{ StatusCode int `json:"status_code"` } `json:"header"`
			Body   struct {
				TrackList []struct {
					Track struct {
						TrackID     int    `json:"track_id"`
						TrackName   string `json:"track_name"`
						ArtistName  string `json:"artist_name"`
						AlbumName   string `json:"album_name"`
						TrackLength int    `json:"track_length"`
					} `json:"track"`
				} `json:"track_list"`
			} `json:"body"`
		} `json:"message"`
	}
	body, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(body, &searchResp); err != nil {
		return nil, err
	}
	if searchResp.Message.Header.StatusCode != 200 {
		return nil, fmt.Errorf("musixmatch status %d", searchResp.Message.Header.StatusCode)
	}
	out := make([]LyricsCandidate, 0, len(searchResp.Message.Body.TrackList))
	for _, tl := range searchResp.Message.Body.TrackList {
		t := tl.Track
		out = append(out, LyricsCandidate{Source: "musixmatch", ID: strconv.Itoa(t.TrackID),
			Title: t.TrackName, Artist: t.ArtistName, Album: t.AlbumName, Duration: t.TrackLength})
	}
	return out, nil
}

// musixmatchLyric tries richsync (word-level synced) first, then plain lyrics.
func musixmatchLyric(trackID string, duration int) (*LyricsResp, error) {
	client := &http.Client{Timeout: 8 * time.Second}

	rq := url.Values{}
	rq.Set("app_id", "web-desktop-app-v1.0")
	rq.Set("format", "json")
	rq.Set("track_id", trackID)
	if duration > 0 {
		rq.Set("f_richsync_length", strconv.Itoa(duration))
		rq.Set("f_richsync_length_max_deviation", "10")
	}
	richURL, err := mxmSign("https://apic-desktop.musixmatch.com/ws/1.1/track.richsync.get?" + rq.Encode())
	if err != nil {
		return nil, err
	}
	req2, _ := http.NewRequest("GET", richURL, nil)
	req2.Header.Set("User-Agent", mxmUA)
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

	lq := url.Values{}
	lq.Set("app_id", "web-desktop-app-v1.0")
	lq.Set("format", "json")
	lq.Set("track_id", trackID)
	lyrURL, err := mxmSign("https://apic-desktop.musixmatch.com/ws/1.1/track.lyrics.get?" + lq.Encode())
	if err != nil {
		return nil, err
	}
	req3, _ := http.NewRequest("GET", lyrURL, nil)
	req3.Header.Set("User-Agent", mxmUA)
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

// ── Handlers ─────────────────────────────────────────────────────────────

// lyricsSearchHandler: GET /api/lyrics/search?q= — every vendor's top
// matches for a free-text query, so the user can pick the right one instead
// of the auto-fetch's blind "first hit".
func (h *handlers) lyricsSearchHandler(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		http.Error(w, "missing q", http.StatusBadRequest)
		return
	}
	type job struct {
		source string
		fn     func(string, int) ([]LyricsCandidate, error)
	}
	jobs := []job{
		{"lrclib", searchLRCLIB},
		{"netease", searchNetEase},
		{"qqmusic", searchQQMusic},
		{"musixmatch", searchMusixmatch},
	}
	type result struct {
		list []LyricsCandidate
		err  error
	}
	results := make([]result, len(jobs))
	var wg sync.WaitGroup
	for i, j := range jobs {
		wg.Add(1)
		go func(i int, j job) {
			defer wg.Done()
			list, err := j.fn(q, lyricsSearchLimit)
			results[i] = result{list, err}
		}(i, j)
	}
	wg.Wait()

	out := LyricsSearchResp{Candidates: []LyricsCandidate{}, Sources: make([]SourceInfo, 0, len(jobs))}
	for i, res := range results {
		info := SourceInfo{Source: jobs[i].source, Found: len(res.list) > 0, Lines: len(res.list)}
		if res.err != nil {
			info.Err = res.err.Error()
		}
		out.Sources = append(out.Sources, info)
		out.Candidates = append(out.Candidates, res.list...)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}

// lyricsCandidateHandler: GET /api/lyrics/candidate?source=&id=&duration= —
// the lyrics of one search candidate, for preview before locking it in.
func (h *handlers) lyricsCandidateHandler(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	id := q.Get("id")
	duration, _ := strconv.Atoi(q.Get("duration"))
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	var (
		resp *LyricsResp
		err  error
	)
	switch q.Get("source") {
	case "lrclib":
		resp, err = lrclibByID(id)
	case "netease":
		resp, err = neteaseLyric(id)
	case "qqmusic":
		resp, err = qqMusicLyric(id)
	case "musixmatch":
		resp, err = musixmatchLyric(id, duration)
	default:
		http.Error(w, "unknown source", http.StatusBadRequest)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	if resp == nil || (len(resp.Synced) == 0 && resp.Plain == "") {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
