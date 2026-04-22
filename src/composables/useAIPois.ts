import { ref, computed, type ShallowRef } from 'vue'
import type L from 'leaflet'
import type { PointOfInterest } from '@/data/pointsOfInterest'
import { useMapStore } from '@/stores/map'
import type { SelectionBounds } from './useSelectionBox'
import type { TimeOfDay } from '@/data/elkBehavior'
import type { HuntingPressure } from '@/stores/map'

export type AnalyzedArea = SelectionBounds

type ComboKey = `${TimeOfDay}_${HuntingPressure}`

function comboKey(timeOfDay: TimeOfDay, pressure: HuntingPressure): ComboKey {
  return `${timeOfDay}_${pressure}`
}

export function useAIPois(map: ShallowRef<L.Map | null>) {
  const mapStore = useMapStore()

  /** All 9 time×pressure POI sets, keyed like "dawn_low" */
  const allCombos = ref<Record<string, PointOfInterest[]>>({})

  const loading = ref(false)
  const error = ref<string | null>(null)
  const analyzedArea = ref<AnalyzedArea | null>(null)

  /** Whether we have analysis results loaded */
  const hasResults = computed(() => Object.keys(allCombos.value).length > 0)

  /** The active POI set for the current time + pressure selection */
  const pois = computed<PointOfInterest[]>(() => {
    if (!hasResults.value) return []
    const key = comboKey(mapStore.timeOfDay, mapStore.huntingPressure)
    return allCombos.value[key] ?? []
  })

  async function generatePOIs(selectionBounds: SelectionBounds) {
    if (!map.value) return

    loading.value = true
    error.value = null

    try {
      const res = await fetch('/api/generate-pois', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bounds: selectionBounds,
          season: mapStore.season,
          bufferMiles: mapStore.bufferMiles,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Server error: ${res.status}`)
      }

      const data = await res.json()
      const combos: Record<string, PointOfInterest[]> = {}

      for (const [key, rawPois] of Object.entries(data.combos || {})) {
        combos[key] = (rawPois as PointOfInterest[]).map((poi, i) => ({
          ...poi,
          id: `ai-poi-${key}-${Date.now()}-${i}`,
        }))
      }

      allCombos.value = combos
      analyzedArea.value = selectionBounds
      mapStore.lockSeason()
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to generate POIs'
      console.error('AI POI generation failed:', err)
    } finally {
      loading.value = false
    }
  }

  function clearPOIs() {
    allCombos.value = {}
    analyzedArea.value = null
    error.value = null
    mapStore.unlockSeason()
  }

  return {
    pois,
    allCombos,
    hasResults,
    loading,
    error,
    analyzedArea,
    generatePOIs,
    clearPOIs,
  }
}
