import React from 'react'

export interface AdminEditConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

const AdminEditConfirmModal: React.FC<AdminEditConfirmModalProps> = ({
  open,
  title,
  message,
  confirmLabel = '确认编辑',
  cancelLabel = '取消',
  onConfirm,
  onCancel,
}) => {
  if (!open) return null

  return (
    <div
      className="admin-edit-confirm-overlay"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="admin-edit-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-edit-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-edit-confirm-icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 id="admin-edit-confirm-title" className="admin-edit-confirm-title">{title}</h2>
        <p className="admin-edit-confirm-message">{message}</p>
        <div className="admin-edit-confirm-actions">
          <button type="button" className="admin-edit-confirm-btn admin-edit-confirm-btn--cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="admin-edit-confirm-btn admin-edit-confirm-btn--confirm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminEditConfirmModal
