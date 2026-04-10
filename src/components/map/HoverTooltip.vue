<script setup lang="ts">
import type { HoverScores } from '@/composables/useHoverInfo'
import { behaviorColors } from '@/data/elkBehavior'

defineProps<{
  scores: HoverScores
}>()

function pct(val: number): string {
  return (val * 100).toFixed(0)
}
</script>

<template>
  <q-card dark flat class="hover-tooltip">
    <q-card-section class="q-pa-sm">
      <div class="text-mono text-caption text-grey-7 q-mb-xs">
        {{ scores.lat.toFixed(4) }}, {{ scores.lng.toFixed(4) }}
      </div>

      <div v-for="(key, idx) in ['feeding', 'water', 'bedding', 'wallows', 'travel'] as const" :key="key" class="score-row">
        <span class="score-dot" :style="{ background: behaviorColors[key] }"></span>
        <span class="score-label">{{ key.charAt(0).toUpperCase() + key.slice(1) }}</span>
        <span class="score-value text-grey-5">{{ pct(scores[key]) }}%</span>
      </div>

      <q-separator dark class="q-my-xs" />

      <div class="score-row overall-row">
        <span class="score-label text-weight-bold">Overall</span>
        <span class="score-value text-amber text-weight-bold text-body2">{{ pct(scores.overall) }}%</span>
      </div>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.hover-tooltip {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 1000;
  background: rgba(15, 25, 35, 0.92) !important;
  backdrop-filter: blur(8px);
  border: 1px solid #1e2d3d;
  border-radius: 10px;
  min-width: 165px;
  pointer-events: none;
}

.text-mono {
  font-family: monospace;
  font-variant-numeric: tabular-nums;
}

.score-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 1px 0;
  font-size: 12px;
}

.score-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.score-label {
  flex: 1;
}

.score-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
