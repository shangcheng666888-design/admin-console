import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import AdminEditConfirmModal from '../components/admin/AdminEditConfirmModal'

export interface AdminEditConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
}

interface AdminEditConfirmContextValue {
  requestEditConfirm: (options: AdminEditConfirmOptions) => void
}

const AdminEditConfirmContext = createContext<AdminEditConfirmContextValue | null>(null)

export const AdminEditConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<AdminEditConfirmOptions | null>(null)

  const close = useCallback(() => {
    setOpen(false)
    setOptions(null)
  }, [])

  const requestEditConfirm = useCallback((next: AdminEditConfirmOptions) => {
    setOptions(next)
    setOpen(true)
  }, [])

  const handleConfirm = useCallback(() => {
    const action = options?.onConfirm
    close()
    action?.()
  }, [close, options])

  const value = useMemo(() => ({ requestEditConfirm }), [requestEditConfirm])

  return (
    <AdminEditConfirmContext.Provider value={value}>
      {children}
      <AdminEditConfirmModal
        open={open}
        title={options?.title ?? '确认编辑'}
        message={options?.message ?? '即将修改重要信息，请确认后继续。'}
        confirmLabel={options?.confirmLabel}
        cancelLabel={options?.cancelLabel}
        onConfirm={handleConfirm}
        onCancel={close}
      />
    </AdminEditConfirmContext.Provider>
  )
}

export function useAdminEditConfirm(): AdminEditConfirmContextValue {
  const ctx = useContext(AdminEditConfirmContext)
  if (!ctx) {
    throw new Error('useAdminEditConfirm must be used within AdminEditConfirmProvider')
  }
  return ctx
}
