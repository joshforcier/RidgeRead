import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Request, Response } from 'express'
import { generatePOIs } from '../server/routes/poi.js'

export const config = {
  maxDuration: 60,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  await generatePOIs(req as unknown as Request, res as unknown as Response)
}
