import type { NextFunction, Request, Response } from 'express'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { config } from './config.js'

export interface AuthedUser {
  uid: string
  email: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser
    }
  }
}

// Verifying ID tokens only needs the project ID (Google's public keys are fetched automatically),
// so no service account key has to live on the VPS.
const auth = config.AUTH_DISABLED ? null : getAuth(initializeApp({ projectId: config.FIREBASE_PROJECT_ID }))

if (config.AUTH_DISABLED) {
  console.warn('[auth] AUTH_DISABLED=true: every request is allowed. Never use this in production.')
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!auth) {
    req.user = { uid: 'dev', email: 'dev@localhost' }
    return next()
  }

  const header = req.get('authorization') ?? ''
  const match = /^Bearer (.+)$/.exec(header)
  if (!match) {
    res.status(401).json({ error: 'Missing bearer token' })
    return
  }

  try {
    // No revocation check (`checkRevoked`): that calls the Firebase Auth admin API, which needs a
    // service-account credential we intentionally don't keep on the VPS. Tokens expire within 1h.
    const decoded = await auth.verifyIdToken(match[1])
    const email = decoded.email?.toLowerCase()
    if (!email || !decoded.email_verified || !config.allowedEmails.has(email)) {
      console.warn(`[auth] rejected ${email ?? decoded.uid}: not in ALLOWED_EMAILS or email not verified`)
      res.status(403).json({ error: 'This account is not allowed to use this dashboard' })
      return
    }
    req.user = { uid: decoded.uid, email }
    next()
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'unknown'
    const message = err instanceof Error ? err.message.split('\n')[0] : String(err)
    console.warn(`[auth] token rejected (${code}): ${message}`)
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
