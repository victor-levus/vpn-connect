import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth, authDisabled, googleProvider } from '../lib/firebase'

interface AuthUser {
  email: string
  displayName: string | null
  photoURL: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signIn: () => Promise<void>
  logOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const devUser: AuthUser = { email: 'dev@localhost', displayName: 'Local dev', photoURL: null }

const toAuthUser = (u: User): AuthUser => ({ email: u.email ?? '', displayName: u.displayName, photoURL: u.photoURL })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(authDisabled ? devUser : null)
  const [loading, setLoading] = useState(!authDisabled)

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, (u) => {
      setUser(u ? toAuthUser(u) : null)
      setLoading(false)
    })
  }, [])

  const value: AuthContextValue = {
    user,
    loading,
    signIn: async () => {
      if (auth) await signInWithPopup(auth, googleProvider)
    },
    logOut: async () => {
      if (auth) await signOut(auth)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
