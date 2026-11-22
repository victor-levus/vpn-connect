import { useEffect, useState } from 'react'

/** Re-renders every `intervalMs` so relative times ("2m ago") stay current. */
export function useNow(intervalMs = 5000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
