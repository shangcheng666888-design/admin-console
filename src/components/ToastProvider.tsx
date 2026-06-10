import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export type ToastType = 'success' | 'error'

export interface ToastPayload {
  title: string
  message?: string
  type?: ToastType
}

interface ToastState extends ToastPayload {
  type: ToastType
}

interface ToastContextValue {
  showToast: (input: string | ToastPayload, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const ADMIN_TOAST_DURATION = {
  success: 2800,
  error: 4000,
} as const

function AdminToastIcon({ type }: { type: ToastType }) {
  if (type === 'error') {
    return (
      <svg className="admin-toast-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" opacity="0.35" />
        <path d="M12 8v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="16" r="1" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg className="admin-toast-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" opacity="0.35" />
      <path
        d="M8 12.2l2.6 2.6L16 9.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="admin-toast-icon-check"
      />
    </svg>
  )
}

interface AdminToastViewProps {
  toast: ToastState
  leaving: boolean
  onClose: () => void
}

const AdminToastView: React.FC<AdminToastViewProps> = ({ toast, leaving, onClose }) => {
  const duration = ADMIN_TOAST_DURATION[toast.type]
  const typeLabel = toast.type === 'success' ? '成功' : '失败'

  return (
    <div
      className={`admin-toast admin-toast--${toast.type}${leaving ? ' admin-toast--leaving' : ''}`}
      role="alert"
      aria-live="assertive"
    >
      <span className="admin-toast-orb" aria-hidden />
      <div className="admin-toast-panel">
        <div className="admin-toast-top">
          <span className="admin-toast-badge">{typeLabel}</span>
          <button type="button" className="admin-toast-close" onClick={onClose} aria-label="关闭提示">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="admin-toast-main">
          <div className="admin-toast-icon-ring" aria-hidden>
            <span className="admin-toast-icon-pulse" />
            <span className="admin-toast-icon-wrap">
              <AdminToastIcon type={toast.type} />
            </span>
          </div>
          <div className="admin-toast-body">
            <strong className="admin-toast-title">{toast.title}</strong>
            {toast.message ? <p className="admin-toast-message">{toast.message}</p> : null}
          </div>
        </div>
        <div className="admin-toast-footer">
          <div className="admin-toast-progress-track">
            <div className="admin-toast-progress" style={{ animationDuration: `${duration}ms` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastState | null>(null)
  const [leaving, setLeaving] = useState(false)
  const timerRef = useRef<number | null>(null)
  const leaveTimerRef = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (leaveTimerRef.current) {
      window.clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
  }, [])

  const dismissToast = useCallback(() => {
    clearTimers()
    setLeaving(true)
    leaveTimerRef.current = window.setTimeout(() => {
      setToast(null)
      setLeaving(false)
    }, 220)
  }, [clearTimers])

  const showToast = useCallback(
    (input: string | ToastPayload, legacyType: ToastType = 'success') => {
      const next: ToastState =
        typeof input === 'string'
          ? { title: input, type: legacyType }
          : {
              title: input.title,
              message: input.message,
              type: input.type ?? 'success',
            }

      clearTimers()
      setLeaving(false)
      setToast(next)

      const duration = ADMIN_TOAST_DURATION[next.type]
      timerRef.current = window.setTimeout(() => {
        dismissToast()
      }, duration)
    },
    [clearTimers, dismissToast],
  )

  useEffect(
    () => () => {
      clearTimers()
    },
    [clearTimers],
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? <AdminToastView toast={toast} leaving={leaving} onClose={dismissToast} /> : null}
    </ToastContext.Provider>
  )
}

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}
