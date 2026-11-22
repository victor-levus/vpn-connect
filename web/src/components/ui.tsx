import { animate } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import type { PeerState } from './StatusDot'

export const card = 'rounded-2xl border border-line bg-surface shadow-card backdrop-blur-xl'

/** Stable hue per peer, so each peer keeps its color across sessions. */
export function hueFor(key: string) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360
  return h
}

export function initials(label: string) {
  const parts = label.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  if (/^\d/.test(label)) return label.split('.').slice(-1)[0].slice(0, 3)
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase()
}

const ringColor: Record<PeerState, string> = {
  online: 'ring-ok/60',
  offline: 'ring-bad/40',
  never: 'ring-idle/40',
}

export function Avatar({ label, seed, state, size = 'md' }: { label: string; seed: string; state: PeerState; size?: 'md' | 'lg' }) {
  const h = hueFor(seed)
  const dims = size === 'lg' ? 'size-14 text-lg rounded-2xl' : 'size-11 text-sm rounded-xl'
  return (
    <div className="relative shrink-0">
      <div
        className={`grid place-items-center font-semibold text-white ring-2 ring-offset-2 ring-offset-elevated transition duration-500 ${dims} ${ringColor[state]} ${
          state === 'online' ? '' : 'saturate-[0.35] opacity-80'
        }`}
        style={{ background: `linear-gradient(135deg, hsl(${h} 72% 56%), hsl(${(h + 45) % 360} 70% 46%))` }}
      >
        {initials(label)}
      </div>
    </div>
  )
}

/** Animates between numeric values; `format` controls how the number is shown. */
export function CountUp({ value, format = (v) => Math.round(v).toLocaleString() }: { value: number; format?: (v: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef(0)
  useEffect(() => {
    const controls = animate(from.current, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = format(v)
      },
    })
    from.current = value
    return () => controls.stop()
    // format is usually an inline function; re-running on value change is what we want.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return <span ref={ref}>{format(from.current)}</span>
}

const chip: Record<PeerState, { cls: string; label: string }> = {
  online: { cls: 'bg-ok/12 text-ok ring-ok/25', label: 'Online' },
  offline: { cls: 'bg-bad/10 text-bad ring-bad/25', label: 'Offline' },
  never: { cls: 'bg-idle/12 text-muted ring-idle/25', label: 'Never connected' },
}

export function StatusChip({ state }: { state: PeerState }) {
  const c = chip[state]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${c.cls}`}>
      <span className="relative flex size-1.5">
        {state === 'online' && <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-75" />}
        <span className={`relative inline-flex size-1.5 rounded-full ${state === 'online' ? 'bg-ok' : state === 'offline' ? 'bg-bad' : 'bg-idle'}`} />
      </span>
      {c.label}
    </span>
  )
}

export function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-9 place-items-center rounded-xl text-muted transition hover:bg-sunken hover:text-fg focus-visible:outline-2 focus-visible:outline-brand active:scale-95"
    >
      {children}
    </button>
  )
}
