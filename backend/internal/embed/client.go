// Package embed is a thin client for the in-cluster embedding sidecar
// (HuggingFace text-embeddings-inference serving intfloat/multilingual-e5-base).
//
// Callers own the e5 instruction prefix: use "query: <text>" for search queries
// and "passage: <text>" for indexed documents — the client embeds text verbatim.
package embed

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// Client talks to the TEI /embed endpoint.
type Client struct {
	url  string
	http *http.Client
}

// New builds a client. Endpoint comes from EMBED_URL (default: the in-cluster
// service http://embed/embed).
func New() *Client {
	url := os.Getenv("EMBED_URL")
	if url == "" {
		url = "http://embed/embed"
	}
	return &Client{url: url, http: &http.Client{Timeout: 30 * time.Second}}
}

// Embed returns one 768-dim vector per input, in the same order. Empty input
// returns nil without a request.
func (c *Client) Embed(ctx context.Context, inputs []string) ([][]float32, error) {
	if len(inputs) == 0 {
		return nil, nil
	}
	body, _ := json.Marshal(map[string]any{"inputs": inputs})

	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt) * 500 * time.Millisecond)
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, bytes.NewReader(body))
		if err != nil {
			return nil, err
		}
		req.Header.Set("content-type", "application/json")

		resp, err := c.http.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		raw, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("embed %d: %s", resp.StatusCode, raw)
			// 4xx won't succeed on retry; fail fast.
			if resp.StatusCode >= 400 && resp.StatusCode < 500 {
				return nil, lastErr
			}
			continue
		}
		var out [][]float32
		if err := json.Unmarshal(raw, &out); err != nil {
			return nil, fmt.Errorf("embed decode: %w", err)
		}
		if len(out) != len(inputs) {
			return nil, fmt.Errorf("embed: got %d vectors for %d inputs", len(out), len(inputs))
		}
		return out, nil
	}
	return nil, fmt.Errorf("embed: all attempts failed: %w", lastErr)
}

// EmbedOne is the single-input convenience wrapper.
func (c *Client) EmbedOne(ctx context.Context, input string) ([]float32, error) {
	vecs, err := c.Embed(ctx, []string{input})
	if err != nil {
		return nil, err
	}
	if len(vecs) != 1 {
		return nil, fmt.Errorf("embed: expected 1 vector, got %d", len(vecs))
	}
	return vecs[0], nil
}
