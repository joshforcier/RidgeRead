import { ref, type ShallowRef } from 'vue'
import L from 'leaflet'

function haversineMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(miles: number): string {
  if (miles < 0.1) {
    return `${Math.round(miles * 5280)} ft`
  }
  return `${miles.toFixed(2)} mi`
}

export function useMeasure(map: ShallowRef<L.Map | null>) {
  const active = ref(false)
  const distance = ref<string | null>(null)

  let pointA: L.LatLng | null = null
  let markerA: L.CircleMarker | null = null
  let markerB: L.CircleMarker | null = null
  let line: L.Polyline | null = null
  let label: L.Marker | null = null
  const layerGroup = L.layerGroup()
  let addedToMap = false

  function clearLayers() {
    layerGroup.clearLayers()
    markerA = null
    markerB = null
    line = null
    label = null
    pointA = null
    distance.value = null
  }

  function ensureLayerGroup() {
    if (map.value && !addedToMap) {
      layerGroup.addTo(map.value)
      addedToMap = true
    }
  }

  const markerStyle = {
    radius: 7,
    color: '#fff',
    fillColor: '#e8c547',
    fillOpacity: 1,
    weight: 2,
  }

  function onClick(e: L.LeafletMouseEvent) {
    if (!map.value) return
    ensureLayerGroup()

    if (!pointA) {
      // First click — place point A
      clearLayers()
      pointA = e.latlng
      markerA = L.circleMarker(e.latlng, markerStyle).addTo(layerGroup)
    } else {
      // Second click — place point B, draw line, show distance
      const pointB = e.latlng
      markerB = L.circleMarker(pointB, markerStyle).addTo(layerGroup)

      line = L.polyline([pointA, pointB], {
        color: '#e8c547',
        weight: 3,
        dashArray: '8 6',
        opacity: 1,
      }).addTo(layerGroup)

      const miles = haversineMiles(pointA.lat, pointA.lng, pointB.lat, pointB.lng)
      const dist = formatDistance(miles)
      distance.value = dist

      // Label at midpoint
      const midLat = (pointA.lat + pointB.lat) / 2
      const midLng = (pointA.lng + pointB.lng) / 2

      const icon = L.divIcon({
        className: 'measure-label',
        iconSize: [0, 0],
        html: `<div style="
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          background: rgba(15, 25, 35, 0.95);
          color: #e8c547;
          font-size: 13px;
          font-weight: 700;
          padding: 5px 12px;
          border-radius: 6px;
          border: 1px solid rgba(232, 197, 71, 0.3);
          white-space: nowrap;
          text-shadow: 0 1px 2px rgba(0,0,0,0.4);
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        ">${dist}</div>`,
      })

      label = L.marker([midLat, midLng], { icon, interactive: false }).addTo(layerGroup)

      // Reset for next measurement
      pointA = null
    }
  }

  function activate() {
    if (!map.value) return
    active.value = true
    clearLayers()
    map.value.getContainer().style.cursor = 'crosshair'
    map.value.on('click', onClick)
  }

  function deactivate() {
    if (!map.value) return
    active.value = false
    map.value.getContainer().style.cursor = ''
    map.value.off('click', onClick)
    clearLayers()
  }

  function toggle() {
    if (active.value) {
      deactivate()
    } else {
      activate()
    }
  }

  return { active, distance, activate, deactivate, toggle }
}
