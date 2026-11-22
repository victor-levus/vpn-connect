import { useMemo, useState, type ReactNode } from 'react'
import { FiAlertTriangle, FiSearch } from 'react-icons/fi'
import { Header } from '../components/Header'
import { PeerDrawer } from '../components/PeerDrawer'
import { PeerList, type PeerRow } from '../components/PeerList'
import { SummaryCards } from '../components/SummaryCards'
import type { PeerState } from '../components/StatusDot'
import { useNow } from '../hooks/useNow'
import { useSnapshot } from '../hooks/useSnapshot'
import { peerLabel, timeAgo } from '../lib/format'

type Filter = 'all' | 'online' | 'offline'

export function Dashboard() {
  const { snapshot, receivedAt, state, error } = useSnapshot()
  const now = useNow()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  // Re-check "online" locally between updates. Handshake age is measured on the server's clock
  // (generatedAt) plus time elapsed on ours since it arrived, so clock skew doesn't matter.
  const rows: PeerRow[] = useMemo(() => {
    if (!snapshot) return []
    const elapsed = now - receivedAt
    const threshold = snapshot.onlineThresholdSeconds * 1000
    return snapshot.peers.map((peer) => {
      let s: PeerState
      if (peer.latestHandshake === null) s = 'never'
      else s = peer.online && snapshot.generatedAt - peer.latestHandshake + elapsed < threshold ? 'online' : 'offline'
      // Show times relative to our clock, shifted by the server/client offset.
      const offset = receivedAt - snapshot.generatedAt
      return {
        peer: {
          ...peer,
          latestHandshake: peer.latestHandshake && peer.latestHandshake + offset,
          lastOnlineAt: peer.lastOnlineAt && peer.lastOnlineAt + offset,
        },
        state: s,
      }
    })
  }, [snapshot, receivedAt, now])

  const onlineCount = rows.filter((r) => r.state === 'online').length

  const visible = rows.filter((r) => {
    if (filter === 'online' && r.state !== 'online') return false
    if (filter === 'offline' && r.state === 'online') return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    const p = r.peer
    return [peerLabel(p), p.notes ?? '', p.publicKey, p.endpoint ?? '', ...p.allowedIps].some((v) => v.toLowerCase().includes(q))
  })

  const selected = rows.find((r) => r.peer.publicKey === selectedKey)
  const stale = snapshot && now - receivedAt > snapshot.pollIntervalSeconds * 3 * 1000

  return (
    <div className="min-h-dvh">
      <Header state={state} hostname={snapshot?.server.hostname} />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {error && (
          <Banner tone={state === 'error' ? 'error' : 'warn'}>{error}</Banner>
        )}
        {snapshot?.error && <Banner tone="error">{snapshot.error}. Showing the last known data.</Banner>}
        {stale && !error && (
          <Banner tone="warn">No update from the server for {timeAgo(receivedAt, now).replace(' ago', '')}. Data may be out of date.</Banner>
        )}

        {!snapshot ? (
          state === 'error' ? null : <Skeleton />
        ) : (
          <>
            <SummaryCards snapshot={snapshot} online={onlineCount} />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex rounded-lg border border-white/10 bg-slate-900/60 p-1">
                {(['all', 'online', 'offline'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-md px-3 py-1.5 text-sm capitalize transition ${
                      filter === f ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {f}
                    <span className="ml-1.5 text-xs text-slate-500">
                      {f === 'all' ? rows.length : f === 'online' ? onlineCount : rows.length - onlineCount}
                    </span>
                  </button>
                ))}
              </div>
              <label className="relative sm:ml-auto sm:w-72">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, IP, key…"
                  className="w-full rounded-lg border border-white/10 bg-slate-900/60 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none"
                />
              </label>
            </div>

            <PeerList rows={visible} now={now} onSelect={(p) => setSelectedKey(p.publicKey)} />

            <p className="text-center text-xs text-slate-600">
              Updated {timeAgo(receivedAt, now)} · polling every {snapshot.pollIntervalSeconds}s · online = handshake within{' '}
              {snapshot.onlineThresholdSeconds / 60} min
            </p>
          </>
        )}
      </main>

      {selected && (
        <PeerDrawer
          key={selected.peer.publicKey}
          peer={selected.peer}
          state={selected.state}
          now={now}
          onClose={() => setSelectedKey(null)}
        />
      )}
    </div>
  )
}

function Banner({ tone, children }: { tone: 'warn' | 'error'; children: ReactNode }) {
  const cls =
    tone === 'error'
      ? 'border-rose-500/20 bg-rose-500/10 text-rose-200'
      : 'border-amber-500/20 bg-amber-500/10 text-amber-200'
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${cls}`}>
      <FiAlertTriangle className="shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-900/60" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-slate-900/60" />
    </div>
  )
}
