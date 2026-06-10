import { useCallback } from 'react'
import { useToast, type ToastPayload } from '../components/ToastProvider'
import { parseErrorReason } from '../utils/adminFeedback'

export function useAdminToast() {
  const { showToast } = useToast()

  const saveSuccess = useCallback(
    (detail?: string) => {
      showToast({ title: '修改成功', message: detail, type: 'success' })
    },
    [showToast],
  )

  const saveError = useCallback(
    (reason: unknown, fallback = '请稍后重试') => {
      showToast({ title: '修改失败', message: parseErrorReason(reason, fallback), type: 'error' })
    },
    [showToast],
  )

  const actionSuccess = useCallback(
    (detail: string) => {
      showToast({ title: '操作成功', message: detail, type: 'success' })
    },
    [showToast],
  )

  const actionError = useCallback(
    (reason: unknown, fallback = '请稍后重试') => {
      showToast({ title: '操作失败', message: parseErrorReason(reason, fallback), type: 'error' })
    },
    [showToast],
  )

  const loadError = useCallback(
    (reason: unknown, fallback = '请刷新页面后重试') => {
      showToast({ title: '加载失败', message: parseErrorReason(reason, fallback), type: 'error' })
    },
    [showToast],
  )

  const validateError = useCallback(
    (reason: string) => {
      showToast({ title: '请检查输入', message: reason, type: 'error' })
    },
    [showToast],
  )

  const notify = useCallback(
    (payload: ToastPayload) => {
      showToast(payload)
    },
    [showToast],
  )

  return {
    saveSuccess,
    saveError,
    actionSuccess,
    actionError,
    loadError,
    validateError,
    notify,
  }
}
