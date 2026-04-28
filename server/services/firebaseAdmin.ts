/**
 * Firebase Admin SDK init for the API server.
 *
 * Auto-detects credentials from GOOGLE_APPLICATION_CREDENTIALS env var
 * (set in .env, points to the service-account JSON downloaded from
 * Firebase Console → Project Settings → Service Accounts).
 */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.warn(
      '[firebase-admin] GOOGLE_APPLICATION_CREDENTIALS not set — auth-protected endpoints will fail. ' +
        'See .env.example.',
    )
  }
  initializeApp({
    credential: applicationDefault(),
  })
}

export const adminAuth = getAuth()
export const adminDb = getFirestore()
