package mcp

import (
	"fmt"
	"strings"
)

func formatDelta(n int) string {
	if n >= 1000 {
		return fmt.Sprintf("%d,%03d", n/1000, n%1000)
	}
	return fmt.Sprintf("%d", n)
}

// TrimTrack strips a Track to minimal fields for AI context.
func TrimTrack(id, title, artist, album string, dur int) map[string]any {
	m := map[string]any{"id": id, "t": title, "ar": artist, "dur": dur}
	if album != "" {
		m["al"] = album
	}
	return m
}

// TrimArtist strips an Artist to minimal fields.
func TrimArtist(id, name string) map[string]any {
	return map[string]any{"id": id, "name": name}
}

// TrimRepo strips a TrendingRepo to minimal fields.
func TrimRepo(id, name, lang, tier string, stars, delta, imp int, topics []string) map[string]any {
	t := topics
	if len(t) > 5 {
		t = t[:5]
	}
	return map[string]any{
		"id":   id,
		"name": name,
		"lang": lang,
		"tier": tier,
		"Δ⭐":  delta,
		"imp":  imp,
		"top":  t,
	}
}

// Paginate returns first max items and the total count.
func Paginate[T any](items []T, max int) ([]T, int) {
	total := len(items)
	if total <= max {
		return items, total
	}
	return items[:max], total
}

// TruncStr caps a string at max chars, appending "…" if cut.
func TruncStr(s string, max int) string {
	s = strings.TrimSpace(s)
	if len([]rune(s)) <= max {
		return s
	}
	runes := []rune(s)[:max]
	return string(runes) + "…"
}
