import { z } from 'zod'

const bool = z
  .string()
  .optional()
  .transform((v) => v?.trim().toLowerCase() === 'true')

const list = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(4807),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGINS: list,

  FIREBASE_PROJECT_ID: z.string().default(''),
  ALLOWED_EMAILS: list,
  AUTH_DISABLED: bool,

  WG_INTERFACE: z.string().regex(/^[a-zA-Z0-9_.-]{1,15}$/, 'invalid interface name').default('wg0'),
  WG_BIN: z.string().default('/usr/bin/wg'),
  WG_USE_SUDO: bool,
  WG_CONFIG_PATH: z.string().default(''),
  WG_MOCK: bool,

  POLL_INTERVAL_SECONDS: z.coerce.number().int().min(2).default(5),
  ONLINE_THRESHOLD_SECONDS: z.coerce.number().int().min(30).default(180),
  ACTIVITY_TIMEOUT_SECONDS: z.coerce.number().int().min(10).default(40),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment configuration:')
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

const env = parsed.data
const isProduction = env.NODE_ENV === 'production'

if (isProduction && env.AUTH_DISABLED) {
  console.error('AUTH_DISABLED=true is not allowed when NODE_ENV=production')
  process.exit(1)
}
if (!env.AUTH_DISABLED) {
  if (!env.FIREBASE_PROJECT_ID) {
    console.error('FIREBASE_PROJECT_ID is required unless AUTH_DISABLED=true')
    process.exit(1)
  }
  if (env.ALLOWED_EMAILS.length === 0) {
    console.error('ALLOWED_EMAILS must list at least one email unless AUTH_DISABLED=true')
    process.exit(1)
  }
}

export const config = {
  ...env,
  isProduction,
  allowedEmails: new Set(env.ALLOWED_EMAILS.map((e) => e.toLowerCase())),
  pollIntervalMs: env.POLL_INTERVAL_SECONDS * 1000,
  onlineThresholdMs: env.ONLINE_THRESHOLD_SECONDS * 1000,
  activityTimeoutMs: env.ACTIVITY_TIMEOUT_SECONDS * 1000,
}
