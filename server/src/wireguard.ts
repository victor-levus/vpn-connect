import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { config } from './config.js'

const execFileAsync = promisify(execFile)

export interface InterfaceInfo {
  name: string
  publicKey: string
  listenPort: number | null
}

export interface RawPeer {
  publicKey: string
  endpoint: string | null
  allowedIps: string[]
  /** Unix ms of the last handshake, or null if there has never been one. */
  latestHandshake: number | null
  rxBytes: number
  txBytes: number
  persistentKeepalive: number | null
}

export interface WgDump {
  iface: InterfaceInfo
  peers: RawPeer[]
}

const none = (v: string | undefined) => (!v || v === '(none)' || v === 'off' ? null : v)

/**
 * Parses `wg show <iface> dump`.
 *
 * Line 1 (interface): private-key  public-key  listen-port  fwmark
 * Other lines (peers): public-key  preshared-key  endpoint  allowed-ips  latest-handshake  rx  tx  keepalive
 *
 * The interface private key and peer preshared keys are discarded here and never leave this function.
 */
export function parseDump(output: string, ifaceName: string): WgDump {
  const lines = output.split('\n').filter((l) => l.trim() !== '')
  if (lines.length === 0) throw new Error('empty output from wg show')

  const [, ifacePublicKey, listenPort] = lines[0].split('\t')
  const iface: InterfaceInfo = {
    name: ifaceName,
    publicKey: ifacePublicKey ?? '',
    listenPort: listenPort ? Number(listenPort) || null : null,
  }

  const peers: RawPeer[] = lines.slice(1).map((line) => {
    const [publicKey, , endpoint, allowedIps, handshake, rx, tx, keepalive] = line.split('\t')
    const hs = Number(handshake)
    return {
      publicKey,
      endpoint: none(endpoint),
      allowedIps: none(allowedIps)?.split(',') ?? [],
      latestHandshake: hs > 0 ? hs * 1000 : null,
      rxBytes: Number(rx) || 0,
      txBytes: Number(tx) || 0,
      persistentKeepalive: none(keepalive) ? Number(keepalive) : null,
    }
  })

  return { iface, peers }
}

export async function readWireGuard(): Promise<WgDump> {
  if (config.WG_MOCK) return mockDump()

  const args = ['show', config.WG_INTERFACE, 'dump']
  const [cmd, cmdArgs] = config.WG_USE_SUDO ? ['sudo', ['-n', config.WG_BIN, ...args]] : [config.WG_BIN, args]
  const { stdout } = await execFileAsync(cmd, cmdArgs, { timeout: 10_000 })
  return parseDump(stdout, config.WG_INTERFACE)
}

/**
 * Optional: pulls peer names from comments in a WireGuard config file.
 * Recognises the common styles:
 *   # Name: laptop          (a comment inside or just above a [Peer] block)
 *   ### Client laptop       (angristan/wireguard-install)
 *   ### begin laptop ###    (PiVPN)
 * Returns a map of public key → name. Any read error yields an empty map.
 */
export async function readPeerNames(): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (!config.WG_CONFIG_PATH) return names

  let text: string
  try {
    text = await readFile(config.WG_CONFIG_PATH, 'utf8')
  } catch {
    return names
  }

  let pendingComment: string | null = null
  let inPeer = false
  let peerName: string | null = null

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.startsWith('#')) {
      const cleaned = line
        .replace(/^#+\s*/, '')
        .replace(/\s*#+$/, '')
        .replace(/^(name|client|begin)\s*:?\s*/i, '')
        .trim()
      if (!cleaned || /^end\b/i.test(cleaned)) continue
      if (inPeer && !peerName) peerName = cleaned
      else pendingComment = cleaned
      continue
    }
    if (/^\[peer\]$/i.test(line)) {
      inPeer = true
      peerName = pendingComment
      pendingComment = null
      continue
    }
    if (/^\[.+\]$/.test(line)) {
      inPeer = false
      pendingComment = null
      continue
    }
    const key = /^publickey\s*=\s*(\S+)$/i.exec(line)
    if (inPeer && key && peerName) names.set(key[1], peerName.slice(0, 64))
  }
  return names
}

// ── Mock data for local development ─────────────────────────────────────────

const mockPeers = [
  { key: 'mOcKlaptop000000000000000000000000000000000=', name: 'laptop', ip: '10.8.0.2/32', ep: '203.0.113.10:51820' },
  { key: 'mOcKphone0000000000000000000000000000000000=', name: 'phone', ip: '10.8.0.3/32', ep: '198.51.100.24:40211' },
  { key: 'mOcKnas000000000000000000000000000000000000=', name: 'home-nas', ip: '10.8.0.4/32', ep: '192.0.2.77:51820' },
  { key: 'mOcKoffice000000000000000000000000000000000=', name: 'office-pc', ip: '10.8.0.5/32', ep: '203.0.113.99:33012' },
  { key: 'mOcKpi00000000000000000000000000000000000000=', name: null, ip: '10.8.0.6/32', ep: null },
]
const mockState = new Map<string, { online: boolean; hs: number | null; rx: number; tx: number }>()

function mockDump(): WgDump {
  const now = Date.now()
  const peers = mockPeers.map((p, i) => {
    let s = mockState.get(p.key)
    if (!s) {
      s = { online: i < 3, hs: i === 4 ? null : now - (i < 3 ? 30_000 : 3_600_000 * i), rx: 0, tx: 0 }
      mockState.set(p.key, s)
    }
    if (i !== 4 && Math.random() < 0.05) s.online = !s.online
    if (s.online) {
      s.hs = now - Math.floor(Math.random() * 90_000)
      s.rx += Math.floor(Math.random() * 500_000)
      s.tx += Math.floor(Math.random() * 200_000)
    }
    return {
      publicKey: p.key,
      endpoint: s.hs ? p.ep : null,
      allowedIps: [p.ip],
      latestHandshake: s.hs,
      rxBytes: s.rx,
      txBytes: s.tx,
      persistentKeepalive: 25,
    }
  })
  return { iface: { name: config.WG_INTERFACE, publicKey: 'mOcKserver00000000000000000000000000000000=', listenPort: 51820 }, peers }
}

export const mockNames = new Map(mockPeers.filter((p) => p.name).map((p) => [p.key, p.name as string]))
