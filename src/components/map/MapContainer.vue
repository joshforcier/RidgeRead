<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useMap } from '@/composables/useMap'
import { useHeatmap } from '@/composables/useHeatmap'
import { useHoverInfo } from '@/composables/useHoverInfo'
import { useAIPois } from '@/composables/useAIPois'
import { useOverlayZones } from '@/composables/useOverlayZones'
import { useSelectionBox } from '@/composables/useSelectionBox'
import { useMeasure } from '@/composables/useMeasure'
import { pointsOfInterest as defaultPois } from '@/data/pointsOfInterest'

const mapRef = ref<HTMLElement | null>(null)
const { map } = useMap(mapRef)

const selection = useSelectionBox(map)
const measure = useMeasure(map)
const { pois, hasResults, loading, error, analyzedArea, fromCache, generatePOIs, clearPOIs } = useAIPois(map)

const { terrainCells } = useHeatmap(map, analyzedArea)
const { hoverScores, attach } = useHoverInfo(map, terrainCells)

const activePois = computed(() => {
  return pois.value.length > 0 ? pois.value : defaultPois
})

useOverlayZones(map, activePois)

watch(() => map.value, (m) => { if (m) attach() }, { immediate: true })

async function analyzeSelection() {
  if (!selection.bounds.value) return
  await generatePOIs(selection.bounds.value)
}

function resetAll() {
  clearPOIs()
  selection.clearSelection()
}

const measureActive = computed(() => measure.active.value)

defineExpose({
  map, hoverScores,
  pois, hasResults, loading, error, analyzedArea, fromCache,
  selection,
  measureActive,
  toggleMeasure: () => measure.toggle(),
  analyzeSelection, resetAll,
})
</script>

<template>
  <div ref="mapRef" class="map-container"></div>
</template>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
}
</style>
