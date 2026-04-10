import { ref, computed, type ShallowRef } from 'vue'
import type L from 'leaflet'
import type { PointOfInterest } from '@/data/pointsOfInterest'
import { useMapStore } from '@/stores/map'
import type { SelectionBounds } from './useSelectionBox'
import type { Season, TimeOfDay } from '@/data/elkBehavior'

export type AnalyzedArea = SelectionBounds

type ComboKey = `${Season}_${TimeOfDay}`

function comboKey(season: Season, timeOfDay: TimeOfDay): ComboKey {
  return `${season}_${timeOfDay}`
}

export function useAIPois(map: ShallowRef<L.Map | null>) {
  const mapStore = useMapStore()

  /** All 9 season×time POI sets, keyed like "rut_dawn" */
  const allCombos = ref<Record<string, PointOfInterest[]>>({})

  const loading = ref(false)
  const error = ref<string | null>(null)
  const analyzedArea = ref<AnalyzedArea | null>(null)

  /** Whether we have analysis results loaded */
  const hasResults = computed(() => Object.keys(allCombos.value).length > 0)

  /** The active POI set for the current season + time selection */
  const pois = computed<PointOfInterest[]>(() => {
    if (!hasResults.value) return []
    const key = comboKey(mapStore.season, mapStore.timeOfDay)
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
