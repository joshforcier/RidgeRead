/**
 * Fire history integration for scouting context.
 *
 * Primary source: MTBS burn area boundaries exposed through ArcGIS REST.
 * If the public service is unavailable or changes schema, callers get an
 * empty result instead of losing POI generation.
 */

export interface FireHistoryFeature {
  id?: string
  name?: string
  year?: number
  acres?: number
  severity?: 'low' | 'moderate' | 'high' | 'mixed' | 'unknown'
  source: 'MTBS'
  geometry: Array<{ lat: number; lng: number }>
}

interface Bounds {
  north: number
  south: number
  east: number
  west: number
}

interface ArcGisFeature {
  attributes?: Record<string, unknown>
  geometry?: {
    rings?: number[][][]
    paths?: number[][][]
    x?: number
    y?: number
  }
}

interface ArcGisResponse {
  error?: { message?: string; details?: string[] }
  features?: ArcGisFeature[]
  extent?: {
    xmin?: number
    ymin?: number
    xmax?: number
    ymax?: number
  }
}

const MTBS_BOUNDARY_ENDPOINTS = [
  'https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/MTBS_Polygons_v1/FeatureServer/0/query',
] as const

const FIRE_HISTORY_TIMEOUT_MS = 8000
const MAX_FIRE_FEATURES = 60
const MAX_GEOMETRY_POINTS = 160
const MAX_EXTENT_LOOKUPS = 16

export async function fetchFireHistory(bounds: Bounds): Promise<FireHistoryFeature[]> {
  for (const endpoint of MTBS_BOUNDARY_ENDPOINTS) {
    try {
      const data = await fetchArcGisJson(buildMtbsAttributesQueryUrl(endpoint, bounds))
      if (data.error) {
        console.warn(`MTBS query error: ${data.error.message || 'unknown error'}`)
        continue
      }

      const features = data.features || []
      const extentLookupFeatures = features.slice(0, MAX_EXTENT_LOOKUPS)
      const extentByObjectId = new Map<string, Array<{ lat: number; lng: number }>>()

      for (const feature of extentLookupFeatures) {
        const objectId = firstString(feature.attributes || {}, ['OBJECTID']) || String(firstNumber(feature.attributes || {}, ['OBJECTID']) || '')
        if (!objectId) continue

        const extentData = await fetchArcGisJson(buildMtbsExtentQueryUrl(endpoint, objectId))
        const geometry = extentToGeometry(extentData.extent)
        if (geometry.length > 0) extentByObjectId.set(objectId, geometry)
      }

      return features
        .map((feature) => {
          const objectId = firstString(feature.attributes || {}, ['OBJECTID']) || String(firstNumber(feature.attributes || {}, ['OBJECTID']) || '')
          return normalizeMtbsFeature(feature, objectId ? extentByObjectId.get(objectId) : undefined)
        })
        .filter((feature): feature is FireHistoryFeature => feature !== null)
        .sort((a, b) => (b.year || 0) - (a.year || 0))
        .slice(0, MAX_FIRE_FEATURES)
    } catch (err) {
      console.warn(`MTBS ${new URL(endpoint).host} fetch error:`, err)
    }
  }

  return []
}

export function summarizeFireHistory(fires: FireHistoryFeature[]): string {
  if (fires.length === 0) return 'No MTBS burn history found in the selected area.'

  const recent = fires.filter((fire) => fire.year && fire.year >= new Date().getFullYear() - 20)
  const named = fires
    .slice(0, 8)
    .map((fire) => {
      const parts = [fire.name || fire.id || 'Unnamed burn']
      if (fire.year) parts.push(String(fire.year))
      if (fire.acres) parts.push(`${Math.round(fire.acres).toLocaleString()} ac`)
      if (fire.severity && fire.severity !== 'unknown') parts.push(`${fire.severity} severity`)
      return parts.join(' / ')
    })

  return `MTBS FIRE HISTORY (${fires.length} burn perimeter${fires.length === 1 ? '' : 's'}, ${recent.length} in last 20 years): ${named.join('; ')}`
}

async function fetchArcGisJson(url: string): Promise<ArcGisResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FIRE_HISTORY_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`ArcGIS returned ${response.status}`)
    return (await response.json()) as ArcGisResponse
  } finally {
    clearTimeout(timeout)
  }
}

function buildMtbsAttributesQueryUrl(endpoint: string, bounds: Bounds): string {
  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    outFields: 'OBJECTID,FireName,StartYear,Acres,FireType,GlobalID',
    returnGeometry: 'false',
    resultRecordCount: String(MAX_FIRE_FEATURES),
    spatialRel: 'esriSpatialRelIntersects',
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    geometry: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
  })
  return `${endpoint}?${params.toString()}`
}

function buildMtbsExtentQueryUrl(endpoint: string, objectId: string): string {
  const params = new URLSearchParams({
    f: 'json',
    where: `OBJECTID=${objectId}`,
    returnGeometry: 'false',
    returnExtentOnly: 'true',
    outSR: '4326',
  })
  return `${endpoint}?${params.toString()}`
}

function normalizeMtbsFeature(feature: ArcGisFeature, fallbackGeometry?: Array<{ lat: number; lng: number }>): FireHistoryFeature | null {
  const attributes = feature.attributes || {}
  const geometry = extractArcGisGeometry(feature.geometry)
  if (geometry.length === 0 && fallbackGeometry?.length) geometry.push(...fallbackGeometry)
  if (geometry.length === 0) return null

  return {
    id: firstString(attributes, ['GlobalID', 'Fire_ID', 'FIRE_ID', 'fire_id', 'Event_ID', 'EVENT_ID']) || String(firstNumber(attributes, ['OBJECTID']) || ''),
    name: firstString(attributes, ['FireName', 'Fire_Name', 'FIRE_NAME', 'fire_name', 'Incid_Name', 'INCIDENT_NAME', 'Name', 'NAME']),
    year: firstYear(attributes, ['StartYear', 'Year', 'YEAR', 'Fire_Year', 'FIRE_YEAR', 'Ig_Year', 'IG_YEAR']),
    acres: firstNumber(attributes, ['Acres', 'ACRES', 'BurnBndAc', 'BURNBNDAC', 'GIS_ACRES']),
    severity: classifySeverity(attributes),
    source: 'MTBS',
    geometry,
  }
}

function extentToGeometry(extent: ArcGisResponse['extent']): Array<{ lat: number; lng: number }> {
  if (!extent) return []
  const { xmin, ymin, xmax, ymax } = extent
  if (![xmin, ymin, xmax, ymax].every((value) => Number.isFinite(value))) return []
  return [
    { lat: ymin as number, lng: xmin as number },
    { lat: ymin as number, lng: xmax as number },
    { lat: ymax as number, lng: xmax as number },
    { lat: ymax as number, lng: xmin as number },
    { lat: ymin as number, lng: xmin as number },
  ]
}

function extractArcGisGeometry(geometry: ArcGisFeature['geometry']): Array<{ lat: number; lng: number }> {
  if (!geometry) return []
  const coords = geometry.rings?.[0] || geometry.paths?.[0]
  if (coords && coords.length > 0) {
    const stride = Math.max(1, Math.ceil(coords.length / MAX_GEOMETRY_POINTS))
    return coords
      .filter((_, index) => index % stride === 0)
      .map(([lng, lat]) => ({ lat, lng }))
      .filter((pt) => Number.isFinite(pt.lat) && Number.isFinite(pt.lng))
  }
  if (Number.isFinite(geometry.x) && Number.isFinite(geometry.y)) {
    return [{ lat: geometry.y as number, lng: geometry.x as number }]
  }
  return []
}

function firstString(attributes: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = attributes[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function firstNumber(attributes: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = attributes[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return undefined
}

function firstYear(attributes: Record<string, unknown>, keys: string[]): number | undefined {
  const year = firstNumber(attributes, keys)
  if (!year) return undefined
  const rounded = Math.round(year)
  return rounded >= 1900 && rounded <= 2100 ? rounded : undefined
}

function classifySeverity(attributes: Record<string, unknown>): FireHistoryFeature['severity'] {
  const text = Object.entries(attributes)
    .filter(([key]) => /sev|burn/i.test(key))
    .map(([, value]) => String(value).toLowerCase())
    .join(' ')

  if (/high/.test(text)) return 'high'
  if (/moderate|medium/.test(text)) return 'moderate'
  if (/low/.test(text)) return 'low'

  const high = firstNumber(attributes, ['High_T', 'HIGH_T', 'High_Severity', 'HIGH_SEVERITY'])
  const low = firstNumber(attributes, ['Low_T', 'LOW_T', 'Low_Severity', 'LOW_SEVERITY'])
  if (high && high > 0) return 'mixed'
  if (low && low > 0) return 'mixed'

  return 'unknown'
}
