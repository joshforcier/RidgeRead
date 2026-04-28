import type { Request, Response, NextFunction } from 'express'
import { adminAuth } from '../services/firebaseAdmin.js'

/**
 * Extends Express Request with the verified Firebase user. Routes downstream
 * of `requireAuth` can read `req.uid` knowing it's been validated.
 */
export interface AuthedRequest extends Request {
  uid?: string
  email?: string | null
}

/**
 * Verify a Firebase ID token from the `Authorization: Bearer <token>` header.
 * Rejects with 401 if missing or invalid.
 */
export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' })
    return
  }
  const token = match[1]
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    req.uid = decoded.uid
    req.email = decoded.email ?? null
    next()
  } catch (err) {
    console.error('[auth] verifyIdToken failed:', err)
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
