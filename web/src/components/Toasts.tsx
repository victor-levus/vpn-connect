import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { FiX } from 'react-icons/fi'
import type { PeerState } from './StatusDot'
import { Avatar } from './ui'

export interface Toast {
  id: number
  label: string
  seed: string
  state: PeerState
  at: number
}

/** Live "peer came online / went offline" notifications, stacked bottom-right. */
export function Toasts({ toasts, onDismiss, onOpen }: { toasts: Toast[]; onDismiss: (id: number) => void; onOpen: (seed: string) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} onOpen={onOpen} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastItem({ toast, onDismiss, onOpen }: { toast: Toast; onDismiss: (id: number) => void; onOpen: (seed: string) => void }) {
  useEffect(() => {
    const id = setTimeout(() => onDismiss(toast.id), 6000)
    return () => clearTimeout(id)
  }, [toast.id, onDismiss])

  const online = toast.state === 'online'
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className="pointer-events-auto relative flex w-full max-w-sm items-center gap-3 overflow-hidden rounded-2xl border border-line bg-elevated/95 p-3 pr-2 shadow-pop backdrop-blur-xl"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${online ? 'bg-ok' : 'bg-bad'}`} />
      <button onClick={() => onOpen(toast.seed)} className="flex min-w-0 flex-1 items-center gap-3 pl-1 text-left">
        <Avatar label={toast.label} seed={toast.seed} state={toast.state} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{toast.label}</div>
          <div className={`text-xs ${online ? 'text-ok' : 'text-bad'}`}>{online ? 'Came online' : 'Went offline'}</div>
        </div>
      </button>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="grid size-7 shrink-0 place-items-center rounded-lg text-subtle hover:bg-sunken hover:text-fg"
      >
        <FiX className="size-4" />
      </button>
      <motion.span
        className={`absolute bottom-0 left-0 h-0.5 ${online ? 'bg-ok/50' : 'bg-bad/50'}`}
        initial={{ width: '100%' }}
        animate={{ width: 0 }}
        transition={{ duration: 6, ease: 'linear' }}
      />
    </motion.div>
  )
}
