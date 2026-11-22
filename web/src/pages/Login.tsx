import { motion } from 'motion/react'
import { useState } from 'react'
import { FcGoogle } from 'react-icons/fc'
import { FiActivity, FiBell, FiZap } from 'react-icons/fi'
import { HiShieldCheck } from 'react-icons/hi2'
import { ThemeToggle } from '../components/ThemeToggle'
import { useAuth } from '../hooks/useAuth'

const features = [
  { Icon: FiActivity, text: 'Live status of every WireGuard peer' },
  { Icon: FiZap, text: 'Offline detection in under a minute' },
  { Icon: FiBell, text: 'Instant alerts when peers come and go' },
]

export function Login() {
  const { signIn } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handle = async () => {
    setBusy(true)
    setError(null)
    try {
      await signIn()
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError('Sign-in failed. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        {/* Glow behind the card */}
        <div className="absolute -inset-px rounded-[28px] bg-linear-to-br from-brand/40 via-transparent to-brand-2/40 blur-xl" />

        <div className="relative rounded-[26px] border border-line bg-elevated/90 p-8 shadow-pop backdrop-blur-2xl sm:p-10">
          <motion.div
            initial={{ scale: 0.5, rotate: -25, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.15 }}
            className="relative mx-auto grid size-16 place-items-center rounded-2xl bg-linear-to-br from-brand to-brand-2 text-white shadow-xl shadow-brand/30"
          >
            <span className="absolute inset-0 animate-ping rounded-2xl bg-brand/30 [animation-duration:2.5s]" />
            <HiShieldCheck className="relative size-9" />
          </motion.div>

          <h1 className="mt-6 text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome to <span className="text-gradient">VPN Connect</span>
          </h1>
          <p className="mt-2 text-center text-sm text-muted">Sign in to monitor your WireGuard network.</p>

          <ul className="mt-8 space-y-3">
            {features.map(({ Icon, text }, i) => (
              <motion.li
                key={text}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="flex items-center gap-3 text-sm"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-brand/10 text-brand">
                  <Icon className="size-4" />
                </span>
                {text}
              </motion.li>
            ))}
          </ul>

          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => void handle()}
            disabled={busy}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl border border-line-strong bg-elevated px-4 py-3 text-sm font-semibold shadow-card transition hover:shadow-pop disabled:opacity-60"
          >
            {busy ? (
              <span className="size-5 animate-spin rounded-full border-2 border-line-strong border-t-brand" />
            ) : (
              <FcGoogle className="size-5" />
            )}
            {busy ? 'Signing in…' : 'Continue with Google'}
          </motion.button>

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-center text-sm text-bad">
              {error}
            </motion.p>
          )}
          <p className="mt-6 text-center text-xs text-subtle">Access is limited to approved accounts.</p>
        </div>
      </motion.div>
    </main>
  )
}
