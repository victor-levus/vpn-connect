import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FiAlertTriangle, FiLock, FiRefreshCw } from 'react-icons/fi'
import { FilterBar, type Filter } from '../components/FilterBar'
import { Header } from '../components/Header'
import { Overview } from '../components/Overview'
import { PeerDrawer } from '../components/PeerDrawer'
import { PeerGrid, type PeerRow } from '../components/PeerGrid'
import type { PeerState } from '../components/StatusDot'
import { Toasts, type Toast } from '../components/Toasts'
import { card } from '../components/ui'
import { useNow } from '../hooks/useNow'
import { useSnapshot } from '../hooks/useSnapshot'
import { peerLabel, timeAgo } from '../lib/format'

export function Dashboard() {
  const { snapshot, receivedAt, state, error } = useSnapshot()
  const now = useNow()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  // Re-check "online" locally between updates. Ages are measured on the server's clock
  // (generatedAt) plus time elapsed on ours since it arrived, so clock skew doesn't matter.
  const rows: PeerRow[] = useMemo(() => {
    if (!snapshot) return []
    const elapsed = now - receivedAt
    const age = (t: number | null | undefined) => (t == null ? Infinity : snapshot.generatedAt - t + elapsed)
    const handshakeLimit = snapshot.onlineThresholdSeconds * 1000
    const activityLimit = (snapshot.activityTimeoutSeconds ?? 40) * 1000
    // Show times relative to our clock, shifted by the server/client offset.
    const offset = receivedAt - snapshot.generatedAt
    const shift = (t: number | null | undefined) => (t == null ? null : t + offset)

    return snapshot.peers.map((peer) => {
      const handshakeFresh = age(peer.latestHandshake) < handshakeLimit
      let s: PeerState
      if (peer.latestHandshake === null) s = 'never'
      else s = peer.online && handshakeFresh && age(peer.lastActivityAt) < activityLimit ? 'online' : 'offline'
      return {
        peer: {
          ...peer,
          latestHandshake: shift(peer.latestHandshake),
          lastOnlineAt: shift(peer.lastOnlineAt),
          lastActivityAt: shift(peer.lastActivityAt),
        },
        state: s,
        quiet: s === 'offline' && handshakeFresh,
      }
    })
  }, [snapshot, receivedAt, now])

  // Toast whenever a peer flips state (not on first load).
  const prevStates = useRef<Map<string, PeerState> | null>(null)
  const toastId = useRef(0)
  useEffect(() => {
    if (rows.length === 0) return
    const next = new Map(rows.map((r) => [r.peer.publicKey, r.state]))
    const prev = prevStates.current
    prevStates.current = next
    if (!prev) return
    const changed = rows.filter((r) => prev.has(r.peer.publicKey) && prev.get(r.peer.publicKey) !== r.state && r.state !== 'never')
    if (changed.length === 0) return
    setToasts((t) =>
      [
        ...t,
        ...changed.map((r) => ({ id: ++toastId.current, label: peerLabel(r.peer), seed: r.peer.publicKey, state: r.state, at: Date.now() })),
      ].slice(-4),
    )
  }, [rows])
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const onlineCount = rows.filter((r) => r.state === 'online').length
  const q = query.trim().toLowerCase()
  const visible = rows.filter((r) => {
    if (filter === 'online' && r.state !== 'online') return false
    if (filter === 'offline' && r.state === 'online') return false
    if (!q) return true
    const p = r.peer
    return [peerLabel(p), p.notes ?? '', p.publicKey, p.endpoint ?? '', ...p.allowedIps].some((v) => v.toLowerCase().includes(q))
  })

  const selected = rows.find((r) => r.peer.publicKey === selectedKey)
  const stale = snapshot && now - receivedAt > snapshot.pollIntervalSeconds * 3 * 1000 + 5000
  const closeDrawer = useCallback(() => setSelectedKey(null), [])

  return (
    <div className="min-h-dvh">
      <Header state={state} hostname={snapshot?.server.hostname} />

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        <AnimatePresence>
          {error && state !== 'error' && (
            <Banner key="err" tone="warn" icon={<FiRefreshCw className="animate-spin" />}>
              {error}
            </Banner>
          )}
          {snapshot?.error && (
            <Banner key="wg" tone="error" icon={<FiAlertTriangle />}>
              {snapshot.error}. Showing the last known data.
            </Banner>
          )}
          {stale && !error && (
            <Banner key="stale" tone="warn" icon={<FiAlertTriangle />}>
              No update from the server for {timeAgo(receivedAt, now).replace(' ago', '')}. Data may be out of date.
            </Banner>
          )}
        </AnimatePresence>

        {state === 'error' ? (
          <NoAccess message={error} />
        ) : !snapshot ? (
          <Skeleton />
        ) : (
          <>
            <Overview snapshot={snapshot} online={onlineCount} />

            <section className="space-y-5">
              <FilterBar
                filter={filter}
                onFilter={setFilter}
                counts={{ all: rows.length, online: onlineCount, offline: rows.length - onlineCount }}
                query={query}
                onQuery={setQuery}
              />
              <PeerGrid rows={visible} now={now} onSelect={(p) => setSelectedKey(p.publicKey)} hasQuery={!!q} />
            </section>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="pb-6 text-center text-xs text-subtle">
              Updated {timeAgo(receivedAt, now)} · checking every {snapshot.pollIntervalSeconds}s · offline after{' '}
              {snapshot.activityTimeoutSeconds ?? 40}s without traffic
            </motion.p>
          </>
        )}
      </main>

      <AnimatePresence>
        {selected && (
          <PeerDrawer
            key={selected.peer.publicKey}
            peer={selected.peer}
            state={selected.state}
            quiet={selected.quiet}
            activityTimeoutSeconds={snapshot?.activityTimeoutSeconds ?? 40}
            now={now}
            onClose={closeDrawer}
          />
        )}
      </AnimatePresence>

      <Toasts toasts={toasts} onDismiss={dismiss} onOpen={(key) => setSelectedKey(key)} />
    </div>
  )
}

function Banner({ tone, icon, children }: { tone: 'warn' | 'error'; icon: ReactNode; children: ReactNode }) {
  const cls = tone === 'error' ? 'border-bad/25 bg-bad/10 [&>svg]:text-bad' : 'border-warn/25 bg-warn/10 [&>svg]:text-warn'
  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={`flex items-center gap-3 overflow-hidden rounded-xl border px-4 py-3 text-sm ${cls}`}
    >
      {icon}
      <span>{children}</span>
    </motion.div>
  )
}

function NoAccess({ message }: { message: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${card} mx-auto mt-12 max-w-md p-8 text-center`}
    >
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-bad/10 text-bad">
        <FiLock className="size-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Access denied</h2>
      <p className="mt-1 text-sm text-muted">{message}</p>
    </motion.div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="skeleton h-80 rounded-2xl lg:col-span-2" />
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-36 rounded-2xl" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-36 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
