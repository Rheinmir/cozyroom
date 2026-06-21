package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"cozyroom/internal/api"
	"cozyroom/internal/cron"
	"cozyroom/internal/db"
	"cozyroom/internal/discord"
	"cozyroom/internal/enricher"
	"cozyroom/internal/teams"
	"cozyroom/internal/telegram"
	"cozyroom/internal/hls"
	"cozyroom/internal/library"
	repo "cozyroom/internal/repository/postgres"
	"cozyroom/internal/usecase"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	geminiKey       := envOr("GEMINI_API_KEY", "")
	openRouterKey   := envOr("OPENROUTER_API_KEY", "")

	var geminiKeys []string
	if raw := envOr("GEMINI_API_KEYS", ""); raw != "" {
		for _, k := range strings.Split(raw, ",") {
			if k = strings.TrimSpace(k); k != "" {
				geminiKeys = append(geminiKeys, k)
			}
		}
	} else if geminiKey != "" {
		geminiKeys = []string{geminiKey}
	}
	anthropicKey    := envOr("ANTHROPIC_API_KEY", "")
	deepseekKey     := envOr("DEEPSEEK_API_KEY", "")
	githubToken     := envOr("GITHUB_TOKEN", "")
	databaseURL     := envOr("DATABASE_URL", "postgres://cozyroom:cozyroom@localhost:5432/cozyroom?sslmode=disable")
	musicPath       := envOr("MUSIC_PATH", "/music")
	ytDownloadPath  := envOr("YT_DOWNLOAD_PATH", "")
	coversDir       := envOr("COVERS_DIR", "/data/covers")
	artistImgDir    := envOr("ARTIST_IMG_DIR", "/data/artist-images")
	lyricsDir       := envOr("LYRICS_DIR", "/data/lyrics")
	filmsPath       := envOr("FILMS_PATH", "/films")
	ebooksPath      := envOr("EBOOKS_PATH", "/ebooks")
	hlsDir          := envOr("HLS_DIR", "/data/hls")
	trickplayDir    := envOr("TRICKPLAY_DIR", "/data/trickplay")
	videoPosterDir  := envOr("VIDEO_POSTER_DIR", "/data/video-posters")
	ebookCoversDir  := envOr("EBOOK_COVERS_DIR", "/data/ebook-covers")
	comicsDir       := envOr("COMICS_DIR", "/data/comics")
	lastfmKey       := envOr("LASTFM_API_KEY", "")
	lastfmSecret    := envOr("LASTFM_API_SECRET", "")
	tmdbAPIKey      := envOr("TMDB_API_KEY", "")
	cloakProxyURL   := envOr("CLOAK_PROXY_URL", "")

	database, err := db.Open(databaseURL)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer database.Close()
	rawDB := database.DB // *sql.DB for packages that don't use the rebind wrapper

	if err := os.MkdirAll(lyricsDir, 0755); err != nil {
		log.Fatalf("create lyrics dir: %v", err)
	}
	if err := os.MkdirAll(hlsDir, 0755); err != nil {
		log.Fatalf("create hls dir: %v", err)
	}
	if err := os.MkdirAll(trickplayDir, 0755); err != nil {
		log.Fatalf("create trickplay dir: %v", err)
	}
	if err := os.MkdirAll(videoPosterDir, 0755); err != nil {
		log.Fatalf("create video-poster dir: %v", err)
	}
	if err := os.MkdirAll(ebookCoversDir, 0755); err != nil {
		log.Fatalf("create ebook-covers dir: %v", err)
	}
	if err := os.MkdirAll(comicsDir, 0755); err != nil {
		log.Fatalf("create comics dir: %v", err)
	}
	hlsMgr := hls.New(hlsDir)
	hlsMgr.Watch(ctx) // detect + kill stuck ffmpeg transcode jobs

	// ---- Repository layer ----
	artistRepo  := repo.NewArtistRepo(rawDB)
	albumRepo   := repo.NewAlbumRepo(rawDB)
	trackRepo   := repo.NewTrackRepo(rawDB)
	searchRepo  := &repo.SearchRepo{DB: rawDB}
	statsRepo   := &repo.StatsRepo{DB: rawDB}
	cacheRepo   := &repo.LyricsCacheRepo{DB: rawDB}
	settingsRepo := &repo.SettingsRepo{DB: rawDB}
	videoRepo    := repo.NewVideoRepo(rawDB)
	playbackRepo := &repo.PlaybackRepo{DB: rawDB}
	uowFactory   := &repo.UoWFactory{DB: rawDB}

	// ---- Usecase layer ----
	libUC := &usecase.LibraryUsecase{
		Artists: artistRepo,
		Albums:  albumRepo,
		Tracks:  trackRepo,
		Search:  searchRepo,
		Stats:   statsRepo,
	}
	lyricsUC   := &usecase.LyricsUsecase{Cache: cacheRepo}
	settingsUC := &usecase.SettingsUsecase{Settings: settingsRepo}
	videoUC    := &usecase.VideoUsecase{Videos: videoRepo}
	ebookUC    := usecase.NewEbookUsecase(uowFactory)
	playbackUC := &usecase.PlaybackUsecase{Playback: playbackRepo}

	// ---- HTTP router + comics downloader ----
	mux, dl, aiHandlers := api.NewRouter(api.RouterDeps{
		Lib:          libUC,
		Lyrics:       lyricsUC,
		Settings:     settingsUC,
		Playback:     playbackUC,
		UoW:          uowFactory,
		ScanDB:          rawDB,
		MusicPath:       musicPath,
		YtDownloadPath:  ytDownloadPath,
		FilmsPath:       filmsPath,
		CoversDir:    coversDir,
		ArtistImgDir: artistImgDir,
		LyricsDir:    lyricsDir,
		LastfmKey:    lastfmKey,
		LastfmSecret: lastfmSecret,
		Video:        videoUC,
		Ebook:        ebookUC,
		EbooksPath:   ebooksPath,
		EbookCoversDir: ebookCoversDir,
		CloakProxyURL:  cloakProxyURL,
		HLSMgr:       hlsMgr,
		TrickplayDir: trickplayDir,
		PosterDir:    videoPosterDir,
		GeminiKey:     geminiKey,
		GeminiKeys:    geminiKeys,
		OpenRouterKey: openRouterKey,
		GithubToken:   githubToken,
		ComicsDir:     comicsDir,
		MaxComicsGB:   50,
		AnthropicKey:  anthropicKey,
		DeepSeekKey:   deepseekKey,
	})
	go dl.Start(ctx)

	cronMgr := cron.NewCronManager(rawDB, aiHandlers)
	api.GlobalReloadCron = cronMgr.LoadAndScheduleAll
	if err := cronMgr.Start(); err != nil {
		log.Printf("[Cron] Start error: %v", err)
	}
	defer cronMgr.Stop()

	tgBot := telegram.NewTelegramBot(aiHandlers)
	if tgBot != nil {
		tgBot.Start()
	}

	teamsBot := teams.NewTeamsBot(aiHandlers)

	discordBot := discord.NewDiscordBot(aiHandlers)
	if discordBot != nil {
		if err := discordBot.Start(); err != nil {
			log.Printf("[Discord] Start error: %v", err)
		} else {
			defer discordBot.Stop()
		}
	}

	// ---- Background scan + enricher ----
	go func() {
		if libUC.IsEmpty(context.Background()) {
			log.Printf("background scan started: %s", musicPath)
			res, err := library.Scan(rawDB, musicPath, coversDir)
			if err != nil {
				log.Printf("scan error: %v", err)
			} else {
				log.Printf("scan done: %d tracks, %d errors", res.Tracks, res.Errors)
			}
		}
		if videoRepo.IsEmpty(context.Background()) {
			log.Printf("background scan videos started: %s", filmsPath)
			if err := library.ScanVideos(rawDB, filmsPath); err != nil {
				log.Printf("video scan error: %v", err)
			}
		}
		// Background scan ebooks
		// Background scan ebooks
		if uow, err := uowFactory.Begin(context.Background()); err == nil {
			_ = uow.Ebooks().IsEmpty(context.Background()) // Keep call for now or remove
			uow.Rollback()
		}
		if true { // Force scan to get covers
			log.Printf("background scan ebooks started: %s", ebooksPath)
			_ = library.ScanEbooks(rawDB, ebooksPath, ebookCoversDir)
		}
		enricher.FetchArtistImages(enricher.DeezerProvider{}, artistRepo, artistImgDir)
		if tmdbAPIKey != "" {
			enricher.FetchVideoPosters(enricher.TMDbProvider{APIKey: tmdbAPIKey}, videoRepo, videoPosterDir)
		}
	}()

	// ---- Trending repos poll (every 12h) ----
	go func() {
		run := func() {
			repos, err := enricher.FetchTrendingRepos(githubToken)
			if err != nil {
				log.Printf("trending: fetch: %v", err)
				return
			}
			if err := enricher.SaveTrendingSnapshot(rawDB, repos); err != nil {
				log.Printf("trending: save: %v", err)
				return
			}
			log.Printf("trending: saved %d repos", len(repos))
			go enricher.BackfillStarHistory(rawDB, repos, githubToken)
			if len(geminiKeys) > 0 || openRouterKey != "" {
				enricher.EnrichWithAI(rawDB, geminiKeys, openRouterKey)
			}
		}
		run()
		ticker := time.NewTicker(12 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			run()
		}
	}()

	addr := ":8080"
	log.Printf("cozyroom listening on %s", addr)

	// Wrap mux to intercept Teams webhook without circular import
	handler := http.Handler(mux)
	if teamsBot != nil {
		teamsHandler := teamsBot.Handler()
		handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/teams/messages" && r.Method == http.MethodPost {
				teamsHandler(w, r)
				return
			}
			mux.ServeHTTP(w, r)
		})
	}

	srv := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,  // chặn slowloris
		WriteTimeout:      5 * time.Minute,   // đủ cho HLS + audio stream qua 5G
		IdleTimeout:       2 * time.Minute,   // giải phóng goroutine khi client drop
	}
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
