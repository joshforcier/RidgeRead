import { onMounted, onUnmounted, nextTick, shallowRef, watch, type Ref } from 'vue'
import L from 'leaflet'
import { useMapStore, type BaseLayer } from '@/stores/map'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

interface LayerDef {
  style: string
  opacity?: number
}

const layerDefs: Record<BaseLayer, LayerDef[]> = {
  streets: [{ style: 'mapbox/streets-v12' }],
  satellite: [{ style: 'mapbox/satellite-v9' }],
  outdoors: [{ style: 'mapbox/outdoors-v12' }],
  hybrid: [{ style: 'joshforcier/cmnyygiw9006x01qv8bpg574v' }],
}
function tileUrl(style: string): string {
  return `https://api.mapbox.com/styles/v1/${style}/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`
}

export function useMap(containerRef: Ref<HTMLElement | null>) {
  const map = shallowRef<L.Map | null>(null)
  const mapStore = useMapStore()
  let currentTileLayers: L.TileLayer[] = []

  function applyTileLayer(instance: L.Map, layer: BaseLayer) {
    for (const tl of currentTileLayers) {
      instance.removeLayer(tl)
    }
    currentTileLayers = []

    for (const def of layerDefs[layer]) {
      const tl = L.tileLayer(tileUrl(def.style), {
        tileSize: 512,
        zoomOffset: -1,
        maxZoom: 22,
        opacity: def.opacity ?? 1,
        attribution: '&copy; <a href="https://www.mapbox.com/">Mapbox</a>',
      })
      tl.addTo(instance)
      currentTileLayers.push(tl)
    }
  }

  onMounted(() => {
    if (!containerRef.value) return

    const instance = L.map(containerRef.value, {
      attributionControl: false,
    }).setView(
      [mapStore.center.lat, mapStore.center.lng],
      mapStore.zoom
    )

    applyTileLayer(instance, mapStore.baseLayer)

    L.control.scale({ imperial: true, metric: false, position: 'bottomright' }).addTo(instance)

    instance.on('moveend', () => {
      const center = instance.getCenter()
      mapStore.setView(
        { lat: center.lat, lng: center.lng },
        instance.getZoom()
      )
    })

    map.value = instance

    nextTick(() => {
      instance.invalidateSize()
    })
  })

  watch(
    () => mapStore.baseLayer,
    (layer) => {
      if (map.value) {
        applyTileLayer(map.value, layer)
      }
    }
  )

  onUnmounted(() => {
    if (map.value) {
      map.value.remove()
      map.value = null
    }
  })

  function setView(lat: number, lng: number, zoom: number) {
    map.value?.setView([lat, lng], zoom)
  }

  function invalidateSize() {
    map.value?.invalidateSize()
  }

  return { map, setView, invalidateSize }
}
