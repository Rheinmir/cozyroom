package api

import (
	"database/sql"
	"fmt"
	"net/http"
	"regexp"
	"time"

	"cozyroom/internal/domain"
	"cozyroom/internal/hls"
	"cozyroom/internal/library"
	"cozyroom/internal/mcp"
	"cozyroom/internal/metrics"
	pg "cozyroom/internal/repository/postgres"
	"cozyroom/internal/usecase"

	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var reHexSeg = regexp.MustCompile(`/[0-9a-f]{16}(/|$)`)

func normalizePath(p string) string {
	return reHexSeg.ReplaceAllStringFunc(p, func(s string) string {
		if s[len(s)-1] == '/' {
			return "/{id}/"
		}
		return "/{id}"
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (sw *statusWriter) WriteHeader(code int) {
	sw.status = code
	sw.ResponseWriter.WriteHeader(code)
}

func (sw *statusWriter) Flush() {
	if f, ok := sw.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func metricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sw := &statusWriter{ResponseWriter: w, status: 200}
		path := normalizePath(r.URL.Path)
		start := time.Now()
		next.ServeHTTP(sw, r)
		dur := time.Since(start).Seconds()
		status := fmt.Sprintf("%d", sw.status)
		metrics.HTTPRequestsTotal.WithLabelValues(r.Method, path, status).Inc()
		metrics.HTTPDurationSeconds.WithLabelValues(r.Method, path).Observe(dur)
	})
}

// RouterDeps groups everything the router needs.
type RouterDeps struct {
	Lib          *usecase.LibraryUsecase
	Lyrics       *usecase.LyricsUsecase
	Settings     *usecase.SettingsUsecase
	Playback     *usecase.PlaybackUsecase
	UoW          domain.UnitOfWorkFactory
	ScanDB       *sql.DB // for scanner/enricher (own internal TXs)
	MusicPath    string
	FilmsPath    string
	CoversDir    string
	ArtistImgDir string
	LyricsDir    string
	LastfmKey    string
	LastfmSecret string
	Video        *usecase.VideoUsecase
	Ebook        *usecase.EbookUsecase
	EbooksPath     string
	EbookCoversDir string
	CloakProxyURL  string
	HLSMgr        *hls.Manager
	TrickplayDir  string
	PosterDir     string
	GeminiKey     string
	OpenRouterKey string
	GithubToken   string
	ComicsDir     string
	MaxComicsGB   int64
	AnthropicKey  string
	DeepSeekKey   string
}

var GlobalReloadCron func() error

func NewRouter(d RouterDeps) (http.Handler, *ComicsDownloader, *AIHandlers) {
	h := &handlers{
		lib:          d.Lib,
		lyrics:       d.Lyrics,
		settings:     d.Settings,
		playback:     d.Playback,
		scanDB:       d.ScanDB,
		musicPath:    d.MusicPath,
		filmsPath:    d.FilmsPath,
		coversDir:    d.CoversDir,
		artistImgDir: d.ArtistImgDir,
		lyricsDir:    d.LyricsDir,
		lastfmKey:    d.LastfmKey,
		lastfmSecret: d.LastfmSecret,
		video:        d.Video,
		ebook:        d.Ebook,
		ebooksPath:   d.EbooksPath,
		ebookCoversDir: d.EbookCoversDir,
	}
	mux := http.NewServeMux()

	mux.Handle("GET /metrics", promhttp.Handler())

	mux.HandleFunc("GET /api/health", h.health)
	mux.HandleFunc("GET /api/stats", h.stats)
	mux.HandleFunc("POST /api/scan", h.scan)
	mux.HandleFunc("GET /api/artists", h.listArtists)
	mux.HandleFunc("GET /api/artists/{id}", h.artistDetail)
	mux.HandleFunc("GET /api/albums", h.listAlbums)
	mux.HandleFunc("GET /api/tracks", h.listTracks)
	mux.HandleFunc("GET /api/covers/{id}", h.cover)
	mux.HandleFunc("GET /api/artist-images/{id}", h.artistImage)
	mux.HandleFunc("GET /api/smart-queue", h.smartQueue)
	mux.HandleFunc("GET /api/search", h.search)
	mux.HandleFunc("GET /api/lyrics/{id}", h.lyricsHandler)
	mux.HandleFunc("POST /api/lyrics/{id}", h.lyricsHandler)
	mux.HandleFunc("DELETE /api/lyrics/{id}", h.lyricsHandler)
	mux.HandleFunc("GET /api/lyrics/{id}/translate", h.translateLyricsHandler)
	mux.HandleFunc("GET /stream/{id}", h.stream)

	vh := &VideoHandlers{uc: h.video, hlsMgr: d.HLSMgr, trickplayDir: d.TrickplayDir, posterDir: d.PosterDir}
	mux.HandleFunc("GET /api/videos", vh.listVideos)
	mux.HandleFunc("GET /stream-video/{id}", vh.streamVideo)
	mux.HandleFunc("GET /api/videos/{id}/stream", vh.smartStream)
	mux.HandleFunc("GET /api/video-posters/{id}", vh.videoPoster)
	mux.HandleFunc("GET /api/trickplay/{id}", vh.trickplayMeta)
	mux.HandleFunc("GET /api/trickplay/{id}/sprite", vh.trickplaySprite)
	mux.HandleFunc("GET /hls/{id}/{file}", vh.serveHLS)

	mux.HandleFunc("GET /api/ebooks", h.listEbooks)
	mux.HandleFunc("GET /api/ebooks/{id}/content", h.ebookContent)
	mux.HandleFunc("GET /api/ebooks/{id}/pages", h.ebookPages)
	mux.HandleFunc("GET /api/ebooks/{id}/page/{n}", h.ebookPage)
	mux.HandleFunc("GET /api/ebooks/{id}/asset", h.ebookAsset)
	mux.HandleFunc("GET /api/ebooks/{id}/toc", h.ebookTOC)
	mux.HandleFunc("GET /api/ebook-covers/{id}", h.ebookCover)
	mux.HandleFunc("POST /api/ebooks/{id}/nsfw", h.setEbookNSFW)
	mux.HandleFunc("POST /api/ebooks/{id}/progress", h.setEbookProgress)
	mux.HandleFunc("POST /api/ebooks/{id}/collection", h.setEbookCollection)

	mux.HandleFunc("GET /api/playback/progress/{type}/{id}", h.getPlaybackProgress)
	mux.HandleFunc("POST /api/playback/progress",           h.setPlaybackProgress)

	mux.HandleFunc("GET /api/lastfm/status",        h.lastfmStatus)
	mux.HandleFunc("POST /api/lastfm/login",        h.lastfmLogin)
	mux.HandleFunc("DELETE /api/lastfm/disconnect", h.lastfmDisconnect)
	mux.HandleFunc("POST /api/lastfm/now-playing",  h.lastfmNowPlaying)
	mux.HandleFunc("POST /api/lastfm/scrobble",     h.lastfmScrobble)

	sc := NewScraperHandlers(d.CloakProxyURL)
	mux.HandleFunc("GET /api/scraper/md/latest",         sc.mdLatest)
	mux.HandleFunc("GET /api/scraper/md/search",         sc.mdSearch)
	mux.HandleFunc("GET /api/scraper/md/chapters/{id}",  sc.mdChapters)
	mux.HandleFunc("GET /api/scraper/md/pages/{id}",     sc.mdPages)
	mux.HandleFunc("GET /api/scraper/md/img",            sc.mdImg)

	eh := NewEHCachedHandler(d.ScanDB, d.CloakProxyURL)
	mux.HandleFunc("GET /api/scraper/eh/latest",         eh.ehLatest)
	mux.HandleFunc("GET /api/scraper/eh/search",         eh.ehSearch)
	mux.HandleFunc("GET /api/scraper/eh/detail",         eh.ehDetail)
	mux.HandleFunc("GET /api/scraper/eh/pages",          eh.ehPages)
	mux.HandleFunc("GET /api/scraper/eh/image",          sc.ehImage)

	comicsGB := d.MaxComicsGB
	if comicsGB <= 0 {
		comicsGB = 50
	}
	dl := newComicsDownloader(
		&pg.ComicsDownloadsRepo{DB: d.ScanDB},
		d.ComicsDir,
		comicsGB,
		eh,
	)
	mux.HandleFunc("GET /api/scraper/downloads",                    dl.listDownloads)
	mux.HandleFunc("DELETE /api/scraper/downloads/{id}",            dl.deleteDownload)
	mux.HandleFunc("POST /api/scraper/downloads/{id}/retry",        dl.retryDownload)
	mux.HandleFunc("POST /api/scraper/enqueue/eh/{gid}/{token}",    dl.enqueueEH)
	mux.HandleFunc("POST /api/scraper/enqueue/md/{mangaId}",        dl.enqueueMD)
	mux.HandleFunc("GET /api/scraper/local/{id}/chapters",          dl.listChapters)
	mux.HandleFunc("GET /api/scraper/local/{id}/{file...}",         dl.serveLocalFile)

	th := &TrendingHandlers{db: d.ScanDB, geminiKey: d.GeminiKey, openRouterKey: d.OpenRouterKey, githubToken: d.GithubToken}
	mux.HandleFunc("GET /api/trending",           th.listTrending)
	mux.HandleFunc("GET /api/trending/dates",     th.listDates)
	mux.HandleFunc("GET /api/trending/history",   th.repoHistory)
	mux.HandleFunc("POST /api/trending/refresh",  th.refresh)

	yh := &YouTubeHandlers{db: d.ScanDB, musicPath: d.MusicPath, coversDir: d.CoversDir}
	mux.HandleFunc("GET /api/youtube/search", yh.search)
	mux.HandleFunc("GET /api/youtube/channel", yh.channel)
	mux.HandleFunc("GET /api/youtube/stream/{id}", yh.stream)
	mux.HandleFunc("POST /api/youtube/download", yh.download)
	mux.HandleFunc("POST /api/youtube/update-tools", yh.updateTools)

	ph := &PlaylistHandlers{db: d.ScanDB}
	mux.HandleFunc("GET /api/playlists", ph.listPlaylists)
	mux.HandleFunc("GET /api/playlists/{id}/tracks", ph.listPlaylistTracks)
	mux.HandleFunc("POST /api/playlists", ph.createPlaylist)
	mux.HandleFunc("DELETE /api/playlists/{id}", ph.deletePlaylist)
	mux.HandleFunc("POST /api/playlists/{id}/tracks", ph.addTrackToPlaylist)
	mux.HandleFunc("DELETE /api/playlists/{id}/tracks/{track_id}", ph.removeTrackFromPlaylist)

	mcpTools := mcp.NewRegistry(mcp.ToolDeps{
		Lib: d.Lib,
		DB:  d.ScanDB,
		ScanFunc: func() (int, error) {
			res, err := library.Scan(d.ScanDB, d.MusicPath, d.CoversDir)
			return res.Tracks, err
		},
		CloakProxyURL: d.CloakProxyURL,
		ReloadCronFunc: func() error {
			if GlobalReloadCron != nil {
				return GlobalReloadCron()
			}
			return nil
		},
	})
	mux.HandleFunc("/mcp", mcp.NewHTTPHandler(mcpTools))
	aiH := &AIHandlers{
		anthropicKey:  d.AnthropicKey,
		geminiKey:     d.GeminiKey,
		openRouterKey: d.OpenRouterKey,
		deepseekKey:   d.DeepSeekKey,
		tools:         mcpTools,
		db:            d.ScanDB,
	}
	mux.HandleFunc("POST /api/ai/chat", aiH.chat)
	mux.HandleFunc("POST /api/ai/chat/stream", aiH.chatStream)
	mux.HandleFunc("GET /api/ai/logs", aiH.logs)
	mux.HandleFunc("POST /api/ai/logs/{id}/dislike", aiH.dislike)
	mux.HandleFunc("GET /api/ai/sessions", aiH.sessions)
	mux.HandleFunc("GET /api/ai/sessions/{id}/messages", aiH.sessionMessages)
	mux.HandleFunc("GET /api/ai/stats", aiH.stats)
	mux.HandleFunc("GET /api/ai/extremes", aiH.extremes)
	mux.HandleFunc("POST /api/ai/ocr-pricing", aiH.ocrPricing)
	mux.HandleFunc("GET /api/ai/memory", aiH.memoryList)
	mux.HandleFunc("PUT /api/ai/memory", aiH.memoryImport)
	mux.HandleFunc("DELETE /api/ai/memory/{key}", aiH.memoryDelete)
	mux.HandleFunc("GET /api/ai/model-prices", aiH.modelPricesList)
	mux.HandleFunc("PUT /api/ai/model-prices", aiH.modelPricesUpsert)
	mux.HandleFunc("GET /api/ai/stats/daily", aiH.statsDaily)

	mux.Handle("/", spaHandler{root: "./dist"})

	return metricsMiddleware(mux), dl, aiH
}
