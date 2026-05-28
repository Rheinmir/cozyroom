package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"cozyroom/internal/transcode"
)

type trickplayMeta struct {
	Ready       bool   `json:"ready"`
	IntervalS   int    `json:"interval_s"`
	Cols        int    `json:"cols"`
	FrameWidth  int    `json:"frame_width"`
	FrameHeight int    `json:"frame_height"`
	Count       int    `json:"count"`
	SpriteURL   string `json:"sprite_url,omitempty"`
}

func (h *VideoHandlers) trickplayMeta(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	v, err := h.uc.GetVideo(r.Context(), id)
	if err != nil || v == nil {
		http.NotFound(w, r)
		return
	}

	spritePath := filepath.Join(h.trickplayDir, id+".png")

	if !v.TrickplayReady {
		// trigger generation in background if file also doesn't exist yet
		if _, err := os.Stat(spritePath); os.IsNotExist(err) {
			go func() {
				ctx := context.Background()
				if err := transcode.GenerateTrickplay(ctx, v.FilePath, spritePath); err != nil {
					log.Printf("trickplay: generate %s: %v", id, err)
					return
				}
				if err := h.uc.Videos.SetTrickplayReady(ctx, id); err != nil {
					log.Printf("trickplay: set ready %s: %v", id, err)
				}
			}()
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(trickplayMeta{
			Ready:       false,
			IntervalS:   transcode.TrickplayIntervalS,
			Cols:        transcode.TrickplayCols,
			FrameWidth:  transcode.TrickplayFrameWidth,
			FrameHeight: transcode.TrickplayFrameHeight,
		})
		return
	}

	count := 0
	if transcode.TrickplayIntervalS > 0 && v.DurationS > 0 {
		count = (v.DurationS + transcode.TrickplayIntervalS - 1) / transcode.TrickplayIntervalS
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(trickplayMeta{
		Ready:       true,
		IntervalS:   transcode.TrickplayIntervalS,
		Cols:        transcode.TrickplayCols,
		FrameWidth:  transcode.TrickplayFrameWidth,
		FrameHeight: transcode.TrickplayFrameHeight,
		Count:       count,
		SpriteURL:   "/api/trickplay/" + id + "/sprite",
	})
}

func (h *VideoHandlers) trickplaySprite(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	spritePath := filepath.Join(h.trickplayDir, id+".png")
	if _, err := os.Stat(spritePath); os.IsNotExist(err) {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	http.ServeFile(w, r, spritePath)
}
