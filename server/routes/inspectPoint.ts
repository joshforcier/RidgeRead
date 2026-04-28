import type { Response } from 'express'
import type { AuthedRequest } from '../middleware/auth.js'
import { fetchElevationGrid } from '../services/elevation.js'
import { computeSlopeAspect, inspectTerrainAt } from '../services/terrainAnalysis.js'

/**
 * Dev-only diagnostic: given a single lat/lng, fetch a small elevation
 * grid centered on the point and run the terrain feature detection on
 * the center cell. Returns structured pass/fail reasons for each feature
 * type so we can debug "why isn't this saddle being labeled?" questions.
 *
 * Auth-protected to avoid casual abuse of the underlying elevation
 * services, but no usage quota — this is a read-only diagnostic.
 */
export async function inspectPoint(req: AuthedRequest, res: Response) {
  const { lat, lng, cellSpacingM, gridSize } = req.body as {
    lat?: number
    lng?: number
    cellSpacingM?: number
    gridSize?: number
  }

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    res.status(400).json({ error: 'Missing lat/lng (numbers required)' })
    return
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: 'lat/lng out of valid range' })
    return
  }

  // Defaults: 200m cell spacing × 31×31 grid → 6km square bbox with a 3km
  // saddle search radius (15 cells). 200m sampling captures sharp peaks
  // that 400m would smooth over via bilinear interpolation; 3km reach is
  // local-enough to avoid catching regional cross-valley topology.
  const spacing = cellSpacingM ?? 200
  const size = gridSize ?? 31
  if (size < 31 || size > 71) {
    res.status(400).json({ error: 'gridSize must be between 31 and 71' })
    return
  }
  const halfExtent = (size - 1) / 2
  const latStep = spacing / 111_000
  const lngStep = spacing / (111_000 * Math.cos((lat * Math.PI) / 180))

  const bounds = {
    south: lat - halfExtent * latStep,
    north: lat + halfExtent * latStep,
    west: lng - halfExtent * lngStep,
    east: lng + halfExtent * lngStep,
  }

  try {
    const elevGrid = await fetchElevationGrid(bounds, size)
    const terrainPoints = computeSlopeAspect(elevGrid)
    const inspection = inspectTerrainAt(
      terrainPoints,
      elevGrid,
      halfExtent, // center row
      halfExtent, // center col
    )
    if (!inspection) {
      res.status(500).json({ error: 'Could not inspect point — center cell out of grid bounds' })
      return
    }
    res.json({
      ...inspection,
      meta: {
        gridSize: size,
        cellSpacingM: spacing,
        bounds,
      },
    })
  } catch (err: unknown) {
    console.error('inspectPoint error:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Inspection failed' })
  }
}
