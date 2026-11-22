import { FiArrowDown, FiArrowUp, FiChevronRight } from 'react-icons/fi'
import { bytes, peerLabel, shortKey, timeAgo } from '../lib/format'
import type { Peer } from '../types'
import { StatusDot, type PeerState } from './StatusDot'

export interface PeerRow {
  peer: Peer
  state: PeerState
}

interface Props {
  rows: PeerRow[]
  now: number
  onSelect: (peer: Peer) => void
}

export function PeerList({ rows, now, onSelect }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-400">
        No peers match this filter.
      </div>
    )
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-white/5 md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Peer</th>
              <th className="px-4 py-3 font-medium">Tunnel IP</th>
              <th className="px-4 py-3 font-medium">Endpoint</th>
              <th className="px-4 py-3 font-medium">Last handshake</th>
              <th className="px-4 py-3 text-right font-medium">Traffic</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 bg-slate-900/30">
            {rows.map(({ peer, state }) => (
              <tr
                key={peer.publicKey}
                onClick={() => onSelect(peer)}
                className="cursor-pointer transition hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <StatusDot state={state} />
                    <div className="min-w-0">
                      <div className={`truncate font-medium ${peer.name ? 'text-white' : 'italic text-slate-400'}`}>
                        {peerLabel(peer)}
                      </div>
                      <div className="font-mono text-xs text-slate-500">{shortKey(peer.publicKey)}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-slate-300">{peer.allowedIps.join(', ') || '—'}</td>
                <td className="px-4 py-3 font-mono text-slate-400">{peer.endpoint ?? '—'}</td>
                <td className={`px-4 py-3 ${state === 'online' ? 'text-slate-300' : 'text-slate-500'}`}>
                  {timeAgo(peer.latestHandshake, now)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                  <span className="inline-flex items-center gap-1"><FiArrowDown className="text-sky-400" />{bytes(peer.rxBytes)}</span>
                  <span className="ml-3 inline-flex items-center gap-1"><FiArrowUp className="text-violet-400" />{bytes(peer.txBytes)}</span>
                </td>
                <td className="pr-3 text-slate-600"><FiChevronRight /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-2 md:hidden">
        {rows.map(({ peer, state }) => (
          <li key={peer.publicKey}>
            <button
              onClick={() => onSelect(peer)}
              className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-slate-900/50 p-4 text-left transition active:bg-white/5"
            >
              <StatusDot state={state} />
              <div className="min-w-0 flex-1">
                <div className={`truncate font-medium ${peer.name ? 'text-white' : 'italic text-slate-400'}`}>{peerLabel(peer)}</div>
                <div className="mt-0.5 truncate font-mono text-xs text-slate-500">{peer.allowedIps.join(', ')}</div>
              </div>
              <div className="text-right text-xs text-slate-400">{timeAgo(peer.latestHandshake, now)}</div>
              <FiChevronRight className="text-slate-600" />
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
