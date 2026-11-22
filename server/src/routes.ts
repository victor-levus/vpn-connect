import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { requireAuth } from './auth.js'
import { prisma } from './db.js'
import { monitor, type Snapshot } from './monitor.js'

export const api = Router()

api.get('/health', (_req, res) => {
  const snap = monitor.current()
  res.json({ ok: true, lastPoll: snap?.generatedAt ?? null, wireguardOk: snap ? snap.error === null : null })
})

api.use(requireAuth)

api.get('/me', (req, res) => {
  res.json(req.user)
})

api.get('/snapshot', (_req, res) => {
  const snap = monitor.current()
  if (!snap) {
    res.status(503).json({ error: 'First poll has not finished yet' })
    return
  }
  res.json(snap)
})

/**
 * Server-Sent Events: sends the full snapshot on connect and after every poll.
 * Comment lines every 20s keep proxies from closing an idle connection.
 */
api.get('/stream', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write('retry: 5000\n\n')

  const send = (snap: Snapshot) => res.write(`event: snapshot\ndata: ${JSON.stringify(snap)}\n\n`)
  const current = monitor.current()
  if (current) send(current)

  monitor.on('snapshot', send)
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 20_000)

  req.on('close', () => {
    clearInterval(heartbeat)
    monitor.off('snapshot', send)
  })
})

// Public keys are base64 and may contain "/", so the URL carries them as base64url.
const fromUrlKey = (key: string) => key.replace(/-/g, '+').replace(/_/g, '/')
const keyParam = z.string().regex(/^[A-Za-z0-9_-]{42,44}=?$/)

const peerPatch = z.object({
  name: z.string().trim().max(64).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
})

api.patch('/peers/:key', async (req, res) => {
  const key = keyParam.safeParse(req.params.key)
  const body = peerPatch.safeParse(req.body)
  if (!key.success || !body.success) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }
  const publicKey = fromUrlKey(key.data)
  const data = {
    ...(body.data.name !== undefined ? { name: body.data.name || null } : {}),
    ...(body.data.notes !== undefined ? { notes: body.data.notes || null } : {}),
  }

  const existing = await prisma.peer.findUnique({ where: { publicKey } })
  if (!existing) {
    res.status(404).json({ error: 'Unknown peer' })
    return
  }
  const updated = await prisma.peer.update({ where: { publicKey }, data })
  monitor.applyMeta(publicKey, { name: updated.name, notes: updated.notes })
  res.json({ publicKey, name: updated.name, notes: updated.notes })
})

const DAY_MS = 24 * 60 * 60 * 1000

api.get('/peers/:key/history', async (req, res) => {
  const key = keyParam.safeParse(req.params.key)
  if (!key.success) {
    res.status(400).json({ error: 'Invalid peer key' })
    return
  }
  const publicKey = fromUrlKey(key.data)
  const now = Date.now()
  const windowStart = now - DAY_MS

  const [events, inWindow, before] = await Promise.all([
    prisma.statusEvent.findMany({ where: { publicKey }, orderBy: { at: 'desc' }, take: 50 }),
    prisma.statusEvent.findMany({ where: { publicKey, at: { gte: new Date(windowStart) } }, orderBy: { at: 'asc' } }),
    prisma.statusEvent.findFirst({ where: { publicKey, at: { lt: new Date(windowStart) } }, orderBy: { at: 'desc' } }),
  ])

  // Uptime over the last 24h: walk the state changes inside the window in time order.
  const trackedFrom = before ? windowStart : (inWindow[0]?.at.getTime() ?? now)
  let state = before?.online ?? inWindow[0]?.online ?? false
  let cursor = trackedFrom
  let onlineMs = 0
  for (const e of inWindow) {
    const t = e.at.getTime()
    if (state) onlineMs += t - cursor
    state = e.online
    cursor = t
  }
  if (state) onlineMs += now - cursor
  const trackedMs = now - trackedFrom

  res.json({
    events: events.map((e) => ({ online: e.online, at: e.at.getTime() })),
    uptime24h: trackedMs > 0 ? onlineMs / trackedMs : null,
    trackedSince: trackedFrom,
  })
})
