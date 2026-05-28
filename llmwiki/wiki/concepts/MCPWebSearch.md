# MCP Web Search + Browse URL
**Type:** concept
**Tags:** mcp, ai, web, search, cloak-proxy

Two MCP tools for AI agent to access live web information, routed through the existing cloak proxy service.

## Tools

### `web_search(query)`
- Calls DuckDuckGo Instant Answer API: `https://api.duckduckgo.com/?q=<query>&format=json&no_html=1&skip_disambig=1`
- Returns: `abstract_text`, `abstract_url`, `abstract_title`, `answer`, `results[]`, `related_topics[]`
- No API key required
- Routed via `fetchViaCloak(d.CloakProxyURL, searchURL)`

### `browse_url(url)`
- Fetches arbitrary public URL via cloak proxy
- Strips HTML tags (`<[^>]+>` regex), collapses whitespace, truncates to 5000 chars
- Returns `{url, text}`
- No SSRF guard implemented (relies on cloak proxy being a trusted service)

## Architecture

```
AI agent → MCP tool → fetchViaCloak() → POST {cloakURL}/fetch {"url":"..."} → cloak service → target URL
                                      ↑ fallback: direct HTTP if no cloakURL
```

`fetchViaCloak` (registry.go): sends `POST {cloakURL}/fetch` with `{"url": targetURL}`, reads `{"html": ..., "error": ...}`. Both tools fail gracefully with `"cloak proxy not configured"` if `CloakProxyURL` empty.

## Configuration

`ToolDeps.CloakProxyURL` wired from `RouterDeps.CloakProxyURL` in `routes.go`. Set via environment variable `CLOAK_PROXY_URL` (same as existing scraper usage).

## Limitations

- `web_search` via DDG Instant Answer API returns limited results for long-tail queries — consider adding HTML fallback (`html.duckduckgo.com/html/`) if needed
- `browse_url` strips HTML but does not execute JS — no SPA content
- No caching of search results
- Browser control (click, type, screenshot) needs Playwright service — out of scope

## Origin

- **Draft:** `llmwiki/wiki/sources/draft/280526-mcp-web-search-browse.md`
- **Source:** `backend/internal/mcp/registry.go` — `webSearchTool`, `browseURLTool`, `fetchViaCloak`
- **Date:** 2026-05-28
