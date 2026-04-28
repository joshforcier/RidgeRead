import type { Response } from 'express'
import type { AuthedRequest } from '../middleware/auth.js'
import { fetchElevationGrid } from '../services/elevation.js'
import {
  computeSlopeAspect,
  inspectTerrainAt,
  type PointInspection,
} from '../services/terrainAnalysis.js'

const DEFAULT_CELL_SPACING_M = 200
const DEFAULT_GRID_SIZE = 31
const MAX_POINTS_PER_REQUEST = 200
const CONCURRENCY = 5

interface InspectPointsBody {
  points?: Array<{ lat: number; lng: number; id?: string }>
  cellSpacingM?: number
  gridSize?: number
}

interface PerPointResult {
  id?: string
  lat: number
  lng: number
  inspection?: PointInspection
  error?: string
}

async function inspectOne(
  lat: number,
  lng: number,
  cellSpacingM: number,
  gridSize: number,
): Promise<PointInspection> {
  const halfExtent = (gridSize - 1) / 2
  const latStep = cellSpacingM / 111_000
  const lngStep = cellSpacingM / (111_000 * Math.cos((lat * Math.PI) / 180))
  const bounds = {
    south: lat - halfExtent * latStep,
    north: lat + halfExtent * latStep,
    west: lng - halfExtent * lngStep,
    east: lng + halfExtent * lngStep,
  }
  const elevGrid = await fetchElevationGrid(bounds, gridSize)
  const terrainPoints = computeSlopeAspect(elevGrid)
  const inspection = inspectTerrainAt(terrainPoints, elevGrid, halfExtent, halfExtent)
  if (!inspection) throw new Error('center cell out of grid bounds')
  return inspection
}

/**
 * Run a batch of small grid inspections in parallel with bounded concurrency
 * so we don't hammer USGS 3DEP / Mapbox with dozens of simultaneous fetches.
 */
async function runBatchedInspections(
  points: Array<{ lat: number; lng: number; id?: string }>,
  cellSpacingM: number,
  gridSize: number,
): Promise<PerPointResult[]> {
  const results: PerPointResult[] = new Array(points.length)
  let nextIdx = 0

  const worker = async () => {
    while (true) {
      const i = nextIdx++
      if (i >= points.length) return
      const p = points[i]
      try {
        const inspection = await inspectOne(p.lat, p.lng, cellSpacingM, gridSize)
        results[i] = { id: p.id, lat: p.lat, lng: p.lng, inspection }
      } catch (err) {
        results[i] = {
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          error: err instanceof Error ? err.message : 'inspection failed',
        }
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
  return results
}

export async function inspectPoints(req: AuthedRequest, res: Response) {
  const { points, cellSpacingM, gridSize } = req.body as InspectPointsBody

  if (!Array.isArray(points) || points.length === 0) {
    res.status(400).json({ error: 'points array required' })
    return
  }
  if (points.length > MAX_POINTS_PER_REQUEST) {
    res.status(400).json({
      error: `Too many points (max ${MAX_POINTS_PER_REQUEST}); split into batches`,
    })
    return
  }
  for (const p of points) {
    if (typeof p?.lat !== 'number' || typeof p?.lng !== 'number') {
      res.status(400).json({ error: 'each point requires numeric lat and lng' })
      return
    }
    if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) {
      res.status(400).json({ error: `point out of range: ${p.lat},${p.lng}` })
      return
    }
  }

  const spacing = cellSpacingM ?? DEFAULT_CELL_SPACING_M
  const size = gridSize ?? DEFAULT_GRID_SIZE
  if (size < 31 || size > 71) {
    res.status(400).json({ error: 'gridSize must be between 31 and 71' })
    return
  }

  try {
    const results = await runBatchedInspections(points, spacing, size)
    res.json({
      results,
      meta: { gridSize: size, cellSpacingM: spacing, count: points.length },
    })
  } catch (err: unknown) {
    console.error('inspectPoints error:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Batch inspection failed' })
  }
}
