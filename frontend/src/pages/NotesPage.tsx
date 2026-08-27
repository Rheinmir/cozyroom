import { useState, useEffect, useCallback } from 'react'
import {
  KanbanCreds, KanbanBoard, KanbanColumn, KanbanLabel, KanbanUser, KanbanPendingUser,
  KanbanBoardRole, KanbanBoardMember,
  KanbanNote, KanbanSubtask, KanbanComment,
  registerKanbanUser, loginKanbanUser, logoutKanbanUser,
  listApprovedKanbanUsers, listPendingKanbanUsers, approveKanbanUser, rejectKanbanUser,
  listBoardRoles, listBoardMembers, upsertBoardMember,
  listBoards, createBoard, updateBoard, deleteBoard,
  listColumns, createColumn, updateColumn, deleteColumn,
  listLabels, createLabel, deleteLabel,
  listNotes, createNote, updateNote, deleteNote,
  listSubtasks, createSubtask, updateSubtask, deleteSubtask,
  listComments, createComment, deleteComment,
} from '../api'
import { useDialogs } from '../DialogContext'

const OWNER_PW_KEY = 'cozyroom_owner_password'
const TOKEN_KEY = 'cozyroom_kanban_token'
const USERNAME_KEY = 'cozyroom_kanban_username'
const COLOR_KEY = 'cozyroom_kanban_color'
const OWNER_PASSWORD = 'owner712002'

const PRIORITIES: { key: string; label: string }[] = [
  { key: '', label: 'Không đặt' },
  { key: 'low', label: 'Thấp' },
  { key: 'medium', label: 'Trung bình' },
  { key: 'high', label: 'Cao' },
]
const priorityLabel = (p: string) => PRIORITIES.find(x => x.key === p)?.label ?? p

const toDateInput = (epoch: number | null) => epoch ? new Date(epoch * 1000).toISOString().slice(0, 10) : ''
const fromDateInput = (s: string): number | null => s ? Math.floor(new Date(`${s}T00:00:00`).getTime() / 1000) : null
const isOverdue = (epoch: number | null) => !!epoch && epoch * 1000 < Date.now()

type Session = { creds: KanbanCreds; isOwner: boolean; username: string; color: string }

function GateScreen({ onEnter }: { onEnter: (s: Session) => void }) {
  const [tab, setTab] = useState<'login' | 'register' | 'owner'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [ownerInput, setOwnerInput] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const doLogin = () => {
    setError(''); setInfo(''); setBusy(true)
    loginKanbanUser(username.trim(), password)
      .then(res => {
        sessionStorage.setItem(TOKEN_KEY, res.token)
        sessionStorage.setItem(USERNAME_KEY, res.username)
        sessionStorage.setItem(COLOR_KEY, res.color)
        onEnter({ creds: { token: res.token }, isOwner: false, username: res.username, color: res.color })
      })
      .catch(err => setError(err.message))
      .finally(() => setBusy(false))
  }

  const doRegister = () => {
    setError(''); setInfo(''); setBusy(true)
    registerKanbanUser(username.trim(), password)
      .then(() => setInfo('Đã đăng ký — vui lòng chờ owner duyệt tài khoản trước khi đăng nhập.'))
      .catch(err => setError(err.message))
      .finally(() => setBusy(false))
  }

  const doOwnerEnter = () => {
    if (ownerInput.trim() !== OWNER_PASSWORD) {
      setError('Mật khẩu owner sai!')
      return
    }
    sessionStorage.setItem(OWNER_PW_KEY, ownerInput.trim())
    onEnter({ creds: { password: OWNER_PASSWORD }, isOwner: true, username: 'owner', color: '#ffffff' })
  }

  return (
    <div className="notes-gate">
      <div className="notes-gate-card">
        <div className="notes-gate-title">Kanban</div>
        <div className="notes-gate-tabs">
          <button className={`notes-gate-tab ${tab === 'login' ? 'notes-gate-tab--active' : ''}`} onClick={() => { setTab('login'); setError(''); setInfo('') }}>Đăng nhập</button>
          <button className={`notes-gate-tab ${tab === 'register' ? 'notes-gate-tab--active' : ''}`} onClick={() => { setTab('register'); setError(''); setInfo('') }}>Đăng ký</button>
          <button className={`notes-gate-tab ${tab === 'owner' ? 'notes-gate-tab--active' : ''}`} onClick={() => { setTab('owner'); setError(''); setInfo('') }}>Owner</button>
        </div>

        {tab === 'owner' ? (
          <>
            <div className="notes-gate-sub">Nhập mật khẩu owner để vào bằng quyền quản trị</div>
            <input className="notes-gate-input" type="password" placeholder="Mật khẩu owner" value={ownerInput}
              onChange={e => setOwnerInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && doOwnerEnter()} autoFocus />
            <button className="notes-gate-btn" onClick={doOwnerEnter}>Vào</button>
          </>
        ) : (
          <>
            <div className="notes-gate-sub">{tab === 'login' ? 'Đăng nhập tài khoản đã được duyệt' : 'Đăng ký tài khoản mới — cần owner duyệt trước khi dùng được'}</div>
            <input className="notes-gate-input" placeholder="Tên đăng nhập" value={username} onChange={e => setUsername(e.target.value)} autoFocus />
            <input className="notes-gate-input" type="password" placeholder="Mật khẩu" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (tab === 'login' ? doLogin() : doRegister())} />
            <button className="notes-gate-btn" disabled={busy} onClick={tab === 'login' ? doLogin : doRegister}>
              {tab === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          </>
        )}
        {error && <div className="notes-gate-error">{error}</div>}
        {info && <div className="notes-gate-info">{info}</div>}
      </div>
    </div>
  )
}

// Role is per-board membership (module 1/17) — this panel covers both
// approving pending users onto the currently active board, and changing an
// already-approved user's role on that same board (needed e.g. after a
// board created later than their original approval).
function AdminPendingPanel({ password, boardId }: { password: string; boardId: string }) {
  const { toast } = useDialogs()
  const [pending, setPending] = useState<KanbanPendingUser[]>([])
  const [members, setMembers] = useState<KanbanBoardMember[]>([])
  const [roles, setRoles] = useState<KanbanBoardRole[]>([])
  const [open, setOpen] = useState(false)
  const [pendingRole, setPendingRole] = useState<Record<string, string>>({})

  const assignableRoles = roles.filter(r => r.name !== 'owner')
  const defaultRoleId = assignableRoles.find(r => r.name === 'member')?.id || ''

  const load = useCallback(() => {
    listPendingKanbanUsers(password).then(setPending).catch(console.error)
    listBoardMembers(boardId, { password }).then(setMembers).catch(console.error)
    listBoardRoles(boardId, { password }).then(setRoles).catch(console.error)
  }, [password, boardId])

  useEffect(() => { if (open) load() }, [open, load])

  const approve = (id: string) =>
    approveKanbanUser(id, password, boardId, pendingRole[id] || defaultRoleId).then(load).catch(err => toast(err.message, 'error'))
  const reject = (id: string) =>
    rejectKanbanUser(id, password).then(load).catch(err => toast(err.message, 'error'))
  const changeRole = (userId: string, roleId: string) =>
    upsertBoardMember(boardId, userId, roleId, { password }).then(load).catch(err => toast(err.message, 'error'))

  return (
    <div className="notes-admin-panel">
      <button className="notes-admin-toggle" onClick={() => setOpen(o => !o)}>
        👤 Quản lý user {pending.length > 0 && open === false ? `(${pending.length} chờ duyệt)` : ''}
      </button>
      {open && (
        <div className="notes-admin-list">
          {pending.length === 0 && <div className="notes-admin-empty">Không có user chờ duyệt</div>}
          {pending.map(u => (
            <div key={u.id} className="notes-admin-row">
              <span className="notes-admin-username">{u.username}</span>
              <select className="notes-detail-select" value={pendingRole[u.id] || defaultRoleId}
                onChange={e => setPendingRole(prev => ({ ...prev, [u.id]: e.target.value }))}>
                {assignableRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button className="note-card-btn note-card-btn--save" onClick={() => approve(u.id)}>Duyệt</button>
              <button className="note-card-btn note-card-btn--danger" onClick={() => reject(u.id)}>Từ chối</button>
            </div>
          ))}
          {members.length > 0 && (
            <>
              <div className="notes-detail-section-title" style={{ marginTop: 10 }}>Thành viên board này</div>
              {members.map(m => (
                <div key={m.user_id} className="notes-admin-row">
                  <span className="notes-admin-username">{m.username}</span>
                  <select className="notes-detail-select" value={m.role_id} onChange={e => changeRole(m.user_id, e.target.value)}>
                    {assignableRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function NoteDetailPanel({
  note, columns, labels, users, creds, onClose, onChanged,
}: {
  note: KanbanNote
  columns: KanbanColumn[]
  labels: KanbanLabel[]
  users: KanbanUser[]
  creds: KanbanCreds
  onClose: () => void
  onChanged: () => void
}) {
  const { toast } = useDialogs()
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [priority, setPriority] = useState(note.priority)
  const [dueDate, setDueDate] = useState(toDateInput(note.due_date))
  const [assignee, setAssignee] = useState(note.assigned_user_id)
  const [labelIds, setLabelIds] = useState<string[]>(note.label_ids)
  const [subtasks, setSubtasks] = useState<KanbanSubtask[]>([])
  const [newSubtask, setNewSubtask] = useState('')
  const [comments, setComments] = useState<KanbanComment[]>([])
  const [newComment, setNewComment] = useState('')

  useEffect(() => {
    listSubtasks(note.id, creds).then(setSubtasks).catch(console.error)
    listComments(note.id, creds).then(setComments).catch(console.error)
  }, [note.id, creds])

  const save = () => {
    updateNote(note.id, {
      board_id: note.board_id, column_id: note.column_id, position: note.position,
      title: title.trim(), content, priority, due_date: fromDateInput(dueDate),
      assigned_user_id: assignee, label_ids: labelIds,
    }, creds).then(() => { onChanged(); onClose() }).catch(err => toast(err.message, 'error'))
  }

  const toggleLabel = (id: string) =>
    setLabelIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])

  const addSubtask = () => {
    const title = newSubtask.trim()
    if (!title) return
    setNewSubtask('')
    createSubtask(note.id, title, creds)
      .then(s => setSubtasks(prev => [...prev, s]))
      .catch(err => toast(err.message, 'error'))
  }
  const toggleSubtask = (s: KanbanSubtask) =>
    updateSubtask(note.id, s.id, { title: s.title, done: !s.done, position: s.position }, creds)
      .then(() => setSubtasks(prev => prev.map(x => x.id === s.id ? { ...x, done: !x.done } : x)))
      .catch(err => toast(err.message, 'error'))
  const removeSubtask = (id: string) =>
    deleteSubtask(note.id, id, creds).then(() => setSubtasks(prev => prev.filter(x => x.id !== id))).catch(err => toast(err.message, 'error'))

  const addComment = () => {
    const content = newComment.trim()
    if (!content) return
    setNewComment('')
    createComment(note.id, content, creds)
      .then(c => setComments(prev => [...prev, c]))
      .catch(err => toast(err.message, 'error'))
  }
  const removeComment = (id: string) =>
    deleteComment(note.id, id, creds).then(() => setComments(prev => prev.filter(x => x.id !== id))).catch(err => toast(err.message, 'error'))

  return (
    <div className="notes-detail-overlay" onClick={onClose}>
      <div className="notes-detail-panel" onClick={e => e.stopPropagation()}>
        <button className="notes-detail-close" onClick={onClose}>✕</button>
        <input className="notes-detail-title" value={title} onChange={e => setTitle(e.target.value)} />
        <textarea className="notes-detail-content" value={content} onChange={e => setContent(e.target.value)} rows={3} />

        <div className="notes-detail-row">
          <label className="notes-detail-label">Cột</label>
          <select className="notes-detail-select" value={note.column_id} disabled>
            {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="notes-detail-label">Độ ưu tiên</label>
          <select className="notes-detail-select" value={priority} onChange={e => setPriority(e.target.value)}>
            {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>

        <div className="notes-detail-row">
          <label className="notes-detail-label">Hạn</label>
          <input className="notes-detail-select" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          <label className="notes-detail-label">Người phụ trách</label>
          <select className="notes-detail-select" value={assignee} onChange={e => setAssignee(e.target.value)}>
            <option value="">Chưa gán</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
          </select>
        </div>

        <div className="notes-detail-labels">
          {labels.map(l => (
            <button key={l.id} className={`notes-label-chip ${labelIds.includes(l.id) ? 'notes-label-chip--active' : ''}`}
              style={{ borderColor: l.color, color: labelIds.includes(l.id) ? '#000' : l.color, background: labelIds.includes(l.id) ? l.color : 'transparent' }}
              onClick={() => toggleLabel(l.id)}>{l.name}</button>
          ))}
          {labels.length === 0 && <span className="notes-detail-hint">Board này chưa có label nào</span>}
        </div>

        <div className="notes-detail-section">
          <div className="notes-detail-section-title">Checklist {subtasks.length > 0 && `(${subtasks.filter(s => s.done).length}/${subtasks.length})`}</div>
          {subtasks.map(s => (
            <div key={s.id} className="notes-subtask-row">
              <input type="checkbox" checked={s.done} onChange={() => toggleSubtask(s)} />
              <span className={s.done ? 'notes-subtask-done' : ''}>{s.title}</span>
              <button className="note-card-btn note-card-btn--danger" onClick={() => removeSubtask(s.id)}>✕</button>
            </div>
          ))}
          <div className="notes-subtask-add">
            <input className="notes-gate-input" placeholder="Thêm việc cần làm..." value={newSubtask}
              onChange={e => setNewSubtask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubtask()} />
            <button className="note-card-btn" onClick={addSubtask}>+</button>
          </div>
        </div>

        <div className="notes-detail-section">
          <div className="notes-detail-section-title">Bình luận</div>
          {comments.map(c => (
            <div key={c.id} className="notes-comment-row">
              <span className="notes-comment-author">{c.author_label || 'owner'}</span>
              <span className="notes-comment-content">{c.content}</span>
              <button className="note-card-btn note-card-btn--danger" onClick={() => removeComment(c.id)}>✕</button>
            </div>
          ))}
          <div className="notes-subtask-add">
            <input className="notes-gate-input" placeholder="Viết bình luận..." value={newComment}
              onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment()} />
            <button className="note-card-btn" onClick={addComment}>+</button>
          </div>
        </div>

        <div className="notes-detail-actions">
          <button className="note-card-btn note-card-btn--save" onClick={save}>Lưu</button>
          <button className="note-card-btn" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  )
}

function NoteCard({
  note, users, labels, onOpen, onDelete, onMoveColumn, onDragStart, canMoveLeft, canMoveRight,
}: {
  note: KanbanNote
  users: KanbanUser[]
  labels: KanbanLabel[]
  onOpen: () => void
  onDelete: () => void
  onMoveColumn: (dir: -1 | 1) => void
  onDragStart: (e: React.DragEvent) => void
  canMoveLeft: boolean
  canMoveRight: boolean
}) {
  const assignee = users.find(u => u.id === note.assigned_user_id)
  const noteLabels = labels.filter(l => note.label_ids.includes(l.id))

  return (
    <div className="note-card" draggable onDragStart={onDragStart}>
      <div
        className="note-card-title"
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      >{note.title}</div>
      {note.content && <div className="note-card-content" onClick={onOpen}>{note.content}</div>}
      {(noteLabels.length > 0 || note.priority || note.due_date || assignee || note.subtask_total > 0) && (
        <div className="note-card-meta">
          {noteLabels.map(l => <span key={l.id} className="notes-label-chip notes-label-chip--sm" style={{ borderColor: l.color, color: l.color }}>{l.name}</span>)}
          {note.priority && <span className={`notes-priority-badge notes-priority-badge--${note.priority}`}>{priorityLabel(note.priority)}</span>}
          {note.due_date && <span className={`notes-due-badge ${isOverdue(note.due_date) ? 'notes-due-badge--overdue' : ''}`}>{toDateInput(note.due_date)}</span>}
          {note.subtask_total > 0 && <span className="notes-subtask-badge">✓ {note.subtask_done}/{note.subtask_total}</span>}
          {assignee && <span className="notes-assignee-avatar" style={{ background: assignee.color }} title={assignee.username}>{assignee.username[0]?.toUpperCase()}</span>}
        </div>
      )}
      <div className="note-card-actions">
        <button className="note-card-btn" disabled={!canMoveLeft} onClick={() => onMoveColumn(-1)} title="Chuyển cột trái">‹</button>
        <button className="note-card-btn" disabled={!canMoveRight} onClick={() => onMoveColumn(1)} title="Chuyển cột phải">›</button>
        <button className="note-card-btn note-card-btn--danger" onClick={onDelete} title="Xoá">✕</button>
      </div>
    </div>
  )
}

function NewNoteForm({ onCreate }: { onCreate: (title: string, content: string) => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  if (!open) {
    return <button className="note-add-btn" onClick={() => setOpen(true)}>+ Thêm note</button>
  }

  const submit = () => {
    if (!title.trim()) return
    onCreate(title.trim(), content.trim())
    setTitle(''); setContent(''); setOpen(false)
  }

  return (
    <div className="note-card note-card--editing">
      <input className="note-card-input" placeholder="Tiêu đề" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      <textarea className="note-card-textarea" placeholder="Nội dung (tuỳ chọn)" value={content} onChange={e => setContent(e.target.value)} rows={3} />
      <div className="note-card-actions">
        <button className="note-card-btn note-card-btn--save" onClick={submit}>Tạo</button>
        <button className="note-card-btn" onClick={() => { setOpen(false); setTitle(''); setContent('') }}>Huỷ</button>
      </div>
    </div>
  )
}

export default function NotesPage() {
  const { confirm, toast } = useDialogs()
  const [session, setSession] = useState<Session | null>(null)
  const [boards, setBoards] = useState<KanbanBoard[]>([])
  const [activeBoardId, setActiveBoardId] = useState('')
  const [columns, setColumns] = useState<KanbanColumn[]>([])
  const [labels, setLabels] = useState<KanbanLabel[]>([])
  const [users, setUsers] = useState<KanbanUser[]>([])
  const [notes, setNotes] = useState<KanbanNote[]>([])
  const [loading, setLoading] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [newBoardName, setNewBoardName] = useState('')
  const [addingBoard, setAddingBoard] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')
  const [addingColumn, setAddingColumn] = useState(false)
  const [search, setSearch] = useState('')
  const [filterLabel, setFilterLabel] = useState('')
  const [filterPriority, setFilterPriority] = useState('')

  // Restore session (owner or logged-in user) — no board/note API call happens
  // before one of these two credentials is confirmed present.
  useEffect(() => {
    const ownerPw = sessionStorage.getItem(OWNER_PW_KEY)
    if (ownerPw === OWNER_PASSWORD) {
      setSession({ creds: { password: OWNER_PASSWORD }, isOwner: true, username: 'owner', color: '#ffffff' })
      return
    }
    const token = sessionStorage.getItem(TOKEN_KEY)
    if (token) {
      setSession({ creds: { token }, isOwner: false, username: sessionStorage.getItem(USERNAME_KEY) || '', color: sessionStorage.getItem(COLOR_KEY) || '#888' })
    }
  }, [])

  const loadBoard = useCallback((boardId: string, creds: KanbanCreds) => {
    setLoading(true)
    Promise.all([listColumns(boardId, creds), listLabels(boardId, creds), listNotes(boardId, creds)])
      .then(([cols, labs, ns]) => { setColumns(cols); setLabels(labs); setNotes(ns) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!session) return
    listBoards(session.creds).then(bs => {
      setBoards(bs)
      const first = bs[0]?.id || 'default'
      setActiveBoardId(first)
      loadBoard(first, session.creds)
    }).catch(console.error)
    listApprovedKanbanUsers(session.creds).then(setUsers).catch(console.error)
  }, [session, loadBoard])

  useEffect(() => {
    if (session && activeBoardId) loadBoard(activeBoardId, session.creds)
  }, [activeBoardId, session, loadBoard])

  if (!session) return <GateScreen onEnter={setSession} />

  const logout = () => {
    sessionStorage.removeItem(OWNER_PW_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USERNAME_KEY)
    sessionStorage.removeItem(COLOR_KEY)
    if (session.creds.token) logoutKanbanUser(session.creds.token).catch(console.error)
    setSession(null)
  }

  const sortedColumns = [...columns].sort((a, b) => a.position - b.position)
  const filteredNotes = notes.filter(n => {
    if (search && !`${n.title} ${n.content}`.toLowerCase().includes(search.toLowerCase())) return false
    if (filterLabel && !n.label_ids.includes(filterLabel)) return false
    if (filterPriority && n.priority !== filterPriority) return false
    return true
  })
  const columnNotes = (columnId: string) =>
    filteredNotes.filter(n => n.column_id === columnId).sort((a, b) => a.position - b.position)

  const refreshBoard = () => loadBoard(activeBoardId, session.creds)

  const persistColumnOrder = (columnId: string, ordered: KanbanNote[]) => {
    ordered.forEach((n, i) => {
      updateNote(n.id, {
        board_id: n.board_id, column_id: columnId, position: i, title: n.title, content: n.content,
        priority: n.priority, due_date: n.due_date, assigned_user_id: n.assigned_user_id, label_ids: n.label_ids,
      }, session.creds).catch(console.error)
    })
  }

  const handleCreate = (columnId: string, title: string, content: string) => {
    createNote({ board_id: activeBoardId, column_id: columnId, title, content, priority: '', due_date: null, assigned_user_id: '', label_ids: [] }, session.creds)
      .then(n => setNotes(prev => [...prev, n]))
      .catch(err => toast(err.message, 'error'))
  }

  const handleDelete = async (note: KanbanNote) => {
    if (!(await confirm({ message: `Xoá note "${note.title}"?`, danger: true }))) return
    deleteNote(note.id, session.creds)
      .then(() => setNotes(prev => prev.filter(n => n.id !== note.id)))
      .catch(err => toast(err.message, 'error'))
  }

  const moveToColumn = (note: KanbanNote, newColumnId: string) => {
    const target = columnNotes(newColumnId)
    const newPos = target.length
    updateNote(note.id, {
      board_id: note.board_id, column_id: newColumnId, position: newPos, title: note.title, content: note.content,
      priority: note.priority, due_date: note.due_date, assigned_user_id: note.assigned_user_id, label_ids: note.label_ids,
    }, session.creds)
      .then(() => setNotes(prev => prev.map(n => n.id === note.id ? { ...n, column_id: newColumnId, position: newPos } : n)))
      .catch(err => toast(err.message, 'error'))
  }

  const handleMoveArrow = (note: KanbanNote, dir: -1 | 1) => {
    const idx = sortedColumns.findIndex(c => c.id === note.column_id)
    const nextIdx = idx + dir
    if (nextIdx < 0 || nextIdx >= sortedColumns.length) return
    moveToColumn(note, sortedColumns[nextIdx].id)
  }

  const handleDropOnColumn = (columnId: string) => {
    if (!dragId) return
    const dragged = notes.find(n => n.id === dragId)
    if (!dragged) return
    setDragId(null)
    if (dragged.column_id === columnId) return
    const targetOrdered = [...columnNotes(columnId), dragged]
    setNotes(prev => prev.map(n => n.id === dragged.id ? { ...n, column_id: columnId, position: targetOrdered.length - 1 } : n))
    persistColumnOrder(columnId, targetOrdered)
  }

  const handleAddBoard = () => {
    const name = newBoardName.trim()
    if (!name) return
    setNewBoardName('') // clear synchronously so a repeated Enter before the request resolves is a no-op, not a duplicate create
    createBoard(name, session.creds)
      .then(b => { setBoards(prev => [...prev, b]); setActiveBoardId(b.id); setAddingBoard(false) })
      .catch(err => toast(err.message, 'error'))
  }

  const handleDeleteBoard = async (b: KanbanBoard) => {
    if (!(await confirm({ message: `Xoá board "${b.name}"? (chỉ xoá được khi board không còn note nào)`, danger: true }))) return
    deleteBoard(b.id, session.creds)
      .then(() => {
        setBoards(prev => prev.filter(x => x.id !== b.id))
        if (activeBoardId === b.id) setActiveBoardId(boards.find(x => x.id !== b.id)?.id || '')
      })
      .catch(err => toast(err.message, 'error'))
  }

  const handleAddColumn = () => {
    const name = newColumnName.trim()
    if (!name) return
    setNewColumnName('') // clear synchronously — same double-submit guard as handleAddBoard
    createColumn(activeBoardId, name, session.creds)
      .then(c => { setColumns(prev => [...prev, c]); setAddingColumn(false) })
      .catch(err => toast(err.message, 'error'))
  }

  const handleRenameColumn = (c: KanbanColumn) => {
    const name = window.prompt('Tên cột mới:', c.name)
    if (!name || !name.trim()) return
    updateColumn(activeBoardId, c.id, { name: name.trim(), position: c.position }, session.creds)
      .then(() => setColumns(prev => prev.map(x => x.id === c.id ? { ...x, name: name.trim() } : x)))
      .catch(err => toast(err.message, 'error'))
  }

  const handleDeleteColumn = async (c: KanbanColumn) => {
    if (!(await confirm({ message: `Xoá cột "${c.name}"? (chỉ xoá được khi cột không còn note nào)`, danger: true }))) return
    deleteColumn(activeBoardId, c.id, session.creds)
      .then(() => setColumns(prev => prev.filter(x => x.id !== c.id)))
      .catch(err => toast(err.message, 'error'))
  }

  const selectedNote = notes.find(n => n.id === selectedNoteId) || null

  return (
    <div className="notes-page">
      <div className="notes-header">
        <h1 className="notes-title">Kanban</h1>
        <p className="notes-subtitle">
          {loading ? 'Đang tải...' : `${filteredNotes.length} note`} · đăng nhập là <strong>{session.username}</strong>
          <button className="notes-logout-btn" onClick={logout}>Đăng xuất</button>
        </p>
      </div>

      {session.isOwner && activeBoardId && <AdminPendingPanel password={OWNER_PASSWORD} boardId={activeBoardId} />}

      <div className="notes-board-switcher">
        {boards.map(b => (
          <div key={b.id} className={`notes-board-tab ${b.id === activeBoardId ? 'notes-board-tab--active' : ''}`}>
            <span
              onClick={() => setActiveBoardId(b.id)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveBoardId(b.id) } }}
            >{b.name}</span>
            <button className="notes-board-tab-del" onClick={() => handleDeleteBoard(b)} title="Xoá board">✕</button>
          </div>
        ))}
        {addingBoard ? (
          <input className="notes-gate-input notes-board-add-input" autoFocus placeholder="Tên board mới"
            value={newBoardName} onChange={e => setNewBoardName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddBoard()} onBlur={() => !newBoardName && setAddingBoard(false)} />
        ) : (
          <button className="notes-board-tab notes-board-tab--add" onClick={() => setAddingBoard(true)}>+ Board</button>
        )}
      </div>

      <div className="notes-filter-bar">
        <input className="notes-gate-input notes-search-input" placeholder="Tìm theo tiêu đề/nội dung..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="notes-detail-select" value={filterLabel} onChange={e => setFilterLabel(e.target.value)}>
          <option value="">Mọi label</option>
          {labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select className="notes-detail-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="">Mọi độ ưu tiên</option>
          {PRIORITIES.filter(p => p.key).map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>

      <div className="notes-board">
        {sortedColumns.map((col, idx) => (
          <div key={col.id} className="notes-column" onDragOver={e => e.preventDefault()} onDrop={() => handleDropOnColumn(col.id)}>
            <div className="notes-column-title">
              <span
                onClick={() => handleRenameColumn(col)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRenameColumn(col) } }}
              >{col.name}</span>
              <button className="notes-board-tab-del" onClick={() => handleDeleteColumn(col)} title="Xoá cột">✕</button>
            </div>
            <div className="notes-column-list">
              {columnNotes(col.id).map(note => (
                <NoteCard
                  key={note.id}
                  note={note}
                  users={users}
                  labels={labels}
                  onOpen={() => setSelectedNoteId(note.id)}
                  onDelete={() => handleDelete(note)}
                  onMoveColumn={dir => handleMoveArrow(note, dir)}
                  onDragStart={() => setDragId(note.id)}
                  canMoveLeft={idx > 0}
                  canMoveRight={idx < sortedColumns.length - 1}
                />
              ))}
            </div>
            <NewNoteForm onCreate={(title, content) => handleCreate(col.id, title, content)} />
          </div>
        ))}
        <div className="notes-column notes-column--add">
          {addingColumn ? (
            <input className="notes-gate-input" autoFocus placeholder="Tên cột mới" value={newColumnName}
              onChange={e => setNewColumnName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddColumn()}
              onBlur={() => !newColumnName && setAddingColumn(false)} />
          ) : (
            <button className="note-add-btn" onClick={() => setAddingColumn(true)}>+ Cột mới</button>
          )}
        </div>
      </div>

      {selectedNote && (
        <NoteDetailPanel
          note={selectedNote}
          columns={sortedColumns}
          labels={labels}
          users={users}
          creds={session.creds}
          onClose={() => setSelectedNoteId(null)}
          onChanged={refreshBoard}
        />
      )}
    </div>
  )
}
