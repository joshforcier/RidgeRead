<script setup lang="ts">
import { computed } from 'vue'
import { useMapStore } from '@/stores/map'
import { activityColor, buildTripForecastDays, liveConditions, tripDayMonthShort } from '@/data/inSeason'

const mapStore = useMapStore()
const c = computed(() => mapStore.liveWeather ?? liveConditions)
const tripDays = computed(() => buildTripForecastDays(mapStore.inSeasonTripStart, mapStore.inSeasonTripEnd))

const displayLoc = computed(() => mapStore.huntLocation?.label || c.value.loc)

function modifierDelta(delta: number): string {
  if (delta > 0) return `+${delta}`
  if (delta === 0) return '+/-0'
  return String(delta)
}

function moonPath(age: number) {
  const t = (age % 29.5) / 29.5
  const illum = 1 - Math.abs(0.5 - t) * 2
  const waxing = t < 0.5
  const r = 26
  const cx = 32
  const cy = 32
  const xr = r * (1 - 2 * illum)
  const sweep = waxing ? 1 : 0
  const innerSweep = xr >= 0 ? sweep : waxing ? 0 : 1
  const xrAbs = Math.abs(xr)
  return {
    show: illum > 0.02,
    d: `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${sweep} ${cx} ${cy + r} A ${xrAbs} ${r} 0 0 ${innerSweep} ${cx} ${cy - r} Z`,
  }
}

</script>

<template>
  <div class="inseason-panel">
    <div class="is-live-head">
      <div class="is-live-row">
        <span class="is-live-pulse"><span class="is-live-pulse-dot" /></span>
        <span class="is-live-label">Live Conditions</span>
        <span class="is-live-time">Updated {{ c.updatedAt }}</span>
      </div>
      <div class="is-live-loc">{{ displayLoc }}</div>
    </div>

    <section class="is-section">
      <header class="is-section-head">
        <span class="is-section-num">01</span>
        <span class="is-section-label">Hunt Day</span>
      </header>

      <div class="is-trip-strip" aria-label="Select hunt day">
        <button
          v-for="day in tripDays"
          :key="day.date"
          class="is-trip-day is-trip-day--in"
          :class="{ 'is-trip-day--active': mapStore.inSeasonActiveDay === day.date }"
          :style="{ '--day-color': activityColor(day.activity) }"
          type="button"
          @click="mapStore.setInSeasonActiveDay(day.date)"
        >
          <span class="is-trip-day-dow">{{ day.dow }}</span>
          <span class="is-trip-day-dom">{{ day.dom }}</span>
          <span class="is-trip-day-bar">
            <span class="is-trip-day-fill" :style="{ height: `${day.activity ?? 8}%` }" />
          </span>
          <span class="is-trip-day-grade">{{ day.grade }}</span>
          <span class="is-trip-day-month">{{ tripDayMonthShort(day) }}</span>
        </button>
      </div>
    </section>

    <section class="is-section">
      <header class="is-section-head">
        <span class="is-section-num">02</span>
        <span class="is-section-label">Weather</span>
        <span class="is-impact is-impact--pos">+10 movement</span>
      </header>

      <div class="is-weather-grid">
        <div class="is-tile">
          <div class="is-tile-head">
            <q-icon name="air" size="15px" />
            <span class="is-tile-label">Wind</span>
            <svg class="is-windrose" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
              <circle cx="11" cy="11" r="9" fill="none" stroke="currentColor" stroke-opacity="0.3" />
              <text x="11" y="5" text-anchor="middle" font-size="6" fill="currentColor" font-family="JetBrains Mono">N</text>
              <g :transform="`rotate(${c.wind.dirDeg} 11 11)`">
                <path d="M11 4 L13 10 L11 8 L9 10 Z" fill="var(--amber)" />
              </g>
            </svg>
          </div>
          <div class="is-tile-primary">{{ c.wind.mph }} mph</div>
          <div class="is-tile-sub">{{ c.wind.dirName }} - gust {{ c.wind.gust }}</div>
        </div>

        <div class="is-tile">
          <div class="is-tile-head">
            <q-icon name="device_thermostat" size="15px" />
            <span class="is-tile-label">Temp</span>
          </div>
          <div class="is-tile-primary">{{ c.tempF }}°F</div>
          <div class="is-tile-sub is-tile-sub--pos">
            <q-icon name="trending_down" size="13px" />
            {{ Math.abs(c.tempTrend) }}° / 3h
          </div>
        </div>

        <div class="is-tile">
          <div class="is-tile-head">
            <q-icon name="speed" size="15px" />
            <span class="is-tile-label">Pressure</span>
          </div>
          <div class="is-tile-primary">{{ c.pressureInHg.toFixed(2) }}</div>
          <div class="is-tile-sub is-tile-sub--pos">
            <q-icon name="trending_down" size="13px" />
            {{ Math.abs(c.pressureTrend).toFixed(2) }} / 6h
          </div>
        </div>

        <div class="is-tile">
          <div class="is-tile-head">
            <q-icon name="cloud" size="15px" />
            <span class="is-tile-label">Cover</span>
          </div>
          <div class="is-tile-primary">{{ c.cloudPct }}%</div>
          <div class="is-tile-sub">{{ c.precip.chance }}% precip</div>
        </div>
      </div>
    </section>

    <section class="is-section">
      <header class="is-section-head">
        <span class="is-section-num">03</span>
        <span class="is-section-label">Moon - Solunar</span>
        <span class="is-impact is-impact--neg">-3 midday</span>
      </header>

      <div class="is-moon">
        <svg class="is-moon-glyph" viewBox="0 0 64 64" aria-hidden="true">
          <defs>
            <radialGradient id="inseason-moon-grad" cx="38%" cy="38%" r="62%">
              <stop offset="0%" stop-color="#f4ecd5" />
              <stop offset="60%" stop-color="#d8c89f" />
              <stop offset="100%" stop-color="#9c8b66" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="26" fill="#1a2330" stroke="#25374a" />
          <path v-if="moonPath(c.moon.age).show" :d="moonPath(c.moon.age).d" fill="url(#inseason-moon-grad)" />
          <circle cx="38" cy="28" r="2" fill="#000" fill-opacity="0.08" />
          <circle cx="28" cy="38" r="3" fill="#000" fill-opacity="0.07" />
          <circle cx="34" cy="40" r="1.5" fill="#000" fill-opacity="0.1" />
        </svg>
        <div class="is-moon-body">
          <div class="is-moon-name">{{ c.moon.phaseName }}</div>
          <div class="is-moon-illum">{{ c.moon.illumPct }}% illuminated - day {{ c.moon.age.toFixed(1) }}</div>
          <div class="is-moon-stats">
            <div class="is-moon-stat"><span>Rise</span><strong>{{ c.moon.rise }}</strong></div>
            <div class="is-moon-stat"><span>Set</span><strong>{{ c.moon.set }}</strong></div>
            <div class="is-moon-stat"><span>Overhead</span><strong>{{ c.moon.overhead }}</strong></div>
            <div class="is-moon-stat"><span>Underfoot</span><strong>{{ c.moon.underfoot }}</strong></div>
          </div>
        </div>
      </div>
    </section>

    <section class="is-section">
      <header class="is-section-head">
        <span class="is-section-num">04</span>
        <span class="is-section-label">Live Modifiers</span>
      </header>
      <div class="is-mod-list">
        <div
          v-for="modifier in c.modifiers"
          :key="modifier.label"
          class="is-mod"
          :class="`is-mod--${modifier.kind}`"
        >
          <span class="is-mod-delta">{{ modifierDelta(modifier.delta) }}</span>
          <span class="is-mod-body">
            <span class="is-mod-label">{{ modifier.label }}</span>
            <span class="is-mod-detail">{{ modifier.detail }}</span>
          </span>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
.inseason-panel,
.inseason-panel * {
  box-sizing: border-box;
}

.inseason-panel {
  width: 100%;
  max-width: 100%;
  min-height: 100%;
  overflow-x: hidden;
  padding-right: 10px;
  color: var(--fg-1, #c8d6e5);
  background: var(--bg-0, #07090c);
}

.is-live-head {
  width: 100%;
  min-width: 0;
  padding: 10px 12px 10px 16px;
  background:
    linear-gradient(90deg, rgba(74, 222, 128, 0.06), transparent 60%),
    var(--bg-0, #07090c);
  border-bottom: 1px solid var(--bd-0, #1a2735);
}

.is-live-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.is-live-pulse {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 10px;
  height: 10px;
}

.is-live-pulse::before {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(74, 222, 128, 0.35);
  animation: live-ring 2s ease-out infinite;
}

.is-live-pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 6px rgba(74, 222, 128, 0.8);
  z-index: 1;
}

.is-live-label,
.is-section-label,
.is-section-num,
.is-live-time,
.is-live-loc {
  font-family: var(--mono, 'JetBrains Mono', monospace);
}

.is-live-label {
  min-width: 0;
  overflow: hidden;
  color: #4ade80;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.is-live-time {
  flex: 0 0 auto;
  margin-left: auto;
  color: var(--fg-3, #556676);
  font-size: 9px;
  font-weight: 600;
}

.is-live-loc {
  color: var(--fg-2, #8a9cad);
  font-size: 10px;
  font-weight: 600;
}

.is-section {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  padding: 14px 10px 14px 14px;
  border-bottom: 1px solid var(--bd-0, #1a2735);
}

.is-section-head {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 10px;
}

.is-section-num {
  color: var(--fg-3, #556676);
  font-size: 10px;
  font-weight: 700;
}

.is-section-label {
  min-width: 0;
  overflow: hidden;
  color: #8aaedb;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-impact {
  flex: 0 0 auto;
  margin-left: auto;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.is-impact--pos {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.35);
}

.is-impact--neg {
  color: #f97316;
  background: rgba(249, 115, 22, 0.08);
  border: 1px solid rgba(249, 115, 22, 0.35);
}

.is-location-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--bd-0, #1a2735);
  border-radius: 6px;
  background: var(--bg-1, #0b1118);
}

.is-location-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
}

.is-location-actions--selecting {
  grid-template-columns: minmax(0, 0.7fr) minmax(0, 1fr);
}

.is-location-readout {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 9px;
  border: 1px solid var(--bd-0, #1a2735);
  border-radius: 5px;
  background: var(--bg-2, #0f1922);
}

.is-location-readout--empty {
  color: var(--fg-3, #556676);
}

.is-location-readout-key {
  flex: 0 0 auto;
  color: var(--fg-3, #556676);
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 8.5px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.is-location-readout-value {
  min-width: 0;
  overflow: hidden;
  color: var(--fg-0, #e7eef5);
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 11.5px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-location-btn {
  min-width: 0;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 8px;
  border: 1px solid var(--bd-0, #1a2735);
  border-radius: 5px;
  background: var(--bg-2, #0f1922);
  color: var(--fg-1, #c8d6e5);
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  cursor: pointer;
}

.is-location-btn--ghost {
  color: var(--fg-2, #8a9cad);
}

.is-location-btn--primary {
  border-color: rgba(232, 197, 71, 0.55);
  background: var(--amber, #e8c547);
  color: #080b10;
}

.is-location-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.is-location-status {
  min-width: 0;
  overflow: hidden;
  color: var(--fg-3, #556676);
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.is-location-status--error {
  color: #f97316;
}

.is-trip-range {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.is-trip-range-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}

.is-trip-range-field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  background: var(--bg-2, #0f1922);
  border: 1px solid var(--bd-0, #1a2735);
  border-radius: 6px;
}

.is-trip-range-key {
  color: var(--fg-3, #556676);
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 8.5px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.is-trip-range-field input {
  width: 100%;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--fg-0, #e7eef5);
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 11px;
  font-weight: 800;
}

.is-trip-range-arrow {
  color: var(--fg-3, #556676);
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-weight: 800;
}

.is-trip-strip {
  display: flex;
  gap: 3px;
  margin-bottom: 10px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.is-trip-day {
  flex: 0 0 34px;
  min-width: 34px;
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: 5px 2px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: var(--bg-2, #0f1922);
  color: var(--fg-3, #556676);
  cursor: pointer;
  opacity: 0.42;
}

.is-trip-day--in {
  opacity: 1;
}

.is-trip-day--active {
  border-color: var(--amber, #e8c547);
  background: rgba(232, 197, 71, 0.1);
  box-shadow: 0 0 0 1px rgba(232, 197, 71, 0.12);
}

.is-trip-day:disabled {
  cursor: default;
}

.is-trip-day-dow,
.is-trip-day-dom,
.is-trip-day-month,
.is-trip-day-grade {
  font-family: var(--mono, 'JetBrains Mono', monospace);
  line-height: 1;
}

.is-trip-day-dow {
  font-size: 8px;
  font-weight: 800;
  text-transform: uppercase;
}

.is-trip-day-dom {
  color: var(--fg-1, #c8d6e5);
  font-size: 13px;
  font-weight: 800;
}

.is-trip-day-bar {
  position: relative;
  width: 14px;
  height: 22px;
  overflow: hidden;
  border-radius: 2px;
  background: rgba(200, 214, 229, 0.08);
}

.is-trip-day-fill {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--day-color);
}

.is-trip-day-grade {
  color: var(--day-color);
  font-size: 10px;
  font-weight: 900;
}

.is-trip-day-month {
  color: var(--fg-3, #556676);
  font-size: 7.5px;
  font-weight: 800;
  text-transform: uppercase;
}

.is-dayplan {
  overflow: hidden;
  border: 1px solid var(--bd-0, #1a2735);
  border-left: 3px solid var(--day-color);
  border-radius: 7px;
  background:
    radial-gradient(circle at 0 0, color-mix(in srgb, var(--day-color) 12%, transparent), transparent 42%),
    var(--bg-2, #0f1922);
}

.is-dayplan-head {
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--bd-0, #1a2735);
}

.is-dayplan-date,
.is-dayplan-grade,
.is-dayplan-act {
  display: flex;
  flex-direction: column;
}

.is-dayplan-dow,
.is-dayplan-dom,
.is-dayplan-mo,
.is-dayplan-grade-letter,
.is-dayplan-grade-label,
.is-dayplan-act-num,
.is-dayplan-cell-k,
.is-dayplan-cell-v,
.is-dayplan-plan-k,
.is-dayplan-conf {
  font-family: var(--mono, 'JetBrains Mono', monospace);
}

.is-dayplan-dow,
.is-dayplan-mo {
  color: var(--fg-3, #556676);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.is-dayplan-dom {
  color: var(--fg-0, #e7eef5);
  font-size: 24px;
  font-weight: 900;
  line-height: 0.95;
}

.is-dayplan-grade {
  min-width: 42px;
  align-items: center;
  padding: 4px 8px;
  border: 1px solid var(--day-color);
  border-radius: 4px;
}

.is-dayplan-grade-letter {
  color: var(--day-color);
  font-size: 16px;
  font-weight: 900;
}

.is-dayplan-grade-label {
  color: var(--fg-2, #8a9cad);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.is-dayplan-act {
  align-items: flex-end;
  gap: 5px;
}

.is-dayplan-act-num {
  color: var(--day-color);
  font-size: 24px;
  font-weight: 900;
  line-height: 1;
  text-shadow: 0 0 12px color-mix(in srgb, var(--day-color) 30%, transparent);
}

.is-dayplan-act-bar {
  width: 64px;
  height: 3px;
  overflow: hidden;
  border-radius: 2px;
  background: rgba(200, 214, 229, 0.1);
}

.is-dayplan-act-fill {
  display: block;
  height: 100%;
  background: var(--day-color);
}

.is-dayplan-headline {
  padding: 10px 12px;
  color: var(--fg-0, #e7eef5);
  font-size: 12.5px;
  font-weight: 800;
  border-bottom: 1px solid var(--bd-0, #1a2735);
}

.is-dayplan-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  border-bottom: 1px solid var(--bd-0, #1a2735);
}

.is-dayplan-cell {
  min-width: 0;
  padding: 8px 5px;
  border-right: 1px solid var(--bd-0, #1a2735);
}

.is-dayplan-cell:last-child {
  border-right: none;
}

.is-dayplan-cell-k {
  display: block;
  color: var(--fg-3, #556676);
  font-size: 7.5px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.is-dayplan-cell-v {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  color: var(--fg-0, #e7eef5);
  font-size: 10.5px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-dayplan-cell-v small {
  color: var(--fg-3, #556676);
  font-size: 8px;
}

.is-dayplan-moon-glyph {
  position: relative;
  width: 11px;
  height: 11px;
  overflow: hidden;
  border-radius: 50%;
  background: #1a2330;
  border: 1px solid #25374a;
}

.is-dayplan-moon-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  background: #f4ecd5;
}

.is-dayplan-flags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 9px 12px 0;
}

.is-dayplan-flag {
  padding: 2px 6px;
  border: 1px solid rgba(232, 197, 71, 0.45);
  border-radius: 3px;
  background: rgba(232, 197, 71, 0.06);
  color: var(--amber, #e8c547);
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 9px;
  font-weight: 800;
  text-transform: lowercase;
}

.is-dayplan-plan {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 10px 12px;
}

.is-dayplan-plan-row {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 8px;
}

.is-dayplan-plan-k {
  color: var(--fg-3, #556676);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.is-dayplan-plan-v {
  color: var(--fg-1, #c8d6e5);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.45;
}

.is-dayplan-plan-v--mono {
  font-family: var(--mono, 'JetBrains Mono', monospace);
}

.is-dayplan-plan-v--accent {
  color: var(--amber, #e8c547);
  font-weight: 800;
}

.is-dayplan-conf {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px 11px;
  color: var(--fg-3, #556676);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.is-dayplan-conf strong {
  color: #4ade80;
}

.is-dayplan-conf-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
}

.is-dayplan-conf--med strong,
.is-dayplan-conf--med .is-dayplan-conf-dot {
  color: var(--amber, #e8c547);
  background: var(--amber, #e8c547);
}

.is-dayplan-conf--low strong,
.is-dayplan-conf--low .is-dayplan-conf-dot {
  color: #f97316;
  background: #f97316;
}

.is-dayplan--unavail {
  border-left-color: var(--bd-1, #25374a);
}

.is-dayplan-unavail-body {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 10px;
  padding: 10px 12px 12px;
}

.is-dayplan-unavail-title {
  color: var(--fg-0, #e7eef5);
  font-size: 12px;
  font-weight: 800;
}

.is-dayplan-unavail-sub,
.is-dayplan-unavail-meta {
  color: var(--fg-2, #8a9cad);
  font-size: 11px;
  line-height: 1.4;
}

.is-dayplan-unavail-meta {
  color: var(--fg-3, #556676);
  font-family: var(--mono, 'JetBrains Mono', monospace);
  margin-top: 3px;
}

.is-weather-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 6px;
}

.is-tile {
  min-width: 0;
  min-height: 64px;
  padding: 8px 10px;
  border: 1px solid var(--bd-0, #1a2735);
  border-radius: 6px;
  background: var(--bg-2, #0f1922);
}

.is-tile-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  color: var(--fg-3, #556676);
}

.is-tile-label {
  color: var(--fg-3, #556676);
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.is-windrose {
  margin-left: auto;
  color: var(--fg-2, #8a9cad);
}

.is-tile-primary {
  overflow: hidden;
  color: var(--fg-0, #e7eef5);
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 18px;
  font-weight: 900;
  line-height: 1;
}

.is-tile-sub {
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 5px;
  color: var(--fg-2, #8a9cad);
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 10px;
  font-weight: 600;
}

.is-tile-sub--pos {
  color: #4ade80;
}

.is-moon {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 4px 4px;
}

.is-moon-glyph {
  width: 58px;
  height: 58px;
  flex: 0 0 auto;
}

.is-moon-glyph--sm {
  width: 42px;
  height: 42px;
}

.is-moon-body {
  min-width: 0;
  flex: 1;
}

.is-moon-name {
  min-width: 0;
  overflow: hidden;
  color: var(--fg-0, #e7eef5);
  font-size: 13px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-moon-illum {
  min-width: 0;
  overflow: hidden;
  color: var(--fg-2, #8a9cad);
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-moon-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 8px;
  margin-top: 6px;
}

.is-moon-stat {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.is-moon-stat span {
  color: var(--fg-3, #556676);
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.is-moon-stat strong {
  min-width: 0;
  overflow: hidden;
  color: var(--fg-1, #c8d6e5);
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 10.5px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-mod-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.is-mod {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--bd-0, #1a2735);
  border-left-width: 2px;
  border-radius: 5px;
  background: var(--bg-2, #0f1922);
}

.is-mod--pos {
  border-left-color: #4ade80;
}

.is-mod--neg {
  border-left-color: #f97316;
}

.is-mod--neu {
  border-left-color: var(--bd-1, #25374a);
}

.is-mod-delta {
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 13px;
  font-weight: 900;
}

.is-mod--pos .is-mod-delta {
  color: #4ade80;
}

.is-mod--neg .is-mod-delta {
  color: #f97316;
}

.is-mod--neu .is-mod-delta {
  color: var(--fg-2, #8a9cad);
}

.is-mod-body {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.is-mod-label {
  min-width: 0;
  overflow: hidden;
  color: var(--fg-0, #e7eef5);
  font-size: 11.5px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-mod-detail {
  min-width: 0;
  overflow: hidden;
  color: var(--fg-3, #556676);
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 9.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes live-ring {
  0% {
    opacity: 0.9;
    transform: scale(0.6);
  }
  100% {
    opacity: 0;
    transform: scale(1.8);
  }
}
</style>
