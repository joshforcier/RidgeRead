import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { LatLng } from '@/types/map'
import type { Season, TimeOfDay, BehaviorLayer } from '@/data/elkBehavior'
import { behaviorWeights } from '@/data/elkBehavior'

export type BaseLayer = 'street' | 'satellite' | 'topo' | 'terrain'

export const useMapStore = defineStore('map', () => {
  // Map view state — centered on Flat Tops, CO
  const center = ref<LatLng>({ lat: 39.955, lng: -107.14 })
  const zoom = ref(13)
  const baseLayer = ref<BaseLayer>('topo')

  // Elk analysis controls
  const season = ref<Season>('rut')
  const timeOfDay = ref<TimeOfDay>('dawn')
  const activeBehaviors = ref<BehaviorLayer[]>(['feeding', 'water', 'bedding', 'wallows', 'travel'])
  const intensity = ref(0.7) // heatmap opacity 0–1
  const showHeatmap = ref(false)
  const showOverlayZones = ref(true)
  const bufferMiles = ref(0.5) // road/trail/building buffer in miles

  // Derived: current behavior weights for active season + time
  const currentWeights = computed(() => {
    return behaviorWeights[season.value][timeOfDay.value]
  })

  function setView(newCenter: LatLng, newZoom: number) {
    center.value = newCenter
    zoom.value = newZoom
  }

  function setSeason(s: Season) {
    season.value = s
  }

  function setTimeOfDay(t: TimeOfDay) {
    timeOfDay.value = t
  }

  function toggleBehavior(b: BehaviorLayer) {
    const idx = activeBehaviors.value.indexOf(b)
    if (idx >= 0) {
      activeBehaviors.value.splice(idx, 1)
    } else {
      activeBehaviors.value.push(b)
    }
  }

  function setIntensity(val: number) {
    intensity.value = val
  }

  function toggleOverlayZones() {
    showOverlayZones.value = !showOverlayZones.value
  }

  function setBaseLayer(layer: BaseLayer) {
    baseLayer.value = layer
  }

  return {
    center,
    zoom,
    baseLayer,
    season,
    timeOfDay,
    activeBehaviors,
    intensity,
    showHeatmap,
    showOverlayZones,
    bufferMiles,
    currentWeights,
    setView,
    setBaseLayer,
    setSeason,
    setTimeOfDay,
    toggleBehavior,
    setIntensity,
    toggleOverlayZones,
  }
})
