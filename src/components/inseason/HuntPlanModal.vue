<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { activityColor, tripDayDateLabel, tripDayMonthLong, tripDayMonthShort, type TripForecastDay } from '@/data/inSeason'
import { behaviorLabels, type BehaviorLayer } from '@/data/elkBehavior'
import type { PointOfInterest } from '@/data/pointsOfInterest'

interface PoiBriefing {
  poi: PointOfInterest
  rank: number
  score: number
  reason: string
  approach: {
    from: string
    timing: string
    schedule: string
    notes: string
    watch: string
  }
}

interface TimelineWindow {
  start: number
  end: number
  label: string
  kind: 'prime' | 'minor'
}

interface TimelinePoint {
  x: number
  y: number
  value: number
}

interface TimelineModel {
  width: number
  height: number
  pad: number
  path: string
  area: string
  windows: Array<TimelineWindow & { x: number; width: number }>
  highY: number
}

const props = withDefaults(defineProps<{
  modelValue?: boolean
  inline?: boolean
  days: TripForecastDay[]
  location: string
  pois: PointOfInterest[]
}>(), {
  modelValue: false,
  inline: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const shareOpen = ref(false)
const copied = ref(false)
const modalBodyRef = ref<HTMLElement | null>(null)

const open = computed({
  get: () => props.inline || props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const availableDays = computed(() => props.days.filter((day) => day.available))
const bestDay = computed(() => {
  return [...availableDays.value].sort((a, b) => (b.activity ?? 0) - (a.activity ?? 0))[0] ?? props.days[0]
})
const worstDay = computed(() => {
  return [...availableDays.value].sort((a, b) => (a.activity ?? 0) - (b.activity ?? 0))[0] ?? props.days[0]
})
const moonHighDay = computed(() => {
  return props.days.reduce((max, day) => (day.moonIllum ?? 0) > (max.moonIllum ?? 0) ? day : max, props.days[0])
})
const avgActivity = computed(() => {
  const scored = availableDays.value.filter((day) => typeof day.activity === 'number')
  if (scored.length === 0) return 0
  return Math.round(scored.reduce((sum, day) => sum + (day.activity ?? 0), 0) / scored.length)
})
const confidenceLabel = computed(() => {
  if (availableDays.value.some((day) => day.conf === 'low')) return 'Mixed'
  if (availableDays.value.some((day) => day.conf === 'med')) return 'Med'
  return availableDays.value.length > 0 ? 'High' : 'Moon'
})
const dateRangeLabel = computed(() => {
  const first = props.days[0]
  const last = props.days[props.days.length - 1]
  if (!first || !last) return 'Trip dates'
  return `${tripDayDateLabel(first)} - ${tripDayDateLabel(last)}`
})
const shareLink = computed(() => `https://ridgeread.app/plan/${planId.value}`)
const planId = computed(() => {
  const base = `${props.location}-${dateRangeLabel.value}`.replace(/[^a-z0-9]/gi, '').toUpperCase()
  return `${base.slice(0, 4) || 'RR'}-${String(props.days.length).padStart(2, '0')}DAY`
})

watch(open, async (value) => {
  shareOpen.value = false
  copied.value = false
  if (!value) return
  await nextTick()
  modalBodyRef.value?.scrollTo({ top: 0 })
})

function close() {
  open.value = false
}

function scrollToDay(date: string) {
  document.getElementById(`hp-day-${date}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function copyShareLink() {
  copied.value = false
  void navigator.clipboard?.writeText(shareLink.value).then(() => {
    copied.value = true
  }).catch(() => {
    copied.value = false
  })
}

function smsShare() {
  const body = encodeURIComponent(`RidgeRead hunt plan: ${shareLink.value}`)
  window.location.href = `sms:?&body=${body}`
}

function printPlan() {
  document.body.classList.add('hp-printing')
  window.setTimeout(() => {
    window.print()
    window.setTimeout(() => document.body.classList.remove('hp-printing'), 500)
  }, 80)
}

function tripSummaryProse(): string[] {
  const days = props.days
  if (days.length === 0) return []
  const best = bestDay.value
  const worst = worstDay.value
  const moonHi = moonHighDay.value
  const stormDays = days.filter((day) => day.flags.some((flag) => /storm|front|snow/i.test(flag)))

  return [
    `You are looking at ${days.length} days on the unit, ${days[0].dow} the ${days[0].dom} through ${days[days.length - 1].dow} the ${days[days.length - 1].dom}. The window is defined by pressure first and moon second. If the forecast keeps tightening the way it is now, treat the weather shifts as your schedule and let everything else bend around them.`,
    `Your high-leverage day is ${best.dow} the ${best.dom}, with an activity index of ${best.activity ?? 0} and a ${best.label.toLowerCase()} read. The days around it are not throwaways. Use them to confirm sign, learn wind behavior, and protect the spots you will need when the best window opens.`,
    stormDays.length > 0
      ? `Plan for weather on ${stormDays.map((day) => day.dow).join(' and ')}. Wear it, do not fight it. Elk feed harder before a front and reset hard after one; both sides of that pattern are huntable. The middle is where hunters waste legs. The moon peaks at ${moonHi.moonIllum}% on ${moonHi.dow}, so expect compressed daylight movement and quiet middays. Your softest day on paper is ${worst.dow}, and that is a day for discipline, not panic.`
      : `The forecast stays coherent through the trip. No major storm to build around, just pressure movement, wind discipline, and moon timing. The moon peaks at ${moonHi.moonIllum}% on ${moonHi.dow}, so expect short, sharp pushes near daylight and a flatter middle of the day. Your softest day on paper is ${worst.dow}; use it for a slower hunt and a cleaner evening setup.`,
  ]
}

function dayWeatherSentence(day: TripForecastDay): string {
  if (!day.available) {
    return `${day.dow} the ${day.dom} is outside the operational forecast window. The moon read is ${day.moonPhase} at ${day.moonIllum}% illumination, but weather needs to be pulled again inside 48 to 72 hours.`
  }
  const wind = day.wind
  const trend = day.pressureTrend === 'falling' ? 'falling' : day.pressureTrend === 'rising' ? 'rising' : 'steady'
  const gust = wind?.gust ? `, gusting to ${wind.gust}` : ''
  const moonNote = day.moonIllum >= 90
    ? `Bright moon at ${day.moonIllum}% compresses your daylight movement.`
    : `${day.moonIllum}% moon is manageable if you respect the midday lull.`
  return `${day.dow}: highs around ${day.hi}°, lows near ${day.lo}°. Wind out of the ${wind?.dir ?? 'W'} at ${wind?.mph ?? 0} mph${gust}. Pressure is ${trend}${trend === 'falling' ? ', which is the tailwind you want to ride' : trend === 'rising' ? ', so urgency fades after the weather clears' : ', so movement should track the normal windows'}. ${moonNote}`
}

function behaviorNarrative(day: TripForecastDay): string {
  if (!day.available) {
    return 'Without current weather, keep the plan loose. The terrain read still matters, but the final call should wait until live wind, pressure, and precipitation are inside the forecast window.'
  }
  if (day.flags.includes('storm front') || day.flags.includes('all-day movement')) {
    return 'Pre-frontal pressure has elk on edge. They feel the system coming and feed before they have to ride it out. Cows will drift into feed earlier than usual, and bulls should travel with more urgency. This is not a sit-back day. Be where they need to be before the weather tells them to move.'
  }
  if (day.flags.includes('post-storm')) {
    return 'Post-storm reset. Weather pins animals down, and then appetite brings them back onto their feet. Expect a sharper morning than the moon would normally allow, but do not assume it lasts all day. Once they feed and settle, the mountain can go quiet fast.'
  }
  if (day.flags.includes('high wind') || day.flags.includes('snow')) {
    return 'High wind pushes elk into leeward timber and protected bedding. They will avoid exposed parks unless pressure forces them. Glass the sheltered faces, keep your own movement slow, and accept that one clean setup beats five noisy miles.'
  }
  if (day.flags.includes('cool front') || day.flags.includes('falling pressure')) {
    return 'Falling pressure and a cool front should keep elk on their feet longer than a normal bluebird day. Bulls may stay vocal deeper into the morning, and bedded elk can stand earlier in the afternoon. Your job is to be set before they decide to move.'
  }
  if (day.flags.includes('full moon') || day.flags.includes('bright moon')) {
    return 'Bright moon turns the country into a night feeding range. Expect elk to bed early and move briefly in daylight. There are two windows worth hunting hard: first light and last light. The middle is for glassing, resting, and protecting your evening approach.'
  }
  if (day.flags.includes('high pressure')) {
    return 'High pressure flattens the herd. Elk become predictable in a boring way: short movements, long beds, and little urgency. Hunt edges and plan stalks carefully. Do not walk through the timber just because the morning feels slow.'
  }
  return 'Conditions are coherent without a dominant weather driver. Expect the standard rhythm: dawn push, midday lull, dusk pulse. Wind discipline and patience do more for you than extra miles.'
}

function tacticSentence(day: TripForecastDay): string {
  if (day.flags.includes('high wind') || day.flags.includes('snow')) return 'Stay low, glass leeward, and save your legs for the final 90 minutes of light.'
  if (day.flags.includes('storm front')) return 'All-day hunt. Bring more food than you think and stay in the wind, not against it.'
  if (day.flags.includes('post-storm')) return 'Be on feed before first light; quit the morning when the mountain goes quiet.'
  if (day.flags.includes('falling pressure')) return 'Hunt the morning aggressively and keep one evening setup protected.'
  if (day.flags.includes('full moon') || day.flags.includes('bright moon')) return 'Two windows, no middle: first light and last light, in position early for both.'
  if (day.flags.includes('high pressure')) return 'Plan stalks and do not push timber; the wind is the only thing keeping you in the game.'
  return 'Run the standard rotation: meadow edge at dawn, timber discipline midday, travel pinch at dusk.'
}

function behaviorName(layer: BehaviorLayer): string {
  return behaviorLabels[layer] ?? layer
}

function primaryBehavior(poi: PointOfInterest): BehaviorLayer | null {
  return poi.relatedBehaviors[0] ?? null
}

function oppositeDir(direction: string | undefined): string {
  const map: Record<string, string> = {
    N: 'S',
    NE: 'SW',
    E: 'W',
    SE: 'NW',
    S: 'N',
    SW: 'NE',
    W: 'E',
    NW: 'SE',
    WNW: 'ESE',
    NNW: 'SSE',
    ENE: 'WSW',
  }
  return map[direction ?? 'W'] ?? 'opposite'
}

function poiScore(poi: PointOfInterest, day: TripForecastDay): number {
  let score = 68
  const behaviors = poi.relatedBehaviors
  if (day.flags.includes('storm front') && behaviors.includes('feeding')) score += 13
  if (day.flags.includes('falling pressure') && behaviors.includes('feeding')) score += 9
  if (day.flags.includes('high wind') && behaviors.includes('bedding')) score += 14
  if (day.flags.includes('post-storm') && behaviors.includes('travel')) score += 8
  if (day.flags.includes('full moon') && behaviors.includes('bedding')) score += 6
  if (day.bestPoi === poi.name) score += 8
  if (poi.reasoningWhyHere) score += 4
  return Math.min(100, score)
}

function poiReason(poi: PointOfInterest, day: TripForecastDay): string {
  const behavior = primaryBehavior(poi)
  const aspect = poi.aspect ? `${poi.aspect}-facing` : 'terrain-backed'
  const wind = day.wind?.dir ?? 'W'
  if (poi.reasoningWhyHere) return poi.reasoningWhyHere
  if (day.flags.includes('storm front') && behavior === 'feeding') return `Pre-storm feed. With pressure dropping and ${day.cloud ?? 0}% cloud cover, this ${aspect} ${poi.type} should hold elk longer than it normally would.`
  if (day.flags.includes('high wind') && behavior === 'bedding') return `Wind-protected bedding. ${day.wind?.mph ?? 0} mph ${wind} wind should push elk toward calmer timber and sidehill cover like this.`
  if (day.flags.includes('post-storm')) return 'Post-storm corridor. After weather pins elk down, travel routes between feed and cover become valuable for a short morning window.'
  if (day.flags.includes('full moon') && behavior === 'bedding') return 'Bright moon means longer beds. This spot matters because it gives you a daylight target when open feed goes quiet.'
  if (poi.relatedBehaviors.includes('wallows')) return `Wallow or water influence with a workable ${wind} wind. Approach clean and treat it as a last-light play unless sign says otherwise.`
  return `${aspect} ${poi.type} with ${poi.relatedBehaviors.map(behaviorName).join(', ').toLowerCase()} value. The current pattern does not argue against it; it argues for a disciplined setup.`
}

function poiApproach(poi: PointOfInterest, day: TripForecastDay, rank: number): PoiBriefing['approach'] {
  const wind = day.wind?.dir ?? 'W'
  const from = `${oppositeDir(wind)} side`
  const timing = (day.activity ?? 0) >= 70 ? 'In by 05:30' : 'In by 06:00'
  const schedule = rank === 1
    ? day.flags.includes('high wind') ? 'Last 90 minutes of light' : 'Primary morning sit'
    : rank === 2 ? 'Mid-morning reposition or evening sit' : 'Backup if primary blows out'
  return {
    from,
    timing,
    schedule,
    notes: `Wind is ${wind}; approach from the ${from.toLowerCase()} and keep the final 200 yards slow. Glass each opening before stepping into it.`,
    watch: poi.aspect?.includes('S')
      ? 'Thermals may reverse once the slope warms. Be settled before that switch or be willing to back out.'
      : 'Cold air drains early. Stay above the elk when you can and do not let scent fall into the bottom.',
  }
}

function poisForDay(day: TripForecastDay): PoiBriefing[] {
  if (!day.available) return []
  return props.pois
    .map((poi) => ({ poi, score: poiScore(poi, day) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
      reason: poiReason(entry.poi, day),
      approach: poiApproach(entry.poi, day, index + 1),
    }))
}

function timelineWindows(day: TripForecastDay): TimelineWindow[] {
  const windows: TimelineWindow[] = [
    { start: 5, end: 9, label: 'DAWN PUSH', kind: 'prime' },
    { start: 17, end: 20, label: 'DUSK PULSE', kind: 'prime' },
  ]
  if (day.flags.includes('storm front') || day.flags.includes('all-day movement')) {
    windows.splice(1, 0, { start: 9, end: 17, label: 'PRE-FRONT BAND', kind: 'minor' })
  }
  return windows
}

function timelineModel(day: TripForecastDay): TimelineModel {
  const width = 800
  const height = 96
  const pad = 8
  const step = (width - pad * 2) / 23
  const peak = day.activity ?? 70
  const stormy = day.flags.includes('high wind') || day.flags.includes('snow')
  const fullMoon = day.moonIllum >= 90
  const values = Array.from({ length: 24 }, (_, hour) => {
    let value = 20
    const dawnDist = Math.abs(hour - 6.5)
    if (dawnDist < 2.5) value = peak * (1 - dawnDist / 2.5)
    const duskDist = Math.abs(hour - 18.5)
    if (duskDist < 2.5) value = Math.max(value, peak * (1 - duskDist / 2.5))
    if (hour > 10 && hour < 16) value = Math.max(15, fullMoon ? 15 : 30)
    if (stormy && hour > 8 && hour < 16) value = 10
    if (day.flags.includes('storm front') && hour > 8 && hour < 16) value = peak * 0.7
    value += (hour % 3) * 2 - 3
    return Math.max(8, Math.min(100, value))
  })
  const points: TimelinePoint[] = values.map((value, index) => ({
    x: pad + index * step,
    y: pad + (1 - value / 100) * (height - pad * 2),
    value: Math.round(value),
  }))
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
  const area = `${path} L ${points[23].x.toFixed(1)} ${height - pad} L ${points[0].x.toFixed(1)} ${height - pad} Z`
  return {
    width,
    height,
    pad,
    path,
    area,
    highY: pad + (1 - 0.7) * (height - pad * 2),
    windows: timelineWindows(day).map((window) => ({
      ...window,
      x: pad + window.start * step,
      width: (window.end - window.start) * step,
    })),
  }
}
</script>

<template>
  <teleport to="body" :disabled="inline">
    <div
      v-if="open"
      :class="inline ? 'hp-inline-shell' : 'hp-overlay'"
      @click.self="!inline && close()"
    >
      <article
        class="hp-modal"
        :class="{ 'hp-modal--inline': inline }"
        role="dialog"
        :aria-modal="!inline"
      aria-label="Hunt plan"
      >
        <header class="hp-header">
          <div class="hp-header-left">
            <div class="hp-header-eyebrow">
              <span class="hp-header-pulse"><span class="hp-header-pulse-dot" /></span>
              Live plan
            </div>
            <h1>Hunt Plan</h1>
            <div class="hp-header-sub">{{ dateRangeLabel }} - {{ location }}</div>
          </div>

          <div class="hp-header-actions">
            <button class="hp-action" type="button" @click="shareOpen = !shareOpen">
              <q-icon name="ios_share" size="15px" />
              Share
            </button>
            <button class="hp-action" type="button" @click="printPlan">
              <q-icon name="print" size="15px" />
              Print
            </button>
            <button v-if="!inline" class="hp-action hp-action--icon" type="button" aria-label="Close" @click="close">
              <q-icon name="close" size="17px" />
            </button>
          </div>

          <div v-if="shareOpen" class="hp-share">
            <label class="hp-share-row">
              <span>Link</span>
              <input :value="shareLink" readonly>
              <button type="button" @click="copyShareLink">{{ copied ? 'Copied' : 'Copy' }}</button>
            </label>
            <div class="hp-share-row">
              <span>Partner</span>
              <button class="hp-share-sms" type="button" @click="smsShare">Send SMS link</button>
            </div>
            <p>Partner sees live forecast updates, not a static snapshot.</p>
          </div>
        </header>

        <div ref="modalBodyRef" class="hp-body">
          <section class="hp-overview">
            <header class="hp-section-head">
              <span>Part One</span>
              <h2>Trip Overview</h2>
            </header>

            <div class="hp-stat-band">
              <div>
                <span>Duration</span>
                <strong>{{ days.length }}<small>days</small></strong>
              </div>
              <div>
                <span>Avg Activity</span>
                <strong>{{ avgActivity }}</strong>
              </div>
              <div>
                <span>High-Leverage Day</span>
                <strong>{{ bestDay?.dow }}<small>{{ bestDay ? tripDayMonthShort(bestDay) : '' }} {{ bestDay?.dom }}</small></strong>
              </div>
              <div>
                <span>Confidence</span>
                <strong>{{ confidenceLabel }}</strong>
              </div>
            </div>

            <div class="hp-prose hp-prose--drop">
              <p v-for="paragraph in tripSummaryProse()" :key="paragraph">{{ paragraph }}</p>
            </div>

            <div class="hp-glance">
              <div class="hp-glance-title">At A Glance</div>
              <div class="hp-glance-grid" :style="{ gridTemplateColumns: `repeat(${days.length}, minmax(88px, 1fr))` }">
                <button
                  v-for="day in days"
                  :key="day.date"
                  class="hp-glance-day"
                  type="button"
                  @click="scrollToDay(day.date)"
                >
                  <span>{{ day.dow }}</span>
                  <strong>{{ day.dom }}</strong>
                  <i>
                    <b :style="{ height: `${day.activity ?? 0}%`, background: activityColor(day.activity) }" />
                  </i>
                  <em :style="{ color: activityColor(day.activity) }">{{ day.grade }}</em>
                </button>
              </div>
            </div>
          </section>

          <div class="hp-divider">
            <span>Part Two</span>
            <strong>Day-by-Day Briefings</strong>
          </div>

          <section
            v-for="(day, index) in days"
            :id="`hp-day-${day.date}`"
            :key="day.date"
            class="hp-day"
            :style="{ '--day-color': activityColor(day.activity) }"
          >
            <header class="hp-day-head">
              <div class="hp-day-rail" />
              <div>
                <span class="hp-day-eyebrow">Day {{ index + 1 }} of {{ days.length }}</span>
                <h2>{{ day.dow }} - {{ tripDayMonthLong(day) }} {{ day.dom }}</h2>
                <p>{{ day.headline }}</p>
              </div>
              <div class="hp-grade" :style="{ borderColor: activityColor(day.activity), color: activityColor(day.activity) }">
                <strong>{{ day.grade }}</strong>
                <span>{{ day.label }}</span>
              </div>
            </header>

            <div class="hp-block">
              <header><span>A</span><strong>Conditions</strong></header>
              <div v-if="day.available" class="hp-cond-grid">
                <div><span>Hi / Lo</span><strong>{{ day.hi }}° / {{ day.lo }}°</strong></div>
                <div><span>Wind</span><strong>{{ day.wind?.mph }}<small> mph {{ day.wind?.dir }}</small></strong></div>
                <div><span>Pressure</span><strong>{{ day.pressure }}</strong></div>
                <div><span>Precip</span><strong>{{ day.precip }}<small>%</small></strong></div>
                <div><span>Cloud</span><strong>{{ day.cloud }}<small>%</small></strong></div>
                <div><span>Moon</span><strong>{{ day.moonIllum }}<small>%</small></strong></div>
              </div>
              <p class="hp-guide-line">{{ dayWeatherSentence(day) }}</p>
            </div>

            <div v-if="day.available" class="hp-block">
              <header>
                <span>B</span>
                <strong>Hourly Activity</strong>
                <em>Annotated windows</em>
              </header>
              <div class="hp-timeline">
                <svg width="100%" :viewBox="`0 0 ${timelineModel(day).width} ${timelineModel(day).height}`" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient :id="`hp-fill-${day.date}`" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stop-color="#e8c547" stop-opacity="0.45" />
                      <stop offset="100%" stop-color="#e8c547" stop-opacity="0.02" />
                    </linearGradient>
                  </defs>
                  <rect
                    v-for="window in timelineModel(day).windows"
                    :key="window.label"
                    :x="window.x"
                    :y="timelineModel(day).pad"
                    :width="window.width"
                    :height="timelineModel(day).height - timelineModel(day).pad * 2"
                    :fill="window.kind === 'prime' ? 'rgba(74,222,128,0.06)' : 'rgba(232,197,71,0.05)'"
                  />
                  <line
                    :x1="timelineModel(day).pad"
                    :x2="timelineModel(day).width - timelineModel(day).pad"
                    :y1="timelineModel(day).highY"
                    :y2="timelineModel(day).highY"
                    stroke="#25374a"
                    stroke-width="1"
                    stroke-dasharray="2 3"
                  />
                  <path :d="timelineModel(day).area" :fill="`url(#hp-fill-${day.date})`" />
                  <path :d="timelineModel(day).path" fill="none" stroke="#e8c547" stroke-width="1.8" />
                  <text
                    v-for="window in timelineModel(day).windows"
                    :key="`${window.label}-text`"
                    :x="window.x + window.width / 2"
                    :y="timelineModel(day).height - 20"
                    text-anchor="middle"
                    font-size="9"
                    font-family="JetBrains Mono"
                    font-weight="800"
                    :fill="window.kind === 'prime' ? '#4ade80' : '#e8c547'"
                  >
                    {{ window.label }}
                  </text>
                </svg>
                <div class="hp-timeline-axis">
                  <span>12a</span><span>3a</span><span>6a</span><span>9a</span>
                  <span>12p</span><span>3p</span><span>6p</span><span>9p</span>
                </div>
              </div>
            </div>

            <div v-if="day.available" class="hp-block">
              <header><span>C</span><strong>Predicted Behavior</strong></header>
              <p class="hp-guide-line">{{ behaviorNarrative(day) }}</p>
              <blockquote class="hp-tactic">
                <span>Tactic</span>
                {{ tacticSentence(day) }}
              </blockquote>
            </div>

            <div v-if="day.available" class="hp-block">
              <header>
                <span>D</span>
                <strong>Recommended POIs</strong>
                <em>Top 3 for the day</em>
              </header>
              <div v-if="poisForDay(day).length > 0" class="hp-poi-list">
                <article
                  v-for="entry in poisForDay(day)"
                  :key="entry.poi.id"
                  class="hp-poi"
                  :style="{ '--poi-color': activityColor(entry.score) }"
                >
                  <header class="hp-poi-head">
                    <span>{{ entry.rank }}</span>
                    <div>
                      <h3>{{ entry.poi.name }}</h3>
                      <p>
                        {{ entry.poi.elevationFt ?? 'elev TBD' }} -
                        {{ entry.poi.aspect ?? 'aspect TBD' }} -
                        {{ entry.poi.slope != null ? `${entry.poi.slope.toFixed(1)}° slope` : 'slope TBD' }}
                      </p>
                    </div>
                    <strong>{{ entry.score }}</strong>
                  </header>
                  <p class="hp-poi-reason">{{ entry.reason }}</p>
                  <div class="hp-approach">
                    <strong>Approach</strong>
                    <div>
                      <span>From</span><b>{{ entry.approach.from }}</b>
                      <span>Timing</span><b>{{ entry.approach.timing }}</b>
                      <span>Schedule</span><b>{{ entry.approach.schedule }}</b>
                    </div>
                    <p><span>Notes</span>{{ entry.approach.notes }}</p>
                    <p><span>Watch</span>{{ entry.approach.watch }}</p>
                  </div>
                </article>
              </div>
              <p v-else class="hp-empty-pois">Run an area analysis to attach ranked POIs to this memo.</p>
            </div>
          </section>

          <footer class="hp-footer">
            <span>- End of briefing -</span>
            <small>RidgeRead - {{ planId }} - refresh when forecast updates</small>
          </footer>
        </div>
      </article>
    </div>
  </teleport>
</template>

<style scoped>
.hp-overlay {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  justify-content: center;
  padding: 28px;
  overflow: auto;
  background: rgba(4, 7, 11, 0.72);
  backdrop-filter: blur(10px);
}

.hp-inline-shell {
  min-height: 100%;
  padding: 18px 22px 24px;
  overflow: visible;
  background:
    radial-gradient(circle at 14% 0%, rgba(232, 197, 71, 0.08), transparent 30%),
    radial-gradient(circle at 82% 14%, rgba(74, 222, 128, 0.06), transparent 34%),
    #060a0f;
}

.hp-modal {
  position: relative;
  width: min(1180px, 100%);
  max-height: calc(100vh - 56px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(38, 55, 72, 0.95);
  border-radius: 10px;
  background: #071017;
  color: #d9e4ef;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.5);
}

.hp-modal--inline {
  width: 100%;
  max-height: none;
  overflow: visible;
  box-shadow: none;
}

.hp-modal--inline .hp-body {
  overflow: visible;
}

.hp-header {
  position: sticky;
  top: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 22px;
  border-bottom: 1px solid #1a2735;
  background: rgba(8, 13, 19, 0.96);
}

.hp-header-eyebrow,
.hp-section-head span,
.hp-day-eyebrow,
.hp-block header span,
.hp-block header em,
.hp-stat-band span,
.hp-glance-title,
.hp-cond-grid span,
.hp-share span,
.hp-approach span,
.hp-footer,
.hp-empty-pois {
  font-family: var(--mono, 'JetBrains Mono', monospace);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.hp-header-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #4ade80;
  font-size: 10px;
  font-weight: 900;
}

.hp-header-pulse {
  position: relative;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: rgba(74, 222, 128, 0.18);
}

.hp-header-pulse-dot {
  position: absolute;
  inset: 2px;
  border-radius: inherit;
  background: #4ade80;
  animation: hp-pulse 1.4s ease-in-out infinite;
}

.hp-header h1,
.hp-section-head h2,
.hp-day-head h2 {
  margin: 0;
  font-family: Georgia, 'Times New Roman', serif;
  letter-spacing: 0;
}

.hp-header h1 {
  margin-top: 4px;
  color: #f5f1e7;
  font-size: clamp(26px, 3vw, 44px);
  line-height: 1;
}

.hp-header-sub {
  margin-top: 6px;
  color: #8a9cad;
  font-size: 13px;
  font-weight: 700;
}

.hp-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hp-action,
.hp-share button {
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 11px;
  border: 1px solid #25374a;
  border-radius: 6px;
  background: #0f1922;
  color: #d9e4ef;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.hp-action--icon {
  width: 34px;
  padding: 0;
}

.hp-share {
  position: absolute;
  top: calc(100% - 4px);
  right: 52px;
  width: min(430px, calc(100vw - 48px));
  padding: 12px;
  border: 1px solid #26394d;
  border-radius: 8px;
  background: #0b121a;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
}

.hp-share-row {
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.hp-share-row input {
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  border: 1px solid #1a2735;
  border-radius: 5px;
  background: #071017;
  color: #d9e4ef;
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 11px;
}

.hp-share-row span {
  color: #64798d;
  font-size: 8px;
  font-weight: 900;
}

.hp-share p {
  margin: 2px 0 0;
  color: #8a9cad;
  font-size: 12px;
}

.hp-body {
  overflow: auto;
  padding: 28px;
}

.hp-overview,
.hp-day {
  border: 1px solid #1a2735;
  border-radius: 8px;
  background: #0a121a;
}

.hp-overview {
  padding: 24px;
}

.hp-section-head span,
.hp-day-eyebrow,
.hp-block header span,
.hp-block header em {
  color: #7a8ea2;
  font-size: 10px;
  font-weight: 900;
}

.hp-section-head h2 {
  color: #f2ead9;
  font-size: 38px;
}

.hp-stat-band {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 22px 0;
  border: 1px solid #25374a;
  border-radius: 7px;
  overflow: hidden;
}

.hp-stat-band div {
  min-width: 0;
  padding: 14px;
  border-right: 1px solid #25374a;
  background: #0f1922;
}

.hp-stat-band div:last-child {
  border-right: 0;
}

.hp-stat-band span {
  color: #64798d;
  font-size: 9px;
  font-weight: 900;
}

.hp-stat-band strong {
  display: block;
  margin-top: 7px;
  color: #f5f1e7;
  font-size: 26px;
  line-height: 1;
}

.hp-stat-band small {
  margin-left: 5px;
  color: #8a9cad;
  font-size: 12px;
}

.hp-prose {
  max-width: 880px;
}

.hp-prose p,
.hp-guide-line,
.hp-poi-reason,
.hp-approach p {
  color: #c8d6e5;
  font-size: 15px;
  line-height: 1.65;
}

.hp-prose--drop p:first-child::first-letter {
  float: left;
  margin: 7px 9px 0 0;
  color: #e8c547;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 52px;
  line-height: 0.8;
}

.hp-glance {
  margin-top: 24px;
}

.hp-glance-title {
  margin-bottom: 8px;
  color: #8a9cad;
  font-size: 10px;
  font-weight: 900;
}

.hp-glance-grid {
  display: grid;
  gap: 8px;
  overflow-x: auto;
}

.hp-glance-day {
  min-width: 0;
  padding: 9px;
  border: 1px solid #25374a;
  border-radius: 6px;
  background: #0f1922;
  color: #d9e4ef;
  text-align: left;
  cursor: pointer;
}

.hp-glance-day span,
.hp-glance-day em {
  display: block;
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 9px;
  font-style: normal;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.hp-glance-day strong {
  display: block;
  margin: 2px 0 6px;
  color: #f5f1e7;
  font-size: 19px;
}

.hp-glance-day i {
  position: relative;
  display: block;
  width: 100%;
  height: 28px;
  overflow: hidden;
  border-radius: 3px;
  background: #152333;
}

.hp-glance-day b {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
}

.hp-divider {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin: 28px 0 14px;
  color: #e8c547;
}

.hp-divider span {
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.hp-divider strong {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 28px;
}

.hp-day {
  position: relative;
  overflow: hidden;
  margin-bottom: 24px;
  padding: 0 22px 22px 34px;
  scroll-margin-top: 92px;
}

.hp-day-rail {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  background: var(--day-color);
}

.hp-day-head {
  position: static;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  padding: 24px 0 12px;
  border-bottom: 1px solid #1a2735;
}

.hp-day-head > div {
  min-width: 0;
}

.hp-day-head h2 {
  color: #f5f1e7;
  font-size: clamp(25px, 3.8vw, 34px);
  line-height: 1.05;
}

.hp-day-head p {
  margin: 8px 0 0;
  color: #8a9cad;
  font-weight: 700;
}

.hp-grade {
  align-self: start;
  min-width: 72px;
  padding: 8px 10px;
  border: 1px solid;
  border-radius: 6px;
  text-align: center;
}

.hp-grade strong,
.hp-grade span {
  display: block;
  line-height: 1;
}

.hp-grade strong {
  font-size: 24px;
}

.hp-grade span {
  margin-top: 4px;
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.hp-block {
  padding: 18px 0 0;
}

.hp-block header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.hp-block header span {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e8c547;
  border-radius: 50%;
  color: #e8c547;
}

.hp-block header strong {
  color: #f5f1e7;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 22px;
}

.hp-block header em {
  margin-left: auto;
  font-style: normal;
}

.hp-cond-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  border: 1px solid #25374a;
  border-radius: 6px;
  overflow: hidden;
}

.hp-cond-grid div {
  min-width: 0;
  padding: 11px;
  border-right: 1px solid #25374a;
  background: #0f1922;
}

.hp-cond-grid div:last-child {
  border-right: 0;
}

.hp-cond-grid span {
  color: #64798d;
  font-size: 8px;
  font-weight: 900;
}

.hp-cond-grid strong {
  display: block;
  margin-top: 4px;
  color: #f5f1e7;
  font-size: 16px;
}

.hp-cond-grid small {
  margin-left: 3px;
  color: #8a9cad;
  font-size: 10px;
}

.hp-timeline {
  border: 1px solid #25374a;
  border-radius: 7px;
  background: #081018;
  overflow: hidden;
}

.hp-timeline svg {
  display: block;
  height: 112px;
}

.hp-timeline-axis {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  padding: 7px 10px;
  border-top: 1px solid #1a2735;
  color: #64798d;
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 9px;
  font-weight: 800;
}

.hp-tactic {
  margin: 14px 0 0;
  padding: 14px 16px;
  border-left: 3px solid #e8c547;
  background: rgba(232, 197, 71, 0.08);
  color: #f5f1e7;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.45;
}

.hp-tactic span {
  display: block;
  margin-bottom: 5px;
  color: #e8c547;
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.hp-poi-list {
  display: grid;
  gap: 12px;
}

.hp-poi {
  border: 1px solid #25374a;
  border-radius: 7px;
  background: #0f1922;
  overflow: hidden;
}

.hp-poi-head {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 48px;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #1a2735;
}

.hp-poi-head > span {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--poi-color);
  color: #061016;
  font-weight: 900;
}

.hp-poi-head h3 {
  margin: 0;
  color: #f5f1e7;
  font-size: 17px;
}

.hp-poi-head p {
  margin: 4px 0 0;
  color: #8a9cad;
  font-size: 12px;
}

.hp-poi-head strong {
  color: var(--poi-color);
  font-size: 24px;
  text-align: right;
}

.hp-poi-reason,
.hp-approach {
  margin: 0;
  padding: 12px;
}

.hp-approach {
  border-top: 1px solid #1a2735;
  background: #0a121a;
}

.hp-approach > strong {
  display: block;
  margin-bottom: 8px;
  color: #e8c547;
  font-family: var(--mono, 'JetBrains Mono', monospace);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.hp-approach div {
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr) 70px minmax(0, 1fr) 86px minmax(0, 1.4fr);
  gap: 6px;
  align-items: baseline;
  margin-bottom: 8px;
}

.hp-approach span {
  color: #64798d;
  font-size: 8px;
  font-weight: 900;
}

.hp-approach b {
  color: #d9e4ef;
  font-size: 12px;
}

.hp-approach p {
  padding: 0;
  margin: 5px 0 0;
  color: #c8d6e5;
}

.hp-approach p span {
  margin-right: 8px;
  color: #e8c547;
}

.hp-empty-pois {
  margin: 0;
  padding: 14px;
  border: 1px dashed #25374a;
  border-radius: 6px;
  color: #8a9cad;
  font-size: 10px;
  font-weight: 900;
}

.hp-footer {
  padding: 26px 0 8px;
  color: #64798d;
  font-size: 10px;
  font-weight: 900;
  text-align: center;
}

.hp-footer span,
.hp-footer small {
  display: block;
}

@keyframes hp-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.72); }
}

@media (max-width: 820px) {
  .hp-overlay {
    padding: 10px;
  }

  .hp-modal {
    max-height: calc(100vh - 20px);
  }

  .hp-header,
  .hp-day-head {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: flex-start;
  }

  .hp-body {
    padding: 14px;
  }

  .hp-day {
    padding: 0 16px 18px 28px;
  }

  .hp-day-head {
    gap: 10px;
    padding-top: 20px;
  }

  .hp-stat-band,
  .hp-cond-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hp-approach div {
    grid-template-columns: 70px minmax(0, 1fr);
  }
}
</style>

<style>
body.hp-printing {
  background: #f2ead9;
}

@media print {
  body.hp-printing * {
    visibility: hidden;
  }

  body.hp-printing .hp-modal,
  body.hp-printing .hp-modal * {
    visibility: visible;
  }

  body.hp-printing .hp-overlay {
    position: static !important;
    display: block !important;
    padding: 0 !important;
    background: #f2ead9 !important;
  }

  body.hp-printing .hp-modal {
    width: 100% !important;
    max-height: none !important;
    border: 0 !important;
    box-shadow: none !important;
    background: #f2ead9 !important;
    color: #17202a !important;
    overflow: visible !important;
  }

  body.hp-printing .hp-header {
    position: static !important;
    background: #f8f1df !important;
    border-bottom: 1px solid #c9b98e !important;
  }

  body.hp-printing .hp-header-actions,
  body.hp-printing .hp-share {
    display: none !important;
  }

  body.hp-printing .hp-body {
    overflow: visible !important;
    padding: 18px !important;
  }

  body.hp-printing .hp-overview,
  body.hp-printing .hp-day,
  body.hp-printing .hp-block,
  body.hp-printing .hp-poi,
  body.hp-printing .hp-stat-band div,
  body.hp-printing .hp-cond-grid div,
  body.hp-printing .hp-glance-day {
    background: #fbf5e6 !important;
    color: #17202a !important;
    border-color: #d4c49b !important;
  }

  body.hp-printing h1,
  body.hp-printing h2,
  body.hp-printing h3,
  body.hp-printing strong,
  body.hp-printing p {
    color: #17202a !important;
  }

  body.hp-printing .hp-day {
    break-before: page;
    page-break-before: always;
  }

  body.hp-printing .hp-poi,
  body.hp-printing .hp-block {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
</style>
