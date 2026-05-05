import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { HuntLocation, LatLng } from '@/types/map'
import { tripForecast, type LiveConditions } from '@/data/inSeason'
import type { Season, TimeOfDay, BehaviorLayer } from '@/data/elkBehavior'
import { behaviorWeights } from '@/data/elkBehavior'
import type { PointOfInterest } from '@/data/pointsOfInterest'

export type AppMode = 'scouting' | 'in-season'

export type SidebarTab = 'controls' | 'pois'

export type HuntingPressure = 'low' | 'medium' | 'high' | 'max'

export type BaseLayer = 'streets' | 'satellite' | 'outdoors' | 'hybrid' | 'lidar'

export const useMapStore = defineStore('map', () => {
  // Map view state — centered on Flat Tops, CO
  const center = ref<LatLng>(
    import.meta.env.DEV
      ? { lat: 41.10594, lng: -106.68388 }
      : { lat: 39.955, lng: -107.14 },
  )
  const zoom = ref(13)
  const baseLayer = ref<BaseLayer>('satellite')

  // Elk analysis controls
  const season = ref<Season>('rut')
  const timeOfDay = ref<TimeOfDay>('dawn')
  const activeBehaviors = ref<BehaviorLayer[]>(['feeding', 'water', 'bedding', 'wallows', 'travel', 'security'])
  const intensity = ref(0.7) // heatmap opacity 0–1
  const showHeatmap = ref(false)
  const bufferMiles = ref(0.5) // road/trail/building buffer in miles
  const huntingPressure = ref<HuntingPressure>('medium')
  const appMode = ref<AppMode>('scouting')
  const inSeasonTripStart = ref(tripForecast[0]?.date ?? new Date().toISOString().slice(0, 10))
  const inSeasonTripEnd = ref(tripForecast[4]?.date ?? inSeasonTripStart.value)
  const inSeasonActiveDay = ref(inSeasonTripStart.value)
  const HUNT_LOCATION_KEY = 'ridgeread.huntLocation'
  function loadHuntLocation(): HuntLocation | null {
    try {
      const raw = localStorage.getItem(HUNT_LOCATION_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<HuntLocation>
      if (
        typeof parsed.label !== 'string' ||
        typeof parsed.lat !== 'number' ||
        typeof parsed.lng !== 'number' ||
        !Number.isFinite(parsed.lat) ||
        !Number.isFinite(parsed.lng)
      ) {
        return null
      }
      return {
        label: parsed.label,
        lat: parsed.lat,
        lng: parsed.lng,
        source: parsed.source === 'map-center' || parsed.source === 'map-click' ? parsed.source : 'manual',
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      }
    } catch {
      return null
    }
  }
  const huntLocation = ref<HuntLocation | null>(loadHuntLocation())
  const huntLocationSelecting = ref(false)
  const returnToInSeasonAfterHuntLocation = ref(false)
  const liveWeather = ref<LiveConditions | null>(null)
  const weatherLoading = ref(false)
  const weatherError = ref<string | null>(null)

  // POI presentation state (POI list lives in useAIPois; mirrored here so the
  // sidebar and detail panel can read it without a direct composable dependency)
  const currentPois = ref<PointOfInterest[]>([])
  const pinnedPoiId = ref<string | null>(null)
  const hoveredPoiId = ref<string | null>(null)
  const sidebarTab = ref<SidebarTab>('controls')

  // POIs preserved across "New Selection" so previous analyses stay on the map
  const keptPois = ref<PointOfInterest[]>([])

  // Per-POI deletions, persisted to localStorage so they survive refreshes
  const DELETED_POI_KEY = 'ridgeread.deletedPoiIds'
  function loadDeletedIds(): Set<string> {
    try {
      const raw = localStorage.getItem(DELETED_POI_KEY)
      if (!raw) return new Set()
      const arr = JSON.parse(raw) as unknown
      return Array.isArray(arr) ? new Set(arr.filter((x): x is string => typeof x === 'string')) : new Set()
    } catch {
      return new Set()
    }
  }
  const deletedPoiIds = ref<Set<string>>(loadDeletedIds())
  watch(
    deletedPoiIds,
    (set) => {
      try { localStorage.setItem(DELETED_POI_KEY, JSON.stringify([...set])) } catch { /* ignore */ }
    },
    { deep: true },
  )

  const pinnedPoi = computed<PointOfInterest | null>(() =>
    pinnedPoiId.value
      ? currentPois.value.find((p) => p.id === pinnedPoiId.value) ?? null
      : null,
  )

  // Pressure multipliers: scales security up and feeding/travel down at high pressure
  const pressureModifiers: Record<Exclude<HuntingPressure, 'max'>, Record<BehaviorLayer, number>> = {
    low:    { feeding: 1.1, water: 1.0, bedding: 0.9, wallows: 1.0, travel: 1.1, security: 0.5 },
    medium: { feeding: 1.0, water: 1.0, bedding: 1.0, wallows: 1.0, travel: 1.0, security: 1.0 },
    high:   { feeding: 0.7, water: 0.8, bedding: 1.1, wallows: 0.6, travel: 0.6, security: 1.5 },
  }

  // Derived: current behavior weights for active season + time + pressure
  const currentWeights = computed(() => {
    if (huntingPressure.value === 'max') {
      return { feeding: 0, water: 0, bedding: 0, wallows: 0, travel: 0, security: 1 }
    }
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

  function setBaseLayer(layer: BaseLayer) {
    baseLayer.value = layer
  }

  function setHuntingPressure(p: HuntingPressure) {
    huntingPressure.value = p
  }

  function setAppMode(mode: AppMode) {
    appMode.value = mode
    if (mode === 'in-season' && huntLocationSelecting.value) {
      huntLocationSelecting.value = false
      returnToInSeasonAfterHuntLocation.value = false
    }
  }

  function setInSeasonTripStart(value: string) {
    const next = normalizeDateKey(value, inSeasonTripStart.value)
    inSeasonTripStart.value = next
    if (inSeasonTripEnd.value < next) inSeasonTripEnd.value = next
    inSeasonActiveDay.value = next
  }

  function setInSeasonTripEnd(value: string) {
    const next = normalizeDateKey(value, inSeasonTripEnd.value)
    inSeasonTripEnd.value = next
    if (inSeasonTripStart.value > next) inSeasonTripStart.value = next
    if (inSeasonActiveDay.value < inSeasonTripStart.value) inSeasonActiveDay.value = inSeasonTripStart.value
    if (inSeasonActiveDay.value > inSeasonTripEnd.value) inSeasonActiveDay.value = inSeasonTripEnd.value
  }

  function setInSeasonActiveDay(value: string) {
    const next = normalizeDateKey(value, inSeasonActiveDay.value)
    if (next < inSeasonTripStart.value) {
      inSeasonActiveDay.value = inSeasonTripStart.value
      return
    }
    if (next > inSeasonTripEnd.value) {
      inSeasonActiveDay.value = inSeasonTripEnd.value
      return
    }
    inSeasonActiveDay.value = next
  }

  function normalizeDateKey(value: string, fallback: string): string {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback
  }

  function setHuntLocation(location: HuntLocation) {
    const previous = huntLocation.value
    const changed = !previous || previous.lat !== location.lat || previous.lng !== location.lng || previous.label !== location.label
    huntLocation.value = location
    huntLocationSelecting.value = false
    if (changed) liveWeather.value = null
    weatherError.value = null
    try { localStorage.setItem(HUNT_LOCATION_KEY, JSON.stringify(location)) } catch { /* ignore */ }
    if (returnToInSeasonAfterHuntLocation.value) {
      returnToInSeasonAfterHuntLocation.value = false
      appMode.value = 'in-season'
    }
  }

  function beginHuntLocationSelection(returnToInSeason = false) {
    returnToInSeasonAfterHuntLocation.value = returnToInSeason
    huntLocationSelecting.value = true
    weatherError.value = null
  }

  function cancelHuntLocationSelection() {
    huntLocationSelecting.value = false
    returnToInSeasonAfterHuntLocation.value = false
  }

  function clearHuntLocation() {
    huntLocation.value = null
    huntLocationSelecting.value = false
    liveWeather.value = null
    weatherError.value = null
    try { localStorage.removeItem(HUNT_LOCATION_KEY) } catch { /* ignore */ }
  }

  function setLiveWeather(conditions: LiveConditions | null) {
    liveWeather.value = conditions
    if (conditions) weatherError.value = null
  }

  function setWeatherLoading(value: boolean) {
    weatherLoading.value = value
  }

  function setWeatherError(message: string | null) {
    weatherError.value = message
  }

  function setCurrentPois(pois: PointOfInterest[]) {
    currentPois.value = pois
    if (pinnedPoiId.value && !pois.some((p) => p.id === pinnedPoiId.value)) {
      pinnedPoiId.value = null
    }
  }

  function pinPoi(id: string | null) {
    pinnedPoiId.value = id
  }

  function setHoveredPoi(id: string | null) {
    hoveredPoiId.value = id
  }

  function setSidebarTab(tab: SidebarTab) {
    sidebarTab.value = tab
  }

  function archivePois(pois: PointOfInterest[]) {
    if (pois.length === 0) return
    const existing = new Set(keptPois.value.map((p) => p.id))
    const newOnes = pois.filter((p) => !existing.has(p.id))
    if (newOnes.length === 0) return
    keptPois.value = [...keptPois.value, ...newOnes]
  }

  function clearKeptPois() {
    keptPois.value = []
  }

  function deletePoi(id: string) {
    deletedPoiIds.value = new Set([...deletedPoiIds.value, id])
    if (pinnedPoiId.value === id) pinnedPoiId.value = null
    if (hoveredPoiId.value === id) hoveredPoiId.value = null
  }

  function restorePoi(id: string) {
    if (!deletedPoiIds.value.has(id)) return
    const next = new Set(deletedPoiIds.value)
    next.delete(id)
    deletedPoiIds.value = next
  }

  function clearDeletedPois() {
    deletedPoiIds.value = new Set()
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
    bufferMiles,
    huntingPressure,
    appMode,
    inSeasonTripStart,
    inSeasonTripEnd,
    inSeasonActiveDay,
    huntLocation,
    huntLocationSelecting,
    liveWeather,
    weatherLoading,
    weatherError,
    currentWeights,
    currentPois,
    pinnedPoiId,
    pinnedPoi,
    hoveredPoiId,
    sidebarTab,
    keptPois,
    deletedPoiIds,
    setView,
    setBaseLayer,
    setSeason,
    setTimeOfDay,
    toggleBehavior,
    setIntensity,
    setHuntingPressure,
    setAppMode,
    setInSeasonTripStart,
    setInSeasonTripEnd,
    setInSeasonActiveDay,
    setHuntLocation,
    beginHuntLocationSelection,
    cancelHuntLocationSelection,
    clearHuntLocation,
    setLiveWeather,
    setWeatherLoading,
    setWeatherError,
    setCurrentPois,
    pinPoi,
    setHoveredPoi,
    setSidebarTab,
    archivePois,
    clearKeptPois,
    deletePoi,
    restorePoi,
    clearDeletedPois,
  }
})
