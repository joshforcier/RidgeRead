/**
 * Elevation grid from USGS 3DEP via the National Map's ArcGIS ImageServer.
 *
 * Compared to Mapbox Terrain-RGB, this gives us:
 *   - LiDAR-derived data over most of CONUS (sub-meter vertical accuracy)
 *   - 32-bit float values (no RGB-encoding loss)
 *   - Sub-canopy terrain — critical for elk hunting in timber
 *
 * Endpoint:
 *   https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage
 * Docs:
 *   https://www.usgs.gov/3d-elevation-program
 */

import { fromArrayBuffer } from 'geotiff'
import type { ElevationGrid, ElevationPoint } from './elevation.js'

const EXPORT_URL =
  'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage'

/**
 * Raster size requested from the ImageServer. 1024×1024 over a typical
 * hunting-area bbox (~10–15 km square) yields ~10–15 m/pixel — matching the
 * 1/3 arc-second 3DEP product's native resolution. Higher buys little until
 * we also bump the analysis grid above 20×20.
 */
const RASTER_SIZE = 1024

/**
 * Conservative US-coverage bbox tests. 3DEP technically also covers Hawaii
 * and territories, but coverage there is patchier so we don't claim it.
 * We require the bbox CENTER to fall in CONUS or Alaska — both extremes
 * being inside is too strict and rejects legitimate edge-of-CONUS bboxes.
 */
const CONUS = { minLat: 24.4, maxLat: 49.5, minLng: -125.0, maxLng: -66.9 }
const ALASKA = { minLat: 51.0, maxLat: 71.5, minLng: -180.0, maxLng: -129.0 }

export function isInUSCoverage(bounds: {
  north: number
  south: number
  east: number
  west: number
}): boolean {
  const cLat = (bounds.north + bounds.south) / 2
  const cLng = (bounds.east + bounds.west) / 2
  const inConus =
    cLat >= CONUS.minLat &&
    cLat <= CONUS.maxLat &&
    cLng >= CONUS.minLng &&
    cLng <= CONUS.maxLng
  const inAlaska =
    cLat >= ALASKA.minLat &&
    cLat <= ALASKA.maxLat &&
    cLng >= ALASKA.minLng &&
    cLng <= ALASKA.maxLng
  return inConus || inAlaska
}

/**
 * 3DEP nodata sentinel — appears over water, outside coverage, or where
 * source LiDAR was rejected for QC reasons. Plus very-large-negative floats
 * (the GDAL-style sentinel ~-3.4e38).
 */
function isNodata(v: number): boolean {
  return Number.isNaN(v) || v < -1000 || !Number.isFinite(v)
}

export async function fetchElevationGrid3DEP(
  bounds: { north: number; south: number; east: number; west: number },
  gridSize = 20,
): Promise<ElevationGrid> {
  const url =
    `${EXPORT_URL}?` +
    new URLSearchParams({
      bbox: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
      bboxSR: '4326',
      imageSR: '4326',
      size: `${RASTER_SIZE},${RASTER_SIZE}`,
      format: 'tiff',
      pixelType: 'F32',
      // Bilinear yields visibly smoother slopes than the default nearest-neighbor.
      interpolation: 'RSP_BilinearInterpolation',
      noData: '-9999',
      f: 'image',
    }).toString()

  const res = await fetch(url, {
    headers: { 'User-Agent': 'TerrainIQ/0.1 (+https://github.com/joshforcier/TerrainIQ)' },
  })
  if (!res.ok) {
    throw new Error(`USGS 3DEP exportImage returned ${res.status}`)
  }

  const buf = await res.arrayBuffer()
  // The endpoint sometimes returns JSON error bodies with a 200 status when
  // a parameter combo confuses it (e.g., absurd bboxes). Check the magic.
  const sig = new Uint8Array(buf.slice(0, 4))
  const isLittleEndianTiff = sig[0] === 0x49 && sig[1] === 0x49 && sig[2] === 0x2a && sig[3] === 0x00
  const isBigEndianTiff = sig[0] === 0x4d && sig[1] === 0x4d && sig[2] === 0x00 && sig[3] === 0x2a
  if (!isLittleEndianTiff && !isBigEndianTiff) {
    const head = new TextDecoder().decode(buf.slice(0, 200))
    throw new Error(`USGS 3DEP returned non-TIFF response: ${head.slice(0, 120)}`)
  }

  const tiff = await fromArrayBuffer(buf)
  const image = await tiff.getImage()
  const width = image.getWidth()
  const height = image.getHeight()
  const raster = (await image.readRasters({ interleave: true })) as Float32Array

  const points: ElevationPoint[] = []
  const latStep = (bounds.north - bounds.south) / (gridSize - 1)
  const lngStep = (bounds.east - bounds.west) / (gridSize - 1)

  let nodataCount = 0
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const lat = bounds.south + row * latStep
      const lng = bounds.west + col * lngStep
      // Image origin is top-left (north-west); pixel y increases southward.
      const px = Math.min(
        width - 1,
        Math.max(0, Math.floor(((lng - bounds.west) / (bounds.east - bounds.west)) * (width - 1))),
      )
      const py = Math.min(
        height - 1,
        Math.max(0, Math.floor(((bounds.north - lat) / (bounds.north - bounds.south)) * (height - 1))),
      )
      let elev = raster[py * width + px]
      if (isNodata(elev)) {
        elev = 0
        nodataCount++
      }
      points.push({ lat, lng, elevation: elev })
    }
  }

  // If too many points came back as nodata, the caller should fall back to
  // a different source rather than feed a swiss-cheese grid into terrain
  // analysis. 10% threshold is empirical — light coastal/water content
  // routinely produces a few % nodata, but a swiss-cheese >10% means coverage
  // is genuinely thin and the result won't be trustworthy for slope/aspect.
  if (nodataCount / points.length > 0.1) {
    throw new Error(
      `USGS 3DEP returned ${nodataCount} nodata points out of ${points.length} (>10%) — coverage too thin`,
    )
  }

  const valid = points.map((p) => p.elevation).filter((e) => e > -500 && e < 9000)
  const minElevation = valid.length ? Math.min(...valid) : 0
  const maxElevation = valid.length ? Math.max(...valid) : 0
  const avgElevation = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0

  return {
    points,
    rows: gridSize,
    cols: gridSize,
    minElevation,
    maxElevation,
    avgElevation,
  }
}
