# Proposal: MCP Web Search + Browse Tools via Cloak Proxy

**Date:** 2026-05-28

## Bối cảnh

Claude's browser extension có 2 chức năng chính:
1. **Background web search** — tìm kiếm ngầm, trả kết quả có cấu trúc
2. **Browser control** — navigate, click, type, screenshot

Cozyroom đã có **cloak proxy** (`POST {cloakURL}/fetch {"url":"..."} → {"html":"..."}`) — generic HTTP fetcher dùng để bypass ban khi scrape E-Hentai. Có thể tái dụng cho AI tools.

## Đánh giá

| Chức năng | Wrap cloak được không? | Lý do |
|---|---|---|
| Web search | ✅ Hoàn toàn phù hợp | DuckDuckGo Instant Answer API (JSON, no auth) hoặc fetch HTML search |
| Browse URL → read content | ✅ Hoàn toàn phù hợp | Cloak fetch bất kỳ URL → Go strip HTML → readable text |
| Browser control (click, type, JS) | ❌ Không fit | Cloak trả HTML tĩnh, không render JS, không interact |

→ **Phase 1**: Implement 2 MCP tools dùng cloak  
→ **Phase 2 (future)**: Extend cloak service với Playwright endpoint nếu cần browser control thực sự

---

## Tính năng 1: `web_search`

**MCP tool:**
```json
{
  "name": "web_search",
  "description": "Search the web. Returns top results with title, URL, snippet.",
  "input": { "query": "string", "limit": "integer (default 5, max 10)" }
}
```

**Backend flow:**
1. Gọi DuckDuckGo Instant Answer API: `https://api.duckduckgo.com/?q=<query>&format=json&no_html=1&skip_disambig=1`
2. Route qua cloak proxy (hoặc direct nếu không có cloak)
3. Parse JSON → extract `RelatedTopics[].Text` + `AbstractText` + `AbstractURL`
4. Fallback: nếu DDG trả ít kết quả → fetch `https://html.duckduckgo.com/html/?q=<query>`, parse `<a class="result__a">` tags
5. Trả `[{title, url, snippet}]` truncated

**Tại sao DuckDuckGo?** Free, no API key, HTML endpoint stable, cloak đủ để bypass geo-block nếu cần.

---

## Tính năng 2: `browse_url`

**MCP tool:**
```json
{
  "name": "browse_url",
  "description": "Fetch content of a URL and return readable text (HTML stripped). Max 4000 chars.",
  "input": { "url": "string" }
}
```

**Backend flow:**
1. Validate URL (must be http/https, no local IPs)
2. `POST {cloakURL}/fetch {"url": url}` → HTML string
3. Go: strip HTML tags (`regexp` hoặc `golang.org/x/net/html` parser), collapse whitespace
4. Return first 4000 chars of cleaned text + source URL

**Use cases:**
- AI đọc documentation page
- Xem nội dung link user paste vào chat
- Fact-check sau khi web_search

---

## Implementation plan

### Backend (Go)
1. Thêm helper `fetchViaCloak(cloakURL, targetURL string) (string, error)` trong `api/` hoặc `mcp/`
2. Add `web_search` tool vào `mcp/registry.go` — cần `CloakProxyURL` trong `ToolDeps`
3. Add `browse_url` tool vào `mcp/registry.go`
4. Update `ToolDeps` struct để thêm `CloakProxyURL string`
5. Wire `CloakProxyURL` trong `routes.go` → `mcpTools`

### Frontend
- Không thay đổi giao diện — tools tự expose qua MCP, AI dùng trong chat

### Estimated effort: ~2h backend only

---

## Risks / Notes

- DuckDuckGo HTML scraping fragile nếu DDG thay layout — dùng JSON API trước, HTML parse là fallback
- `browse_url` cần validate URL để tránh SSRF (block `localhost`, `10.x`, `192.168.x`, `172.16-31.x`)
- Nếu không có cloak configured → fallback direct HTTP (đã có pattern này trong scraper.go)
- Browser control thực sự (Playwright) cần service riêng — để Phase 2

## Origin
User feedback 2026-05-28 — muốn MCP tools giống Claude browser extension, tái dụng cloak proxy.
