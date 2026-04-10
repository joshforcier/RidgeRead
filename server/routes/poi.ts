import type { Request, Response } from 'express'
import OpenAI from 'openai'
import {
  fetchLandData,
  summarizeLandData,
  getRoadTrailSegments,
  isNearRoadOrTrail,
  haversineMeters,
} from './overpass'
import { fetchElevationGrid } from '../services/elevation'
import {
  analyzeTerrainForPrompt,
  formatFeaturesForPrompt,
  computeSlopeAspect,
  type TerrainPoint,
} from '../services/terrainAnalysis'

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set. Create a .env file with your key.')
  }
  return new OpenAI({ apiKey })
}

interface GeneratePOIRequest {
  bounds: {
    north: number
    south: number
    east: number
    west: number
  }
  season: string
  timeOfDay: string
  zoom: number
  bufferMiles?: number
}

const METERS_PER_MILE = 1609.34
const DEFAULT_BUFFER_MILES = 0.5

const SEASONS = ['rut', 'post-rut', 'late-season'] as const
const TIMES = ['dawn', 'midday', 'dusk'] as const

/**
 * Find the nearest terrain grid point to a given lat/lng and return
 * verified elevation, slope, and aspect.
 */
function lookupTerrain(
  lat: number,
  lng: number,
  terrainPoints: TerrainPoint[]
): { elevation: number; slope: number; aspect: string; distMeters: number } {
  let nearest = terrainPoints[0]
  let minDist = Infinity

  for (const pt of terrainPoints) {
    const dLat = pt.lat - lat
    const dLng = pt.lng - lng
    // Approximate squared distance (fine for nearest-neighbor on small areas)
    const d = dLat * dLat + dLng * dLng
    if (d < minDist) {
      minDist = d
      nearest = pt
    }
  }

  const distMeters = haversineMeters(lat, lng, nearest.lat, nearest.lng)
  return {
    elevation: nearest.elevation,
    slope: nearest.slope,
    aspect: nearest.aspectLabel,
    distMeters,
  }
}

function mToFt(m: number): string {
  return Math.round(m * 3.28084).toLocaleString()
}

/**
 * Season-specific behavior rules used in the GPT prompt.
 */
const seasonBehaviorRules: Record<string, string> = {
  rut: `SEASON: RUT (Mid-Sep to Mid-Oct) — Breeding overrides energy economics.

FEEDING (weight: dawn 35%, dusk 40%):
- Elk feed in meadows and parks during predawn/dusk. Cows maintain feeding patterns but are herded by bulls.
- Place feeding POIs on mapped meadows/grasslands WITHIN 100-200m of timber edge (elk never venture farther during daylight).
- The transition zone (100-400m band where timber thins to meadow) is the highest-probability encounter zone.

WATER (weight: dawn 50%, dusk 55%):
- HIGH importance during rut. Elk stay within 400m of water. Cows need daily water, bulls won't let them wander far.
- Place water POIs near confirmed streams, springs, and drainage confluences within 400m of bedding timber.

BEDDING (weight: midday 80%):
- North/northeast-facing slopes, 10-30° slope, 60-80% canopy cover with relatively open understory.
- Benches and flats at 1/3 to 2/3 up a slope — high enough for thermal advantage, low enough for water/feed access.
- Place on detected BENCH features on N/NE aspects. Herd bulls bed near cow herds.
- Satellite bulls bed on adjacent finger ridges, 100-300m uphill from herd bull.

WALLOWS (weight: dawn 75%, midday 70%, dusk 80%):
- CRITICAL rut feature. Flat boggy areas near springs or seeps WITHIN timber, at the heads of small drainages.
- Place on detected DRAINAGE features near confirmed streams. Look for low-slope areas (<10°) near water in timber.
- Fresh wallows have torn-up ground, rubbed trees, strong urine smell. Bulls revisit multiple times per day.

TRAVEL (weight: dawn 85%, dusk 90%):
- Peak movement at dawn and dusk. Bulls herd cows along ridgelines, saddles, and timber edges.
- Travel follows terrain funnels: saddles between drainages, benches connecting meadows to timber, creek bottom edges, finger ridge tops.
- Place at detected SADDLE points and on ridgeline/finger-ridge features connecting bedding to feeding areas.`,

  'post-rut': `SEASON: POST-RUT (Mid-Oct to Mid-Nov) — Recovery phase. Most difficult to pattern.

FEEDING (weight: dawn 65%, dusk 75%):
- Feeding becomes primary driver. Bulls are depleted (lost 15-20% body weight) and need calories.
- Bulls often DON'T LEAVE TIMBER — they feed in small openings and shaded parks within canopy. Do NOT place bull feeding POIs in open meadows.
- Cow herds return to predictable feed-to-bed patterns on south/southeast-facing slopes.
- Place feeding POIs at timber edges and small clearings WITHIN forest, not in large open meadows.

WATER (weight: dawn 30%, dusk 35%):
- Moderate importance. Bulls water every 24-48 hours, often at night. Less critical than rut.
- Place water POIs near streams but expect nighttime-only visits.

BEDDING (weight: midday 95%):
- Densest available timber on north/northeast-facing slopes. 80%+ canopy closure, deadfall, limited visibility (<40-50 yards).
- Slope increases to 20-40° — steeper terrain provides security. Approaching hunters must make noise on steep faces.
- Thermal advantage critical: morning thermals rise (scent from below), evening thermals sink (scent from above).
- Place on detected BENCH features on N/NE aspects with steep surrounding terrain. Also: dark timber bowls, drainage heads where ridges converge, blowdown areas.
- Distance to water DECREASES in importance — bulls drink at night.

WALLOWS (weight: ~5%):
- Nearly irrelevant post-rut. Bulls have stopped breeding behavior. Do not prioritize.

TRAVEL (weight: dawn 35%, dusk 40%):
- Minimal movement. Bulls emerge late and cautiously at dusk, if at all.
- Place travel POIs ONLY on the most sheltered corridors — drainage bottoms and timber-to-timber connections. NOT exposed ridgelines.`,

  'late-season': `SEASON: LATE SEASON (Late Nov through Dec) — Energy conservation. Cold + snow dominate.

FEEDING (weight: dawn 90%, dusk 90%):
- Survival mode. Elk need calories desperately. Large herds (50-200+ animals) on limited winter range.
- Elk feed in open SOUTH-FACING meadows and slopes. Most visible and predictable elk of the year.
- Same feeding areas on the same schedule daily until disrupted.
- Place feeding POIs on south-facing mapped meadows. The south-facing transition zone (timber edge above meadow) is THE most important late-season terrain feature.

WATER (weight: ~10%):
- Nearly irrelevant. Snow provides hydration. Elk may not visit open water at all. Do not prioritize.

BEDDING (weight: midday 85%):
- ASPECT FLIPS from earlier seasons. Elk bed on SOUTH/SOUTHWEST-facing slopes (15-25°F warmer than north-facing).
- Slope decreases to 5-20° — elk conserve energy on gentler terrain. Rely on herd vigilance, not steep escape terrain.
- Wind protection critical: leeward side of ridges, sheltered from prevailing NW wind.
- Avoid areas with >18-24 inches soft snow. Seek windblown ridges, south-facing openings, under dense canopy.
- Place on detected BENCH features on S/SW aspects near south-facing meadows.

WALLOWS (weight: 0%):
- Dormant. Zero relevance. Do not generate wallow POIs for late season.

TRAVEL (weight: dawn 45%, dusk 50%):
- Elk move between a few core feeding and bedding areas on a tight daily pattern.
- Migration corridors: narrow valleys, saddles, ridgelines funneling elk from summer to winter range. Storms trigger active migration.
- Place at saddles and along ridgelines connecting south-facing feeding to south-facing bedding timber.`,
}

/**
 * Build the GPT prompt for a specific season + time combo, reusing shared terrain context.
 */
function buildPrompt(
  season: string,
  timeOfDay: string,
  bounds: GeneratePOIRequest['bounds'],
  centerLat: number,
  centerLng: number,
  terrain: { elevationProfile: string; slopeAnalysis: string; aspectBreakdown: string; elkHabitatNotes: string },
  featuresList: string,
  terrainSummary: string,
  roadAvoidanceSection: string,
  terrainFeaturesSection: string,
  bufferMiles: number,
  bufferMeters: number,
): string {
  const rules = seasonBehaviorRules[season] || seasonBehaviorRules['rut']

  return `You are an expert elk hunting guide placing points of interest using REAL terrain data. You have actual elevation measurements, computed slope/aspect, and verified land cover from OpenStreetMap. Every POI must be grounded in the data below.

MAP BOUNDS:
- North: ${bounds.north.toFixed(5)}, South: ${bounds.south.toFixed(5)}
- East: ${bounds.east.toFixed(5)}, West: ${bounds.west.toFixed(5)}
- Center: ${centerLat.toFixed(5)}, ${centerLng.toFixed(5)}
- Time of day: ${timeOfDay}

REAL ELEVATION DATA:
${terrain.elevationProfile}
${terrain.slopeAnalysis}
${terrain.aspectBreakdown}

${rules}

ELK HABITAT ASSESSMENT:
${terrain.elkHabitatNotes}

LAND COVER (OpenStreetMap):
${terrainSummary}
${roadAvoidanceSection}
${terrainFeaturesSection}
${featuresList}
UNIVERSAL PRINCIPLES:
- Thermals: Morning thermals flow UPHILL, evening thermals flow DOWNHILL. Elk bed where thermals create predictable scent detection (points, ridge noses, bench edges).
- Escape routes: Elk always bed with 2+ escape routes (downhill into drainage + lateral along bench/contour). Single-exit bedding = unused.
- Pressure response: Pressured elk shift to thicker, steeper, more remote terrain. Best areas are >1 mile from roads with no ATV access.
- Transition zone: The 100-400m band where timber thins to meadow is the #1 encounter zone across all seasons. Hunt it at first/last 90 min of daylight.

PLACEMENT RULES:
1. ALL POIs must be >${bufferMiles.toFixed(2)} miles (${Math.round(bufferMeters)}m) from ANY road, trail, or building listed above.
2. Use REAL coordinates from detected terrain features and OSM data — do not invent locations.
3. NEVER place near buildings or developed areas.
4. Match POI type to real terrain: "meadow" ONLY on mapped meadows, "drainage" ONLY at real drainage points, "saddle" ONLY at detected saddles, "spring" ONLY near confirmed water.
5. Descriptions MUST reference actual elevation, slope angle, aspect, and specific tactical advice for the current season + time of day.
6. For "${timeOfDay}" specifically: focus POIs on the behaviors with the highest weights for this time window.

Generate 5-20 points of interest. Coordinates STRICTLY WITHIN bounds.

POI types: meadow, drainage, wallow, saddle, spring, trail-junction
Behaviors: feeding, water, bedding, wallows, travel

Respond with ONLY valid JSON:
{
  "pois": [
    {
      "name": "string - descriptive name referencing the actual terrain feature",
      "lat": number,
      "lng": number,
      "type": "meadow|drainage|wallow|saddle|spring|trail-junction",
      "relatedBehaviors": ["feeding", "water", etc - only behaviors relevant to this season],
      "description": "string - 2-3 sentences: what the terrain is, why elk use it this season/time, and specific tactical hunting advice (where to set up, wind direction, approach)"
    }
  ]
}`
}

export async function generatePOIs(req: Request, res: Response) {
  const { bounds, bufferMiles: rawBuffer } = req.body as GeneratePOIRequest

  // Clamp buffer to 0.1–2.0 miles
  const bufferMiles = Math.max(0.1, Math.min(2.0, rawBuffer ?? DEFAULT_BUFFER_MILES))
  const bufferMeters = bufferMiles * METERS_PER_MILE

  if (!bounds || bounds.north == null || bounds.south == null || bounds.east == null || bounds.west == null) {
    res.status(400).json({ error: 'Missing map bounds' })
    return
  }

  if (bounds.north <= bounds.south || bounds.east <= bounds.west) {
    res.status(400).json({ error: 'Invalid bounds: north must be > south, east must be > west' })
    return
  }

  const midLatRad = (((bounds.north + bounds.south) / 2) * Math.PI) / 180
  const heightM = (bounds.north - bounds.south) * 111320
  const widthM = (bounds.east - bounds.west) * 111320 * Math.cos(midLatRad)
  const MAX_SIDE_METERS = 1609.34 * 5.5

  if (heightM > MAX_SIDE_METERS || widthM > MAX_SIDE_METERS) {
    res.status(400).json({
      error: `Area too large (${(widthM / 1609.34).toFixed(2)} mi × ${(heightM / 1609.34).toFixed(2)} mi). Zoom in to 5 mi × 5 mi or smaller.`
    })
    return
  }

  const centerLat = (bounds.north + bounds.south) / 2
  const centerLng = (bounds.east + bounds.west) / 2

  try {
    // ── Step 1: Fetch real data in parallel (shared across all 9 combos) ──
    console.log('Fetching OSM land data + elevation grid...')
    const [landData, elevGrid] = await Promise.all([
      fetchLandData(bounds),
      fetchElevationGrid(bounds, 20), // 20×20 = 400 points, 4 API calls
    ])

    const terrainSummary = summarizeLandData(landData)
    const roadTrailSegments = getRoadTrailSegments(landData)

    const totalRoadPts = landData.roads.reduce((n, r) => n + r.geometry.length, 0)
    const totalTrailPts = landData.trails.reduce((n, r) => n + r.geometry.length, 0)
    console.log(`OSM: ${landData.roads.length} roads (${totalRoadPts} pts), ${landData.trails.length} trails (${totalTrailPts} pts), ${landData.forests.length} forests, ${landData.meadows.length} meadows, ${landData.water.length} water, ${landData.streams.length} streams`)
    console.log(`Road/trail segments for buffer check: ${roadTrailSegments.length}`)
    console.log(`Elevation: ${elevGrid.minElevation.toFixed(0)}m – ${elevGrid.maxElevation.toFixed(0)}m (${elevGrid.points.length} points)`)

    // ── Step 2: Analyze terrain from real elevation data ──
    const terrain = analyzeTerrainForPrompt(elevGrid, landData)
    const featuresList = formatFeaturesForPrompt(terrain.detectedFeatures)

    console.log(`Terrain: ${terrain.detectedFeatures.length} features detected`)

    // ── Step 3: Build road avoidance section ──
    let roadAvoidanceSection = ''
    if (landData.roads.length > 0 || landData.trails.length > 0) {
      const roadSamples: string[] = []
      for (const road of landData.roads.slice(0, 15)) {
        const mid = road.geometry[Math.floor(road.geometry.length / 2)]
        if (mid) {
          roadSamples.push(`  - ${road.name || 'Unnamed road'}: ~${mid.lat.toFixed(5)}, ${mid.lng.toFixed(5)}`)
        }
      }
      for (const trail of landData.trails.slice(0, 10)) {
        const mid = trail.geometry[Math.floor(trail.geometry.length / 2)]
        if (mid) {
          roadSamples.push(`  - ${trail.name || 'Unnamed trail'}: ~${mid.lat.toFixed(5)}, ${mid.lng.toFixed(5)}`)
        }
      }
      roadAvoidanceSection = `
ROADS AND TRAILS TO AVOID (maintain ${bufferMiles.toFixed(2)} mile / ${Math.round(bufferMeters)}m buffer from ALL of these):
${roadSamples.join('\n')}
`
    }

    // ── Step 4: Build terrain features for prompt ──
    let terrainFeaturesSection = ''
    if (landData.meadows.length > 0 || landData.water.length > 0 || landData.streams.length > 0 || landData.forests.length > 0) {
      const features: string[] = []
      for (const meadow of landData.meadows.slice(0, 8)) {
        const center = meadow.geometry[Math.floor(meadow.geometry.length / 2)]
        if (center) {
          features.push(`  - Meadow${meadow.name ? ` "${meadow.name}"` : ''}: ~${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`)
        }
      }
      for (const water of landData.water.slice(0, 5)) {
        const center = water.geometry[Math.floor(water.geometry.length / 2)]
        if (center) {
          features.push(`  - Water body${water.name ? ` "${water.name}"` : ''}: ~${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`)
        }
      }
      for (const stream of landData.streams.slice(0, 8)) {
        const mid = stream.geometry[Math.floor(stream.geometry.length / 2)]
        if (mid) {
          features.push(`  - Stream${stream.name ? ` "${stream.name}"` : ''}: ~${mid.lat.toFixed(5)}, ${mid.lng.toFixed(5)}`)
        }
      }
      for (const forest of landData.forests.slice(0, 5)) {
        const center = forest.geometry[Math.floor(forest.geometry.length / 2)]
        if (center) {
          features.push(`  - Forest${forest.name ? ` "${forest.name}"` : ''}: ~${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`)
        }
      }
      for (const ridge of landData.ridges.slice(0, 5)) {
        const center = ridge.geometry[0]
        if (center) {
          features.push(`  - ${ridge.name || 'Ridge/Saddle'}: ~${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`)
        }
      }
      terrainFeaturesSection = `
OSM LAND COVER FEATURES:
${features.join('\n')}
`
    }

    // ── Step 5: Compute terrain grid for verification (shared across all combos) ──
    const terrainPoints = computeSlopeAspect(elevGrid)

    // ── Step 6: Build and run all 9 season×time GPT calls in parallel ──
    const openai = getClient()
    const buildingPoints = landData.buildings.flatMap(b => b.geometry)

    type ComboKey = `${typeof SEASONS[number]}_${typeof TIMES[number]}`
    const comboResults: Record<string, unknown[]> = {}

    console.log('Launching 9 parallel GPT calls (3 seasons × 3 times)...')

    const comboPromises = SEASONS.flatMap(season =>
      TIMES.map(async (timeOfDay) => {
        const key: ComboKey = `${season}_${timeOfDay}`

        const prompt = buildPrompt(
          season, timeOfDay, bounds, centerLat, centerLng,
          terrain, featuresList, terrainSummary,
          roadAvoidanceSection, terrainFeaturesSection,
          bufferMiles, bufferMeters,
        )

        const completion = await openai.chat.completions.create({
          model: 'gpt-5.4-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_completion_tokens: 2500,
          response_format: { type: 'json_object' },
        })

        const content = completion.choices[0]?.message?.content
        if (!content) {
          console.warn(`Empty response for ${key}`)
          return { key, pois: [] }
        }

        const parsed = JSON.parse(content)
        const rawPois = parsed.pois || []

        // Server-side buffer enforcement
        const filteredPois = rawPois.filter((poi: { lat: number; lng: number; name?: string }) => {
          if (roadTrailSegments.length > 0) {
            if (isNearRoadOrTrail(poi.lat, poi.lng, roadTrailSegments, bufferMeters)) {
              return false
            }
          }
          for (const bPt of buildingPoints) {
            if (haversineMeters(poi.lat, poi.lng, bPt.lat, bPt.lng) < bufferMeters) {
              return false
            }
          }
          return true
        })

        // ── Terrain verification: attach real elevation/slope/aspect ──
        const verifiedPois = filteredPois.map((poi: {
          lat: number
          lng: number
          name?: string
          type?: string
          relatedBehaviors?: string[]
          description?: string
        }) => {
          const real = lookupTerrain(poi.lat, poi.lng, terrainPoints)
          return {
            ...poi,
            elevation: real.elevation,
            elevationFt: mToFt(real.elevation),
            slope: real.slope,
            aspect: real.aspect,
          }
        })

        console.log(`  ${key}: ${rawPois.length} generated, ${verifiedPois.length} passed buffer (verified terrain)`)
        return { key, pois: verifiedPois }
      })
    )

    const results = await Promise.all(comboPromises)

    for (const { key, pois } of results) {
      comboResults[key] = pois
    }

    const totalPois = Object.values(comboResults).reduce((sum, arr) => sum + arr.length, 0)
    console.log(`All 9 combos complete — ${totalPois} total POIs across all combinations`)

    res.json({ combos: comboResults })
  } catch (err: unknown) {
    console.error('POI generation error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: message })
  }
}
