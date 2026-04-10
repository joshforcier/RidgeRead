import { ref, onUnmounted, type ShallowRef, type Ref } from 'vue'
import type L from 'leaflet'
import type { TerrainCell } from '@/data/terrainGrid'
import { useMapStore } from '@/stores/map'
import { computeCellScore } from '@/data/terrainGrid'

export interface HoverScores {
  feeding: number
  water: number
  bedding: number
  wallows: number
  travel: number
  overall: number
  lat: number
  lng: number
}

export function useHoverInfo(
  map: ShallowRef<L.Map | null>,
  terrainCells: Ref<TerrainCell[]>
) {
  const mapStore = useMapStore()
  const hoverScores = ref<HoverScores | null>(null)

  function findNearestCell(lat: number, lng: number): TerrainCell | null {
    let closest: TerrainCell | null = null
    let minDist = Infinity
    for (const cell of terrainCells.value) {
      const d = (cell.lat - lat) ** 2 + (cell.lng - lng) ** 2
      if (d < minDist) {
        minDist = d
        closest = cell
      }
    }
    // Dynamic threshold: use grid spacing if available
    const threshold = terrainCells.value.length > 1
      ? ((terrainCells.value[1].lat - terrainCells.value[0].lat) ** 2) * 8
      : 0.002 ** 2 * 4
    return minDist < threshold ? closest : null
  }

  function onMouseMove(e: L.LeafletMouseEvent) {
    const cell = findNearestCell(e.latlng.lat, e.latlng.lng)
    if (!cell) {
      hoverScores.value = null
      return
    }

    const overall = computeCellScore(cell, mapStore.activeBehaviors, mapStore.currentWeights)

    hoverScores.value = {
      feeding: cell.scores.feeding * mapStore.currentWeights.feeding,
      water: cell.scores.water * mapStore.currentWeights.water,
      bedding: cell.scores.bedding * mapStore.currentWeights.bedding,
      wallows: cell.scores.wallows * mapStore.currentWeights.wallows,
      travel: cell.scores.travel * mapStore.currentWeights.travel,
      overall,
      lat: e.latlng.lat,
      lng: e.latlng.lng,
    }
  }

  function onMouseOut() {
    hoverScores.value = null
  }

  let attached = false
  function attach() {
    if (map.value && !attached) {
      map.value.on('mousemove', onMouseMove as L.LeafletEventHandlerFn)
      map.value.on('mouseout', onMouseOut)
      attached = true
    }
  }

  function detach() {
    if (map.value && attached) {
      map.value.off('mousemove', onMouseMove as L.LeafletEventHandlerFn)
      map.value.off('mouseout', onMouseOut)
      attached = false
    }
  }

  onUnmounted(detach)

  return { hoverScores, attach, detach }
}
