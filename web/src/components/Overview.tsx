import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { FiArrowDown, FiArrowUp, FiClock, FiCpu, FiHash, FiWifi, FiWifiOff } from 'react-icons/fi'
import { bytes, duration, shortKey } from '../lib/format'
import type { Snapshot } from '../types'
import { card, CountUp } from './ui'

const rise = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.05 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
})

function HealthRing({ online, total }: { online: number; total: number }) {
  const pct = total ? online / total : 0
  const r = 52
  const tone = pct === 1 ? 'All peers connected' : pct === 0 ? (total ? 'Every peer is offline' : 'No peers yet') : `${total - online} offline`
  return (
    <div className="flex items-center gap-6">
      <div className="relative size-36 shrink-0">
        <svg viewBox="0 0 120 120" className="size-full -rotate-90">
          <defs>
            <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--brand)" />
              <stop offset="100%" stopColor="var(--brand-2)" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--sunken)" strokeWidth="12" />
          {total > 0 && pct < 1 && (
            <circle cx="60" cy="60" r={r} fill="none" stroke="var(--bad)" strokeOpacity="0.25" strokeWidth="12" />
          )}
          <motion.circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="url(#ring)"
            strokeWidth="12"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: Math.max(pct, 0.0001) }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-3xl font-semibold tracking-tight tabular-nums">
              <CountUp value={Math.round(pct * 100)} />
              <span className="text-lg text-muted">%</span>
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-subtle">online</div>
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-sm text-muted">Network health</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">
          <CountUp value={online} /> <span className="text-muted">/ {total}</span>
        </div>
        <div className={`mt-1 text-sm ${pct === 1 ? 'text-ok' : total ? 'text-bad' : 'text-muted'}`}>{tone}</div>
      </div>
    </div>
  )
}

function Meta({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className="grid size-7 place-items-center rounded-lg bg-sunken text-subtle">{icon}</span>
      <span className="text-muted">{label}</span>
      <span className="ml-auto truncate font-medium">{children}</span>
    </div>
  )
}

function Stat({ icon, label, value, sub, accent, i }: { icon: ReactNode; label: string; value: ReactNode; sub: ReactNode; accent: string; i: number }) {
  return (
    <motion.div {...rise(i)} whileHover={{ y: -3 }} className={`${card} group relative overflow-hidden p-4 sm:p-5`}>
      <div className={`absolute -right-6 -top-6 size-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40 ${accent}`} />
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className={`grid size-8 place-items-center rounded-lg text-white ${accent}`}>{icon}</span>
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums sm:mt-4 sm:text-3xl">{value}</div>
      <div className="mt-1 truncate text-xs text-subtle">{sub}</div>
    </motion.div>
  )
}

export function Overview({ snapshot, online }: { snapshot: Snapshot; online: number }) {
  const total = snapshot.peers.length
  const { interface: iface, uptimeSeconds, hostname } = snapshot.server
  const rx = snapshot.peers.reduce((s, p) => s + p.rxBytes, 0)
  const tx = snapshot.peers.reduce((s, p) => s + p.txBytes, 0)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <motion.section {...rise(0)} className={`${card} relative overflow-hidden p-6 lg:col-span-2`}>
        <div className="pointer-events-none absolute -left-20 -top-20 size-64 rounded-full bg-brand/10 blur-3xl" />
        <HealthRing online={online} total={total} />
        <div className="mt-6 space-y-2.5 border-t border-line pt-5">
          <Meta icon={<FiCpu className="size-3.5" />} label="Server">{hostname}</Meta>
          <Meta icon={<FiHash className="size-3.5" />} label="Interface">
            <span className="font-mono">{iface.name}{iface.listenPort ? `:${iface.listenPort}` : ''}</span>
          </Meta>
          <Meta icon={<FiClock className="size-3.5" />} label="Uptime">{duration(uptimeSeconds)}</Meta>
          <Meta icon={<FiHash className="size-3.5" />} label="Public key">
            <span className="font-mono text-xs">{shortKey(iface.publicKey)}</span>
          </Meta>
        </div>
      </motion.section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-3">
        <Stat
          i={1}
          icon={<FiWifi className="size-4" />}
          label="Online"
          accent="bg-ok"
          value={<CountUp value={online} />}
          sub={total ? `${Math.round((online / total) * 100)}% of ${total} peers` : 'No peers configured'}
        />
        <Stat
          i={2}
          icon={<FiWifiOff className="size-4" />}
          label="Offline"
          accent="bg-bad"
          value={<CountUp value={total - online} />}
          sub={`No traffic for ${snapshot.activityTimeoutSeconds}s`}
        />
        <Stat
          i={3}
          icon={<FiArrowDown className="size-4" />}
          label="Received"
          accent="bg-brand-2"
          value={<CountUp value={rx} format={(v) => bytes(Math.round(v))} />}
          sub="Total from all peers"
        />
        <Stat
          i={4}
          icon={<FiArrowUp className="size-4" />}
          label="Sent"
          accent="bg-violet-500"
          value={<CountUp value={tx} format={(v) => bytes(Math.round(v))} />}
          sub="Total to all peers"
        />
      </div>
    </div>
  )
}
