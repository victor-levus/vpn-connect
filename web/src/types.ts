export interface Peer {
  publicKey: string
  name: string | null
  notes: string | null
  online: boolean
  endpoint: string | null
  allowedIps: string[]
  latestHandshake: number | null
  rxBytes: number
  txBytes: number
  persistentKeepalive: number | null
  lastOnlineAt: number | null
}

export interface Snapshot {
  server: {
    hostname: string
    interface: { name: string; publicKey: string; listenPort: number | null }
    uptimeSeconds: number
  }
  peers: Peer[]
  generatedAt: number
  onlineThresholdSeconds: number
  pollIntervalSeconds: number
  error: string | null
}

export interface PeerHistory {
  events: { online: boolean; at: number }[]
  uptime24h: number | null
  trackedSince: number
}

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'error'
