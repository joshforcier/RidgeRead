import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { generatePOIs } from './routes/poi'

dotenv.config()

const app = express()
const PORT = process.env.SERVER_PORT || 3001

app.use(cors())
app.use(express.json())

app.post('/api/generate-pois', generatePOIs)

app.listen(PORT, () => {
  console.log(`RidgeRead API server running on http://localhost:${PORT}`)
})
