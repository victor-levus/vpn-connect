import { useState } from 'react'
import { FcGoogle } from 'react-icons/fc'
import { MdVpnLock } from 'react-icons/md'
import { useAuth } from '../hooks/useAuth'

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
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center shadow-2xl">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300">
          <MdVpnLock className="size-7" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-white">VPN Connect</h1>
        <p className="mt-1 text-sm text-slate-400">Sign in to see your WireGuard peers.</p>
        <button
          onClick={() => void handle()}
          disabled={busy}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-100 disabled:opacity-60"
        >
          <FcGoogle className="size-5" />
          {busy ? 'Signing in…' : 'Continue with Google'}
        </button>
        {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      </div>
    </main>
  )
}
