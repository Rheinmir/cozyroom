package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
)

type NotesHandlers struct {
	db *sql.DB
}

type kanbanNote struct {
	ID        string `json:"id"`
	ColumnKey string `json:"column_key"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	Position  int    `json:"position"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

// GET /api/notes
func (h *NotesHandlers) listNotes(w http.ResponseWriter, r *http.Request) {
	if !verifyOwnerPassword(r) {
		http.Error(w, "unauthorized: correct password required", http.StatusUnauthorized)
		return
	}

	rows, err := h.db.Query(`
		SELECT id, column_key, title, content, position, created_at, updated_at
		FROM kanban_notes ORDER BY column_key ASC, position ASC`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	notes := []kanbanNote{}
	for rows.Next() {
		var n kanbanNote
		if err := rows.Scan(&n.ID, &n.ColumnKey, &n.Title, &n.Content, &n.Position, &n.CreatedAt, &n.UpdatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		notes = append(notes, n)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(notes)
}

// POST /api/notes
func (h *NotesHandlers) createNote(w http.ResponseWriter, r *http.Request) {
	if !verifyOwnerPassword(r) {
		http.Error(w, "unauthorized: correct password required", http.StatusUnauthorized)
		return
	}

	var body struct {
		ColumnKey string `json:"column_key"`
		Title     string `json:"title"`
		Content   string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	title := strings.TrimSpace(body.Title)
	col := strings.TrimSpace(body.ColumnKey)
	if title == "" || col == "" {
		http.Error(w, "title and column_key cannot be empty", http.StatusBadRequest)
		return
	}

	id := genHexID()
	var pos int
	_ = h.db.QueryRow("SELECT COALESCE(MAX(position), 0) + 1 FROM kanban_notes WHERE column_key = $1", col).Scan(&pos)

	var n kanbanNote
	err := h.db.QueryRow(`
		INSERT INTO kanban_notes (id, column_key, title, content, position)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, column_key, title, content, position, created_at, updated_at`,
		id, col, title, body.Content, pos,
	).Scan(&n.ID, &n.ColumnKey, &n.Title, &n.Content, &n.Position, &n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(n)
}

// PUT /api/notes/{id} — edit title/content, or move to a different column/position
func (h *NotesHandlers) updateNote(w http.ResponseWriter, r *http.Request) {
	if !verifyOwnerPassword(r) {
		http.Error(w, "unauthorized: correct password required", http.StatusUnauthorized)
		return
	}

	id := r.PathValue("id")

	var body struct {
		ColumnKey string `json:"column_key"`
		Title     string `json:"title"`
		Content   string `json:"content"`
		Position  int    `json:"position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	title := strings.TrimSpace(body.Title)
	col := strings.TrimSpace(body.ColumnKey)
	if title == "" || col == "" {
		http.Error(w, "title and column_key cannot be empty", http.StatusBadRequest)
		return
	}

	res, err := h.db.Exec(`
		UPDATE kanban_notes
		SET column_key = $1, title = $2, content = $3, position = $4, updated_at = EXTRACT(EPOCH FROM NOW())::INTEGER
		WHERE id = $5`,
		col, title, body.Content, body.Position, id,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "note not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// DELETE /api/notes/{id}
func (h *NotesHandlers) deleteNote(w http.ResponseWriter, r *http.Request) {
	if !verifyOwnerPassword(r) {
		http.Error(w, "unauthorized: correct password required", http.StatusUnauthorized)
		return
	}

	id := r.PathValue("id")

	res, err := h.db.Exec("DELETE FROM kanban_notes WHERE id = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "note not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
