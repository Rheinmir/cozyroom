package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
)

type BoardHandlers struct {
	db *sql.DB
}

type kanbanBoard struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Position  int    `json:"position"`
	CreatedAt int64  `json:"created_at"`
}

type kanbanColumn struct {
	ID       string `json:"id"`
	BoardID  string `json:"board_id"`
	Name     string `json:"name"`
	Position int    `json:"position"`
}

type kanbanLabel struct {
	ID      string `json:"id"`
	BoardID string `json:"board_id"`
	Name    string `json:"name"`
	Color   string `json:"color"`
}

type kanbanRole struct {
	ID       string `json:"id"`
	BoardID  string `json:"board_id"`
	Name     string `json:"name"`
	IsSystem bool   `json:"is_system"`
}

type kanbanMember struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	RoleID   string `json:"role_id"`
	RoleName string `json:"role_name"`
}

const (
	fullBoardPerms   = `{"board":["create","read","update","delete"],"column":["create","read","update","delete"],"label":["create","read","update","delete"],"note":["create","read","update","delete","assign"],"comment":["create","read","update","delete"]}`
	memberBoardPerms = `{"board":["read"],"column":["read"],"label":["read"],"note":["create","read","update","delete","assign"],"comment":["create","read","update","delete"]}`
	viewerBoardPerms = `{"board":["read"],"column":["read"],"label":["read"],"note":["read"],"comment":["read"]}`
)

// seedBoardRoles creates the 4 default roles for a newly created board and
// returns the freshly generated 'admin' role's ID, so the caller can grant
// the board's creator that role immediately — without it, a non-owner who
// creates a board would have no membership row and be locked out of writing
// on the board they just made.
func seedBoardRoles(db *sql.DB, boardID string) string {
	roles := []struct{ name, perms string }{
		{"owner", fullBoardPerms},
		{"admin", fullBoardPerms},
		{"member", memberBoardPerms},
		{"viewer", viewerBoardPerms},
	}
	var adminRoleID string
	for i, role := range roles {
		id := genHexID()
		db.Exec("INSERT INTO kanban_roles (id, board_id, name, permissions, is_system, position) VALUES ($1, $2, $3, $4, 1, $5)",
			id, boardID, role.name, role.perms, i)
		if role.name == "admin" {
			adminRoleID = id
		}
	}
	return adminRoleID
}

// GET /api/boards
func (h *BoardHandlers) listBoards(w http.ResponseWriter, r *http.Request) {
	if _, ok := verifyKanbanAccess(h.db, r); !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	rows, err := h.db.Query("SELECT id, name, position, created_at FROM kanban_boards ORDER BY position ASC")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	boards := []kanbanBoard{}
	for rows.Next() {
		var b kanbanBoard
		if err := rows.Scan(&b.ID, &b.Name, &b.Position, &b.CreatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		boards = append(boards, b)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(boards)
}

// POST /api/boards — any verified kanban identity may create a board; there
// is no permission to check against a board that doesn't exist yet. The
// creator (unless already the owner-bypass identity) is granted 'admin' on
// their new board immediately.
func (h *BoardHandlers) createBoard(w http.ResponseWriter, r *http.Request) {
	identity, ok := verifyKanbanAccess(h.db, r)
	if !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
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
		http.Error(w, "name cannot be empty", http.StatusBadRequest)
		return
	}

	id := genHexID()
	var pos int
	_ = h.db.QueryRow("SELECT COALESCE(MAX(position), 0) + 1 FROM kanban_boards").Scan(&pos)

	var b kanbanBoard
	err := h.db.QueryRow(
		"INSERT INTO kanban_boards (id, name, position) VALUES ($1, $2, $3) RETURNING id, name, position, created_at",
		id, name, pos,
	).Scan(&b.ID, &b.Name, &b.Position, &b.CreatedAt)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Seed default columns so a new board is usable immediately, matching
	// the layout every user already knows from the original single-board
	// Kanban — an empty board with no columns reads as broken, not "new".
	for i, colName := range []string{"Cần làm", "Đang làm", "Xong"} {
		h.db.Exec("INSERT INTO kanban_columns (id, board_id, name, position) VALUES ($1, $2, $3, $4)", genHexID(), b.ID, colName, i)
	}

	adminRoleID := seedBoardRoles(h.db, b.ID)
	if !identity.IsOwner {
		h.db.Exec(`
			INSERT INTO kanban_board_members (board_id, user_id, role_id) VALUES ($1, $2, $3)
			ON CONFLICT (board_id, user_id) DO UPDATE SET role_id = $3`, b.ID, identity.UserID, adminRoleID)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(b)
}

// PUT /api/boards/{id} — rename / reorder
func (h *BoardHandlers) updateBoard(w http.ResponseWriter, r *http.Request) {
	identity, ok := verifyKanbanAccess(h.db, r)
	if !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	id := r.PathValue("id")
	if !hasPermission(h.db, identity, id, "board", "update") {
		http.Error(w, "forbidden: missing board:update permission", http.StatusForbidden)
		return
	}

	var body struct {
		Name     string `json:"name"`
		Position int    `json:"position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		http.Error(w, "name cannot be empty", http.StatusBadRequest)
		return
	}

	res, err := h.db.Exec("UPDATE kanban_boards SET name = $1, position = $2 WHERE id = $3", name, body.Position, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		http.Error(w, "board not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /api/boards/{id} — blocked while any note still lives on this board,
// so deleting a board can never silently discard task data. Permission is
// checked before that business rule, so a user without board:delete never
// learns whether the board is empty or not.
func (h *BoardHandlers) deleteBoard(w http.ResponseWriter, r *http.Request) {
	identity, ok := verifyKanbanAccess(h.db, r)
	if !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	id := r.PathValue("id")
	if !hasPermission(h.db, identity, id, "board", "delete") {
		http.Error(w, "forbidden: missing board:delete permission", http.StatusForbidden)
		return
	}

	var noteCount int
	_ = h.db.QueryRow("SELECT COUNT(*) FROM kanban_notes WHERE board_id = $1", id).Scan(&noteCount)
	if noteCount > 0 {
		http.Error(w, "board still has notes — move or delete them first", http.StatusConflict)
		return
	}

	h.db.Exec("DELETE FROM kanban_labels WHERE board_id = $1", id)
	h.db.Exec("DELETE FROM kanban_columns WHERE board_id = $1", id)
	h.db.Exec("DELETE FROM kanban_board_members WHERE board_id = $1", id)
	h.db.Exec("DELETE FROM kanban_roles WHERE board_id = $1", id)

	res, err := h.db.Exec("DELETE FROM kanban_boards WHERE id = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		http.Error(w, "board not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/boards/{id}/columns
func (h *BoardHandlers) listColumns(w http.ResponseWriter, r *http.Request) {
	if _, ok := verifyKanbanAccess(h.db, r); !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	boardID := r.PathValue("id")

	rows, err := h.db.Query("SELECT id, board_id, name, position FROM kanban_columns WHERE board_id = $1 ORDER BY position ASC", boardID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	columns := []kanbanColumn{}
	for rows.Next() {
		var c kanbanColumn
		if err := rows.Scan(&c.ID, &c.BoardID, &c.Name, &c.Position); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		columns = append(columns, c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(columns)
}

// POST /api/boards/{id}/columns
func (h *BoardHandlers) createColumn(w http.ResponseWriter, r *http.Request) {
	identity, ok := verifyKanbanAccess(h.db, r)
	if !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	boardID := r.PathValue("id")
	if !hasPermission(h.db, identity, boardID, "column", "create") {
		http.Error(w, "forbidden: missing column:create permission", http.StatusForbidden)
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
		http.Error(w, "name cannot be empty", http.StatusBadRequest)
		return
	}

	id := genHexID()
	var pos int
	_ = h.db.QueryRow("SELECT COALESCE(MAX(position), 0) + 1 FROM kanban_columns WHERE board_id = $1", boardID).Scan(&pos)

	if _, err := h.db.Exec("INSERT INTO kanban_columns (id, board_id, name, position) VALUES ($1, $2, $3, $4)", id, boardID, name, pos); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(kanbanColumn{ID: id, BoardID: boardID, Name: name, Position: pos})
}

// PUT /api/boards/{id}/columns/{columnId} — rename / reorder
func (h *BoardHandlers) updateColumn(w http.ResponseWriter, r *http.Request) {
	identity, ok := verifyKanbanAccess(h.db, r)
	if !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	boardID := r.PathValue("id")
	if !hasPermission(h.db, identity, boardID, "column", "update") {
		http.Error(w, "forbidden: missing column:update permission", http.StatusForbidden)
		return
	}
	columnID := r.PathValue("columnId")

	var body struct {
		Name     string `json:"name"`
		Position int    `json:"position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		http.Error(w, "name cannot be empty", http.StatusBadRequest)
		return
	}

	res, err := h.db.Exec("UPDATE kanban_columns SET name = $1, position = $2 WHERE id = $3", name, body.Position, columnID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		http.Error(w, "column not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DELETE /api/boards/{id}/columns/{columnId} — blocked while any note still
// lives in this column.
func (h *BoardHandlers) deleteColumn(w http.ResponseWriter, r *http.Request) {
	identity, ok := verifyKanbanAccess(h.db, r)
	if !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	boardID := r.PathValue("id")
	if !hasPermission(h.db, identity, boardID, "column", "delete") {
		http.Error(w, "forbidden: missing column:delete permission", http.StatusForbidden)
		return
	}
	columnID := r.PathValue("columnId")

	var noteCount int
	_ = h.db.QueryRow("SELECT COUNT(*) FROM kanban_notes WHERE column_id = $1", columnID).Scan(&noteCount)
	if noteCount > 0 {
		http.Error(w, "column still has notes — move or delete them first", http.StatusConflict)
		return
	}

	res, err := h.db.Exec("DELETE FROM kanban_columns WHERE id = $1", columnID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		http.Error(w, "column not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/boards/{id}/labels
func (h *BoardHandlers) listLabels(w http.ResponseWriter, r *http.Request) {
	if _, ok := verifyKanbanAccess(h.db, r); !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	boardID := r.PathValue("id")

	rows, err := h.db.Query("SELECT id, board_id, name, color FROM kanban_labels WHERE board_id = $1 ORDER BY name ASC", boardID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	labels := []kanbanLabel{}
	for rows.Next() {
		var l kanbanLabel
		if err := rows.Scan(&l.ID, &l.BoardID, &l.Name, &l.Color); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		labels = append(labels, l)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(labels)
}

// POST /api/boards/{id}/labels
func (h *BoardHandlers) createLabel(w http.ResponseWriter, r *http.Request) {
	identity, ok := verifyKanbanAccess(h.db, r)
	if !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	boardID := r.PathValue("id")
	if !hasPermission(h.db, identity, boardID, "label", "create") {
		http.Error(w, "forbidden: missing label:create permission", http.StatusForbidden)
		return
	}

	var body struct {
		Name  string `json:"name"`
		Color string `json:"color"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		http.Error(w, "name cannot be empty", http.StatusBadRequest)
		return
	}

	id := genHexID()
	if _, err := h.db.Exec("INSERT INTO kanban_labels (id, board_id, name, color) VALUES ($1, $2, $3, $4)", id, boardID, name, body.Color); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(kanbanLabel{ID: id, BoardID: boardID, Name: name, Color: body.Color})
}

// DELETE /api/boards/{id}/labels/{labelId} — removing a label is safe to
// cascade (unlike notes/columns, no task content is lost, only a tag).
func (h *BoardHandlers) deleteLabel(w http.ResponseWriter, r *http.Request) {
	identity, ok := verifyKanbanAccess(h.db, r)
	if !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	boardID := r.PathValue("id")
	if !hasPermission(h.db, identity, boardID, "label", "delete") {
		http.Error(w, "forbidden: missing label:delete permission", http.StatusForbidden)
		return
	}
	labelID := r.PathValue("labelId")

	h.db.Exec("DELETE FROM kanban_note_labels WHERE label_id = $1", labelID)

	res, err := h.db.Exec("DELETE FROM kanban_labels WHERE id = $1", labelID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		http.Error(w, "label not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/boards/{id}/roles — any verified kanban identity may read a
// board's role list (needed to populate the assign-role dropdown).
func (h *BoardHandlers) listRoles(w http.ResponseWriter, r *http.Request) {
	if _, ok := verifyKanbanAccess(h.db, r); !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	boardID := r.PathValue("id")

	rows, err := h.db.Query("SELECT id, board_id, name, is_system FROM kanban_roles WHERE board_id = $1 ORDER BY position ASC", boardID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	roles := []kanbanRole{}
	for rows.Next() {
		var role kanbanRole
		var isSystem int
		if err := rows.Scan(&role.ID, &role.BoardID, &role.Name, &isSystem); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		role.IsSystem = isSystem != 0
		roles = append(roles, role)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(roles)
}

// GET /api/boards/{id}/members
func (h *BoardHandlers) listMembers(w http.ResponseWriter, r *http.Request) {
	if _, ok := verifyKanbanAccess(h.db, r); !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	boardID := r.PathValue("id")

	rows, err := h.db.Query(`
		SELECT m.user_id, u.username, m.role_id, r.name
		FROM kanban_board_members m
		JOIN kanban_users u ON u.id = m.user_id
		JOIN kanban_roles r ON r.id = m.role_id
		WHERE m.board_id = $1 ORDER BY u.username ASC`, boardID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	members := []kanbanMember{}
	for rows.Next() {
		var m kanbanMember
		if err := rows.Scan(&m.UserID, &m.Username, &m.RoleID, &m.RoleName); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		members = append(members, m)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(members)
}

// POST /api/boards/{id}/members — grant or change an already-approved user's
// role on this specific board. This is how a user gets write access on a
// board created after they were first approved, or how their role on an
// existing board gets changed later. Only someone who can already manage
// this board's members may call it — reuses board:update as the gate (no
// separate "member" resource in this module).
func (h *BoardHandlers) upsertMember(w http.ResponseWriter, r *http.Request) {
	identity, ok := verifyKanbanAccess(h.db, r)
	if !ok {
		http.Error(w, "unauthorized: correct password or session required", http.StatusUnauthorized)
		return
	}
	boardID := r.PathValue("id")
	if !hasPermission(h.db, identity, boardID, "board", "update") {
		http.Error(w, "forbidden: missing board:update permission", http.StatusForbidden)
		return
	}

	var body struct {
		UserID string `json:"user_id"`
		RoleID string `json:"role_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	userID := strings.TrimSpace(body.UserID)
	roleID := strings.TrimSpace(body.RoleID)
	if userID == "" || roleID == "" {
		http.Error(w, "user_id and role_id cannot be empty", http.StatusBadRequest)
		return
	}

	var owningBoard string
	if err := h.db.QueryRow("SELECT board_id FROM kanban_roles WHERE id = $1", roleID).Scan(&owningBoard); err != nil || owningBoard != boardID {
		http.Error(w, "role_id does not belong to board_id", http.StatusBadRequest)
		return
	}
	var status string
	if err := h.db.QueryRow("SELECT status FROM kanban_users WHERE id = $1", userID).Scan(&status); err != nil || status != "approved" {
		http.Error(w, "user_id must be an approved kanban user", http.StatusBadRequest)
		return
	}

	if _, err := h.db.Exec(`
		INSERT INTO kanban_board_members (board_id, user_id, role_id) VALUES ($1, $2, $3)
		ON CONFLICT (board_id, user_id) DO UPDATE SET role_id = $3`, boardID, userID, roleID,
	); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
