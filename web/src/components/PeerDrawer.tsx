import { useEffect, useState, type ReactNode } from 'react'
import { FiAlertTriangle, FiCheck, FiCopy, FiX } from 'react-icons/fi'
import { apiFetch, urlKey } from '../lib/api'
import { bytes, dateTime, peerLabel, timeAgo } from '../lib/format'
import type { Peer, PeerHistory } from '../types'
import { StatusDot, type PeerState } from './StatusDot'

interface Props {
  peer: Peer
  state: PeerState
  now: number
  onClose: () => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-200">{children}</dd>
    </div>
  )
}

export function PeerDrawer({ peer, state, now, onClose }: Props) {
  const [name, setName] = useState(peer.name ?? '')
  const [notes, setNotes] = useState(peer.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<PeerHistory | null>(null)

  useEffect(() => {
    let cancelled = false
    apiFetch<PeerHistory>(`/peers/${urlKey(peer.publicKey)}/history`)
      .then((h) => !cancelled && setHistory(h))
      .catch(() => !cancelled && setHistory({ events: [], uptime24h: null, trackedSince: Date.now() }))
    return () => {
      cancelled = true
    }
    // Refetch when the peer's state flips so the timeline includes the new event.
  }, [peer.publicKey, state])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const dirty = name.trim() !== (peer.name ?? '') || notes.trim() !== (peer.notes ?? '')

  const save = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await apiFetch(`/peers/${urlKey(peer.publicKey)}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim() || null, notes: notes.trim() || null }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const copyKey = async () => {
    await navigator.clipboard.writeText(peer.publicKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end" role="dialog" aria-modal="true" aria-label={peerLabel(peer)}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-white/10 bg-slate-950 shadow-2xl">
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-white/5 bg-slate-950/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-white">{peerLabel(peer)}</h2>
            <div className="mt-1"><StatusDot state={state} withLabel /></div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close">
            <FiX className="size-5" />
          </button>
        </div>

        <div className="space-y-6 px-5 py-5">
          {peer.persistentKeepalive === null && (
            <div className="flex gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
              <FiAlertTriangle className="mt-0.5 shrink-0" />
              <p>
                No keepalive is set for this peer, so it may show offline while idle. Add{' '}
                <code className="rounded bg-black/30 px-1">PersistentKeepalive = 25</code> to the client's [Peer] section.
              </p>
            </div>
          )}

          <section className="space-y-3">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-slate-500">Display name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={64}
                placeholder="e.g. office-nas"
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-slate-500">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Location, owner, purpose…"
                className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none"
              />
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => void save()}
                disabled={!dirty || saving}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {saved && <span className="inline-flex items-center gap-1 text-sm text-emerald-300"><FiCheck /> Saved</span>}
              {saveError && <span className="text-sm text-rose-300">{saveError}</span>}
            </div>
          </section>

          <dl className="grid grid-cols-2 gap-4 rounded-xl border border-white/5 bg-slate-900/40 p-4">
            <Field label="Tunnel IP"><span className="font-mono">{peer.allowedIps.join(', ') || '—'}</span></Field>
            <Field label="Endpoint"><span className="break-all font-mono">{peer.endpoint ?? '—'}</span></Field>
            <Field label="Last handshake">{timeAgo(peer.latestHandshake, now)}</Field>
            <Field label="Last online">{peer.lastOnlineAt ? timeAgo(peer.lastOnlineAt, now) : 'never'}</Field>
            <Field label="Received">{bytes(peer.rxBytes)}</Field>
            <Field label="Sent">{bytes(peer.txBytes)}</Field>
            <Field label="Keepalive">{peer.persistentKeepalive ? `${peer.persistentKeepalive}s` : 'off'}</Field>
            <Field label="Uptime (24h)">
              {history?.uptime24h != null ? `${(history.uptime24h * 100).toFixed(1)}%` : '—'}
            </Field>
            <div className="col-span-2">
              <Field label="Public key">
                <button onClick={() => void copyKey()} className="group flex w-full items-start gap-2 text-left" title="Copy">
                  <span className="break-all font-mono text-xs text-slate-300">{peer.publicKey}</span>
                  {copied ? <FiCheck className="mt-0.5 shrink-0 text-emerald-400" /> : <FiCopy className="mt-0.5 shrink-0 text-slate-500 group-hover:text-white" />}
                </button>
              </Field>
            </div>
          </dl>

          <section>
            <h3 className="mb-3 text-xs uppercase tracking-wide text-slate-500">Recent activity</h3>
            {!history ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : history.events.length === 0 ? (
              <p className="text-sm text-slate-500">No status changes recorded yet.</p>
            ) : (
              <ol className="space-y-0 border-l border-white/10 pl-4">
                {history.events.map((e) => (
                  <li key={e.at} className="relative pb-3 last:pb-0">
                    <span className={`absolute -left-[21px] top-1.5 size-2.5 rounded-full ring-4 ring-slate-950 ${e.online ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                    <div className="text-sm text-slate-200">{e.online ? 'Came online' : 'Went offline'}</div>
                    <div className="text-xs text-slate-500">{dateTime(e.at)} · {timeAgo(e.at, now)}</div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </aside>
    </div>
  )
}
