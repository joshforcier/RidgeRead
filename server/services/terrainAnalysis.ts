/**
 * Terrain analysis — combines real elevation data with OSM land cover
 * to produce a detailed terrain profile for AI POI placement.
 *
 * Computes: slope, aspect, elevation bands, ridgelines, drainages,
 * saddle candidates, and terrain classifications.
 *
 * Elk habitat logic derived from:
 *   - Bedding slope/aspect preferences per season
 *   - Feeding-to-bedding transition zone identification (100-400m band)
 *   - Thermal wind patterns (morning uphill, evening downhill)
 *   - Water proximity requirements by season (rut: <400m, post-rut: less critical, late: snow replaces)
 *   - Escape route viability (2+ exit routes from bedding)
 */

import type { ElevationGrid, ElevationPoint } from './elevation'
import type { OSMLandData } from '../routes/overpass'

// ─── Slope & Aspect ──────────────────────────────────────────

export interface TerrainPoint extends ElevationPoint {
  slope: number        // degrees 0-90
  aspect: number       // degrees 0-360 (0=N, 90=E, 180=S, 270=W)
  aspectLabel: string  // 'N', 'NE', 'E', etc.
}

export function computeSlopeAspect(
  grid: ElevationGrid
): TerrainPoint[] {
  const { points, rows, cols } = grid
  const results: TerrainPoint[] = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c
      const pt = points[idx]

      const left = c > 0 ? points[idx - 1].elevation : pt.elevation
      const right = c < cols - 1 ? points[idx + 1].elevation : pt.elevation
      const up = r < rows - 1 ? points[idx + cols].elevation : pt.elevation
      const down = r > 0 ? points[idx - cols].elevation : pt.elevation

      const cellSizeLat = r < rows - 1
        ? haversineDist(pt.lat, pt.lng, points[idx + cols].lat, points[idx + cols].lng)
        : r > 0
          ? haversineDist(pt.lat, pt.lng, points[idx - cols].lat, points[idx - cols].lng)
          : 200

      const cellSizeLng = c < cols - 1
        ? haversineDist(pt.lat, pt.lng, points[idx + 1].lat, points[idx + 1].lng)
        : c > 0
          ? haversineDist(pt.lat, pt.lng, points[idx - 1].lat, points[idx - 1].lng)
          : 200

      const dzdx = (right - left) / (2 * cellSizeLng)
      const dzdy = (up - down) / (2 * cellSizeLat)

      const slopeRad = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy))
      const slopeDeg = slopeRad * (180 / Math.PI)

      // Aspect = compass bearing of the downhill direction. Uphill vector
      // in (east, north) coords is (dzdx, dzdy); downhill is (-dzdx, -dzdy);
      // compass bearing of (E, N) = atan2(E, N).
      let aspectDeg = Math.atan2(-dzdx, -dzdy) * (180 / Math.PI)
      if (aspectDeg < 0) aspectDeg += 360

      results.push({
        ...pt,
        slope: Math.round(slopeDeg * 10) / 10,
        aspect: Math.round(aspectDeg),
        aspectLabel: getAspectLabel(aspectDeg),
      })
    }
  }

  return results
}

function getAspectLabel(deg: number): string {
  if (deg >= 337.5 || deg < 22.5) return 'N'
  if (deg < 67.5) return 'NE'
  if (deg < 112.5) return 'E'
  if (deg < 157.5) return 'SE'
  if (deg < 202.5) return 'S'
  if (deg < 247.5) return 'SW'
  if (deg < 292.5) return 'W'
  return 'NW'
}

function haversineDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Feature Detection ──────────────────────────────────────

interface TerrainFeature {
  type: 'saddle' | 'ridge' | 'drainage' | 'bench' | 'finger-ridge' | 'transition-zone'
  lat: number
  lng: number
  elevation: number
  slope: number
  aspect: string
  description: string
}

function detectFeatures(
  terrainPoints: TerrainPoint[],
  grid: ElevationGrid
): TerrainFeature[] {
  const features: TerrainFeature[] = []
  const { rows, cols } = grid

  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const idx = r * cols + c
      const pt = terrainPoints[idx]

      const above = terrainPoints[(r + 1) * cols + c]
      const below = terrainPoints[(r - 1) * cols + c]
      const left = terrainPoints[r * cols + (c - 1)]
      const right = terrainPoints[r * cols + (c + 1)]

      const neighbors = [above, below, left, right]
      const nElev = neighbors.map(n => n.elevation)

      // Saddle: lower than two opposite neighbors, higher than the other two
      // "Low points on ridgelines where elk cross between drainages.
      //  Bulls frequently bugle from saddles because sound carries both directions."
      const isHigherNS = pt.elevation > above.elevation && pt.elevation > below.elevation
      const isLowerEW = pt.elevation < left.elevation && pt.elevation < right.elevation
      const isHigherEW = pt.elevation > left.elevation && pt.elevation > right.elevation
      const isLowerNS = pt.elevation < above.elevation && pt.elevation < below.elevation

      if ((isHigherNS && isLowerEW) || (isHigherEW && isLowerNS)) {
        features.push({
          type: 'saddle',
          lat: pt.lat,
          lng: pt.lng,
          elevation: pt.elevation,
          slope: pt.slope,
          aspect: pt.aspectLabel,
          description: `Saddle at ${mToFt(pt.elevation)}ft — natural crossing between drainages. Sound carries both directions; key travel funnel and ambush point for rut bugling and late-season migration.`,
        })
      }

      // Ridge: higher than all 4 cardinal neighbors
      // "Bulls often travel along finger ridges using the wind advantage."
      if (nElev.every(e => pt.elevation > e + 5)) {
        features.push({
          type: 'ridge',
          lat: pt.lat,
          lng: pt.lng,
          elevation: pt.elevation,
          slope: pt.slope,
          aspect: pt.aspectLabel,
          description: `Ridgeline at ${mToFt(pt.elevation)}ft — elk travel corridors. Bulls use ridges for wind advantage. Bedded elk on ridge points with crosswind monitor scent from three directions.`,
        })
      }

      // Drainage bottom: lower than all 4 cardinal neighbors
      // "Drainage heads: uppermost ends of creek drainages where ridges converge.
      //  Thickest timber, least human traffic."
      if (nElev.every(e => pt.elevation < e - 5)) {
        features.push({
          type: 'drainage',
          lat: pt.lat,
          lng: pt.lng,
          elevation: pt.elevation,
          slope: pt.slope,
          aspect: pt.aspectLabel,
          description: `Drainage bottom at ${mToFt(pt.elevation)}ft — water collects here. During rut: wallow potential near springs/seeps. Post-rut: drainage heads hold thickest timber and least human traffic.`,
        })
      }

      // Bench: gentle slope on otherwise steep terrain
      // "Benches and flats located 1/3 to 2/3 up a slope — high enough for thermal advantage,
      //  low enough for water/feed access. Steep sidehill benches are nearly unapproachable
      //  without detection."
      const avgNeighborSlope = neighbors.reduce((a, n) => a + n.slope, 0) / 4
      if (pt.slope < 10 && avgNeighborSlope > 15) {
        // Classify the bench by aspect for seasonal relevance
        const isNorthFacing = ['N', 'NE', 'NW'].includes(pt.aspectLabel)
        const isSouthFacing = ['S', 'SE', 'SW'].includes(pt.aspectLabel)

        let benchDesc = `Bench at ${mToFt(pt.elevation)}ft (${pt.slope}° on ${avgNeighborSlope.toFixed(0)}° terrain), ${pt.aspectLabel}-facing.`
        if (isNorthFacing) {
          benchDesc += ` North-facing bench: rut/post-rut bedding (60-80%+ canopy). Steep approach = security. Thermal advantage: morning thermals rise, evening thermals sink.`
        } else if (isSouthFacing) {
          benchDesc += ` South-facing bench: late-season bedding (15-25°F warmer than north). Solar exposure, reduced snow. Prime Nov-Dec.`
        }

        features.push({
          type: 'bench',
          lat: pt.lat,
          lng: pt.lng,
          elevation: pt.elevation,
          slope: pt.slope,
          aspect: pt.aspectLabel,
          description: benchDesc,
        })
      }

      // Finger ridge: higher than 2-3 neighbors with moderate slope
      // "Small ridges extending off main ridgelines into drainages.
      //  Satellite bulls bed on these. Bulls travel along the tops."
      const higherCount = nElev.filter(e => pt.elevation > e + 3).length
      if (higherCount === 2 || higherCount === 3) {
        if (pt.slope >= 8 && pt.slope <= 25) {
          features.push({
            type: 'finger-ridge',
            lat: pt.lat,
            lng: pt.lng,
            elevation: pt.elevation,
            slope: pt.slope,
            aspect: pt.aspectLabel,
            description: `Finger ridge at ${mToFt(pt.elevation)}ft — small ridge extending into drainage. Satellite bulls bed here during rut (100-300m from herd bull). Travel route with wind advantage.`,
          })
        }
      }
    }
  }

  return features
}

function mToFt(m: number): string {
  return Math.round(m * 3.28084).toLocaleString()
}

// ─── Terrain Summary Builder ────────────────────────────────

export interface TerrainAnalysis {
  elevationProfile: string
  slopeAnalysis: string
  aspectBreakdown: string
  detectedFeatures: TerrainFeature[]
  featureSummary: string
  elkHabitatNotes: string
}

export function analyzeTerrainForPrompt(
  elevGrid: ElevationGrid,
  landData: OSMLandData
): TerrainAnalysis {
  const terrainPoints = computeSlopeAspect(elevGrid)
  const features = detectFeatures(terrainPoints, elevGrid)

  // ── Elevation profile ──
  const elevFt = {
    min: mToFt(elevGrid.minElevation),
    max: mToFt(elevGrid.maxElevation),
    avg: mToFt(elevGrid.avgElevation),
    range: mToFt(elevGrid.maxElevation - elevGrid.minElevation),
  }
  const elevationProfile = `Elevation range: ${elevFt.min}ft to ${elevFt.max}ft (${elevFt.range}ft of relief). Average: ${elevFt.avg}ft.`

  // ── Slope analysis with elk-relevant classifications ──
  const slopes = terrainPoints.map(p => p.slope)
  const total = slopes.length

  // Elk-specific slope bands from the habitat guide
  const lateSeasonBed = slopes.filter(s => s >= 5 && s <= 20).length  // late-season bedding
  const rutBed = slopes.filter(s => s >= 10 && s <= 30).length        // rut bedding
  const postRutBed = slopes.filter(s => s >= 20 && s <= 40).length    // post-rut bedding (security)
  const gentleCount = slopes.filter(s => s < 10).length               // feeding/meadow terrain
  const steepCount = slopes.filter(s => s >= 30).length               // security terrain

  const slopeAnalysis = [
    `Slope breakdown: ${pct(gentleCount, total)} gentle (<10° — feeding/meadow terrain), `,
    `${pct(rutBed, total)} in rut bedding range (10-30°), `,
    `${pct(postRutBed, total)} in post-rut security range (20-40°), `,
    `${pct(steepCount, total)} steep (>30°). `,
    `Average: ${(slopes.reduce((a, b) => a + b, 0) / total).toFixed(1)}°. `,
    `Late-season bedding terrain (5-20°): ${pct(lateSeasonBed, total)}.`,
  ].join('')

  // ── Aspect breakdown with seasonal relevance ──
  const aspectCounts: Record<string, number> = { N: 0, NE: 0, E: 0, SE: 0, S: 0, SW: 0, W: 0, NW: 0 }
  for (const pt of terrainPoints) {
    aspectCounts[pt.aspectLabel]++
  }

  const northPct = (aspectCounts.N + aspectCounts.NE + aspectCounts.NW) / total
  const southPct = (aspectCounts.S + aspectCounts.SE + aspectCounts.SW) / total

  const dominant = Object.entries(aspectCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const aspectBreakdown = [
    `Dominant aspects: ${dominant.map(([dir, count]) => `${dir}-facing (${pct(count, total)})`).join(', ')}. `,
    `North-facing (N/NE/NW): ${pct(Math.round(northPct * total), total)} — rut & post-rut bedding (thermal cover, 60-80%+ canopy). `,
    `South-facing (S/SE/SW): ${pct(Math.round(southPct * total), total)} — late-season bedding (solar warmth, 15-25°F warmer), feeding areas. `,
  ].join('')

  // ── Feature summary ──
  const saddleCount = features.filter(f => f.type === 'saddle').length
  const ridgeCount = features.filter(f => f.type === 'ridge').length
  const drainageCount = features.filter(f => f.type === 'drainage').length
  const benchCount = features.filter(f => f.type === 'bench').length
  const fingerCount = features.filter(f => f.type === 'finger-ridge').length

  const featureParts: string[] = []
  if (saddleCount > 0) featureParts.push(`${saddleCount} saddle points (travel funnels, bugling stations)`)
  if (ridgeCount > 0) featureParts.push(`${ridgeCount} ridgeline sections (travel corridors, wind advantage)`)
  if (drainageCount > 0) featureParts.push(`${drainageCount} drainage bottoms (water, wallows, thick timber at heads)`)
  if (benchCount > 0) featureParts.push(`${benchCount} benches (prime bedding — flat on steep terrain)`)
  if (fingerCount > 0) featureParts.push(`${fingerCount} finger ridges (satellite bull bedding, travel)`)

  const featureSummary = featureParts.length > 0
    ? `Detected terrain features: ${featureParts.join(', ')}.`
    : 'No prominent terrain features detected in this area.'

  // ── Elk habitat notes based on real data ──
  const elkNotes: string[] = []
  const elevAvgM = elevGrid.avgElevation
  const elevMinM = elevGrid.minElevation
  const elevMaxM = elevGrid.maxElevation
  const reliefM = elevMaxM - elevMinM

  // Elevation band assessment
  if (elevAvgM >= 2400 && elevAvgM <= 3200) {
    elkNotes.push(`PRIME ELK ELEVATION (${mToFt(elevAvgM)}ft avg). Rut and post-rut core habitat. Expect resident herds Sep-Nov. Bulls descend from bachelor summer range above to find cow herds in this band.`)
  } else if (elevAvgM >= 2000 && elevAvgM < 2400) {
    elkNotes.push(`TRANSITION/WINTER RANGE ELEVATION (${mToFt(elevAvgM)}ft avg). Late-season concentration zone. As snowpack builds above, elk migrate down to this band. Expect large herds Nov-Dec. Check for south-facing feeding meadows and wind-sheltered bedding.`)
  } else if (elevAvgM >= 1600 && elevAvgM < 2000) {
    elkNotes.push(`LOW ELEVATION WINTER RANGE (${mToFt(elevAvgM)}ft avg). Deep-winter elk concentration. May see ponderosa pine, juniper, oak brush, or sagebrush with scattered timber. Elk adapt to available cover. Best Dec-Jan.`)
  } else if (elevAvgM > 3200) {
    elkNotes.push(`HIGH ELEVATION (${mToFt(elevAvgM)}ft avg). Alpine/subalpine zone. Bachelor bulls summer here but descend for rut. Limited bedding value. Check for saddles and migration corridors connecting to lower elk zones.`)
  }

  // Relief assessment
  if (reliefM > 300) {
    elkNotes.push(`Strong vertical relief (${mToFt(reliefM)}ft). Multiple elevation bands available — elk can adjust bedding and feeding elevation based on conditions without long horizontal travel. Look for benches at 1/3 to 2/3 up slopes.`)
  }

  // Aspect-based seasonal assessment
  if (northPct > 0.30) {
    elkNotes.push(`Significant north-facing terrain (${pct(Math.round(northPct * total), total)}). Rut bedding: N/NE slopes with 60-80% canopy, 10-30° slope, mid-slope benches within 400m of water. Post-rut: darkest N/NE timber, 80%+ canopy, 20-40° slopes, deadfall and thick understory. Bulls go silent, bed in timber you can't see 40 yards into.`)
  }

  if (southPct > 0.30) {
    elkNotes.push(`Significant south-facing terrain (${pct(Math.round(southPct * total), total)}). Late-season bedding: S/SW slopes at 5-20°, south-facing timber edges are THE critical feature (elk feed below, bed above). Solar advantage: 15-25°F warmer than north-facing. Wind-sheltered south slopes with a ridge blocking NW wind are highest-value late-season habitat.`)
  }

  // Feature-based notes
  if (saddleCount > 0) {
    elkNotes.push(`${saddleCount} SADDLE(S) DETECTED. Natural funnels where elk cross between drainages. During rut: bulls bugle from saddles (sound carries both directions). Late season: migration corridor pinch points. Highest-priority ambush terrain across all seasons.`)
  }

  if (benchCount > 0) {
    const nBenches = features.filter(f => f.type === 'bench' && ['N', 'NE', 'NW'].includes(f.aspect)).length
    const sBenches = features.filter(f => f.type === 'bench' && ['S', 'SE', 'SW'].includes(f.aspect)).length
    let benchNote = `${benchCount} BENCH(ES) DETECTED.`
    if (nBenches > 0) benchNote += ` ${nBenches} north-facing (rut/post-rut bedding: thermal cover, steep approach = security).`
    if (sBenches > 0) benchNote += ` ${sBenches} south-facing (late-season bedding: solar warmth, reduced snow).`
    elkNotes.push(benchNote)
  }

  if (drainageCount > 0) {
    elkNotes.push(`${drainageCount} DRAINAGE BOTTOM(S). Water collection points. Rut: wallow potential at drainage heads (flat boggy areas near springs/seeps in timber). Post-rut: drainage heads where ridges converge hold thickest timber and least human pressure. Elk escape route: downhill into drainage bottoms with thick cover.`)
  }

  if (fingerCount > 0) {
    elkNotes.push(`${fingerCount} FINGER RIDGE(S). Small ridges extending off main ridgelines. Satellite bulls bed on these during rut (100-300m from herd bull, monitoring through scent/sound). Bulls travel along tops for wind advantage.`)
  }

  // OSM land cover notes
  if (landData.meadows.length > 0) {
    elkNotes.push(`${landData.meadows.length} MAPPED MEADOW/GRASSLAND AREAS. Primary feeding zones. Elk rarely venture >100-200m from timber edge during daylight. The transition zone (100-400m band where timber thins to meadow) is the highest-probability encounter zone across all seasons. Hunt this band during first and last 90 minutes of daylight.`)
  }

  if (landData.forests.length > 0) {
    elkNotes.push(`${landData.forests.length} MAPPED FOREST/WOODLAND AREAS. Bedding and security cover. Rut: 60-80% canopy with open understory (bulls need to see satellite bulls). Post-rut: 80%+ canopy, deadfall, dog-hair timber — physically difficult to move through quietly. Late season: variable canopy 40-70%, favoring south-facing stands.`)
  }

  if (landData.streams.length > 0) {
    elkNotes.push(`${landData.streams.length} MAPPED STREAM(S). Rut: critical — elk stay within 400m of water, wallows form near springs/seeps at stream heads. Post-rut: bulls water every 24-48 hours, often at night. Late season: snow replaces open water — stream proximity less important.`)
  }

  if (landData.buildings.length > 0) {
    elkNotes.push(`WARNING: ${landData.buildings.length} buildings in area. Elk learn road systems and trails within days of hunting season opening. Flight distance increases from 100m to 400m+ near human activity. Best habitat is >1 mile from roads with no ATV access.`)
  }

  const elkHabitatNotes = elkNotes.length > 0
    ? elkNotes.join('\n\n')
    : 'No specific elk habitat notes for this elevation/terrain profile.'

  return {
    elevationProfile,
    slopeAnalysis,
    aspectBreakdown,
    detectedFeatures: features,
    featureSummary,
    elkHabitatNotes,
  }
}

/**
 * Build a detailed feature list with coordinates for the GPT prompt.
 */
export function formatFeaturesForPrompt(features: TerrainFeature[], limit = 25): string {
  if (features.length === 0) return ''

  // Prioritize: saddles > benches > finger ridges > ridges > drainages
  const priority: Record<string, number> = {
    saddle: 0, bench: 1, 'finger-ridge': 2, ridge: 3, drainage: 4, 'transition-zone': 5,
  }
  const sorted = [...features].sort((a, b) => (priority[a.type] ?? 9) - (priority[b.type] ?? 9))
  const selected = sorted.slice(0, limit)

  const lines = selected.map(f =>
    `  - ${f.type.toUpperCase()} at ${f.lat.toFixed(5)}, ${f.lng.toFixed(5)} (${mToFt(f.elevation)}ft, ${f.slope}° slope, ${f.aspect}-facing): ${f.description}`
  )

  return `\nDETECTED TERRAIN FEATURES (from real elevation data — use these for precise POI placement):\n${lines.join('\n')}\n`
}

function pct(count: number, total: number): string {
  return total > 0 ? `${Math.round((count / total) * 100)}%` : '0%'
}
