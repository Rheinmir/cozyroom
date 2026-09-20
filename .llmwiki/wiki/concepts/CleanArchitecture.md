# Architecture: Clean Architecture & ACID Backend

## Summary
The backend is structured into four explicit layers following Clean Architecture principles. All SQL access is isolated in the `repository/sqlite` layer; business logic lives in `usecase`; HTTP delivery in `api`. A Unit of Work factory provides ACID-safe multi-step writes.

## Layer Map

```
cmd/server/main.go          ← DI wiring: DB → Repos → Usecases → Router
internal/
├── domain/                 ← Pure interfaces + entities (no deps)
│   ├── entity.go           ← Artist, Album, Track, Stats, TrackMeta, SearchResult
│   └── repository.go       ← Repository interfaces + UnitOfWork / UnitOfWorkFactory
├── repository/sqlite/      ← SQL implementations
│   ├── sqlite.go           ← querier abstraction, UoWFactory, compile-time guards
│   ├── artist.go           ← ArtistRepo
│   ├── album.go            ← AlbumRepo
│   ├── track.go            ← TrackRepo (incl. SmartQueue)
│   ├── search.go           ← SearchRepo
│   ├── stats.go            ← StatsRepo
│   ├── lyrics_cache.go     ← LyricsCacheRepo
│   └── settings.go         ← SettingsRepo
├── usecase/                ← Business logic (depends only on domain interfaces)
│   ├── library.go          ← LibraryUsecase
│   ├── lyrics.go           ← LyricsUsecase
│   └── settings.go         ← SettingsUsecase
├── api/                    ← HTTP delivery (no sql.DB, no raw SQL)
│   ├── handler.go          ← All handlers via usecase methods
│   ├── routes.go           ← RouterDeps struct for DI
│   ├── lyrics.go           ← [[concepts/Lyrics|Lyrics]] multi-source handler
│   ├── lastfm.go           ← Last.fm handlers
│   └── scan.go             ← Scan bridge (passes raw DB to library.Scan)
├── library/scanner.go      ← Unchanged; own internal db.Begin() TX (already ACID)
├── enricher/deezer.go      ← Accepts domain.ArtistRepository
├── db/, transcode/, metrics/ ← Unchanged infrastructure packages
```

## ACID Guarantees
- **[[concepts/Scanner|Scanner]]**: wraps entire walk in a single `db.Begin()` / `tx.Commit()` transaction — unchanged.
- **[[concepts/Lyrics|Lyrics]] cache writes** (`LyricsCacheRepo.Set/Delete`): single-statement, atomically consistent via SQLite's autocommit.
- **Unit of Work** (`UoWFactory.Begin()`): available for future multi-repo atomic operations; currently used via compile-time guards.
- **All handler writes**: routed through repository methods — no ad-hoc `db.Exec` in delivery layer.

## Key Decisions
- **`scanDB *sql.DB` in handlers**: [[concepts/Scanner|Scanner]] and enricher manage their own transactions internally. Passing raw DB only to these two is a deliberate boundary rather than breaking their existing ACID logic.
- **No N+1**: All JOINs (listAlbums, listTracks, smartQueue, search) remain as single queries inside their respective repo methods.
- **Frontend contract unchanged**: All JSON keys preserved; `go build ./...` + live smoke check confirmed 832 artists / 1148 albums / 2566 tracks.

## Origin
- **Draft:** `wiki/sources/draft/100526-clean-architecture-acid-refactor-backend.md`
- **Commit:** `e01eebf — refactor: enforce clean architecture and ACID guarantees across backend`
- **Date promoted:** 2026-05-10
