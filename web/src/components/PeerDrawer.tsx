import { motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { FiAlertTriangle, FiCheck, FiCopy, FiX } from 'react-icons/fi'
import { apiFetch, urlKey } from '../lib/api'
import { bytes, dateTime, peerLabel, timeAgo } from '../lib/format'
import type { Peer, PeerHistory } from '../types'
import type { PeerState } from './StatusDot'
import { Avatar, IconButton, StatusChip } from './ui'

interface Props {
  peer: Peer
  state: PeerState
  quiet: boolean
  activityTimeoutSeconds: number
  now: number
  onClose: () => void
}

const input =
  'mt-1.5 w-full rounded-xl border border-line bg-sunken px-3.5 py-2.5 text-sm outline-none transition placeholder:text-subtle focus:border-brand/50 focus:bg-elevated focus:ring-4 focus:ring-brand/10'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-sunken px-3.5 py-3">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-subtle">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium">{children}</dd>
    </div>
  )
}

export function PeerDrawer({ peer, state, quiet, activityTimeoutSeconds, now, onClose }: Props) {
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
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const dirty = name.trim() !== (peer.name ?? '') || notes.trim() !== (peer.notes ?? '')
  const label = peerLabel(peer)
  const uptime = history?.uptime24h

  const save = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await apiFetch(`/peers/${urlKey(peer.publicKey)}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim() || null, notes: notes.trim() || null }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
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
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={label}>
      <motion.div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm dark:bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-line bg-elevated shadow-pop"
      >
        {/* Hero */}
        <div className="relative shrink-0 overflow-hidden border-b border-line px-6 py-6">
          <div
            className={`pointer-events-none absolute -right-16 -top-24 size-64 rounded-full blur-3xl ${
              state === 'online' ? 'bg-ok/20' : state === 'offline' ? 'bg-bad/15' : 'bg-idle/15'
            }`}
          />
          <div className="absolute right-4 top-4 z-10">
            <IconButton label="Close" onClick={onClose}>
              <FiX className="size-5" />
            </IconButton>
          </div>
          <div className="relative flex items-center gap-4 pr-10">
            <Avatar label={label} seed={peer.publicKey} state={state} size="lg" />
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold tracking-tight">{label}</h2>
              <div className="mt-1.5">
                <StatusChip state={state} />
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 space-y-6 px-6 py-6">
          {quiet && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 rounded-xl border border-warn/25 bg-warn/10 p-3.5 text-sm text-fg"
            >
              <FiAlertTriangle className="mt-0.5 shrink-0 text-warn" />
              <p>
                No traffic for over {activityTimeoutSeconds}s. If it was just switched off, that's expected. If it's
                still connected, add <code className="rounded bg-sunken px-1 font-mono text-xs">PersistentKeepalive = 25</code>{' '}
                to the client's own [Peer] config.
              </p>
            </motion.div>
          )}

          <dl className="grid grid-cols-2 gap-2.5">
            <Field label="Tunnel IP"><span className="font-mono">{peer.allowedIps.join(', ') || '—'}</span></Field>
            <Field label="Uptime 24h">{uptime != null ? `${(uptime * 100).toFixed(1)}%` : '—'}</Field>
            <Field label="Last seen">{timeAgo(peer.lastActivityAt ?? peer.latestHandshake, now)}</Field>
            <Field label="Handshake">{timeAgo(peer.latestHandshake, now)}</Field>
            <Field label="Received">{bytes(peer.rxBytes)}</Field>
            <Field label="Sent">{bytes(peer.txBytes)}</Field>
            <div className="col-span-2">
              <Field label="Endpoint"><span className="font-mono">{peer.endpoint ?? '—'}</span></Field>
            </div>
          </dl>

          {uptime != null && (
            <div>
              <div className="mb-2 flex justify-between text-xs text-muted">
                <span>Availability (24h)</span>
                <span className="tabular-nums">{(uptime * 100).toFixed(1)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-bad/15">
                <motion.div
                  className="h-full rounded-full bg-linear-to-r from-brand to-brand-2"
                  initial={{ width: 0 }}
                  animate={{ width: `${uptime * 100}%` }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>
          )}

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Details</h3>
            <label className="block">
              <span className="text-xs font-medium text-muted">Display name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} placeholder="e.g. office-nas" className={input} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Location, owner, purpose…"
                className={`${input} resize-y`}
              />
            </label>
            <div className="flex items-center gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => void save()}
                disabled={!dirty || saving}
                className="rounded-xl bg-linear-to-r from-brand to-brand-2 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </motion.button>
              {saved && (
                <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="inline-flex items-center gap-1 text-sm text-ok">
                  <FiCheck /> Saved
                </motion.span>
              )}
              {saveError && <span className="text-sm text-bad">{saveError}</span>}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Public key</h3>
            <button
              onClick={() => void copyKey()}
              className="group flex w-full items-start gap-3 rounded-xl bg-sunken px-3.5 py-3 text-left transition hover:ring-1 hover:ring-line-strong"
              title="Copy public key"
            >
              <span className="break-all font-mono text-xs text-muted">{peer.publicKey}</span>
              {copied ? <FiCheck className="mt-0.5 shrink-0 text-ok" /> : <FiCopy className="mt-0.5 shrink-0 text-subtle group-hover:text-fg" />}
            </button>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold">Recent activity</h3>
            {!history ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton h-10 rounded-xl" />
                ))}
              </div>
            ) : history.events.length === 0 ? (
              <p className="text-sm text-muted">No status changes recorded yet.</p>
            ) : (
              <ol className="relative space-y-4 pl-6 before:absolute before:bottom-2 before:left-1.25 before:top-2 before:w-px before:bg-line-strong">
                {history.events.map((e, i) => (
                  <motion.li
                    key={e.at}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i, 12) * 0.04 }}
                    className="relative"
                  >
                    <span
                      className={`absolute -left-6 top-1 size-2.75 rounded-full ring-4 ring-elevated ${e.online ? 'bg-ok' : 'bg-bad'}`}
                    />
                    <div className="text-sm font-medium">{e.online ? 'Came online' : 'Went offline'}</div>
                    <div className="text-xs text-subtle">
                      {dateTime(e.at)} · {timeAgo(e.at, now)}
                    </div>
                  </motion.li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </motion.aside>
    </div>
  )
}
