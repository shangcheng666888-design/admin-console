/**
 * 全站管理后台 API 客户端。
 * 访问 /api/admin/*（除登录外）时自动附加管理员 Bearer token。
 */

import { ADMIN_AUTH_KEY } from '../constants/adminAuth'

const getBaseUrl = (): string => {
  const url = import.meta.env.VITE_API_URL
  if (url) return url.replace(/\/$/, '')
  if (import.meta.env.DEV) return 'http://localhost:3001'
  return ''
}

export const apiBase = getBaseUrl()

export function getAdminToken(): string | null {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(ADMIN_AUTH_KEY) : null
    if (!raw) return null
    const data = JSON.parse(raw) as { token?: string }
    return data?.token && typeof data.token === 'string' ? data.token : null
  } catch {
    return null
  }
}

export interface ApiRes<T = unknown> {
  success?: boolean
  message?: string
  [key: string]: T | boolean | string | undefined
}

function isAdminApiRequest(path: string): boolean {
  const p = path.replace(/^\//, '')
  return p.startsWith('api/admin/') && !p.startsWith('api/admin/auth/login')
}

type ApiFetchOptions = Omit<RequestInit, 'body'> & { body?: object }

export async function apiFetch<T = ApiRes>(
  path: string,
  options?: ApiFetchOptions,
): Promise<T> {
  const url = apiBase ? `${apiBase}${path.startsWith('/') ? '' : '/'}${path}` : path
  const { body, ...rest } = options ?? {}
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...((rest.headers as Record<string, string>) ?? {}),
  }
  if (isAdminApiRequest(path)) {
    const token = getAdminToken()
    if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }
  const fetchBody: BodyInit | null | undefined =
    body !== undefined ? JSON.stringify(body) : (rest as RequestInit).body
  const res = await fetch(url, {
    ...rest,
    headers,
    body: fetchBody,
  })
  const data = (await res.json().catch(() => ({}))) as T & ApiRes
  if (!res.ok) {
    const msg = (data && typeof data === 'object' && 'message' in data && data.message) || res.statusText
    throw new Error(String(msg))
  }
  return data as T
}

export const api = {
  get: <T = ApiRes>(path: string) => apiFetch<T>(path, { method: 'GET' }),
  post: <T = ApiRes>(path: string, body?: object) => apiFetch<T>(path, { method: 'POST', body }),
  patch: <T = ApiRes>(path: string, body?: object) => apiFetch<T>(path, { method: 'PATCH', body }),
  put: <T = ApiRes>(path: string, body?: object) => apiFetch<T>(path, { method: 'PUT', body }),
  delete: <T = ApiRes>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
  uploadImage: async (file: File, options?: { bucket?: 'commodity' }): Promise<{ url: string }> => {
    const url = apiBase ? `${apiBase}/api/upload` : '/api/upload'
    const form = new FormData()
    form.append('file', file)
    if (options?.bucket === 'commodity') form.append('bucket', 'commodity')
    const headers: HeadersInit = {}
    if (options?.bucket === 'commodity') {
      const token = getAdminToken()
      if (token) headers['Authorization'] = `Bearer ${token}`
    }
    const res = await fetch(url, { method: 'POST', body: form, headers })
    const data = (await res.json().catch(() => ({}))) as ApiRes & { url?: string }
    if (!res.ok) throw new Error(String((data && data.message) || res.statusText))
    if (!data.url) throw new Error('上传未返回 URL')
    return { url: data.url }
  },
}
