import { fetchEventSource } from '@microsoft/fetch-event-source'
import { useEffect, useState } from 'react'
import { API_URL, authHeaders } from '../lib/api'
import type { ConnectionState, Snapshot } from '../types'

class HttpError extends Error {
  status: number
  constructor(status: number) {
    super(`HTTP ${status}`)
    this.status = status
  }
}

export interface LiveSnapshot {
  snapshot: Snapshot | null
  /** Client clock time when the snapshot arrived, used instead of the server clock to avoid skew. */
  receivedAt: number
  state: ConnectionState
  error: string | null
}

/**
 * Subscribes to the backend's Server-Sent Events stream.
 * Each (re)connect fetches a fresh Firebase ID token, since tokens expire after an hour.
 */
export function useSnapshot(): LiveSnapshot {
  const [live, setLive] = useState<LiveSnapshot>({ snapshot: null, receivedAt: 0, state: 'connecting', error: null })

  useEffect(() => {
    const ctrl = new AbortController()
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let attempt = 0

    const connect = async () => {
      try {
        await fetchEventSource(`${API_URL}/api/stream`, {
          signal: ctrl.signal,
          headers: await authHeaders(),
          openWhenHidden: true,
          async onopen(res) {
            if (!res.ok) throw new HttpError(res.status)
            attempt = 0
            setLive((l) => ({ ...l, state: 'live', error: null }))
          },
          onmessage(msg) {
            if (msg.event !== 'snapshot') return
            setLive({ snapshot: JSON.parse(msg.data) as Snapshot, receivedAt: Date.now(), state: 'live', error: null })
          },
          onclose() {
            throw new Error('Stream closed by server')
          },
          onerror(err) {
            throw err // handled below so every retry gets a fresh token
          },
        })
      } catch (err) {
        if (ctrl.signal.aborted) return
        const forbidden = err instanceof HttpError && err.status === 403
        const message = forbidden
          ? 'This Google account is not allowed to use this dashboard.'
          : err instanceof HttpError && err.status === 401
            ? 'Your session expired. Reconnecting…'
            : 'Cannot reach the VPN server API. Retrying…'
        setLive((l) => ({ ...l, state: forbidden ? 'error' : 'reconnecting', error: message }))
        if (forbidden) return
        attempt++
        retryTimer = setTimeout(connect, Math.min(30_000, 2_000 * attempt))
      }
    }

    void connect()
    return () => {
      ctrl.abort()
      clearTimeout(retryTimer)
    }
  }, [])

  return live
}
