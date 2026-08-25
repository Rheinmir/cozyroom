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
	ID             string   `json:"id"`
	BoardID        string   `json:"board_id"`
	ColumnID       string   `json:"column_id"`
	Title          string   `json:"title"`
	Content        string   `json:"content"`
	Position       int      `json:"position"`
	Priority       string   `json:"priority"`
	DueDate        *int64   `json:"due_date"`
	AssignedUserID string   `json:"assigned_user_id"`
	LabelIDs       []string `json:"label_ids"`
	SubtaskTotal   int      `json:"subtask_total"`
	SubtaskDone    int      `json:"subtask_done"`
	CreatedAt      int64    `json:"created_at"`
	UpdatedAt      int64    `json:"updated_at"`
}

// fetchNotesByBoard loads every note on a board plus its label ids and
// subtask progress. Label ids are fetched per-note (small personal dataset,
// same N+1-per-item convention already used for playlists' track/cover ids).
func (h *NotesHandlers) fetchNotesByBoard(boardID string) ([]kanbanNote, error) {
	rows, err := h.db.Query(`
		SELECT n.id, n.board_id, n.column_id, n.title, n.content, n.position,
		       n.priority, n.due_date, n.assigned_user_id, n.created_at, n.updated_at,
		       COALESCE(st.total, 0), COALESCE(st.done, 0)
		FROM kanban_notes n
		LEFT JOIN (
			SELECT note_id, COUNT(*) AS total, COUNT(*) FILTER (WHERE done = 1) AS done
			FROM kanban_subtasks GROUP BY note_id
		) st ON st.note_id = n.id
		WHERE n.board_id = $1
		ORDER BY n.column_id ASC, n.position ASC`, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	notes := []kanbanNote{}
	for rows.Next() {
		var n kanbanNote
		if err := rows.Scan(&n.ID, &n.BoardID, &n.ColumnID, &n.Title, &n.Content, &n.Position,
			&n.Priority, &n.DueDate, &n.AssignedUserID, &n.CreatedAt, &n.UpdatedAt,
			&n.SubtaskTotal, &n.SubtaskDone); err != nil {
			return nil, err
		}
		n.LabelIDs = []string{}
		notes = append(notes, n)
	}
	for i := range notes {
		lRows, err := h.db.Query("SELECT label_id FROM kanban_note_labels WHERE note_id = $1", notes[i].ID)
		if err != nil {
			continue
		}
		for lRows.Next() {
			var lid string
			if lRows.Scan(&lid) == nil {
				notes[i].LabelIDs = append(notes[i].LabelIDs, lid)
			}
		}
		lRows.Close()
	}
	return notes, nil
}

func (h *NotesHandlers) fetchNote(id string) (kanbanNote, error) {
	var n kanbanNote
	err := h.db.QueryRow(`
		SELECT n.id, n.board_id, n.column_id, n.title, n.content, n.position,
		       n.priority, n.due_date, n.assigned_user_id, n.created_at, n.updated_at,
		       COALESCE(st.total, 0), COALESCE(st.done, 0)
		FROM kanban_notes n
		LEFT JOIN (
			SELECT note_id, COUNT(*) AS total, COUNT(*) FILTER (WHERE done = 1) AS done
			FROM kanban_subtasks GROUP BY note_id
		) st ON st.note_id = n.id
		WHERE n.id = $1`, id,
	).Scan(&n.ID, &n.BoardID, &n.ColumnID, &n.Title, &n.Content, &n.Position,
		&n.Priority, &n.DueDate, &n.AssignedUserID, &n.CreatedAt, &n.UpdatedAt,
		&n.SubtaskTotal, &n.SubtaskDone)
	if err != nil {
		return n, err
	}
	n.LabelIDs = []string{}
	lRows, err := h.db.Query("SELECT label_id FROM kanban_note_labels WHERE note_id = $1", id)
	if err == nil {
		for lRows.Next() {
			var lid string
			if lRows.Scan(&lid) == nil {
				n.LabelIDs = append(n.LabelIDs, lid)
			}
		}
		lRows.Close()
	}
	return n, nil
}

func (h *NotesHandlers) replaceNoteLabels(noteID string, labelIDs []string) {
	h.db.Exec("DELETE FROM kanban_note_labels WHERE note_id = $1", noteID)
	for _, lid := range labelIDs {
		h.db.Exec("INSERT INTO kanban_note_labels (note_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", noteID, lid)
	}
}

// validColumnInBoard confirms columnID actually belongs to boardID before a
// note gets written into it — prevents cross-board data corruption from a
// stale or forged column_id.
func (h *NotesHandlers) validColumnInBoard(boardID, columnID string) bool {
	var owner string
	err := h.db.QueryRow("SELECT board_id FROM kanban_columns WHERE id = $1", columnID).Scan(&owner)
	return err == nil && owner == boardID
}

// noteBoardID looks up the board a note lives on — subtask/comment handlers
// only have the note ID from the URL, not the board, but permission is
// checked per-board (040826 module 1).
func (h *NotesHandlers) noteBoardID(noteID string) (string, error) {
	var boardID string
	err := h.db.QueryRow("SELECT board_id FROM kanban_notes WHERE id = $1", noteID).Scan(&boardID)
	return boardID, err
}

// GET /api/notes?board_id=...
func (h *NotesHandlers) listNotes(w http.ResponseWriter, r *http.Request) {
	if _, ok := verifyKanbanAccess(h.db, r); !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	boardID := r.URL.Query().Get("board_id")
	if boardID == "" {
		boardID = "default"
	}

	notes, err := h.fetchNotesByBoard(boardID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(notes)
}

// POST /api/notes
func (h *NotesHandlers) createNote(w http.ResponseWriter, r *http.Request) {
	identity, ok := verifyKanbanAccess(h.db, r)
	if !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}

	var body struct {
		BoardID        string   `json:"board_id"`
		ColumnID       string   `json:"column_id"`
		Title          string   `json:"title"`
		Content        string   `json:"content"`
		Priority       string   `json:"priority"`
		DueDate        *int64   `json:"due_date"`
		AssignedUserID string   `json:"assigned_user_id"`
		LabelIDs       []string `json:"label_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	title := strings.TrimSpace(body.Title)
	boardID := strings.TrimSpace(body.BoardID)
	columnID := strings.TrimSpace(body.ColumnID)
	if title == "" || boardID == "" || columnID == "" {
		http.Error(w, "title, board_id and column_id cannot be empty", http.StatusBadRequest)
		return
	}
	if !hasPermission(h.db, identity, boardID, "note", "create") {
		http.Error(w, "forbidden: missing note:create permission", http.StatusForbidden)
		return
	}
	if !h.validColumnInBoard(boardID, columnID) {
		http.Error(w, "column_id does not belong to board_id", http.StatusBadRequest)
		return
	}

	id := genHexID()
	var pos int
	_ = h.db.QueryRow("SELECT COALESCE(MAX(position), 0) + 1 FROM kanban_notes WHERE column_id = $1", columnID).Scan(&pos)

	_, err := h.db.Exec(`
		INSERT INTO kanban_notes (id, board_id, column_id, title, content, position, priority, due_date, assigned_user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		id, boardID, columnID, title, body.Content, pos, body.Priority, body.DueDate, body.AssignedUserID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if len(body.LabelIDs) > 0 {
		h.replaceNoteLabels(id, body.LabelIDs)
	}

	n, err := h.fetchNote(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(n)
}

// PUT /api/notes/{id} — edit fields, or move to a different column/board/position
func (h *NotesHandlers) updateNote(w http.ResponseWriter, r *http.Request) {
	identity, ok := verifyKanbanAccess(h.db, r)
	if !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}

	id := r.PathValue("id")

	var body struct {
		BoardID        string   `json:"board_id"`
		ColumnID       string   `json:"column_id"`
		Title          string   `json:"title"`
		Content        string   `json:"content"`
		Position       int      `json:"position"`
		Priority       string   `json:"priority"`
		DueDate        *int64   `json:"due_date"`
		AssignedUserID string   `json:"assigned_user_id"`
		LabelIDs       []string `json:"label_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	title := strings.TrimSpace(body.Title)
	boardID := strings.TrimSpace(body.BoardID)
	columnID := strings.TrimSpace(body.ColumnID)
	if title == "" || boardID == "" || columnID == "" {
		http.Error(w, "title, board_id and column_id cannot be empty", http.StatusBadRequest)
		return
	}
	if !hasPermission(h.db, identity, boardID, "note", "update") {
		http.Error(w, "forbidden: missing note:update permission", http.StatusForbidden)
		return
	}
	if !h.validColumnInBoard(boardID, columnID) {
		http.Error(w, "column_id does not belong to board_id", http.StatusBadRequest)
		return
	}

	res, err := h.db.Exec(`
		UPDATE kanban_notes
		SET board_id = $1, column_id = $2, title = $3, content = $4, position = $5,
		    priority = $6, due_date = $7, assigned_user_id = $8,
		    updated_at = EXTRACT(EPOCH FROM NOW())::INTEGER
		WHERE id = $9`,
		boardID, columnID, title, body.Content, body.Position, body.Priority, body.DueDate, body.AssignedUserID, id,
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
	h.replaceNoteLabels(id, body.LabelIDs)

	w.WriteHeader(http.StatusNoContent)
}

// DELETE /api/notes/{id}
func (h *NotesHandlers) deleteNote(w http.ResponseWriter, r *http.Request) {
	identity, ok := verifyKanbanAccess(h.db, r)
	if !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}

	id := r.PathValue("id")
	if boardID, err := h.noteBoardID(id); err == nil && !hasPermission(h.db, identity, boardID, "note", "delete") {
		http.Error(w, "forbidden: missing note:delete permission", http.StatusForbidden)
		return
	}

	h.db.Exec("DELETE FROM kanban_note_labels WHERE note_id = $1", id)
	h.db.Exec("DELETE FROM kanban_subtasks WHERE note_id = $1", id)
	h.db.Exec("DELETE FROM kanban_comments WHERE note_id = $1", id)

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

type kanbanSubtask struct {
	ID       string `json:"id"`
	NoteID   string `json:"note_id"`
	Title    string `json:"title"`
	Done     bool   `json:"done"`
	Position int    `json:"position"`
}

// GET /api/notes/{id}/subtasks
func (h *NotesHandlers) listSubtasks(w http.ResponseWriter, r *http.Request) {
	if _, ok := verifyKanbanAccess(h.db, r); !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	noteID := r.PathValue("id")

	rows, err := h.db.Query("SELECT id, note_id, title, done, position FROM kanban_subtasks WHERE note_id = $1 ORDER BY position ASC", noteID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	subtasks := []kanbanSubtask{}
	for rows.Next() {
		var s kanbanSubtask
		var done int
		if err := rows.Scan(&s.ID, &s.NoteID, &s.Title, &done, &s.Position); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		s.Done = done != 0
		subtasks = append(subtasks, s)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(subtasks)
}

// POST /api/notes/{id}/subtasks
func (h *NotesHandlers) createSubtask(w http.ResponseWriter, r *http.Request) {
	identity, ok := verifyKanbanAccess(h.db, r)
	if !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	noteID := r.PathValue("id")
	if boardID, err := h.noteBoardID(noteID); err == nil && !hasPermission(h.db, identity, boardID, "note", "update") {
		http.Error(w, "forbidden: missing note:update permission", http.StatusForbidden)
		return
	}

	var body struct {
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	title := strings.TrimSpace(body.Title)
	if title == "" {
		http.Error(w, "title cannot be empty", http.StatusBadRequest)
		return
	}

	id := genHexID()
	var pos int
	_ = h.db.QueryRow("SELECT COALESCE(MAX(position), 0) + 1 FROM kanban_subtasks WHERE note_id = $1", noteID).Scan(&pos)

	if _, err := h.db.Exec("INSERT INTO kanban_subtasks (id, note_id, title, done, position) VALUES ($1, $2, $3, 0, $4)", id, noteID, title, pos); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(kanbanSubtask{ID: id, NoteID: noteID, Title: title, Done: false, Position: pos})
}

// PUT /api/notes/{id}/subtasks/{subtaskId}
func (h *NotesHandlers) updateSubtask(w http.ResponseWriter, r *http.Request) {
	identity, ok := verifyKanbanAccess(h.db, r)
	if !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	if boardID, err := h.noteBoardID(r.PathValue("id")); err == nil && !hasPermission(h.db, identity, boardID, "note", "update") {
		http.Error(w, "forbidden: missing note:update permission", http.StatusForbidden)
		return
	}
	subtaskID := r.PathValue("subtaskId")

	var body struct {
		Title    string `json:"title"`
		Done     bool   `json:"done"`
		Position int    `json:"position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	title := strings.TrimSpace(body.Title)
	if title == "" {
		http.Error(w, "title cannot be empty", http.StatusBadRequest)
		return
	}

	done := 0
	if body.Done {
		done = 1
	}
	res, err := h.db.Exec("UPDATE kanban_subtasks SET title = $1, done = $2, position = $3 WHERE id = $4", title, done, body.Position, subtaskID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		http.Error(w, "subtask not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /api/notes/{id}/subtasks/{subtaskId}
func (h *NotesHandlers) deleteSubtask(w http.ResponseWriter, r *http.Request) {
	identity, ok := verifyKanbanAccess(h.db, r)
	if !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	if boardID, err := h.noteBoardID(r.PathValue("id")); err == nil && !hasPermission(h.db, identity, boardID, "note", "update") {
		http.Error(w, "forbidden: missing note:update permission", http.StatusForbidden)
		return
	}
	res, err := h.db.Exec("DELETE FROM kanban_subtasks WHERE id = $1", r.PathValue("subtaskId"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		http.Error(w, "subtask not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type kanbanComment struct {
	ID           string `json:"id"`
	NoteID       string `json:"note_id"`
	AuthorLabel  string `json:"author_label"`
	Content      string `json:"content"`
	CreatedAt    int64  `json:"created_at"`
}

// GET /api/notes/{id}/comments
func (h *NotesHandlers) listComments(w http.ResponseWriter, r *http.Request) {
	if _, ok := verifyKanbanAccess(h.db, r); !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	noteID := r.PathValue("id")

	rows, err := h.db.Query("SELECT id, note_id, author_label, content, created_at FROM kanban_comments WHERE note_id = $1 ORDER BY created_at ASC", noteID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	comments := []kanbanComment{}
	for rows.Next() {
		var c kanbanComment
		if err := rows.Scan(&c.ID, &c.NoteID, &c.AuthorLabel, &c.Content, &c.CreatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		comments = append(comments, c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comments)
}

// POST /api/notes/{id}/comments — author is the caller's verified identity,
// never a client-supplied name, so nobody can post a comment under another
// person's identity.
func (h *NotesHandlers) createComment(w http.ResponseWriter, r *http.Request) {
	identity, ok := verifyKanbanAccess(h.db, r)
	if !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	noteID := r.PathValue("id")
	if boardID, err := h.noteBoardID(noteID); err == nil && !hasPermission(h.db, identity, boardID, "comment", "create") {
		http.Error(w, "forbidden: missing comment:create permission", http.StatusForbidden)
		return
	}

	var body struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	content := strings.TrimSpace(body.Content)
	if content == "" {
		http.Error(w, "content cannot be empty", http.StatusBadRequest)
		return
	}

	authorUserID := identity.UserID
	authorLabel := identity.Username
	id := genHexID()
	if _, err := h.db.Exec(
		"INSERT INTO kanban_comments (id, note_id, author_user_id, author_label, content) VALUES ($1, $2, $3, $4, $5)",
		id, noteID, authorUserID, authorLabel, content,
	); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var createdAt int64
	_ = h.db.QueryRow("SELECT created_at FROM kanban_comments WHERE id = $1", id).Scan(&createdAt)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(kanbanComment{ID: id, NoteID: noteID, AuthorLabel: authorLabel, Content: content, CreatedAt: createdAt})
}

// DELETE /api/notes/{id}/comments/{commentId}
func (h *NotesHandlers) deleteComment(w http.ResponseWriter, r *http.Request) {
	identity, ok := verifyKanbanAccess(h.db, r)
	if !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	if boardID, err := h.noteBoardID(r.PathValue("id")); err == nil && !hasPermission(h.db, identity, boardID, "comment", "delete") {
		http.Error(w, "forbidden: missing comment:delete permission", http.StatusForbidden)
		return
	}
	res, err := h.db.Exec("DELETE FROM kanban_comments WHERE id = $1", r.PathValue("commentId"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		http.Error(w, "comment not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
