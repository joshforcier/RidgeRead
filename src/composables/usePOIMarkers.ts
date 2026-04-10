import { watch, onUnmounted, type ShallowRef, type Ref } from 'vue'
import L from 'leaflet'
import type { PointOfInterest } from '@/data/pointsOfInterest'
import { poiTypeLabels } from '@/data/pointsOfInterest'

const goldIcon = L.divIcon({
  className: 'poi-marker',
  html: `<div style="
    width: 14px;
    height: 14px;
    background: #e8c547;
    border: 2px solid #0f1923;
    border-radius: 50%;
    box-shadow: 0 0 6px rgba(232, 197, 71, 0.6);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

export function usePOIMarkers(
  map: ShallowRef<L.Map | null>,
  dynamicPois: Ref<PointOfInterest[]>
) {
  const markers: L.Marker[] = []

  function clearMarkers() {
    for (const marker of markers) {
      marker.remove()
    }
    markers.length = 0
  }

  function addMarkers(m: L.Map, pois: PointOfInterest[]) {
    clearMarkers()
    for (const poi of pois) {
      const desc = poi.description.length > 120
        ? poi.description.slice(0, 120) + '...'
        : poi.description

      // Build terrain line from verified data if available
      const terrainLine = poi.elevationFt
        ? `<span style="font-size:10px;color:#e8c547;font-weight:600">${poi.elevationFt}ft · ${poi.slope}° · ${poi.aspect}-facing</span><br/>`
        : ''

      const marker = L.marker([poi.lat, poi.lng], { icon: goldIcon })
        .bindTooltip(
          `<strong>${poi.name}</strong><br/>` +
          `<em>${poiTypeLabels[poi.type] ?? poi.type}</em><br/>` +
          terrainLine +
          `<span style="font-size:11px;color:#8899aa">${desc}</span>`,
          {
            direction: 'auto',
            offset: [0, -10],
            className: 'poi-tooltip',
            maxWidth: 260,
          }
        )
        .addTo(m)
      markers.push(marker)
    }
  }

  // Re-render markers whenever the POI list changes
  watch(
    () => dynamicPois.value,
    (pois) => {
      if (map.value) addMarkers(map.value, pois)
    },
    { deep: true }
  )

  // Also render when map first becomes available
  watch(
    () => map.value,
    (m) => {
      if (m && dynamicPois.value.length > 0) {
        addMarkers(m, dynamicPois.value)
      }
    },
    { immediate: true }
  )

  onUnmounted(clearMarkers)

  return { markers }
}
