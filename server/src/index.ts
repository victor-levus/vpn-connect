import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import { config } from './config.js'
import { prisma } from './db.js'
import { monitor } from './monitor.js'
import { api } from './routes.js'

const app = express()

// Running behind Caddy on the same host: trust exactly one proxy hop for the client IP.
app.set('trust proxy', 1)
app.disable('x-powered-by')

app.use(helmet())
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || config.CORS_ORIGINS.includes(origin)),
    methods: ['GET', 'PATCH'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  }),
)
app.use(express.json({ limit: '10kb' }))
app.use(
  '/api',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: 'draft-8', legacyHeaders: false }),
)

app.use('/api', api)

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[http]', err)
  res.status(500).json({ error: 'Internal server error' })
})

const server = app.listen(config.PORT, config.HOST, () => {
  console.log(`[http] listening on http://${config.HOST}:${config.PORT}`)
  console.log(
    `[monitor] interface=${config.WG_INTERFACE} poll=${config.POLL_INTERVAL_SECONDS}s threshold=${config.ONLINE_THRESHOLD_SECONDS}s${config.WG_MOCK ? ' (MOCK DATA)' : ''}`,
  )
  monitor.start()
})

async function shutdown(signal: string) {
  console.log(`[http] ${signal} received, shutting down`)
  monitor.stop()
  server.close()
  server.closeAllConnections()
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
