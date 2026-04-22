import { watch, onUnmounted, type ShallowRef, type Ref } from 'vue'
import L from 'leaflet'
import { useMapStore } from '@/stores/map'
import type { PointOfInterest } from '@/data/pointsOfInterest'
import { behaviorColors, behaviorLabels, type BehaviorLayer } from '@/data/elkBehavior'

interface Zone {
  behavior: BehaviorLayer
  lat: number
  lng: number
  radius: number
  score: number
  name: string
  description: string
  elevationFt?: string
  slope?: number
  aspect?: string
}

/**
 * Builds overlay zones from POIs.
 * Each POI generates a zone for each of its related behaviors,
 * sized and scored by the current season/time weight.
 */
function buildZonesFromPOIs(
  pois: PointOfInterest[],
  activeBehaviors: BehaviorLayer[],
  weights: Record<BehaviorLayer, number>
): Zone[] {
  const zones: Zone[] = []

  for (const poi of pois) {
    for (const behavior of poi.relatedBehaviors) {
      if (!activeBehaviors.includes(behavior)) continue

      const weight = weights[behavior]
      if (weight < 0.05) continue

      // Radius scales with weight — high-activity behaviors get bigger zones
      const baseRadius = getBaseRadius(poi.type)
      const radius = baseRadius * (0.6 + weight * 0.6)

      zones.push({
        behavior,
        lat: poi.lat,
        lng: poi.lng,
        radius,
        score: weight,
        name: poi.name,
        description: poi.description,
        elevationFt: poi.elevationFt,
        slope: poi.slope,
        aspect: poi.aspect,
      })
    }
  }

  return zones
}

/**
 * Base radius (meters) by POI type — bigger features get bigger zones.
 */
function getBaseRadius(type: PointOfInterest['type']): number {
  switch (type) {
    case 'meadow': return 350
    case 'drainage': return 280
    case 'wallow': return 180
    case 'saddle': return 250
    case 'spring': return 200
    default: return 250
  }
}

/**
 * Approximate distance in meters between two lat/lng points.
 */
function approxDistMeters(a: Zone, b: Zone): number {
  const dLat = (a.lat - b.lat) * 111320
  const dLng = (a.lng - b.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180)
  return Math.sqrt(dLat * dLat + dLng * dLng)
}

/**
 * Merge same-behavior zones that overlap into single larger zones.
 * Uses weighted centroid for position and expands radius to cover the group.
 */
function mergeSameBehaviorZones(zones: Zone[]): Zone[] {
  const byBehavior = new Map<BehaviorLayer, Zone[]>()
  for (const z of zones) {
    if (!byBehavior.has(z.behavior)) byBehavior.set(z.behavior, [])
    byBehavior.get(z.behavior)!.push(z)
  }

  const result: Zone[] = []

  for (const [, group] of byBehavior) {
    // Cluster zones whose circles overlap (distance < sum of radii)
    const used = new Set<number>()

    for (let i = 0; i < group.length; i++) {
      if (used.has(i)) continue

      const cluster = [group[i]]
      used.add(i)

      // Expand cluster: find all zones overlapping with any member
      let expanded = true
      while (expanded) {
        expanded = false
        for (let j = 0; j < group.length; j++) {
          if (used.has(j)) continue
          for (const member of cluster) {
            if (approxDistMeters(member, group[j]) < member.radius + group[j].radius) {
              cluster.push(group[j])
              used.add(j)
              expanded = true
              break
            }
          }
        }
      }

      if (cluster.length === 1) {
        result.push(cluster[0])
        continue
      }

      // Merge cluster into one zone: weighted centroid, expanded radius, best score
      const totalScore = cluster.reduce((s, z) => s + z.score, 0)
      const lat = cluster.reduce((s, z) => s + z.lat * z.score, 0) / totalScore
      const lng = cluster.reduce((s, z) => s + z.lng * z.score, 0) / totalScore

      // Radius covers the farthest edge of any member from the centroid
      const maxReach = Math.max(...cluster.map(z => {
        const d = approxDistMeters({ lat, lng } as Zone, z)
        return d + z.radius
      }))

      // Pick the highest-scoring zone for name/description
      const best = cluster.reduce((a, b) => a.score >= b.score ? a : b)

      result.push({
        ...best,
        lat,
        lng,
        radius: maxReach,
        score: Math.max(...cluster.map(z => z.score)),
      })
    }
  }

  return result
}

/**
 * Offset zones of different behaviors that share similar positions
 * so they fan out instead of stacking.
 */
function applyOverlapOffsets(zones: Zone[]): void {
  // Group zones by approximate position (within ~50m)
  const groups = new Map<string, Zone[]>()
  const gridSize = 0.0005 // ~50m

  for (const zone of zones) {
    const key = `${Math.round(zone.lat / gridSize)}_${Math.round(zone.lng / gridSize)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(zone)
  }

  for (const group of groups.values()) {
    if (group.length <= 1) continue

    const minRadius = Math.min(...group.map(z => z.radius))
    const offsetMeters = minRadius * 0.3

    const metersPerDegLat = 111320
    const metersPerDegLng = 111320 * Math.cos((group[0].lat * Math.PI) / 180)

    for (let i = 0; i < group.length; i++) {
      const angle = (2 * Math.PI * i) / group.length - Math.PI / 2
      group[i].lat += (Math.sin(angle) * offsetMeters) / metersPerDegLat
      group[i].lng += (Math.cos(angle) * offsetMeters) / metersPerDegLng
    }
  }
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

export function useOverlayZones(
  map: ShallowRef<L.Map | null>,
  activePois: Ref<PointOfInterest[]>
) {
  const mapStore = useMapStore()
  const layerGroup = L.layerGroup()
  let addedToMap = false

  function renderZone(zone: Zone) {
    const color = behaviorColors[zone.behavior]
    const rgb = hexToRgb(color)
    const label = behaviorLabels[zone.behavior]

    // Outer glow
    L.circle([zone.lat, zone.lng], {
      radius: zone.radius * 1.3,
      color: `rgba(${rgb}, 0.08)`,
      fillColor: `rgba(${rgb}, 0.03)`,
      fillOpacity: 1,
      weight: 0,
      interactive: false,
    }).addTo(layerGroup)

    // Main zone circle
    const circle = L.circle([zone.lat, zone.lng], {
      radius: zone.radius,
      color: `rgba(${rgb}, 0.5)`,
      fillColor: `rgba(${rgb}, 0.1)`,
      fillOpacity: 1,
      weight: 2,
      dashArray: '6 4',
    }).addTo(layerGroup)

    const desc = zone.description

    const terrainLine = zone.elevationFt
      ? `<span style="font-size:10px;color:#e8c547;font-weight:600">${zone.elevationFt}ft · ${zone.slope}° · ${zone.aspect}-facing</span><br/>`
      : ''

    circle.bindTooltip(
      `<strong>${zone.name}</strong><br/>` +
      `<em>${label} Zone — ${(zone.score * 100).toFixed(0)}%</em><br/>` +
      terrainLine +
      `<span style="font-size:11px;color:#8899aa">${desc}</span>`,
      {
        direction: 'auto',
        className: 'poi-tooltip',
      }
    )

    // Floating label (text only, no background dot)
    const icon = L.divIcon({
      className: 'zone-label',
      html: `<div style="
        color: rgba(${rgb}, 0.9);
        font-size: 10px;
        font-weight: 700;
        white-space: nowrap;
        text-shadow: 0 1px 3px rgba(0,0,0,0.7), 0 0px 6px rgba(0,0,0,0.5);
        letter-spacing: 0.3px;
      ">${label.toUpperCase()} ${(zone.score * 100).toFixed(0)}%</div>`,
      iconAnchor: [0, 8],
    })

    L.marker([zone.lat, zone.lng], { icon, interactive: false })
      .addTo(layerGroup)
  }

  function updateZones() {
    if (!map.value) return

    layerGroup.clearLayers()

    if (!mapStore.showOverlayZones) return

    const zones = buildZonesFromPOIs(
      activePois.value,
      mapStore.activeBehaviors,
      mapStore.currentWeights
    )

    const merged = mergeSameBehaviorZones(zones)
    applyOverlapOffsets(merged)

    for (const zone of merged) {
      renderZone(zone)
    }

    if (!addedToMap) {
      layerGroup.addTo(map.value)
      addedToMap = true
    }
  }

  // React to control changes AND POI list changes
  watch(
    () => [
      mapStore.season,
      mapStore.timeOfDay,
      [...mapStore.activeBehaviors],
      mapStore.showOverlayZones,
      activePois.value,
    ],
    () => updateZones(),
    { deep: true }
  )

  watch(
    () => map.value,
    (m) => {
      if (m) updateZones()
    },
    { immediate: true }
  )

  onUnmounted(() => {
    layerGroup.clearLayers()
    if (map.value && addedToMap) {
      map.value.removeLayer(layerGroup)
    }
  })

  return { updateZones }
}
