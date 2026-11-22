export function timeAgo(ms: number | null, now: number): string {
  if (ms === null) return 'never'
  const s = Math.max(0, Math.round((now - ms) / 1000))
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function duration(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`
  const units = ['KiB', 'MiB', 'GiB', 'TiB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}

export const dateTime = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export const shortKey = (key: string) => `${key.slice(0, 6)}…${key.slice(-6)}`

export const peerLabel = (p: { name: string | null; allowedIps: string[]; publicKey: string }) =>
  p.name ?? p.allowedIps[0]?.replace(/\/32$/, '') ?? shortKey(p.publicKey)
