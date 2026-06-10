export function parseErrorReason(reason: unknown, fallback = '请稍后重试'): string {
  if (reason instanceof Error && reason.message.trim()) return reason.message.trim()
  if (typeof reason === 'string' && reason.trim()) return reason.trim()
  return fallback
}
