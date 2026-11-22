import { motion } from 'motion/react'
import type { MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { FiMonitor, FiMoon, FiSun } from 'react-icons/fi'
import { useTheme, type ThemeChoice } from '../hooks/useTheme'

const options: { value: ThemeChoice; label: string; Icon: typeof FiSun }[] = [
  { value: 'light', label: 'Light', Icon: FiSun },
  { value: 'dark', label: 'Dark', Icon: FiMoon },
  { value: 'system', label: 'System', Icon: FiMonitor },
]

export function ThemeToggle() {
  const { choice, resolved, setChoice } = useTheme()

  const pick = (value: ThemeChoice, e: MouseEvent) => {
    if (value === choice) return
    const willBeDark = value === 'system' ? matchMedia('(prefers-color-scheme: dark)').matches : value === 'dark'
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    // Reveal the new theme in a circle growing from the clicked button, where supported.
    if (!document.startViewTransition || reduce || willBeDark === (resolved === 'dark')) {
      setChoice(value)
      return
    }
    const x = e.clientX
    const y = e.clientY
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    const t = document.startViewTransition(() => flushSync(() => setChoice(value)))
    void t.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 550, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
      )
    })
  }

  return (
    <div role="radiogroup" aria-label="Theme" className="relative flex items-center rounded-xl border border-line bg-sunken p-0.5">
      {options.map(({ value, label, Icon }) => {
        const active = choice === value
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={(e) => pick(value, e)}
            className={`relative grid size-8 place-items-center rounded-[10px] transition-colors ${active ? 'text-fg' : 'text-subtle hover:text-fg'}`}
          >
            {active && (
              <motion.span
                layoutId="theme-pill"
                className="absolute inset-0 rounded-[10px] bg-elevated shadow-card ring-1 ring-line"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <Icon className="relative size-4" />
          </button>
        )
      })}
    </div>
  )
}
