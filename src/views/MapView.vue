<script setup lang="ts">
import { ref, computed } from 'vue'
import MapContainer from '@/components/map/MapContainer.vue'
import HoverTooltip from '@/components/map/HoverTooltip.vue'
import InfoPanel from '@/components/map/InfoPanel.vue'
import type { HoverScores } from '@/composables/useHoverInfo'
import { useMapStore, type BaseLayer } from '@/stores/map'

const mapStore = useMapStore()

const baseLayerOptions: { label: string; value: BaseLayer; icon: string }[] = [
  { label: 'Streets', value: 'streets', icon: 'map' },
  { label: 'Satellite', value: 'satellite', icon: 'satellite_alt' },
  { label: 'Outdoors', value: 'outdoors', icon: 'terrain' },
  { label: 'Hybrid', value: 'hybrid', icon: 'layers' },
]

const mapContainerRef = ref<InstanceType<typeof MapContainer> | null>(null)

const hoverScores = computed<HoverScores | null>(() => {
  return mapContainerRef.value?.hoverScores ?? null
})

const measuring = computed(() => mapContainerRef.value?.measureActive ?? false)

const aiLoading = computed(() => mapContainerRef.value?.loading ?? false)
const aiError = computed(() => mapContainerRef.value?.error ?? null)
const hasResults = computed(() => mapContainerRef.value?.hasResults ?? false)
const aiPoisCount = computed(() => mapContainerRef.value?.pois?.length ?? 0)

// Selection box state
const selectionActive = computed(() => mapContainerRef.value?.selection?.isActive ?? false)
const selectionLocked = computed(() => mapContainerRef.value?.selection?.isLocked ?? false)

function startSelection() {
  mapContainerRef.value?.selection?.activate()
}

function analyzeArea() {
  mapContainerRef.value?.analyzeSelection()
}

function resetAll() {
  mapContainerRef.value?.resetAll()
}
</script>

<template>
  <q-page class="map-page">
    <MapContainer ref="mapContainerRef" />
    <HoverTooltip v-if="hoverScores" :scores="hoverScores" />
    <InfoPanel />

    <!-- Analyze controls -->
    <div class="analyze-controls">
      <!-- Step 1: Select Area -->
      <button
        v-if="!selectionActive && !selectionLocked && !hasResults"
        class="map-btn map-btn--primary"
        @click="startSelection"
      >
        <q-icon name="crop_free" size="18px" />
        <span>Select Area</span>
        <q-tooltip class="custom-tooltip">
          Click to start placing a 5 mi × 5 mi analysis box
        </q-tooltip>
      </button>

      <!-- Selecting hint -->
      <div
        v-if="selectionActive && !selectionLocked"
        class="map-chip"
      >
        <q-icon name="ads_click" size="16px" />
        <span>Click the map to place the box</span>
      </div>

      <!-- Step 2: Analyze (after box is placed) -->
      <button
        v-if="selectionLocked && !hasResults"
        class="map-btn map-btn--primary"
        :disabled="aiLoading"
        @click="analyzeArea"
      >
        <q-spinner-dots v-if="aiLoading" color="dark" size="18px" />
        <q-icon v-else name="auto_awesome" size="18px" />
        <span>{{ aiLoading ? 'Analyzing all combos...' : 'Analyze Area' }}</span>
      </button>

      <!-- Reposition button -->
      <button
        v-if="selectionLocked && !hasResults && !aiLoading"
        class="map-btn map-btn--ghost"
        @click="startSelection"
      >
        <q-icon name="near_me" size="16px" />
        <span>Reposition</span>
      </button>

      <!-- Reset (after analysis complete) -->
      <button
        v-if="hasResults"
        class="map-btn map-btn--ghost"
        @click="resetAll"
      >
        <q-icon name="restart_alt" size="16px" />
        <span>New Selection</span>
      </button>
    </div>

    <!-- AI POI count badge -->
    <div v-if="hasResults" class="ai-badge">
      <q-icon name="auto_awesome" size="14px" />
      {{ aiPoisCount }} POIs
      <span class="ai-badge-hint">Change time/pressure to update</span>
    </div>

    <!-- Error notification -->
    <div v-if="aiError" class="ai-error">
      <q-icon name="error" size="18px" />
      <span>{{ aiError }}</span>
    </div>

    <!-- Map tools bar -->
    <div class="map-tools-bar">
      <button
        class="layer-btn"
        :class="{ 'layer-btn--active': measuring }"
        @click="mapContainerRef?.toggleMeasure()"
      >
        <q-icon name="straighten" size="16px" />
        <span class="layer-label">Measure</span>
      </button>
    </div>

    <!-- Base map layer switcher -->
    <div class="base-layer-switcher">
      <button
        v-for="opt in baseLayerOptions"
        :key="opt.value"
        class="layer-btn"
        :class="{ 'layer-btn--active': mapStore.baseLayer === opt.value }"
        @click="mapStore.setBaseLayer(opt.value)"
      >
        <q-icon :name="opt.icon" size="16px" />
        <span class="layer-label">{{ opt.label }}</span>
      </button>
    </div>
  </q-page>
</template>

<style scoped>
.map-page {
  position: relative;
}

.map-page :deep(.map-container) {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

/* ─── Controls ─── */
.analyze-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ─── Map Buttons ─── */
.map-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.map-btn--primary {
  background: #e8c547;
  color: #0a0e14;
  box-shadow: 0 4px 16px rgba(232, 197, 71, 0.2);
}

.map-btn--primary:hover {
  background: #f0d060;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(232, 197, 71, 0.3);
}

.map-btn--primary:disabled {
  opacity: 0.8;
  cursor: wait;
  transform: none;
}

.map-btn--ghost {
  background: rgba(15, 25, 35, 0.85);
  color: #c8d6e5;
  border: 1px solid #1e2d3d;
  backdrop-filter: blur(12px);
}

.map-btn--ghost:hover {
  background: rgba(15, 25, 35, 0.95);
  border-color: #3a4f65;
}

/* ─── Map Chip ─── */
.map-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 18px;
  border-radius: 10px;
  background: #e8c547;
  color: #0a0e14;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 4px 16px rgba(232, 197, 71, 0.2);
  animation: pulse-chip 2s ease-in-out infinite;
}

@keyframes pulse-chip {
  0%, 100% { box-shadow: 0 4px 16px rgba(232, 197, 71, 0.2); }
  50% { box-shadow: 0 4px 24px rgba(232, 197, 71, 0.35); }
}

/* ─── AI Badge ─── */
.ai-badge {
  position: absolute;
  top: 56px;
  right: 12px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  background: rgba(232, 197, 71, 0.12);
  border: 1px solid rgba(232, 197, 71, 0.2);
  color: #e8c547;
  font-size: 12px;
  font-weight: 700;
}

.ai-badge-hint {
  font-weight: 500;
  color: rgba(232, 197, 71, 0.6);
  font-size: 11px;
  margin-left: 4px;
}

/* ─── Error ─── */
.ai-error {
  position: absolute;
  bottom: 60px;
  right: 12px;
  z-index: 1000;
  max-width: 380px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 10px;
  background: rgba(183, 28, 28, 0.9);
  border: 1px solid rgba(244, 67, 54, 0.4);
  color: #fff;
  font-size: 13px;
  line-height: 1.5;
  backdrop-filter: blur(12px);
}

/* ─── Tooltip ─── */
.custom-tooltip {
  background: #111a24;
  color: #c8d6e5;
  border: 1px solid #1e2d3d;
  font-size: 12px;
  border-radius: 8px;
  padding: 8px 12px;
}

/* ─── Map Tools Bar ─── */
.map-tools-bar {
  position: absolute;
  bottom: 12px;
  left: 130px;
  z-index: 1000;
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgba(15, 25, 35, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid #1e2d3d;
  border-radius: 10px;
}

/* ─── Base Layer Switcher ─── */
.base-layer-switcher {
  position: absolute;
  bottom: 12px;
  right: 12px;
  z-index: 1000;
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgba(15, 25, 35, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid #1e2d3d;
  border-radius: 10px;
}

.layer-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: #6b7c8d;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.layer-btn:hover {
  color: #c8d6e5;
  background: rgba(200, 214, 229, 0.06);
}

.layer-btn--active {
  border-color: rgba(232, 197, 71, 0.3);
  background: rgba(232, 197, 71, 0.1);
  color: #e8c547;
}

@media (max-width: 599px) {
  .layer-label {
    display: none;
  }
  .layer-btn {
    padding: 6px 8px;
  }
}
</style>
