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
    case 'trail-junction': return 220
    default: return 250
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
      color: `rgba(${rgb}, 0.12)`,
      fillColor: `rgba(${rgb}, 0.05)`,
      fillOpacity: 1,
      weight: 0,
      interactive: false,
    }).addTo(layerGroup)

    // Main zone circle
    const circle = L.circle([zone.lat, zone.lng], {
      radius: zone.radius,
      color: `rgba(${rgb}, 0.6)`,
      fillColor: `rgba(${rgb}, 0.15)`,
      fillOpacity: 1,
      weight: 2,
      dashArray: '6 4',
    }).addTo(layerGroup)

    const desc = zone.description.length > 120
      ? zone.description.slice(0, 120) + '...'
      : zone.description

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
        maxWidth: 260,
      }
    )

    // Floating label
    const icon = L.divIcon({
      className: 'zone-label',
      html: `<div style="
        background: rgba(${rgb}, 0.85);
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        white-space: nowrap;
        text-shadow: 0 1px 2px rgba(0,0,0,0.4);
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

    for (const zone of zones) {
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
