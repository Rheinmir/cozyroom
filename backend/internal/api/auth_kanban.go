package api

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const kanbanSessionTTL = 30 * 24 * time.Hour

type KanbanAuthHandlers struct {
	db *sql.DB
}

type kanbanIdentity struct {
	IsOwner  bool
	UserID   string
	Username string
	Color    string
}

func genSessionToken() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x", b)
}

// Deterministic display color from username, so an approved user's avatar
// stays consistent without the owner having to pick a color at approve time.
var assigneeColors = []string{"#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"}

func colorForUsername(username string) string {
	sum := 0
	for _, c := range username {
		sum += int(c)
	}
	return assigneeColors[sum%len(assigneeColors)]
}

// hasPermission checks a user's role ON A SPECIFIC BOARD — role is a
// per-(board,user) membership fact, not a global attribute, since the same
// user can be admin on one board and viewer on another. Fails closed: the
// owner bypass aside, any missing membership, unknown role, or malformed
// permission JSON denies the action rather than defaulting to allow.
func hasPermission(db *sql.DB, identity kanbanIdentity, boardID, resource, action string) bool {
	if identity.IsOwner {
		return true
	}
	var permissionsJSON string
	err := db.QueryRow(`
		SELECT r.permissions
		FROM kanban_board_members m
		JOIN kanban_roles r ON r.id = m.role_id
		WHERE m.board_id = $1 AND m.user_id = $2`, boardID, identity.UserID,
	).Scan(&permissionsJSON)
	if err != nil {
		return false
	}
	var perms map[string][]string
	if err := json.Unmarshal([]byte(permissionsJSON), &perms); err != nil {
		return false
	}
	for _, a := range perms[resource] {
		if a == action {
			return true
		}
	}
	return false
}

// verifyKanbanAccess must remain a strict superset of verifyOwnerPassword —
// owner712002 keeps working exactly as before; an approved user's session is
// an additional way in, never a replacement.
func verifyKanbanAccess(db *sql.DB, r *http.Request) (kanbanIdentity, bool) {
	if verifyOwnerPassword(r) {
		return kanbanIdentity{IsOwner: true, Username: "owner"}, true
	}
	token := r.Header.Get("X-Kanban-Session")
	if token == "" {
		return kanbanIdentity{}, false
	}
	var userID, username, color string
	var expiresAt int64
	err := db.QueryRow(`
		SELECT s.user_id, u.username, u.color, s.expires_at
		FROM kanban_sessions s
		JOIN kanban_users u ON u.id = s.user_id
		WHERE s.token = $1 AND u.status = 'approved'`, token,
	).Scan(&userID, &username, &color, &expiresAt)
	if err != nil || expiresAt < time.Now().Unix() {
		return kanbanIdentity{}, false
	}
	return kanbanIdentity{UserID: userID, Username: username, Color: color}, true
}

// POST /api/kanban/register
func (h *KanbanAuthHandlers) register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	username := strings.TrimSpace(body.Username)
	if len(username) < 3 || len(username) > 32 {
		http.Error(w, "username phải từ 3-32 ký tự", http.StatusBadRequest)
		return
	}
	if len(body.Password) < 6 {
		http.Error(w, "password phải từ 6 ký tự", http.StatusBadRequest)
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	var existingStatus string
	err = h.db.QueryRow("SELECT status FROM kanban_users WHERE username = $1", username).Scan(&existingStatus)
	switch {
	case err == nil && existingStatus != "rejected":
		http.Error(w, "username đã tồn tại hoặc đang chờ duyệt", http.StatusConflict)
		return
	case err == nil: // existingStatus == "rejected" — allow retrying registration
		_, err = h.db.Exec(`
			UPDATE kanban_users SET password_hash = $1, status = 'pending', approved_at = NULL,
				created_at = EXTRACT(EPOCH FROM NOW())::INTEGER
			WHERE username = $2`, string(hash), username)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	case err == sql.ErrNoRows:
		_, err = h.db.Exec(`
			INSERT INTO kanban_users (id, username, password_hash, status, color)
			VALUES ($1, $2, $3, 'pending', $4)`,
			genHexID(), username, string(hash), colorForUsername(username))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	default:
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{"username": username, "status": "pending"})
}

// POST /api/kanban/login
func (h *KanbanAuthHandlers) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	username := strings.TrimSpace(body.Username)

	var id, hash, status, color string
	err := h.db.QueryRow("SELECT id, password_hash, status, color FROM kanban_users WHERE username = $1", username).
		Scan(&id, &hash, &status, &color)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password)) != nil {
		http.Error(w, "sai tên đăng nhập hoặc mật khẩu", http.StatusUnauthorized)
		return
	}
	if status == "pending" {
		http.Error(w, "tài khoản đang chờ owner duyệt", http.StatusForbidden)
		return
	}
	if status == "rejected" {
		http.Error(w, "tài khoản đã bị từ chối", http.StatusForbidden)
		return
	}

	token := genSessionToken()
	expiresAt := time.Now().Add(kanbanSessionTTL).Unix()
	if _, err := h.db.Exec("INSERT INTO kanban_sessions (token, user_id, expires_at) VALUES ($1, $2, $3)", token, id, expiresAt); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"token": token, "username": username, "color": color, "expires_at": expiresAt})
}

// POST /api/kanban/logout
func (h *KanbanAuthHandlers) logout(w http.ResponseWriter, r *http.Request) {
	if token := r.Header.Get("X-Kanban-Session"); token != "" {
		h.db.Exec("DELETE FROM kanban_sessions WHERE token = $1", token)
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/kanban/users — approved users only, for assignee pickers. Any
// verified kanban identity (owner or approved user) may read this list.
func (h *KanbanAuthHandlers) listApprovedUsers(w http.ResponseWriter, r *http.Request) {
	if _, ok := verifyKanbanAccess(h.db, r); !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	rows, err := h.db.Query("SELECT id, username, color FROM kanban_users WHERE status = 'approved' ORDER BY username ASC")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type userJSON struct {
		ID       string `json:"id"`
		Username string `json:"username"`
		Color    string `json:"color"`
	}
	users := []userJSON{}
	for rows.Next() {
		var u userJSON
		if rows.Scan(&u.ID, &u.Username, &u.Color) == nil {
			users = append(users, u)
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// GET /api/kanban/admin/pending — owner712002 ONLY, never a regular session,
// so an approved user can never see or approve other people's registrations.
func (h *KanbanAuthHandlers) listPending(w http.ResponseWriter, r *http.Request) {
	if !verifyOwnerPassword(r) {
		http.Error(w, "unauthorized: correct password required", http.StatusUnauthorized)
		return
	}
	rows, err := h.db.Query("SELECT id, username, created_at FROM kanban_users WHERE status = 'pending' ORDER BY created_at ASC")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type pendingJSON struct {
		ID        string `json:"id"`
		Username  string `json:"username"`
		CreatedAt int64  `json:"created_at"`
	}
	pending := []pendingJSON{}
	for rows.Next() {
		var p pendingJSON
		if rows.Scan(&p.ID, &p.Username, &p.CreatedAt) == nil {
			pending = append(pending, p)
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pending)
}

// POST /api/kanban/admin/users/{id}/approve — grants the new user a role on
// one board right away (default: 'member' on board 'default'), since without
// an initial membership row a freshly approved user could read everything
// but write nowhere until someone separately grants them a board role.
func (h *KanbanAuthHandlers) approveUser(w http.ResponseWriter, r *http.Request) {
	if !verifyOwnerPassword(r) {
		http.Error(w, "unauthorized: correct password required", http.StatusUnauthorized)
		return
	}

	var body struct {
		BoardID string `json:"board_id"`
		RoleID  string `json:"role_id"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body) // body is optional — defaults below cover it

	boardID := strings.TrimSpace(body.BoardID)
	if boardID == "" {
		boardID = "default"
	}
	roleID := strings.TrimSpace(body.RoleID)
	if roleID == "" {
		if err := h.db.QueryRow("SELECT id FROM kanban_roles WHERE board_id = $1 AND name = 'member'", boardID).Scan(&roleID); err != nil {
			http.Error(w, "no default role found for board", http.StatusInternalServerError)
			return
		}
	} else {
		var owningBoard string
		if err := h.db.QueryRow("SELECT board_id FROM kanban_roles WHERE id = $1", roleID).Scan(&owningBoard); err != nil || owningBoard != boardID {
			http.Error(w, "role_id does not belong to board_id", http.StatusBadRequest)
			return
		}
	}

	userID := r.PathValue("id")
	res, err := h.db.Exec(`
		UPDATE kanban_users SET status = 'approved', approved_at = EXTRACT(EPOCH FROM NOW())::INTEGER
		WHERE id = $1 AND status = 'pending'`, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		http.Error(w, "user not found or not pending", http.StatusNotFound)
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

// POST /api/kanban/admin/users/{id}/reject
func (h *KanbanAuthHandlers) rejectUser(w http.ResponseWriter, r *http.Request) {
	if !verifyOwnerPassword(r) {
		http.Error(w, "unauthorized: correct password required", http.StatusUnauthorized)
		return
	}
	res, err := h.db.Exec(`UPDATE kanban_users SET status = 'rejected' WHERE id = $1 AND status = 'pending'`, r.PathValue("id"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		http.Error(w, "user not found or not pending", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
