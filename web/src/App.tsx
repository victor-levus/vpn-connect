import { AuthProvider, useAuth } from './hooks/useAuth'
import { Dashboard } from './pages/Dashboard'
import { Login } from './pages/Login'

function Gate() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="size-6 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
      </div>
    )
  }
  return user ? <Dashboard /> : <Login />
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
