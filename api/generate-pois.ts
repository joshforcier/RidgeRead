import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Request, Response } from 'express'

export const config = {
  maxDuration: 60,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { generatePOIs } = await import('../server/routes/poi')
    await generatePOIs(req as unknown as Request, res as unknown as Response)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('Handler crashed:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: message, stack })
    }
  }
}
