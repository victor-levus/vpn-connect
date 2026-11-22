export type PeerState = 'online' | 'offline' | 'never'

const styles: Record<PeerState, { dot: string; ring: string; label: string; text: string }> = {
  online: { dot: 'bg-emerald-400', ring: 'bg-emerald-400/40', label: 'Online', text: 'text-emerald-300' },
  offline: { dot: 'bg-rose-500', ring: '', label: 'Offline', text: 'text-rose-300' },
  never: { dot: 'bg-slate-500', ring: '', label: 'Never connected', text: 'text-slate-400' },
}

export function StatusDot({ state, withLabel = false }: { state: PeerState; withLabel?: boolean }) {
  const s = styles[state]
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative flex size-2.5 shrink-0">
        {s.ring && <span className={`absolute inline-flex size-full animate-ping rounded-full ${s.ring}`} />}
        <span className={`relative inline-flex size-2.5 rounded-full ${s.dot}`} />
      </span>
      {withLabel && <span className={`text-sm font-medium ${s.text}`}>{s.label}</span>}
    </span>
  )
}
