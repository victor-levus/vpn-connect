import type { ReactNode } from 'react'
import { FiServer, FiUsers, FiWifi, FiWifiOff } from 'react-icons/fi'
import { duration } from '../lib/format'
import type { Snapshot } from '../types'

function Card({ icon, label, value, sub, accent }: { icon: ReactNode; label: string; value: ReactNode; sub?: string; accent: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span className={accent}>{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-white">{value}</div>
      {sub && <div className="mt-1 truncate text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

export function SummaryCards({ snapshot, online }: { snapshot: Snapshot; online: number }) {
  const total = snapshot.peers.length
  const { interface: iface, uptimeSeconds } = snapshot.server
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card icon={<FiUsers />} label="Peers" value={total} sub="configured on the interface" accent="text-sky-400" />
      <Card icon={<FiWifi />} label="Online" value={online} sub={total ? `${Math.round((online / total) * 100)}% connected` : undefined} accent="text-emerald-400" />
      <Card icon={<FiWifiOff />} label="Offline" value={total - online} accent="text-rose-400" sub={`no handshake in ${snapshot.onlineThresholdSeconds / 60} min`} />
      <Card
        icon={<FiServer />}
        label="Server"
        value={<span className="text-lg">{iface.name}{iface.listenPort ? `:${iface.listenPort}` : ''}</span>}
        sub={`up ${duration(uptimeSeconds)}`}
        accent="text-violet-400"
      />
    </div>
  )
}
