package api

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"cozyroom/internal/domain"
)

type PlaylistHandlers struct {
	db *sql.DB
}

const OwnerPassword = "owner712002"

func verifyOwnerPassword(r *http.Request) bool {
	pw := r.Header.Get("X-Owner-Password")
	if pw == "" {
		pw = r.URL.Query().Get("password")
	}
	return pw == OwnerPassword
}

func genHexID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x", b)
}

// GET /api/playlists
func (h *PlaylistHandlers) listPlaylists(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	rows, err := h.db.Query("SELECT id, name, created_at FROM playlists ORDER BY name ASC")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type playlistJSON struct {
		ID        string   `json:"id"`
		Name      string   `json:"name"`
		CreatedAt int64    `json:"created_at"`
		TrackIDs  []string `json:"track_ids"`
		CoverIDs  []string `json:"cover_ids"`
	}

	playlists := []playlistJSON{}
	for rows.Next() {
		var p playlistJSON
		if err := rows.Scan(&p.ID, &p.Name, &p.CreatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		p.TrackIDs = []string{}
		playlists = append(playlists, p)
	}

	// Fetch track IDs for each playlist
	for i, p := range playlists {
		tRows, err := h.db.Query("SELECT track_id FROM playlist_tracks WHERE playlist_id = $1 ORDER BY position ASC", p.ID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		for tRows.Next() {
			var tid string
			if err := tRows.Scan(&tid); err == nil {
				playlists[i].TrackIDs = append(playlists[i].TrackIDs, tid)
			}
		}
		tRows.Close()

		cRows, err := h.db.Query(
			`SELECT id FROM (
			   SELECT al.id, MIN(pt.position) AS first_pos
			   FROM playlist_tracks pt
			   JOIN tracks t ON t.id = pt.track_id
			   JOIN albums al ON al.id = t.album_id
			   WHERE pt.playlist_id = $1
			   GROUP BY al.id
			   ORDER BY first_pos ASC LIMIT 4
			 ) sub`, p.ID)
		if err == nil {
			for cRows.Next() {
				var aid string
				if cRows.Scan(&aid) == nil {
					playlists[i].CoverIDs = append(playlists[i].CoverIDs, aid)
				}
			}
			cRows.Close()
		}
		if playlists[i].CoverIDs == nil {
			playlists[i].CoverIDs = []string{}
		}
	}

	json.NewEncoder(w).Encode(playlists)
}

// GET /api/playlists/{id}/tracks
func (h *PlaylistHandlers) listPlaylistTracks(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := r.PathValue("id")

	// Verify playlist exists
	var name string
	err := h.db.QueryRow("SELECT name FROM playlists WHERE id = $1", id).Scan(&name)
	if err == sql.ErrNoRows {
		http.Error(w, "playlist not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Query tracks (COALESCE guards against NULL track_num/duration_s from old scans)
	rows, err := h.db.Query(`
		SELECT t.id, t.album_id, t.title,
		       COALESCE(t.track_num, 0), COALESCE(t.duration_s, 0),
		       al.title as album_title, ar.name as artist_name, ar.id as artist_id
		FROM playlist_tracks pt
		JOIN tracks t ON t.id = pt.track_id
		JOIN albums al ON al.id = t.album_id
		JOIN artists ar ON ar.id = al.artist_id
		WHERE pt.playlist_id = $1
		ORDER BY pt.position ASC
	`, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	tracks := []domain.Track{}
	for rows.Next() {
		var t domain.Track
		err := rows.Scan(
			&t.ID, &t.AlbumID, &t.Title, &t.TrackNum, &t.DurationS,
			&t.AlbumTitle, &t.ArtistName, &t.ArtistID,
		)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		tracks = append(tracks, t)
	}

	json.NewEncoder(w).Encode(tracks)
}

// POST /api/playlists
func (h *PlaylistHandlers) createPlaylist(w http.ResponseWriter, r *http.Request) {
	if !verifyOwnerPassword(r) {
		http.Error(w, "unauthorized: correct password required", http.StatusUnauthorized)
		return
	}

	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(body.Name)
	if name == "" {
		http.Error(w, "playlist name cannot be empty", http.StatusBadRequest)
		return
	}

	id := genHexID()
	createdAt := time.Now().Unix()

	_, err := h.db.Exec("INSERT INTO playlists (id, name, created_at) VALUES ($1, $2, $3)", id, name, createdAt)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{"id": id, "name": name, "created_at": createdAt})
}

// DELETE /api/playlists/{id}
func (h *PlaylistHandlers) deletePlaylist(w http.ResponseWriter, r *http.Request) {
	if !verifyOwnerPassword(r) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	id := r.PathValue("id")

	// Delete track associations manually to be completely safe
	_, _ = h.db.Exec("DELETE FROM playlist_tracks WHERE playlist_id = $1", id)

	res, err := h.db.Exec("DELETE FROM playlists WHERE id = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "playlist not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// POST /api/playlists/{id}/tracks
func (h *PlaylistHandlers) addTrackToPlaylist(w http.ResponseWriter, r *http.Request) {
	if !verifyOwnerPassword(r) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	id := r.PathValue("id")

	var body struct {
		TrackID string `json:"track_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	trackID := strings.TrimSpace(body.TrackID)
	if trackID == "" {
		http.Error(w, "track_id cannot be empty", http.StatusBadRequest)
		return
	}

	// Verify track exists in DB
	var exists int
	err := h.db.QueryRow("SELECT 1 FROM tracks WHERE id = $1", trackID).Scan(&exists)
	if err == sql.ErrNoRows {
		http.Error(w, "track not found", http.StatusBadRequest)
		return
	} else if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Check if already in playlist
	var count int
	_ = h.db.QueryRow("SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = $1 AND track_id = $2", id, trackID).Scan(&count)
	if count > 0 {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Find max position
	var pos int
	_ = h.db.QueryRow("SELECT COALESCE(MAX(position), 0) + 1 FROM playlist_tracks WHERE playlist_id = $1", id).Scan(&pos)

	// Insert association
	_, err = h.db.Exec("INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES ($1, $2, $3)", id, trackID, pos)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

// DELETE /api/playlists/{id}/tracks/{track_id}
func (h *PlaylistHandlers) removeTrackFromPlaylist(w http.ResponseWriter, r *http.Request) {
	if !verifyOwnerPassword(r) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	id := r.PathValue("id")
	trackID := r.PathValue("track_id")

	_, err := h.db.Exec("DELETE FROM playlist_tracks WHERE playlist_id = $1 AND track_id = $2", id, trackID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
