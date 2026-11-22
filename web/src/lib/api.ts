import { auth } from './firebase'

export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Current user's Firebase ID token (refreshed automatically when close to expiry). */
export async function getToken(): Promise<string | null> {
  return auth?.currentUser ? auth.currentUser.getIdToken() : null
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(await authHeaders()),
      ...init.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

/** WireGuard keys are base64 and can contain "/"; the API takes them as base64url. */
export const urlKey = (publicKey: string) => publicKey.replace(/\+/g, '-').replace(/\//g, '_')
