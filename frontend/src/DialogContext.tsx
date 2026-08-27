import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type ConfirmOptions = {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ToastType = 'error' | 'info' | 'success'
type ToastItem = { id: number; message: string; type: ToastType }

type DialogsAPI = {
  confirm: (opts: ConfirmOptions | string) => Promise<boolean>
  toast: (message: string, type?: ToastType) => void
}

const DialogContext = createContext<DialogsAPI | null>(null)

export function useDialogs(): DialogsAPI {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialogs must be used within <DialogProvider>')
  return ctx
}

let nextToastId = 0

export function DialogProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const confirm = useCallback((opts: ConfirmOptions | string): Promise<boolean> => {
    const normalized: ConfirmOptions = typeof opts === 'string' ? { message: opts } : opts
    return new Promise<boolean>(resolve => setConfirmState({ ...normalized, resolve }))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'error') => {
    const id = ++nextToastId
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const resolveConfirm = (result: boolean) => {
    confirmState?.resolve(result)
    setConfirmState(null)
  }

  return (
    <DialogContext.Provider value={{ confirm, toast }}>
      {children}
      {confirmState && (
        <div className="confirm-overlay" onClick={() => resolveConfirm(false)}>
          <div className="confirm-card" onClick={e => e.stopPropagation()}>
            {confirmState.title && <div className="confirm-title">{confirmState.title}</div>}
            <div className="confirm-message">{confirmState.message}</div>
            <div className="confirm-actions">
              <button className="confirm-btn" onClick={() => resolveConfirm(false)}>{confirmState.cancelLabel || 'Huỷ'}</button>
              <button
                className={`confirm-btn ${confirmState.danger ? 'confirm-btn--danger' : 'confirm-btn--primary'}`}
                onClick={() => resolveConfirm(true)}
              >
                {confirmState.confirmLabel || 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`} onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>
            {t.message}
          </div>
        ))}
      </div>
    </DialogContext.Provider>
  )
}
