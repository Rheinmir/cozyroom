package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"cozyroom/internal/api"
	"cozyroom/internal/cron"
	"cozyroom/internal/db"
	"cozyroom/internal/discord"
	"cozyroom/internal/telegram"
	"cozyroom/internal/enricher"
	"cozyroom/internal/hls"
	"cozyroom/internal/library"
	repo "cozyroom/internal/repository/sqlite"
	"cozyroom/internal/usecase"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	geminiKey       := envOr("GEMINI_API_KEY", "")
	openRouterKey   := envOr("OPENROUTER_API_KEY", "")
	anthropicKey    := envOr("ANTHROPIC_API_KEY", "")
	deepseekKey     := envOr("DEEPSEEK_API_KEY", "")
	githubToken     := envOr("GITHUB_TOKEN", "")
	dbPath          := envOr("DB_PATH", "/data/metadata.db")
	musicPath       := envOr("MUSIC_PATH", "/music")
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

	database, err := db.Open(dbPath)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer database.Close()

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

	// ---- Repository layer ----
	artistRepo  := repo.NewArtistRepo(database)
	albumRepo   := repo.NewAlbumRepo(database)
	trackRepo   := repo.NewTrackRepo(database)
	searchRepo  := &repo.SearchRepo{DB: database}
	statsRepo   := &repo.StatsRepo{DB: database}
	cacheRepo   := &repo.LyricsCacheRepo{DB: database}
	settingsRepo := &repo.SettingsRepo{DB: database}
	videoRepo    := repo.NewVideoRepo(database)
	playbackRepo := &repo.PlaybackRepo{DB: database}
	uowFactory   := &repo.UoWFactory{DB: database}

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
		ScanDB:       database,
		DBPath:       dbPath,
		MusicPath:    musicPath,
		FilmsPath:    filmsPath,
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
		OpenRouterKey: openRouterKey,
		GithubToken:   githubToken,
		ComicsDir:     comicsDir,
		MaxComicsGB:   50,
		AnthropicKey:  anthropicKey,
		DeepSeekKey:   deepseekKey,
	})
	go dl.Start(ctx)

	cronMgr := cron.NewCronManager(database, aiHandlers)
	api.GlobalReloadCron = cronMgr.LoadAndScheduleAll
	if err := cronMgr.Start(); err != nil {
		log.Printf("[Cron] Start error: %v", err)
	}
	defer cronMgr.Stop()

	tgBot := telegram.NewTelegramBot(aiHandlers)
	if tgBot != nil {
		tgBot.Start()
	}

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
			res, err := library.Scan(database, musicPath, coversDir)
			if err != nil {
				log.Printf("scan error: %v", err)
			} else {
				log.Printf("scan done: %d tracks, %d errors", res.Tracks, res.Errors)
			}
		}
		if videoRepo.IsEmpty(context.Background()) {
			log.Printf("background scan videos started: %s", filmsPath)
			if err := library.ScanVideos(database, filmsPath); err != nil {
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
			_ = library.ScanEbooks(database, ebooksPath, ebookCoversDir)
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
			if err := enricher.SaveTrendingSnapshot(database, repos); err != nil {
				log.Printf("trending: save: %v", err)
				return
			}
			log.Printf("trending: saved %d repos", len(repos))
			go enricher.BackfillStarHistory(database, repos, githubToken)
			if geminiKey != "" || openRouterKey != "" {
				enricher.EnrichWithAI(database, geminiKey, openRouterKey)
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
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
