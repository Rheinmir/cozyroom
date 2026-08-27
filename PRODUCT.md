# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The sole user is the owner/operator (self-hosted, no multi-account system — a couple of owner-password gates exist on specific pages like Notes and the debug Request Log, not per-user accounts). Two simultaneous jobs:
1. Personal media consumption: listening to music, watching video, reading ebooks/comics from a self-curated library.
2. Infrastructure experimentation: Cozyroom doubles as a personal testbed for practicing large-scale traffic handling and system scaling on a home k3s cluster (replicas, observability, load behavior).

## Product Purpose

A self-hosted personal media hub (music/video/ebooks/comics) that consolidates content the user has personally collected — content commercial services (Spotify, Plex, Calibre-web, Komga) either don't host (self-ripped/downloaded, non-commercial-licensed) or split across multiple separate apps. Success means the owner can find, play, read, and manage their own library from one place, with an AI assistant that acts directly on that library (search, play, download from YouTube, manage playlists) via chat.

## Positioning

Unlike commercial streaming/media-server products, Cozyroom is built to run and own the owner's actual self-curated file collection end-to-end (no licensing restriction on content), integrates a chat-driven AI agent with direct MCP tool access into the library itself, and is deliberately operated as a real production workload for the owner to rehearse scaling and reliability practices (k3s, replicas, observability) rather than only to consume media.

## Operating Context

- Deployed on a home k3s (K3S) cluster via Docker images built in WSL2, pushed to a private registry, rolled out with `kubectl rollout restart`.
- Go backend, SQLite metadata store, React/TypeScript + Vite frontend, PWA-capable.
- Accessed via both desktop and mobile web browsers.
- No formal auth/account system; a couple of pages are gated behind an owner-only password stored in localStorage.

## Capabilities and Constraints

- Domains: music (search/playback/Last.fm scrobbling/lyrics with auto-translate), video (HLS streaming/transcode/trickplay), ebooks (reader), comics/manga (scraper-backed), playlists, notes/kanban, AI chat assistant with MCP tools, listening/AI usage stats, a debug request-log page.
- Constraint (explicitly confirmed): Impeccable UI work in this project is frontend-only — do not modify backend (`backend/`), the database/migrations (`db.go`), or `k8s/*.yaml`. All design/audit/polish work stays inside `frontend/src`.
- Existing responsive baseline already established (desktop breakpoint at 900px, separate mobile nav) — preserve it rather than reinventing.

## Evidence on Hand

- `README.md`: "Self-hosted personal media streaming — music, video, comics & ebooks from your local library."
- `frontend/package.json` name: `cozyroom-ui`.
- No formal brand/marketing assets beyond the in-app name "Cozyroom" and its current dark, monochrome-with-Spotify-green-accent visual system (see incumbent CSS in `frontend/src/index.css` — treated as evidence, not yet documented in a DESIGN.md).

## Product Principles

- Preserve the owner's real data and running state — this is a live, actively-used personal system, not a disposable prototype (a hard project rule already forbids touching the production database without explicit confirmation).
- Refine the existing interface rather than replacing its identity; this is an established, daily-used product, not a greenfield build.
- Treat scale/traffic-handling correctness (how the UI and backend behave under real load) as a genuine product value, not just an implementation detail, since the owner explicitly uses this project to rehearse large-scale operation.
- Frontend changes must stay scoped to `frontend/src` and must not require backend/DB/infra changes to ship.

## Accessibility & Inclusion

No accessibility standard has been established as a requirement; single owner-operator context. Still worth a baseline pass (contrast, keyboard focus) as general good practice, but not a compliance target.

## Origin

- Created by `/impeccable init`, 2026-08-26, based on repository evidence (`README.md`, `frontend/package.json`, `AppRoutes.tsx`, `CLAUDE.md`) plus a 3-question interview with the owner covering users/job, purpose/positioning, and durable constraints.
