import { FiLogOut } from 'react-icons/fi'
import { MdVpnLock } from 'react-icons/md'
import { useAuth } from '../hooks/useAuth'
import type { ConnectionState } from '../types'

const pill: Record<ConnectionState, { text: string; cls: string }> = {
  live: { text: 'Live', cls: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30' },
  connecting: { text: 'Connecting…', cls: 'bg-sky-500/10 text-sky-300 ring-sky-500/30' },
  reconnecting: { text: 'Reconnecting…', cls: 'bg-amber-500/10 text-amber-300 ring-amber-500/30' },
  error: { text: 'No access', cls: 'bg-rose-500/10 text-rose-300 ring-rose-500/30' },
}

export function Header({ state, hostname }: { state: ConnectionState; hostname?: string }) {
  const { user, logOut } = useAuth()
  const p = pill[state]

  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <div className="grid size-9 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300">
          <MdVpnLock className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-white">VPN Connect</h1>
          <p className="truncate text-xs text-slate-400">{hostname ?? 'WireGuard status'}</p>
        </div>

        <span className={`ml-2 hidden rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 sm:inline ${p.cls}`}>
          {p.text}
        </span>

        <div className="ml-auto flex items-center gap-3">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="size-8 rounded-full" />
          ) : null}
          <span className="hidden text-sm text-slate-300 md:inline">{user?.email}</span>
          <button
            onClick={() => void logOut()}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
            title="Sign out"
            aria-label="Sign out"
          >
            <FiLogOut className="size-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
