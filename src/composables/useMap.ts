import { onMounted, onUnmounted, nextTick, shallowRef, watch, type Ref } from 'vue'
import L from 'leaflet'
import { useMapStore, type BaseLayer } from '@/stores/map'

const tileDefs: Record<BaseLayer, { url: string; attribution: string; maxZoom: number }> = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    maxZoom: 17,
  },
  terrain: {
    url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.jpg',
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://stamen.com/">Stamen Design</a>, &copy; OpenStreetMap contributors',
    maxZoom: 18,
  },
}

export function useMap(containerRef: Ref<HTMLElement | null>) {
  const map = shallowRef<L.Map | null>(null)
  const mapStore = useMapStore()
  let currentTileLayer: L.TileLayer | null = null

  function applyTileLayer(instance: L.Map, layer: BaseLayer) {
    if (currentTileLayer) {
      instance.removeLayer(currentTileLayer)
    }
    const def = tileDefs[layer]
    currentTileLayer = L.tileLayer(def.url, {
      attribution: def.attribution,
      maxZoom: def.maxZoom,
    })
    currentTileLayer.addTo(instance)
  }

  onMounted(() => {
    if (!containerRef.value) return

    const instance = L.map(containerRef.value).setView(
      [mapStore.center.lat, mapStore.center.lng],
      mapStore.zoom
    )

    applyTileLayer(instance, mapStore.baseLayer)

    instance.on('moveend', () => {
      const center = instance.getCenter()
      mapStore.setView(
        { lat: center.lat, lng: center.lng },
        instance.getZoom()
      )
    })

    map.value = instance

    // Quasar's q-page may not have its final dimensions on the first paint.
    // Invalidate size after layout settles so Leaflet + heatmap get correct bounds.
    nextTick(() => {
      instance.invalidateSize()
    })
  })

  // Switch tile layer when the store value changes
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
