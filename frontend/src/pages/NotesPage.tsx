import { useState, useEffect, useCallback } from 'react'
import { KanbanNote, listNotes, createNote, updateNote, deleteNote } from '../api'

const SESSION_PW_KEY = 'cozyroom_owner_password'
const OWNER_PASSWORD = 'owner712002'

const COLUMNS: { key: string; label: string }[] = [
  { key: 'todo', label: 'Cần làm' },
  { key: 'doing', label: 'Đang làm' },
  { key: 'done', label: 'Xong' },
]

function NoteCard({
  note,
  onSave,
  onDelete,
  onMoveColumn,
  onDragStart,
}: {
  note: KanbanNote
  onSave: (title: string, content: string) => void
  onDelete: () => void
  onMoveColumn: (dir: -1 | 1) => void
  onDragStart: (e: React.DragEvent) => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)

  const colIdx = COLUMNS.findIndex(c => c.key === note.column_key)

  if (editing) {
    return (
      <div className="note-card note-card--editing">
        <input className="note-card-input" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
        <textarea className="note-card-textarea" value={content} onChange={e => setContent(e.target.value)} rows={3} />
        <div className="note-card-actions">
          <button className="note-card-btn note-card-btn--save" onClick={() => { onSave(title, content); setEditing(false) }}>Lưu</button>
          <button className="note-card-btn" onClick={() => { setTitle(note.title); setContent(note.content); setEditing(false) }}>Huỷ</button>
        </div>
      </div>
    )
  }

  return (
    <div className="note-card" draggable onDragStart={onDragStart}>
      <div className="note-card-title" onClick={() => setEditing(true)}>{note.title}</div>
      {note.content && <div className="note-card-content" onClick={() => setEditing(true)}>{note.content}</div>}
      <div className="note-card-actions">
        <button className="note-card-btn" disabled={colIdx <= 0} onClick={() => onMoveColumn(-1)} title="Chuyển cột trái">‹</button>
        <button className="note-card-btn" disabled={colIdx >= COLUMNS.length - 1} onClick={() => onMoveColumn(1)} title="Chuyển cột phải">›</button>
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
  const [password, setPassword] = useState<string>(() => sessionStorage.getItem(SESSION_PW_KEY) || '')
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_PW_KEY) === OWNER_PASSWORD)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const [notes, setNotes] = useState<KanbanNote[]>([])
  const [loading, setLoading] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!unlocked) return
    setLoading(true)
    listNotes(password).then(setNotes).catch(console.error).finally(() => setLoading(false))
  }, [unlocked, password])

  useEffect(() => { load() }, [load])

  const handleUnlock = () => {
    if (passwordInput.trim() !== OWNER_PASSWORD) {
      setPasswordError('Mật khẩu sai!')
      return
    }
    sessionStorage.setItem(SESSION_PW_KEY, passwordInput.trim())
    setPassword(passwordInput.trim())
    setUnlocked(true)
    setPasswordError('')
  }

  if (!unlocked) {
    return (
      <div className="notes-gate">
        <div className="notes-gate-card">
          <div className="notes-gate-title">Notes riêng tư</div>
          <div className="notes-gate-sub">Nhập mật khẩu owner để vào bảng ghi chú</div>
          <input
            className="notes-gate-input"
            type="password"
            placeholder="Mật khẩu"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            autoFocus
          />
          {passwordError && <div className="notes-gate-error">{passwordError}</div>}
          <button className="notes-gate-btn" onClick={handleUnlock}>Vào</button>
        </div>
      </div>
    )
  }

  const columnNotes = (key: string) =>
    notes.filter(n => n.column_key === key).sort((a, b) => a.position - b.position)

  const persistColumnOrder = (colKey: string, ordered: KanbanNote[]) => {
    ordered.forEach((n, i) => {
      updateNote(n.id, { column_key: colKey, title: n.title, content: n.content, position: i }, password).catch(console.error)
    })
  }

  const handleCreate = (colKey: string, title: string, content: string) => {
    createNote({ column_key: colKey, title, content }, password)
      .then(n => setNotes(prev => [...prev, n]))
      .catch(console.error)
  }

  const handleSaveEdit = (note: KanbanNote, title: string, content: string) => {
    updateNote(note.id, { column_key: note.column_key, title, content, position: note.position }, password)
      .then(() => setNotes(prev => prev.map(n => n.id === note.id ? { ...n, title, content } : n)))
      .catch(console.error)
  }

  const handleDelete = (note: KanbanNote) => {
    if (!window.confirm(`Xoá note "${note.title}"?`)) return
    deleteNote(note.id, password)
      .then(() => setNotes(prev => prev.filter(n => n.id !== note.id)))
      .catch(console.error)
  }

  const moveToColumn = (note: KanbanNote, newColKey: string) => {
    const target = columnNotes(newColKey)
    const newPos = target.length
    updateNote(note.id, { column_key: newColKey, title: note.title, content: note.content, position: newPos }, password)
      .then(() => setNotes(prev => prev.map(n => n.id === note.id ? { ...n, column_key: newColKey, position: newPos } : n)))
      .catch(console.error)
  }

  const handleMoveArrow = (note: KanbanNote, dir: -1 | 1) => {
    const idx = COLUMNS.findIndex(c => c.key === note.column_key)
    const nextIdx = idx + dir
    if (nextIdx < 0 || nextIdx >= COLUMNS.length) return
    moveToColumn(note, COLUMNS[nextIdx].key)
  }

  const handleDropOnColumn = (colKey: string) => {
    if (!dragId) return
    const dragged = notes.find(n => n.id === dragId)
    if (!dragged) return
    setDragId(null)
    if (dragged.column_key === colKey) return
    const targetOrdered = [...columnNotes(colKey), dragged]
    setNotes(prev => prev.map(n => n.id === dragged.id ? { ...n, column_key: colKey, position: targetOrdered.length - 1 } : n))
    persistColumnOrder(colKey, targetOrdered)
  }

  return (
    <div className="notes-page">
      <div className="notes-header">
        <h1 className="notes-title">Kanban Quick Note</h1>
        <p className="notes-subtitle">{loading ? 'Đang tải...' : `${notes.length} note`}</p>
      </div>
      <div className="notes-board">
        {COLUMNS.map(col => (
          <div
            key={col.key}
            className="notes-column"
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDropOnColumn(col.key)}
          >
            <div className="notes-column-title">{col.label}</div>
            <div className="notes-column-list">
              {columnNotes(col.key).map(note => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onSave={(title, content) => handleSaveEdit(note, title, content)}
                  onDelete={() => handleDelete(note)}
                  onMoveColumn={dir => handleMoveArrow(note, dir)}
                  onDragStart={() => setDragId(note.id)}
                />
              ))}
            </div>
            <NewNoteForm onCreate={(title, content) => handleCreate(col.key, title, content)} />
          </div>
        ))}
      </div>
    </div>
  )
}
