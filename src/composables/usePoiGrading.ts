import type { PointOfInterest } from '@/data/pointsOfInterest'
import type { BehaviorLayer, BehaviorWeights } from '@/data/elkBehavior'

export type Grade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | '—'

export interface GradeResult {
  grade: Grade
  score: number
  label: 'Prime' | 'Strong' | 'Solid' | 'Viable' | 'Marginal' | 'Weak' | 'Skip' | 'No signal'
}

export type EnabledLayers = Record<BehaviorLayer, boolean>
export type ConfidenceMap = Partial<Record<BehaviorLayer, number>>

/**
 * Per-POI per-behavior confidence (0–100). Each position in a POI's
 * `relatedBehaviors` array gets a base confidence from its rank, then is
 * modulated (but not dominated) by the current season/time/pressure weight.
 * The base ceiling (92) prevents the "everything is 100%" saturation we'd
 * get by multiplying weights × large position multipliers.
 *
 * Dominance is decided separately by {@link dominantBehavior} using position
 * order, so a POI's hex color/glyph stays consistent across time-of-day.
 */
const POSITION_BASE = [92, 78, 62, 48, 38, 30] as const

export function deriveConfidence(
  poi: PointOfInterest,
  currentWeights: BehaviorWeights,
): ConfidenceMap {
  const conf: ConfidenceMap = {}
  poi.relatedBehaviors.forEach((b, i) => {
    const base = POSITION_BASE[i] ?? 25
    const weight = currentWeights[b] ?? 0 // 0..1
    // 0.65–1.0 modulation of the base: keeps position order intact while
    // letting time-of-day separate prime windows from merely plausible ones.
    const value = base * (0.65 + weight * 0.35)
    conf[b] = Math.min(100, Math.max(0, Math.round(value)))
  })
  return conf
}

/**
 * The POI's primary behavior for display (hex color + glyph). Uses the AI's
 * stated ordering rather than numeric confidence — position 0 is the
 * behavior the terrain was *classified* for; it should stay the same
 * regardless of time-of-day weighting. When the primary is disabled via
 * the sidebar layers, falls back to the next enabled behavior in order.
 */
export function dominantBehavior(
  poi: PointOfInterest,
  _conf: ConfidenceMap,
  enabledLayers: EnabledLayers,
): BehaviorLayer | null {
  for (const b of poi.relatedBehaviors) {
    if (enabledLayers[b]) return b
  }
  return null
}

export function topConfidence(
  poi: PointOfInterest,
  conf: ConfidenceMap,
  enabledLayers: EnabledLayers,
): number {
  const d = dominantBehavior(poi, conf, enabledLayers)
  return d ? conf[d] ?? 0 : 0
}

/**
 * Composite 0–100 grade. The top behavior carries most of the grade because
 * a focused POI can be excellent for one job; secondary overlap adds lift
 * without requiring every good spot to be multi-purpose.
 */
export function gradePoi(
  poi: PointOfInterest,
  conf: ConfidenceMap,
  enabledLayers: EnabledLayers,
): GradeResult {
  const behaviors = poi.relatedBehaviors.filter((b) => enabledLayers[b])
  if (behaviors.length === 0) {
    return { grade: '—', score: 0, label: 'No signal' }
  }

  const sorted = [...behaviors].sort((a, b) => (conf[b] ?? 0) - (conf[a] ?? 0))
  const top = conf[sorted[0]] ?? 0
  const avg =
    behaviors.reduce((s, b) => s + (conf[b] ?? 0), 0) / behaviors.length
  const overlapBonus = Math.min(14, (behaviors.length - 1) * 8)
  const focusBonus = behaviors.length === 1 && top >= 78 ? 4 : 0

  let score = top * 0.78 + avg * 0.12 + overlapBonus + focusBonus
  if (behaviors.length === 1 && top < 55) score -= 8
  score = Math.max(0, Math.min(100, score))
  const rounded = Math.round(score)

  if (rounded >= 91) return { grade: 'A+', score: rounded, label: 'Prime' }
  if (rounded >= 80) return { grade: 'A', score: rounded, label: 'Strong' }
  if (rounded >= 70) return { grade: 'B+', score: rounded, label: 'Solid' }
  if (rounded >= 60) return { grade: 'B', score: rounded, label: 'Viable' }
  if (rounded >= 50) return { grade: 'C+', score: rounded, label: 'Marginal' }
  if (rounded >= 40) return { grade: 'C', score: rounded, label: 'Weak' }
  return { grade: 'D', score: rounded, label: 'Skip' }
}

export function gradeColor(grade: Grade): string {
  if (grade === 'A+' || grade === 'A') return '#4ade80'
  if (grade === 'B+' || grade === 'B') return '#e8c547'
  if (grade === 'C+' || grade === 'C') return '#f97316'
  return '#ef4444'
}
