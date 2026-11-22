import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { FiSearch, FiX } from 'react-icons/fi'

export type Filter = 'all' | 'online' | 'offline'

interface Props {
  filter: Filter
  onFilter: (f: Filter) => void
  counts: Record<Filter, number>
  query: string
  onQuery: (q: string) => void
}

const tabs: { value: Filter; label: string; dot?: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Online', dot: 'bg-ok' },
  { value: 'offline', label: 'Offline', dot: 'bg-bad' },
]

export function FilterBar({ filter, onFilter, counts, query, onQuery }: Props) {
  const input = useRef<HTMLInputElement>(null)

  // Press "/" anywhere to jump to search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      if (e.key === '/' && !typing) {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex items-baseline gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Peers</h2>
      </div>

      <div role="tablist" className="relative flex w-fit items-center rounded-xl border border-line bg-surface p-1 backdrop-blur-xl sm:ml-4">
        {tabs.map((t) => {
          const active = filter === t.value
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={active}
              onClick={() => onFilter(t.value)}
              className={`relative flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active ? 'text-fg' : 'text-muted hover:text-fg'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="filter-pill"
                  className="absolute inset-0 rounded-lg bg-elevated shadow-card ring-1 ring-line"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
              {t.dot && <span className={`relative size-1.5 rounded-full ${t.dot}`} />}
              <span className="relative">{t.label}</span>
              <span className="relative rounded-md bg-sunken px-1.5 text-xs tabular-nums text-subtle">{counts[t.value]}</span>
            </button>
          )
        })}
      </div>

      <label className="group relative sm:ml-auto sm:w-80">
        <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-subtle transition group-focus-within:text-brand" />
        <input
          ref={input}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && (onQuery(''), input.current?.blur())}
          placeholder="Search name, IP, key, notes…"
          className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-12 text-sm shadow-card outline-none backdrop-blur-xl transition placeholder:text-subtle focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
        />
        {query ? (
          <button
            onClick={() => onQuery('')}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-subtle hover:bg-sunken hover:text-fg"
          >
            <FiX className="size-3.5" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line bg-sunken px-1.5 font-mono text-[11px] text-subtle sm:block">
            /
          </kbd>
        )}
      </label>
    </div>
  )
}
