import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ThemeProvider } from './hooks/useTheme'
import { Dashboard } from './pages/Dashboard'
import { Login } from './pages/Login'

function Gate() {
  const { user, loading } = useAuth()
  const view = loading ? 'loading' : user ? 'app' : 'login'
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        {view === 'loading' ? (
          <div className="grid min-h-dvh place-items-center">
            <div className="size-8 animate-spin rounded-full border-2 border-line-strong border-t-brand" />
          </div>
        ) : view === 'app' ? (
          <Dashboard />
        ) : (
          <Login />
        )}
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      {/* Respect the OS "reduce motion" setting for every animation. */}
      <MotionConfig reducedMotion="user">
        <div className="app-backdrop" aria-hidden />
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </MotionConfig>
    </ThemeProvider>
  )
}
