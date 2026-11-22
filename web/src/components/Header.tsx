import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { FiChevronDown, FiLogOut } from 'react-icons/fi'
import { HiShieldCheck } from 'react-icons/hi2'
import { useAuth } from '../hooks/useAuth'
import type { ConnectionState } from '../types'
import { ThemeToggle } from './ThemeToggle'

const live: Record<ConnectionState, { text: string; dot: string; cls: string }> = {
  live: { text: 'Live', dot: 'bg-ok', cls: 'text-ok bg-ok/10 ring-ok/20' },
  connecting: { text: 'Connecting', dot: 'bg-brand-2', cls: 'text-brand-2 bg-brand-2/10 ring-brand-2/20' },
  reconnecting: { text: 'Reconnecting', dot: 'bg-warn', cls: 'text-warn bg-warn/10 ring-warn/20' },
  error: { text: 'No access', dot: 'bg-bad', cls: 'text-bad bg-bad/10 ring-bad/20' },
}

export function Header({ state, hostname }: { state: ConnectionState; hostname?: string }) {
  const l = live[state]
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <motion.div
          initial={{ rotate: -20, scale: 0.6, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className="grid size-10 place-items-center rounded-xl bg-linear-to-br from-brand to-brand-2 text-white shadow-lg shadow-brand/30"
        >
          <HiShieldCheck className="size-6" />
        </motion.div>
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold tracking-tight">VPN Connect</h1>
          <p className="truncate font-mono text-xs text-subtle">{hostname ?? 'WireGuard monitor'}</p>
        </div>

        <motion.span
          key={state}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`ml-1 hidden items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset sm:inline-flex ${l.cls}`}
        >
          <span className="relative flex size-2">
            {state !== 'error' && <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${l.dot}`} />}
            <span className={`relative inline-flex size-2 rounded-full ${l.dot}`} />
          </span>
          {l.text}
        </motion.span>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}

function UserMenu() {
  const { user, logOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const name = user?.displayName ?? user?.email ?? ''
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-xl p-1 pr-2 transition hover:bg-sunken"
      >
        {user?.photoURL ? (
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="size-8 rounded-lg" />
        ) : (
          <span className="grid size-8 place-items-center rounded-lg bg-sunken text-sm font-semibold text-muted">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <FiChevronDown className={`size-4 text-subtle transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl border border-line bg-elevated p-2 shadow-pop"
          >
            <div className="px-3 py-2">
              <div className="truncate text-sm font-medium">{user?.displayName ?? 'Signed in'}</div>
              <div className="truncate text-xs text-muted">{user?.email}</div>
            </div>
            <div className="my-1 h-px bg-line" />
            <button
              role="menuitem"
              onClick={() => void logOut()}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition hover:bg-sunken hover:text-bad"
            >
              <FiLogOut className="size-4" /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
