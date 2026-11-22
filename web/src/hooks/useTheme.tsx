import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  choice: ThemeChoice
  resolved: 'light' | 'dark'
  setChoice: (c: ThemeChoice) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem('theme')
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readChoice)
  const [systemDark, setSystemDark] = useState(() => media().matches)

  useEffect(() => {
    const m = media()
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [])

  const resolved = choice === 'system' ? (systemDark ? 'dark' : 'light') : choice

  // Layout effect so the class flips inside flushSync (used by the animated theme switch).
  useLayoutEffect(() => {
    const root = document.documentElement
    // Briefly disable transitions so the whole page flips at once instead of cross-fading piecemeal.
    root.classList.add('theme-switching')
    root.classList.toggle('dark', resolved === 'dark')
    const id = requestAnimationFrame(() => root.classList.remove('theme-switching'))
    return () => cancelAnimationFrame(id)
  }, [resolved])

  const setChoice = (c: ThemeChoice) => {
    setChoiceState(c)
    try {
      localStorage.setItem('theme', c)
    } catch {
      /* private mode: theme just won't persist */
    }
  }

  return <ThemeContext.Provider value={{ choice, resolved, setChoice }}>{children}</ThemeContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
