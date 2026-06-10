export function formatDateTime(input: string | number | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!input) return ''
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  const locale = typeof navigator !== 'undefined' && navigator.language ? navigator.language : undefined
  const base: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }
  return d.toLocaleString(locale, { ...base, ...options })
}

export function formatDate(input: string | number | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!input) return ''
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  const locale = typeof navigator !== 'undefined' && navigator.language ? navigator.language : undefined
  const base: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }
  return d.toLocaleDateString(locale, { ...base, ...options })
}

