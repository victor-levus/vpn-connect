import { EventEmitter } from 'node:events'
import os from 'node:os'
import { config } from './config.js'
import { prisma } from './db.js'
import { mockNames, readPeerNames, readWireGuard, type InterfaceInfo } from './wireguard.js'

export interface PeerStatus {
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
    interface: InterfaceInfo
    uptimeSeconds: number
  }
  peers: PeerStatus[]
  /** Unix ms when this snapshot was taken. */
  generatedAt: number
  onlineThresholdSeconds: number
  pollIntervalSeconds: number
  /** Set when the last poll failed (e.g. `wg` not runnable). Peers are from the last good poll. */
  error: string | null
}

class Monitor extends EventEmitter {
  private snapshot: Snapshot | null = null
  private timer: NodeJS.Timeout | null = null
  private running = false
  private confNames = new Map<string, string>()

  current(): Snapshot | null {
    return this.snapshot
  }

  start() {
    if (this.timer) return
    void this.poll()
    this.timer = setInterval(() => void this.poll(), config.pollIntervalMs)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** Apply a name/notes edit to the live snapshot and broadcast it, without waiting for the next poll. */
  applyMeta(publicKey: string, meta: { name: string | null; notes: string | null }) {
    if (!this.snapshot) return
    this.snapshot = {
      ...this.snapshot,
      peers: this.snapshot.peers.map((p) =>
        p.publicKey === publicKey
          ? { ...p, name: meta.name ?? this.confNames.get(publicKey) ?? null, notes: meta.notes }
          : p,
      ),
    }
    this.emit('snapshot', this.snapshot)
  }

  private async poll() {
    if (this.running) return
    this.running = true
    try {
      const [dump, confNames] = await Promise.all([readWireGuard(), config.WG_MOCK ? mockNames : readPeerNames()])
      this.confNames = confNames
      const now = Date.now()

      const stored = new Map((await prisma.peer.findMany()).map((p) => [p.publicKey, p]))
      const peers: PeerStatus[] = []

      for (const raw of dump.peers) {
        const online = raw.latestHandshake !== null && now - raw.latestHandshake < config.onlineThresholdMs
        let meta = stored.get(raw.publicKey)

        if (!meta) {
          meta = await prisma.peer.create({
            data: {
              publicKey: raw.publicKey,
              online,
              lastOnlineAt: online ? new Date(now) : null,
              events: { create: { online } },
            },
          })
        } else if (meta.online !== online) {
          meta = await prisma.peer.update({
            where: { publicKey: raw.publicKey },
            data: {
              online,
              ...(online ? { lastOnlineAt: new Date(now) } : {}),
              events: { create: { online } },
            },
          })
          console.log(`[monitor] ${meta.name ?? confNames.get(raw.publicKey) ?? raw.publicKey.slice(0, 8)} is now ${online ? 'online' : 'offline'}`)
        } else if (online) {
          // Keep lastOnlineAt fresh at most once a minute to avoid needless writes.
          const last = meta.lastOnlineAt?.getTime() ?? 0
          if (now - last > 60_000) {
            meta = await prisma.peer.update({ where: { publicKey: raw.publicKey }, data: { lastOnlineAt: new Date(now) } })
          }
        }

        peers.push({
          ...raw,
          name: meta.name ?? confNames.get(raw.publicKey) ?? null,
          notes: meta.notes,
          online,
          lastOnlineAt: meta.lastOnlineAt?.getTime() ?? null,
        })
      }

      peers.sort((a, b) => Number(b.online) - Number(a.online) || (a.name ?? '~').localeCompare(b.name ?? '~'))

      this.snapshot = {
        server: { hostname: os.hostname(), interface: dump.iface, uptimeSeconds: Math.floor(os.uptime()) },
        peers,
        generatedAt: now,
        onlineThresholdSeconds: config.ONLINE_THRESHOLD_SECONDS,
        pollIntervalSeconds: config.POLL_INTERVAL_SECONDS,
        error: null,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[monitor] poll failed:', message)
      // Keep the last good peer list but flag the failure so the UI can show it.
      this.snapshot = this.snapshot
        ? { ...this.snapshot, generatedAt: Date.now(), error: 'Could not read WireGuard status on the server' }
        : null
    } finally {
      this.running = false
    }
    if (this.snapshot) this.emit('snapshot', this.snapshot)
  }
}

export const monitor = new Monitor()
monitor.setMaxListeners(100)
