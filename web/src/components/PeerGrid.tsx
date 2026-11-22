import { AnimatePresence, motion } from 'motion/react'
import { FiArrowDown, FiArrowUp, FiClock, FiSearch } from 'react-icons/fi'
import { bytes, peerLabel, timeAgo } from '../lib/format'
import type { Peer } from '../types'
import type { PeerState } from './StatusDot'
import { Avatar, card, StatusChip } from './ui'

export interface PeerRow {
  peer: Peer
  state: PeerState
  /** Offline by traffic, though the handshake is still current. */
  quiet: boolean
}

const lastSeen = (p: Peer) => p.lastActivityAt ?? p.latestHandshake

interface Props {
  rows: PeerRow[]
  now: number
  onSelect: (peer: Peer) => void
  hasQuery: boolean
}

export function PeerGrid({ rows, now, onSelect, hasQuery }: Props) {
  return (
    <motion.ul layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <AnimatePresence mode="popLayout" initial={false}>
        {rows.map(({ peer, state }, i) => (
          <motion.li
            key={peer.publicKey}
            layout
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { delay: Math.min(i, 10) * 0.03, duration: 0.35 } }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
            transition={{ layout: { type: 'spring', stiffness: 350, damping: 32 } }}
            className="h-full"
          >
            <PeerCard peer={peer} state={state} now={now} onSelect={onSelect} />
          </motion.li>
        ))}
      </AnimatePresence>
      {rows.length === 0 && (
        <motion.li
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`${card} col-span-full flex flex-col items-center gap-3 border-dashed px-6 py-14 text-center`}
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-sunken text-subtle">
            <FiSearch className="size-5" />
          </span>
          <div className="font-medium">{hasQuery ? 'No peers match your search' : 'No peers in this view'}</div>
          <div className="text-sm text-muted">Try a different filter or search term.</div>
        </motion.li>
      )}
    </motion.ul>
  )
}

function PeerCard({ peer, state, now, onSelect }: { peer: Peer; state: PeerState; now: number; onSelect: (p: Peer) => void }) {
  const label = peerLabel(peer)
  const online = state === 'online'
  return (
    <motion.button
      onClick={() => onSelect(peer)}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`${card} group relative flex h-full w-full flex-col overflow-hidden p-5 text-left transition-[border-color,box-shadow] duration-300 hover:border-line-strong hover:shadow-pop focus-visible:outline-2 focus-visible:outline-brand`}
    >
      {/* Status accent line along the top edge */}
      <span
        className={`absolute inset-x-0 top-0 h-0.5 transition-opacity duration-500 ${
          online ? 'bg-linear-to-r from-transparent via-ok to-transparent opacity-80' : 'opacity-0'
        }`}
      />
      {online && (
        <span className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-ok/10 blur-2xl transition-opacity group-hover:opacity-100 sm:opacity-60" />
      )}

      <div className="relative mb-4 flex items-start gap-3.5">
        <Avatar label={label} seed={peer.publicKey} state={state} />
        <div className="min-w-0 flex-1">
          <div className={`truncate font-semibold tracking-tight ${peer.name ? '' : 'text-muted'}`}>{label}</div>
          <div className="mt-0.5 truncate font-mono text-xs text-subtle">{peer.allowedIps.join(', ') || 'no allowed IPs'}</div>
        </div>
        <StatusChip state={state} />
      </div>

      {peer.notes && <p className="relative -mt-1 mb-4 line-clamp-1 text-sm text-muted">{peer.notes}</p>}

      <div className="relative mt-auto flex items-center gap-4 border-t border-line pt-3.5 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5" title="Last traffic from this peer">
          <FiClock className="size-3.5 text-subtle" />
          {online ? 'Active ' : 'Seen '}
          {timeAgo(lastSeen(peer), now)}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 tabular-nums">
          <FiArrowDown className="size-3.5 text-brand-2" />
          {bytes(peer.rxBytes)}
        </span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <FiArrowUp className="size-3.5 text-violet-500" />
          {bytes(peer.txBytes)}
        </span>
      </div>
    </motion.button>
  )
}
