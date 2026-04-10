/**
 * Bulk elevation data from the Open-Meteo Elevation API.
 * Uses Copernicus DEM (90m resolution), free, no API key.
 *
 * https://open-meteo.com/en/docs/elevation-api
 */

export interface ElevationPoint {
  lat: number
  lng: number
  elevation: number // meters above sea level
}

export interface ElevationGrid {
  points: ElevationPoint[]
  rows: number
  cols: number
  minElevation: number
  maxElevation: number
  avgElevation: number
}

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/elevation'
const BATCH_SIZE = 100 // Open-Meteo limit per request

/**
 * Fetch elevation for an array of lat/lng pairs, batched automatically.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithRetry(url: string, retries = 2): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url)
      if (res.ok) return res
      if (res.status === 429) {
        // Rate limited — wait and retry
        const wait = (attempt + 1) * 1500
        console.log(`Open-Meteo 429, retrying in ${wait}ms...`)
        await sleep(wait)
        continue
      }
      console.error(`Open-Meteo returned ${res.status}`)
      return null
    } catch (err) {
      console.error('Open-Meteo fetch error:', err)
      if (attempt < retries) await sleep(1000)
    }
  }
  return null
}

async function fetchElevations(
  coords: Array<{ lat: number; lng: number }>
): Promise<number[]> {
  const elevations: number[] = new Array(coords.length).fill(0)

  for (let i = 0; i < coords.length; i += BATCH_SIZE) {
    // Throttle: wait between batches to avoid 429
    if (i > 0) await sleep(300)

    const batch = coords.slice(i, i + BATCH_SIZE)
    const lats = batch.map(c => c.lat.toFixed(6)).join(',')
    const lngs = batch.map(c => c.lng.toFixed(6)).join(',')

    const url = `${OPEN_METEO_URL}?latitude=${lats}&longitude=${lngs}`

    const res = await fetchWithRetry(url)
    if (!res) continue

    try {
      const data = (await res.json()) as { elevation: number[] }
      for (let j = 0; j < data.elevation.length; j++) {
        elevations[i + j] = data.elevation[j]
      }
    } catch (err) {
      console.error('Open-Meteo parse error:', err)
    }
  }

  return elevations
}

/**
 * Generate a grid of real elevation data for the given bounds.
 * Uses a configurable grid resolution (default 20×20 = 400 points).
 */
export async function fetchElevationGrid(
  bounds: { north: number; south: number; east: number; west: number },
  gridSize = 20
): Promise<ElevationGrid> {
  const coords: Array<{ lat: number; lng: number }> = []
  const latStep = (bounds.north - bounds.south) / (gridSize - 1)
  const lngStep = (bounds.east - bounds.west) / (gridSize - 1)

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      coords.push({
        lat: bounds.south + row * latStep,
        lng: bounds.west + col * lngStep,
      })
    }
  }

  const elevations = await fetchElevations(coords)

  const points: ElevationPoint[] = coords.map((c, i) => ({
    lat: c.lat,
    lng: c.lng,
    elevation: elevations[i],
  }))

  const allElev = elevations.filter(e => e !== 0)
  const minElevation = allElev.length > 0 ? Math.min(...allElev) : 0
  const maxElevation = allElev.length > 0 ? Math.max(...allElev) : 0
  const avgElevation =
    allElev.length > 0 ? allElev.reduce((a, b) => a + b, 0) / allElev.length : 0

  return {
    points,
    rows: gridSize,
    cols: gridSize,
    minElevation,
    maxElevation,
    avgElevation,
  }
}
