/**
 * Convert an imported scout waypoint + its terrain inspection into a
 * `PointOfInterest`-shaped object so the existing POI grading + hex marker
 * rendering can run on it unchanged.
 *
 * The "synthesis" step is deriving plausible `relatedBehaviors` from the
 * detected terrain feature + slope/aspect. This mirrors the heuristics
 * the AI uses but is deterministic from terrain alone.
 */

import type { PointOfInterest } from '@/data/pointsOfInterest'
import type { BehaviorLayer } from '@/data/elkBehavior'

interface InspectionShape {
  point: { lat: number; lng: number; elevation: number; elevationFt: number; slope: number; aspect: string }
  features: Record<'saddle' | 'ridge' | 'drainage' | 'bench' | 'fingerRidge', { detected: boolean; reason: string }>
}

interface DerivedSynthesis {
  behaviors: BehaviorLayer[]
  primaryFeature: 'saddle' | 'bench' | 'finger-ridge' | 'ridge' | 'drainage' | 'meadow' | 'unknown'
  description: string
  whyHere: string
  whyNotElsewhere: string
}

/**
 * Pull the relief magnitudes out of a feature's `reason` string. Detector
 * messages are formatted like "...: 18.3m above, 12.1m below" — we capture
 * those numbers to flag marginal-vs-strong detections in the writeup. This
 * is best-effort; if the regex doesn't match (older/different message
 * format), strength stays null and we skip the marginal caveat.
 */
function reliefFromReason(reason: string): { above: number; below: number } | null {
  const m = reason.match(/(-?\d+(?:\.\d+)?)\s*m\s*above[^,]*,\s*(-?\d+(?:\.\d+)?)\s*m\s*below/i)
  if (!m) return null
  return { above: parseFloat(m[1]), below: parseFloat(m[2]) }
}

export function deriveBehaviors(insp: InspectionShape): DerivedSynthesis {
  const f = insp.features
  const aspect = insp.point.aspect
  const slope = insp.point.slope
  const elevFt = insp.point.elevationFt
  const isNorthish = aspect === 'N' || aspect === 'NE' || aspect === 'NW'
  const isSouthish = aspect === 'S' || aspect === 'SE' || aspect === 'SW'

  // Priority order matches how a hunter would label the spot if forced to
  // pick one tactical type — saddles/benches override ridges, etc.
  if (f.saddle.detected) {
    const r = reliefFromReason(f.saddle.reason)
    const isMarginal = r !== null && (r.above < 12 || r.below < 12)
    const caveat = isMarginal
      ? ' Note: relief is on the lower end (just above the 8m detection threshold), so this is a subtle saddle — useful but lower-traffic than a deeper col.'
      : ''
    return {
      behaviors: ['travel', 'security'],
      primaryFeature: 'saddle',
      description: `Saddle at ${elevFt} ft, ${aspect}-facing. Natural travel funnel between drainages — sound carries both ways across the col.${caveat}`,
      whyHere: `Verified saddle: ${f.saddle.reason}. The col concentrates elk movement at its lowest crossing — they choose this gap rather than scaling the ridge spine. In rut, sound carries down both drainages; in late season, this is a migration funnel.${caveat}`,
      whyNotElsewhere: `Walking up the ridge spine in either direction costs the elevation advantage. Dropping into either drainage abandons the crossing window. Stationing at the saddle holds two scenting directions and ambush angles on both adjacent slopes.`,
    }
  }
  if (f.bench.detected) {
    let behaviors: BehaviorLayer[]
    let aspectNote: string
    if (isNorthish) {
      behaviors = ['bedding', 'security']
      aspectNote = 'North-facing — rut and post-rut bedding cover (60-80% canopy, thermal advantage on morning rises). Bulls bed here when pressured because the steep approach makes silent stalking impossible.'
    } else if (isSouthish) {
      behaviors = ['bedding', 'feeding']
      aspectNote = 'South-facing — late-season thermal bedding (15-25°F warmer than north faces) plus a transition edge to feeding ground. Prime for Nov-Dec when elk are conserving calories.'
    } else {
      behaviors = ['bedding']
      aspectNote = 'East/west aspect — variable thermal advantage depending on time of day; usable bedding shelf with wind direction matters more than aspect.'
    }
    return {
      behaviors,
      primaryFeature: 'bench',
      description: `Bench at ${elevFt} ft on ${slope.toFixed(0)}° terrain, ${aspect}-facing. ${aspectNote}`,
      whyHere: `Verified mid-slope shelf: ${f.bench.reason}. The combination of gentle slope at the point and steeper surrounding terrain — confirmed by both above and below relief — distinguishes a true bench from a drainage floor or hilltop. ${aspectNote}`,
      whyNotElsewhere: `Above this shelf the slope steepens past comfortable bedding angles; below it, terrain drops toward the drainage with no shelf to hold elk. Adjacent points along the same hillside lack the gentle-on-steep configuration that lets a bull stand up and walk without losing his footing.`,
    }
  }
  if (f.fingerRidge.detected) {
    return {
      behaviors: ['travel', 'security', 'bedding'],
      primaryFeature: 'finger-ridge',
      description: `Finger ridge at ${elevFt} ft, ${aspect}-facing, ${slope.toFixed(0)}°. Satellite bull bedding and travel corridor — wind advantage along the spine in both rut and post-rut.`,
      whyHere: `Sub-ridge confirmed by inspection: ${f.fingerRidge.reason}. Finger ridges extend off the main ridgeline into a drainage; satellite bulls bed here during the rut (typically 100-300m off the herd-bull spine) because the wind comes up either side and they can scent two directions at once. Travel along the top, hunt the head where it joins the main ridge.`,
      whyNotElsewhere: `Stepping off the spine in either direction puts you into the adjacent drainages — slower travel, scent disadvantage, and broken cover. The connection back to the main ridge is the natural funnel; stationing there controls both approaches.`,
    }
  }
  if (f.ridge.detected) {
    return {
      behaviors: ['travel'],
      primaryFeature: 'ridge',
      description: `Ridgeline at ${elevFt} ft, ${aspect}-facing. Travel corridor — bulls use ridges for wind advantage and three-direction scent visibility.`,
      whyHere: `Confirmed ridgetop: ${f.ridge.reason}. Bulls travel along ridges because they monitor scent from both sides and can drop into cover instantly if pressured. The ${aspect} aspect determines which direction they'll prefer to bed off the spine.`,
      whyNotElsewhere: `Side-slopes off the ridge lose wind awareness in two of the four directions; the valley floors below are travel traps when elk are bumped — they get pinned against the next ridge.`,
    }
  }
  if (f.drainage.detected) {
    return {
      behaviors: ['water', 'wallows'],
      primaryFeature: 'drainage',
      description: `Drainage bottom at ${elevFt} ft. Water collects here; wallow potential during rut near springs and seeps; thick timber typical of drainage heads.`,
      whyHere: `Drainage bottom: ${f.drainage.reason}. Water concentrates here; in rut, bulls maintain wallows at drainage heads near springs/seeps for territorial marking. Post-rut and late-season, drainage heads hold the thickest timber and least human pressure.`,
      whyNotElsewhere: `Side hills shed water away from this bottom; ridges are too dry to hold wallows. The drainage-head terrain is where multiple ridges converge — you can't replicate that ridge-convergence security cover by climbing a few hundred meters in any direction.`,
    }
  }
  // No detected feature — fall back to slope/aspect heuristics. These
  // cases are typically the *least* productive waypoints in an import,
  // so we lean honest about the limitations rather than dressing them up.
  if (slope < 8) {
    return {
      behaviors: ['feeding'],
      primaryFeature: 'meadow',
      description: `Open or gently-sloped terrain at ${elevFt} ft (${slope.toFixed(0)}°), ${aspect}-facing. Possible feeding ground IF the canopy is open and forage is present — neither of which the elevation grid can confirm.`,
      whyHere: `Slope of ${slope.toFixed(0)}° is gentle enough for elk to feed and travel without burning calories. South-facing flats are prime late-season feed; north-facing flats hold cover but typically less forage.`,
      whyNotElsewhere: `No saddle, bench, ridge, drainage, or finger-ridge was detected within ~800m — meaning this spot's value rests entirely on factors outside the elevation grid (vegetation, sign, water, your direct observations). Without those, treat this as a low-confidence waypoint.`,
    }
  }
  if (slope > 35) {
    return {
      behaviors: ['security'],
      primaryFeature: 'unknown',
      description: `Steep terrain at ${elevFt} ft (${slope.toFixed(0)}°), ${aspect}-facing. No distinct topographic feature detected.`,
      whyHere: `At ${slope.toFixed(0)}°, this slope is too steep for routine bedding or feeding — elk only enter this kind of terrain as security cover when pressured, or when crossing in transit. No bench, saddle, or finger-ridge breaks the slope here.`,
      whyNotElsewhere: `Without a flat shelf or topographic break, there's no place for an elk to rest comfortably or for a hunter to set up. This is likely a low-value waypoint unless you logged it for a specific reason (a specific trail, sign, or escape-cover observation) the elevation grid can't see.`,
    }
  }
  // Mid-slope (8-35°) but no detected feature — the most ambiguous case.
  return {
    behaviors: [],
    primaryFeature: 'unknown',
    description: `${elevFt} ft, ${aspect}-facing, ${slope.toFixed(0)}° slope. No distinct terrain feature detected within 800m.`,
    whyHere: `The point is on uniform ${slope.toFixed(0)}° hillside — too steep to be a feeding meadow, too gentle to be a security wall, and lacking the relief patterns of a bench, saddle, ridge, drainage, or finger-ridge. Likely a transit slope or undifferentiated cover.`,
    whyNotElsewhere: `Most of the surrounding 800m looks the same in the elevation grid — no nearby topographic hook to make this point stand out. Tactical value (if any) rests on vegetation, sign, or knowledge that the elevation analysis can't capture. Treat this waypoint as low-priority unless you have specific ground intel for it.`,
  }
}

export interface ScoutWaypointForSynthesis {
  id: string
  lat: number
  lng: number
  name: string
  iconHint?: string
  inspection: InspectionShape
}

/**
 * Build a PointOfInterest-shaped object the existing render/grading
 * pipeline can consume. Cast through the structural shape — POI's `type`
 * union doesn't formally include the terrain types we use here, but no
 * runtime code depends on the union being exhaustive.
 */
export function synthesizeScoutPoi(wp: ScoutWaypointForSynthesis): PointOfInterest {
  const { behaviors, primaryFeature, description } = deriveBehaviors(wp.inspection)
  return {
    id: wp.id,
    name: wp.name,
    lat: wp.lat,
    lng: wp.lng,
    type: primaryFeature as PointOfInterest['type'],
    relatedBehaviors: behaviors,
    description,
    elevation: wp.inspection.point.elevation,
    elevationFt: String(Math.round(wp.inspection.point.elevationFt).toLocaleString()),
    slope: wp.inspection.point.slope,
    aspect: wp.inspection.point.aspect,
    reasoningWhyHere: wp.iconHint ? `Imported from GPX (onX category: ${wp.iconHint})` : 'Imported from GPX',
  }
}
