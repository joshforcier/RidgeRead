<script setup lang="ts">
import { computed } from 'vue'
import { useMapStore } from '@/stores/map'
import { liveConditions } from '@/data/inSeason'

const mapStore = useMapStore()
const c = computed(() => mapStore.liveWeather ?? liveConditions)
</script>

<template>
  <div class="is-mapstrip" aria-label="Current conditions">
    <div class="is-mapstrip-section is-mapstrip-mode">
      <span class="is-mapstrip-eyebrow">
        <span class="live-dot" />
        Current Conditions
      </span>
      <span class="is-mapstrip-now">{{ c.timestamp }}</span>
    </div>

    <div class="is-mapstrip-section">
      <span class="is-mapstrip-key">Wind</span>
      <span class="is-mapstrip-val">
        <svg class="windrose" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
          <circle cx="11" cy="11" r="9" fill="none" stroke="currentColor" stroke-opacity="0.3" />
          <text x="11" y="5" text-anchor="middle" font-size="6" fill="currentColor" font-family="JetBrains Mono">N</text>
          <g :transform="`rotate(${c.wind.dirDeg} 11 11)`">
            <path d="M11 4 L13 10 L11 8 L9 10 Z" fill="var(--amber)" />
          </g>
        </svg>
        {{ c.wind.dirName }} {{ c.wind.mph }}<small>mph</small>
      </span>
    </div>

    <div class="is-mapstrip-section">
      <span class="is-mapstrip-key">Temp</span>
      <span class="is-mapstrip-val">
        {{ c.tempF }}<small>°F</small>
        <q-icon name="trending_down" size="14px" class="trend trend--pos" />
      </span>
    </div>

    <div class="is-mapstrip-section is-mapstrip-hide-md">
      <span class="is-mapstrip-key">Pressure</span>
      <span class="is-mapstrip-val">
        {{ c.pressureInHg.toFixed(2) }}
        <q-icon name="trending_down" size="14px" class="trend trend--pos" />
      </span>
    </div>

    <div class="is-mapstrip-section is-mapstrip-hide-md">
      <span class="is-mapstrip-key">Moon</span>
      <span class="is-mapstrip-val">
        <span class="mini-moon">
          <span class="mini-moon-fill" :style="{ width: `${c.moon.illumPct}%` }" />
        </span>
        {{ c.moon.illumPct }}%
      </span>
    </div>

    <div class="is-mapstrip-section is-mapstrip-section--score">
      <span class="is-mapstrip-key">Activity</span>
      <span class="is-mapstrip-score">
        <span class="is-mapstrip-score-num">92</span>
        <span class="is-mapstrip-score-label">Prime</span>
      </span>
    </div>

    <div class="is-mapstrip-section is-mapstrip-section--last is-mapstrip-hide-lg">
      <span class="is-mapstrip-key">Re-grade bias</span>
      <span class="is-mapstrip-bias">
        <span class="is-mapstrip-bias-pos">+7</span>
        <span class="is-mapstrip-bias-bar">
          <span class="is-mapstrip-bias-fill" />
        </span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.is-mapstrip {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 1002;
  min-height: 52px;
  display: grid;
  grid-template-columns: minmax(170px, 1.2fr) repeat(5, minmax(96px, 1fr)) minmax(150px, 1.1fr);
  overflow: hidden;
  background: rgba(10, 14, 20, 0.9);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(26, 39, 53, 0.95);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}

.is-mapstrip-section {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding: 8px 12px;
  border-right: 1px solid var(--bd-0, #1a2735);
}

.is-mapstrip-section--last {
  border-right: none;
}

.is-mapstrip-mode {
  background: linear-gradient(90deg, rgba(74, 222, 128, 0.07), rgba(232, 197, 71, 0.04));
}

.is-mapstrip-eyebrow,
.is-mapstrip-key {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 8.5px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--fg-3, #556676);
  white-space: nowrap;
}

.is-mapstrip-eyebrow {
  color: var(--amber, #e8c547);
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 8px rgba(74, 222, 128, 0.7);
  animation: live-pulse 1.6s ease-in-out infinite;
}

.is-mapstrip-now,
.is-mapstrip-val {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--fg-0, #e7eef5);
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}

.is-mapstrip-val small {
  color: var(--fg-2, #8a9cad);
  font-size: 10px;
  font-weight: 700;
}

.windrose {
  color: var(--fg-2, #8a9cad);
  flex: 0 0 auto;
}

.trend--pos {
  color: #4ade80;
}

.mini-moon {
  position: relative;
  width: 12px;
  height: 12px;
  overflow: hidden;
  border-radius: 50%;
  background: #1a2330;
  border: 1px solid #25374a;
}

.mini-moon-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  background: #f4ecd5;
}

.is-mapstrip-score {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}

.is-mapstrip-score-num {
  color: #4ade80;
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 23px;
  font-weight: 800;
  line-height: 1;
  text-shadow: 0 0 12px rgba(74, 222, 128, 0.3);
}

.is-mapstrip-score-label {
  color: var(--fg-0, #e7eef5);
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.is-mapstrip-bias {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}

.is-mapstrip-bias-pos {
  color: #4ade80;
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 14px;
  font-weight: 800;
}

.is-mapstrip-bias-bar {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: #1a2735;
}

.is-mapstrip-bias-fill {
  display: block;
  width: 64%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #4ade80, #e8c547);
}

@keyframes live-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@media (max-width: 1180px) {
  .is-mapstrip {
    grid-template-columns: minmax(165px, 1.3fr) repeat(5, minmax(88px, 1fr));
  }

  .is-mapstrip-hide-lg {
    display: none;
  }
}

@media (max-width: 860px) {
  .is-mapstrip {
    grid-template-columns: minmax(155px, 1.5fr) repeat(3, minmax(74px, 1fr));
  }

  .is-mapstrip-hide-md {
    display: none;
  }
}

@media (max-width: 599px) {
  .is-mapstrip {
    left: 8px;
    right: 8px;
    top: 8px;
    grid-template-columns: 1fr auto;
  }

  .is-mapstrip-section:not(.is-mapstrip-mode):not(.is-mapstrip-section--score) {
    display: none;
  }

  .is-mapstrip-section {
    padding: 8px 10px;
  }
}
</style>
