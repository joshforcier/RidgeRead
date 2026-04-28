import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// dotenv MUST run before importing modules that read env at import time
// (firebaseAdmin.ts reads GOOGLE_APPLICATION_CREDENTIALS during init).
dotenv.config()

const { generatePOIs } = await import('./routes/poi.js')
const { inspectPoint } = await import('./routes/inspectPoint.js')
const { inspectPoints } = await import('./routes/inspectPoints.js')
const { requireAuth } = await import('./middleware/auth.js')

const app = express()
const PORT = process.env.SERVER_PORT || 3001

app.use(cors())
app.use(express.json())

app.post('/api/generate-pois', requireAuth, generatePOIs)
app.post('/api/inspect-point', requireAuth, inspectPoint)
app.post('/api/inspect-points', requireAuth, inspectPoints)

app.listen(PORT, () => {
  console.log(`RidgeRead API server running on http://localhost:${PORT}`)
})
