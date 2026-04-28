<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    lat: number
    lng: number
    /** Number of decimal places to display. 5 ≈ 1.1m precision, 6 ≈ 0.1m. */
    precision?: number
  }>(),
  { precision: 5 },
)

const copied = ref(false)

function fmt(n: number): string {
  return n.toFixed(props.precision)
}

async function copy() {
  const text = `${fmt(props.lat)}, ${fmt(props.lng)}`
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Fallback for non-secure contexts (older browsers, http on LAN, etc).
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
    } finally {
      document.body.removeChild(ta)
    }
  }
  copied.value = true
  window.setTimeout(() => (copied.value = false), 1400)
}
</script>

<template>
  <button
    type="button"
    class="coord-chip"
    :class="{ 'coord-chip--copied': copied }"
    :title="copied ? 'Copied' : 'Click to copy coordinates'"
    @click.stop="copy"
  >
    <q-icon
      :name="copied ? 'check' : 'content_copy'"
      size="12px"
      class="coord-chip-icon"
    />
    <span class="coord-chip-value">{{ fmt(lat) }}, {{ fmt(lng) }}</span>
    <span v-if="copied" class="coord-chip-toast">Copied</span>
  </button>
</template>

<style scoped>
.coord-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px 5px 7px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0;
  color: #b0bec5;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid #1e2d3d;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
  position: relative;
  white-space: nowrap;
}

.coord-chip:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: #2c4055;
  color: #fff;
}

.coord-chip--copied {
  border-color: rgba(96, 200, 120, 0.5);
  background: rgba(96, 200, 120, 0.1);
  color: #8fdaa3;
}

.coord-chip-icon {
  flex-shrink: 0;
}

.coord-chip-value {
  user-select: all;
}

.coord-chip-toast {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  font-weight: 600;
  font-family: inherit;
  color: #8fdaa3;
  background: rgba(15, 25, 35, 0.95);
  border: 1px solid rgba(96, 200, 120, 0.5);
  padding: 2px 6px;
  border-radius: 4px;
  pointer-events: none;
  animation: coord-chip-fade 1.4s ease;
}

@keyframes coord-chip-fade {
  0% { opacity: 0; transform: translate(-50%, 4px); }
  15% { opacity: 1; transform: translate(-50%, 0); }
  80% { opacity: 1; }
  100% { opacity: 0; }
}
</style>
