import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { LatLng } from '@/types/map'
import type { Season, TimeOfDay, BehaviorLayer } from '@/data/elkBehavior'
import { behaviorWeights } from '@/data/elkBehavior'

export type HuntingPressure = 'low' | 'medium' | 'high'

export type BaseLayer = 'streets' | 'satellite' | 'outdoors' | 'hybrid'

export const useMapStore = defineStore('map', () => {
  // Map view state — centered on Flat Tops, CO
  const center = ref<LatLng>({ lat: 39.955, lng: -107.14 })
  const zoom = ref(13)
  const baseLayer = ref<BaseLayer>('outdoors')

  // Elk analysis controls
  const season = ref<Season>('rut')
  const timeOfDay = ref<TimeOfDay>('dawn')
  const activeBehaviors = ref<BehaviorLayer[]>(['feeding', 'water', 'bedding', 'wallows', 'travel', 'security'])
  const intensity = ref(0.7) // heatmap opacity 0–1
  const showHeatmap = ref(false)
  const showOverlayZones = ref(true)
  const bufferMiles = ref(0.5) // road/trail/building buffer in miles
  const huntingPressure = ref<HuntingPressure>('medium')
  const seasonLocked = ref(false)

  // Pressure multipliers: scales security up and feeding/travel down at high pressure
  const pressureModifiers: Record<HuntingPressure, Record<BehaviorLayer, number>> = {
    low:    { feeding: 1.1, water: 1.0, bedding: 0.9, wallows: 1.0, travel: 1.1, security: 0.5 },
    medium: { feeding: 1.0, water: 1.0, bedding: 1.0, wallows: 1.0, travel: 1.0, security: 1.0 },
    high:   { feeding: 0.7, water: 0.8, bedding: 1.1, wallows: 0.6, travel: 0.6, security: 1.5 },
  }

  // Derived: current behavior weights for active season + time + pressure
  const currentWeights = computed(() => {
    const base = behaviorWeights[season.value][timeOfDay.value]
    const mods = pressureModifiers[huntingPressure.value]
    const result = {} as Record<BehaviorLayer, number>
    for (const key of Object.keys(base) as BehaviorLayer[]) {
      result[key] = Math.min(1, base[key] * mods[key])
    }
    return result
  })

  function setView(newCenter: LatLng, newZoom: number) {
    center.value = newCenter
    zoom.value = newZoom
  }

  function setSeason(s: Season) {
    if (!seasonLocked.value) {
      season.value = s
    }
  }

  function lockSeason() {
    seasonLocked.value = true
  }

  function unlockSeason() {
    seasonLocked.value = false
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

  function setHuntingPressure(p: HuntingPressure) {
    huntingPressure.value = p
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
    huntingPressure,
    seasonLocked,
    currentWeights,
    setView,
    setBaseLayer,
    setSeason,
    setTimeOfDay,
    toggleBehavior,
    setIntensity,
    setHuntingPressure,
    lockSeason,
    unlockSeason,
    toggleOverlayZones,
  }
})
