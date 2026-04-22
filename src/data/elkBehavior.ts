export type Season = 'rut' | 'post-rut' | 'late-season'
export type TimeOfDay = 'dawn' | 'midday' | 'dusk'
export type BehaviorLayer = 'feeding' | 'water' | 'bedding' | 'wallows' | 'travel' | 'security'

export interface BehaviorWeights {
  feeding: number
  water: number
  bedding: number
  wallows: number
  travel: number
  security: number
}

/**
 * Weight multipliers for each behavior by season × time-of-day.
 * Values 0–1. Derived from elk energy economics and breeding behavior:
 *
 * RUT: Breeding overrides energy — bulls vocal, aggressive, covering ground.
 *      Wallows peak. Travel peaks at dawn/dusk along saddles and ridges.
 *      Cows maintain feeding patterns but are herded into timber.
 *
 * POST-RUT: Recovery phase. Bulls depleted (lost 15-20% body weight), go silent,
 *           seek densest cover. Feeding becomes primary driver. Wallows irrelevant.
 *           Movement minimal — bulls may not leave timber at all.
 *
 * LATE SEASON: Energy conservation. Cold + snow push elk downhill to winter range.
 *              Large herds, most predictable daily patterns. Feeding dominates.
 *              Snow replaces water. Wallows dormant. Movement is dawn/dusk between
 *              south-facing feeding meadows and south-facing bedding timber.
 */
export const behaviorWeights: Record<Season, Record<TimeOfDay, BehaviorWeights>> = {
  rut: {
    //                                 feed  water  bed   wallow travel security
    dawn:   { feeding: 0.35, water: 0.50, bedding: 0.15, wallows: 0.75, travel: 0.85, security: 0.40 },
    midday: { feeding: 0.05, water: 0.30, bedding: 0.80, wallows: 0.70, travel: 0.10, security: 0.60 },
    dusk:   { feeding: 0.40, water: 0.55, bedding: 0.10, wallows: 0.80, travel: 0.90, security: 0.35 },
  },
  'post-rut': {
    dawn:   { feeding: 0.65, water: 0.30, bedding: 0.30, wallows: 0.05, travel: 0.35, security: 0.70 },
    midday: { feeding: 0.15, water: 0.15, bedding: 0.95, wallows: 0.02, travel: 0.05, security: 0.90 },
    dusk:   { feeding: 0.75, water: 0.35, bedding: 0.15, wallows: 0.05, travel: 0.40, security: 0.65 },
  },
  'late-season': {
    dawn:   { feeding: 0.90, water: 0.10, bedding: 0.20, wallows: 0.00, travel: 0.45, security: 0.30 },
    midday: { feeding: 0.25, water: 0.05, bedding: 0.85, wallows: 0.00, travel: 0.10, security: 0.55 },
    dusk:   { feeding: 0.90, water: 0.10, bedding: 0.15, wallows: 0.00, travel: 0.50, security: 0.25 },
  },
}

export const seasonLabels: Record<Season, string> = {
  rut: 'Rut',
  'post-rut': 'Post-Rut',
  'late-season': 'Late Season',
}

export const timeLabels: Record<TimeOfDay, string> = {
  dawn: 'Dawn',
  midday: 'Midday',
  dusk: 'Dusk',
}

export const behaviorLabels: Record<BehaviorLayer, string> = {
  feeding: 'Feeding',
  water: 'Water',
  bedding: 'Bedding',
  wallows: 'Wallows',
  travel: 'Travel Corridors',
  security: 'Security',
}

export const behaviorColors: Record<BehaviorLayer, string> = {
  feeding: '#4ade80',
  water: '#60a5fa',
  bedding: '#a78bfa',
  wallows: '#f97316',
  travel: '#facc15',
  security: '#ef4444',
}

/**
 * Tactical notes for each season × time-of-day combo.
 * Sourced from elk habitat research — energy economics, thermal behavior,
 * and terrain-based movement patterns.
 */
export const tacticalNotes: Record<Season, Record<TimeOfDay, string>> = {
  rut: {
    dawn: `Bulls are bugling and herding cows from overnight feeding areas back toward bedding timber. This is peak visibility — bulls move along ridgelines, saddles, and timber edges while pushing cows. Travel follows natural terrain funnels: saddles between drainages, benches connecting meadows to timber, and creek bottom edges. Set up in the transition zone (100-400m band where timber thins to meadow) on the downwind side. Cow calls and location bugles work — bulls are aggressive and may come in hot. Glass saddles and finger ridges.`,

    midday: `Elk are bedded in timber on north/northeast-facing slopes, 1/3 to 2/3 up the slope, in 60-80% canopy cover with open understory. Very little movement. Herd bulls make short loops around bedded cows and visit nearby wallows — flat boggy areas near springs or seeps at the heads of small drainages. Look for fresh dark wallows with torn-up ground and rubbed trees. Satellite bulls bed 100-300m uphill or on adjacent finger ridges, monitoring the herd. Soft cow calls can pull a satellite bull out of cover. Hunt wallows and the timber edges around known bedding benches.`,

    dusk: `Peak activity. Cows drift toward feeding meadows and parks, bulls follow bugling aggressively. Movement reverses the morning pattern — timber edge to meadow along the same corridors. The last 45 minutes of light produce the most dramatic bull activity as they posture on ridgelines and meadow edges. Set up where trails funnel from bedding timber into feeding parks. Key ambush points: saddle crossings, bench edges where elk transition from timber to open, and the downwind fringe of meadows within 100-200m of cover. Elk rarely venture farther from timber than that during daylight.`,
  },
  'post-rut': {
    dawn: `Bulls have gone nearly silent and are physically depleted — they've lost 15-20% of body weight. They fed in small openings within timber during darkness and are back in heavy cover well before first light. You will not see post-rut bulls at dawn in the open. Cow herds may still be visible on meadow edges but move to timber earlier than during the rut. Focus on cow herds to pattern the area — they've returned to predictable feed-to-bed transitions on south/southeast-facing slopes with moderate canopy (50-70%). Still-hunt timber edges at first light, glassing into dark timber bowls and drainage heads.`,

    midday: `Bulls are bedded and virtually immobile in the densest available timber — north/northeast-facing slopes with 80%+ canopy closure, deadfall, and limited visibility (under 40-50 yards). They bed on steep sidehill benches (20-40° slopes) where the approach is noisy. Thermal advantage is everything: morning thermals carry scent uphill, evening thermals carry it downhill, giving bedded bulls scent coverage in both directions. The only midday movement is to water, roughly once every 24-48 hours. Do not push bedded bulls. Glass from a distance, note the location, and plan an evening or morning ambush on their approach routes.`,

    dusk: `Bulls emerge late and cautiously — they often don't leave timber at all, feeding in small openings and shaded parks within the canopy. Cow herds move to larger meadows but enter the open late, often in the last 30 minutes of legal light. The feeding-to-bedding transition zone is still the money spot, but you need to be closer to the timber side. Target drainage heads where multiple ridges converge (thickest timber, least human traffic), steep sidehill benches, and north-facing bowls. Patience kills elk now — sit tight on a known travel route and let them come to you in the final minutes of light.`,
  },
  'late-season': {
    dawn: `Survival mode — elk need calories above all. Large herds (50-200+ animals) feed in open south-facing meadows and slopes starting before first light. They are the most visible and most patternable elk of the year, using the same feeding areas on the same schedule daily. The transition from feeding to bedding is gradual — a 60-90 minute window of slow uphill movement into timber, feeding as they go. Set up on the south-facing timber edge above feeding meadows. Look for tracks and trails in snow funneling toward feed. Wind-sheltered ridges and south-facing transition zones are the highest-value terrain. Cold elk are hungry elk.`,

    midday: `Elk bed on south/southwest-facing timbered slopes (the aspect flips from earlier seasons) at 5-20° slope, seeking solar warmth — south-facing slopes can be 15-25°F warmer than north-facing. They bed on the leeward side of ridges, sheltered from prevailing northwest wind. Snow depth dictates access — elk avoid areas where soft snow exceeds 18-24 inches, preferring windblown ridges, south-facing openings, and under dense canopy where snow is reduced. They may stand, stretch, and rebed, or feed in small openings on warm days. Glass from a distance and plan a stalk using the terrain — approach from the downwind side of the ridge they're bedded below.`,

    dusk: `Second major feeding period. Elk leave bedding cover earlier than other seasons, driven by the need to maximize feeding time before cold nights. They move downhill toward the same feeding areas used that morning — deep creatures of habit in late season. They are fully committed to open feeding areas by last light and continue feeding into darkness. This is the best window of the day. Set up on the south-facing transition zone where bedding timber meets feeding meadows. Migration corridors — narrow valleys, saddles, and ridgelines funneling elk from summer to winter range — can produce exceptional hunting during storms that trigger active migration.`,
  },
}
