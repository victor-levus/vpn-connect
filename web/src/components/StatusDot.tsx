export type PeerState = 'online' | 'offline' | 'never'

const dot: Record<PeerState, string> = {
  online: 'bg-ok',
  offline: 'bg-bad',
  never: 'bg-idle',
}

export function StatusDot({ state }: { state: PeerState }) {
  return (
    <span className="relative flex size-2.5 shrink-0">
      {state === 'online' && <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok/60" />}
      <span className={`relative inline-flex size-2.5 rounded-full ${dot[state]}`} />
    </span>
  )
}
