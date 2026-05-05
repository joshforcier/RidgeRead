<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMapStore } from '@/stores/map'
import { buildTripForecastDays, liveConditions, tripDayDateLabel } from '@/data/inSeason'
import HuntPlanModal from '@/components/inseason/HuntPlanModal.vue'
import { fetchOpenMeteoCurrentWeather, fetchOpenMeteoTripForecast } from '@/services/weather'
import type { PointOfInterest } from '@/data/pointsOfInterest'
import type { TripForecastDay } from '@/data/inSeason'

const mapStore = useMapStore()
const HUNT_POI_RADIUS_MILES = 20
const c = computed(() => mapStore.liveWeather ?? liveConditions)
const planGenerated = ref(false)
const generatedTripDays = ref<TripForecastDay[] | null>(null)
const baseTripDays = computed(() =>
  buildTripForecastDays(mapStore.inSeasonTripStart, mapStore.inSeasonTripEnd),
)
const selectedTripDays = computed(() => generatedTripDays.value ?? baseTripDays.value)
const displayLoc = computed(() => mapStore.huntLocation?.label || c.value.loc)
const dateRangeLabel = computed(() => {
  const first = selectedTripDays.value[0]
  const last = selectedTripDays.value[selectedTripDays.value.length - 1]
  if (!first || !last) return 'Select dates'
  return `${tripDayDateLabel(first)} - ${tripDayDateLabel(last)}`
})
const readyToGenerate = computed(() => Boolean(mapStore.huntLocation) && !mapStore.weatherLoading)
const poiPool = computed(() => {
  const byId = new Map<string, PointOfInterest>()
  for (const poi of [...mapStore.keptPois, ...mapStore.currentPois]) {
    byId.set(poi.id, poi)
  }
  return [...byId.values()]
})
const huntPlanPois = computed(() => {
  const location = mapStore.huntLocation
  if (!location) return poiPool.value
  return poiPool.value.filter((poi) =>
    distanceMiles(location.lat, location.lng, poi.lat, poi.lng) <= HUNT_POI_RADIUS_MILES,
  )
})

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (degrees: number) => degrees * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function readDateValue(event: Event): string {
  return (event.target as HTMLInputElement).value
}

function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function beginHuntLocationPick() {
  mapStore.setAppMode('scouting')
  mapStore.beginHuntLocationSelection(true)
}

function editTrip() {
  planGenerated.value = false
  generatedTripDays.value = null
}

function resetTrip() {
  const today = new Date()
  planGenerated.value = false
  generatedTripDays.value = null
  mapStore.clearHuntLocation()
  mapStore.setInSeasonTripStart(dateKey(today))
  mapStore.setInSeasonTripEnd(dateKey(addDays(today, 4)))
}

async function generatePlan() {
  const location = mapStore.huntLocation
  if (!location) return
  mapStore.setWeatherLoading(true)
  mapStore.setWeatherError(null)
  try {
    const [weather, tripDays] = await Promise.all([
      fetchOpenMeteoCurrentWeather(location),
      fetchOpenMeteoTripForecast(location, baseTripDays.value),
    ])
    mapStore.setLiveWeather(weather)
    generatedTripDays.value = tripDays
    planGenerated.value = true
  } catch (error) {
    mapStore.setWeatherError(error instanceof Error ? error.message : 'Weather request failed')
  } finally {
    mapStore.setWeatherLoading(false)
  }
}

watch(
  () => [mapStore.huntLocation?.updatedAt, mapStore.inSeasonTripStart, mapStore.inSeasonTripEnd],
  () => {
    planGenerated.value = false
    generatedTripDays.value = null
  },
)
</script>

<template>
  <div class="inseason-plan-page">
    <section v-if="!planGenerated" class="hunt-plan-setup">
      <div class="hunt-plan-setup__head">
        <span class="hunt-plan-setup__eyebrow">In-Season Workflow</span>
        <h1>Generate Hunt Plan</h1>
        <p>Set a hunt location and trip dates, then generate the day-by-day plan.</p>
      </div>

      <div class="hunt-plan-setup__grid">
        <div class="hunt-plan-step" :class="{ 'hunt-plan-step--ready': mapStore.huntLocation }">
          <span class="hunt-plan-step__num">01</span>
          <div>
            <strong>Hunt Location</strong>
            <p>{{ mapStore.huntLocation ? displayLoc : 'No location selected' }}</p>
            <button class="hunt-plan-mini-btn" type="button" @click="beginHuntLocationPick">
              <q-icon name="add_location_alt" size="14px" />
              {{ mapStore.huntLocation ? 'Change Location' : 'Select Location' }}
            </button>
          </div>
        </div>
        <div class="hunt-plan-step hunt-plan-step--ready">
          <span class="hunt-plan-step__num">02</span>
          <div>
            <strong>Trip Dates</strong>
            <p>{{ dateRangeLabel }}</p>
            <div class="hunt-plan-date-fields">
              <label>
                <span>From</span>
                <input type="date" :value="mapStore.inSeasonTripStart" @change="mapStore.setInSeasonTripStart(readDateValue($event))">
              </label>
              <label>
                <span>To</span>
                <input type="date" :value="mapStore.inSeasonTripEnd" @change="mapStore.setInSeasonTripEnd(readDateValue($event))">
              </label>
            </div>
          </div>
        </div>
      </div>

      <div class="hunt-plan-actions">
        <button
          v-if="mapStore.huntLocation"
          class="hunt-plan-action"
          type="button"
          @click="resetTrip"
        >
          <q-icon name="restart_alt" size="16px" />
          Reset Trip
        </button>
        <button
          class="hunt-plan-action hunt-plan-action--primary"
          type="button"
          :disabled="!readyToGenerate"
          @click="generatePlan"
        >
          <q-spinner v-if="mapStore.weatherLoading" size="15px" />
          <q-icon v-else name="description" size="16px" />
          Generate Hunt Plan
        </button>
      </div>
      <p v-if="mapStore.weatherError" class="hunt-plan-error">{{ mapStore.weatherError }}</p>
    </section>

    <section v-else class="hunt-plan-report">
      <div class="hunt-plan-report-tools">
        <div>
          <span>Active Trip</span>
          <strong>{{ dateRangeLabel }} · {{ displayLoc }}</strong>
        </div>
        <button class="hunt-plan-action" type="button" @click="editTrip">
          <q-icon name="edit_calendar" size="16px" />
          Edit Trip
        </button>
        <button class="hunt-plan-action" type="button" @click="resetTrip">
          <q-icon name="restart_alt" size="16px" />
          Reset Trip
        </button>
      </div>

      <HuntPlanModal
        inline
        :days="selectedTripDays"
        :location="displayLoc"
        :pois="huntPlanPois"
      />
    </section>
  </div>
</template>

<style scoped>
.inseason-plan-page {
  min-height: 100%;
  background: #060a0f;
}

.hunt-plan-setup {
  width: min(980px, calc(100% - 44px));
  margin: 22px auto;
  padding: 24px;
  border: 1px solid #1a2735;
  border-radius: 10px;
  background:
    radial-gradient(circle at 12% 0%, rgba(232, 197, 71, 0.12), transparent 32%),
    #0a121a;
  color: #d9e4ef;
}

.hunt-plan-setup__eyebrow,
.hunt-plan-step__num,
.hunt-plan-action {
  font-family: var(--mono, 'JetBrains Mono', monospace);
  text-transform: uppercase;
}

.hunt-plan-setup__eyebrow {
  color: #4ade80;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.hunt-plan-setup h1 {
  margin: 6px 0 8px;
  color: #f5f1e7;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(32px, 4vw, 52px);
  line-height: 1;
}

.hunt-plan-setup p {
  margin: 0;
  color: #8a9cad;
  font-size: 14px;
  line-height: 1.5;
}

.hunt-plan-setup__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 22px;
}

.hunt-plan-step {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  min-width: 0;
  padding: 13px;
  border: 1px solid #25374a;
  border-radius: 8px;
  background: #0f1922;
}

.hunt-plan-step--ready {
  border-color: rgba(74, 222, 128, 0.32);
}

.hunt-plan-step__num {
  color: #64798d;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
}

.hunt-plan-step strong {
  display: block;
  color: #f5f1e7;
  font-size: 13px;
  line-height: 1.2;
}

.hunt-plan-step p {
  overflow: hidden;
  margin-top: 5px;
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 10px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hunt-plan-mini-btn {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 10px;
  padding: 0 10px;
  border: 1px solid rgba(232, 197, 71, 0.4);
  border-radius: 6px;
  background: rgba(232, 197, 71, 0.1);
  color: #e8c547;
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.hunt-plan-date-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.hunt-plan-date-fields label {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 7px 8px;
  border: 1px solid #25374a;
  border-radius: 6px;
  background: #0a121a;
}

.hunt-plan-date-fields span {
  color: #64798d;
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.hunt-plan-date-fields input {
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #f5f1e7;
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 11px;
  font-weight: 800;
}

.hunt-plan-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 18px;
}

.hunt-plan-action {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 14px;
  border: 1px solid #25374a;
  border-radius: 7px;
  background: #0f1922;
  color: #d9e4ef;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.hunt-plan-action--primary {
  border-color: rgba(232, 197, 71, 0.58);
  background: #e8c547;
  color: #07090c;
}

.hunt-plan-error {
  margin: 10px 0 0;
  color: #f97316;
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hunt-plan-action:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.hunt-plan-report {
  min-height: 100%;
}

.hunt-plan-report-tools {
  position: sticky;
  top: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 22px;
  border-bottom: 1px solid #1a2735;
  background: rgba(6, 10, 15, 0.94);
  backdrop-filter: blur(12px);
}

.hunt-plan-report-tools > div {
  min-width: 0;
  margin-right: auto;
}

.hunt-plan-report-tools span,
.hunt-plan-report-tools strong {
  display: block;
  font-family: var(--mono, 'JetBrains Mono', monospace);
  text-transform: uppercase;
}

.hunt-plan-report-tools span {
  color: #64798d;
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.hunt-plan-report-tools strong {
  overflow: hidden;
  margin-top: 2px;
  color: #d9e4ef;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 700px) {
  .hunt-plan-setup {
    width: calc(100% - 20px);
    margin: 10px auto;
    padding: 16px;
  }

  .hunt-plan-setup__grid,
  .hunt-plan-actions,
  .hunt-plan-report-tools {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }

  .hunt-plan-report-tools {
    padding: 10px;
  }

  .inseason-plan-page :deep(.hp-inline-shell) {
    padding: 10px;
  }
}
</style>
