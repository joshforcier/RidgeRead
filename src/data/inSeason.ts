export type LiveModifierKind = 'pos' | 'neg' | 'neu'

export interface LiveModifier {
  label: string
  delta: number
  kind: LiveModifierKind
  detail: string
}

export interface LiveConditions {
  updatedAt: string
  loc: string
  timestamp: string
  tempF: number
  tempTrend: number
  wind: {
    mph: number
    gust: number
    dirDeg: number
    dirName: string
  }
  pressureInHg: number
  pressureTrend: number
  cloudPct: number
  precip: {
    chance: number
  }
  moon: {
    phaseName: string
    illumPct: number
    age: number
    rise: string
    set: string
    overhead: string
    underfoot: string
  }
  activity24h: Array<{ h: number; v: number }>
  modifiers: LiveModifier[]
}

export interface TripForecastDay {
  date: string
  dow: string
  dom: number
  monthShort?: string
  monthLong?: string
  available: boolean
  conf: 'high' | 'med' | 'low' | 'none'
  moonIllum: number
  moonPhase: string
  moonAge: number
  activity: number | null
  grade: string
  label: string
  headline: string
  plan: string
  flags: string[]
  hi?: number
  lo?: number
  wind?: {
    mph: number
    dir: string
    gust?: number
  }
  precip?: number
  cloud?: number
  pressure?: number
  pressureTrend?: 'falling' | 'rising' | 'steady'
  bestWindow?: string
  bestPoi?: string
}

export const liveConditions: LiveConditions = {
  updatedAt: '6 min ago',
  loc: 'Sec 14 - T9N R76W',
  timestamp: '07:14 - Tue Oct 14',
  tempF: 38,
  tempTrend: -3,
  wind: { mph: 7, gust: 14, dirDeg: 285, dirName: 'WNW' },
  pressureInHg: 30.18,
  pressureTrend: -0.08,
  cloudPct: 45,
  precip: { chance: 20 },
  moon: {
    phaseName: 'Waxing Gibbous',
    illumPct: 78,
    age: 11.2,
    rise: '14:38',
    set: '03:12',
    overhead: '20:55',
    underfoot: '08:42',
  },
  activity24h: [
    { h: 4, v: 18 }, { h: 5, v: 42 }, { h: 6, v: 88 }, { h: 7, v: 92 },
    { h: 8, v: 70 }, { h: 9, v: 38 }, { h: 10, v: 22 }, { h: 11, v: 28 },
    { h: 12, v: 35 }, { h: 13, v: 30 }, { h: 14, v: 22 }, { h: 15, v: 28 },
    { h: 16, v: 44 }, { h: 17, v: 68 }, { h: 18, v: 86 }, { h: 19, v: 95 },
    { h: 20, v: 82 }, { h: 21, v: 55 }, { h: 22, v: 30 }, { h: 23, v: 20 },
    { h: 0, v: 24 }, { h: 1, v: 30 }, { h: 2, v: 22 }, { h: 3, v: 16 },
  ],
  modifiers: [
    { label: 'Falling barometer', delta: 6, kind: 'pos', detail: 'Movement +' },
    { label: 'Cool front passing', delta: 4, kind: 'pos', detail: 'All-day activity' },
    { label: 'Bright moon (78%)', delta: -3, kind: 'neg', detail: 'Midday slump' },
    { label: 'WNW wind 7 mph', delta: 0, kind: 'neu', detail: 'Steady, plan stalks' },
  ],
}

export const tripForecast: TripForecastDay[] = [
  {
    date: '2025-10-14',
    dow: 'Tue',
    dom: 14,
    available: true,
    conf: 'high',
    hi: 52,
    lo: 31,
    wind: { mph: 7, dir: 'WNW' },
    precip: 20,
    cloud: 45,
    pressure: 30.18,
    pressureTrend: 'falling',
    moonIllum: 78,
    moonPhase: 'Waxing Gibbous',
    moonAge: 11.2,
    activity: 92,
    grade: 'A',
    label: 'Prime',
    headline: 'Cool front + falling pressure',
    plan: 'Hit dark-timber bedding at first light. Cold morning will push elk to feed late.',
    bestWindow: '06:00 - 08:30',
    bestPoi: 'Upper Meadow Park',
    flags: ['cool front', 'falling pressure'],
  },
  {
    date: '2025-10-15',
    dow: 'Wed',
    dom: 15,
    available: true,
    conf: 'high',
    hi: 48,
    lo: 26,
    wind: { mph: 12, dir: 'NW' },
    precip: 60,
    cloud: 80,
    pressure: 29.92,
    pressureTrend: 'falling',
    moonIllum: 86,
    moonPhase: 'Waxing Gibbous',
    moonAge: 12.2,
    activity: 96,
    grade: 'A+',
    label: 'Prime',
    headline: 'Storm building - best day of trip',
    plan: 'Pre-storm feeding all morning. Position upwind of meadows. Stay until last light.',
    bestWindow: 'All-day',
    bestPoi: 'North Wallow Complex',
    flags: ['storm front', 'all-day movement'],
  },
  {
    date: '2025-10-16',
    dow: 'Thu',
    dom: 16,
    available: true,
    conf: 'high',
    hi: 41,
    lo: 22,
    wind: { mph: 18, dir: 'N', gust: 32 },
    precip: 70,
    cloud: 95,
    pressure: 29.78,
    pressureTrend: 'rising',
    moonIllum: 93,
    moonPhase: 'Waxing Gibbous',
    moonAge: 13.2,
    activity: 48,
    grade: 'C+',
    label: 'Marginal',
    headline: 'Snow and high wind',
    plan: 'Sit tight midday. Glass leeward slopes only. Elk will bed thick timber, then feed at dusk.',
    bestWindow: '17:00 - 19:30',
    bestPoi: 'Dark Timber Bowl',
    flags: ['high wind', 'snow', 'leeward slopes'],
  },
  {
    date: '2025-10-17',
    dow: 'Fri',
    dom: 17,
    available: true,
    conf: 'high',
    hi: 44,
    lo: 24,
    wind: { mph: 6, dir: 'W' },
    precip: 10,
    cloud: 30,
    pressure: 30.12,
    pressureTrend: 'rising',
    moonIllum: 98,
    moonPhase: 'Full Moon',
    moonAge: 14.2,
    activity: 78,
    grade: 'B+',
    label: 'Solid',
    headline: 'Post-storm reset with full moon',
    plan: 'Crisp clear morning - elk on the move post-storm. Bright moon means brief AM peak, then siesta.',
    bestWindow: '06:30 - 08:00',
    bestPoi: 'East Fork Drainage',
    flags: ['post-storm', 'bright moon'],
  },
  {
    date: '2025-10-18',
    dow: 'Sat',
    dom: 18,
    available: true,
    conf: 'med',
    hi: 50,
    lo: 30,
    wind: { mph: 9, dir: 'SW' },
    precip: 0,
    cloud: 20,
    pressure: 30.22,
    pressureTrend: 'steady',
    moonIllum: 99,
    moonPhase: 'Full Moon',
    moonAge: 15.2,
    activity: 64,
    grade: 'B',
    label: 'Viable',
    headline: 'Blue-sky high pressure',
    plan: 'Tough midday. Hunt edges hard at dawn and dusk only. Plan stalks with steady SW wind.',
    bestWindow: '17:30 - 19:30',
    bestPoi: 'Divide Saddle',
    flags: ['high pressure', 'full moon'],
  },
  {
    date: '2025-10-19',
    dow: 'Sun',
    dom: 19,
    available: true,
    conf: 'med',
    hi: 53,
    lo: 32,
    wind: { mph: 11, dir: 'SW' },
    precip: 5,
    cloud: 35,
    pressure: 30.10,
    pressureTrend: 'falling',
    moonIllum: 96,
    moonPhase: 'Waning Gibbous',
    moonAge: 16.2,
    activity: 70,
    grade: 'B',
    label: 'Viable',
    headline: 'Pressure starts dropping again',
    plan: 'Building system by evening. Save the wallow complex for last hour.',
    bestWindow: '17:00 - 19:30',
    bestPoi: 'Aspen Wallow',
    flags: ['pressure drop'],
  },
  {
    date: '2025-10-20',
    dow: 'Mon',
    dom: 20,
    available: true,
    conf: 'low',
    hi: 47,
    lo: 28,
    wind: { mph: 8, dir: 'W' },
    precip: 30,
    cloud: 60,
    pressure: 29.95,
    pressureTrend: 'falling',
    moonIllum: 88,
    moonPhase: 'Waning Gibbous',
    moonAge: 17.2,
    activity: 76,
    grade: 'B+',
    label: 'Solid',
    headline: 'Forecast confidence low - verify',
    plan: 'Models suggest another light system. Re-check this day 48h out.',
    bestWindow: 'TBD',
    bestPoi: 'Creek Confluence',
    flags: ['low confidence'],
  },
  {
    date: '2025-10-21',
    dow: 'Tue',
    dom: 21,
    available: false,
    conf: 'none',
    moonIllum: 78,
    moonPhase: 'Waning Gibbous',
    moonAge: 18.2,
    activity: null,
    grade: '?',
    label: 'Beyond forecast',
    headline: 'Outside 7-day forecast',
    plan: 'Moon-only estimate available. Weather check in 1-2 days.',
    flags: [],
  },
]

const forecastByDate = new Map(tripForecast.map((day) => [day.date, day]))

export function buildTripForecastDays(startDate: string, endDate: string): TripForecastDay[] {
  const start = parseDateKey(startDate) ?? parseDateKey(tripForecast[0].date)!
  const end = parseDateKey(endDate) ?? start
  const [from, to] = start.getTime() <= end.getTime() ? [start, end] : [end, start]
  const days: TripForecastDay[] = []
  for (let cursor = new Date(from); cursor.getTime() <= to.getTime(); cursor = addDays(cursor, 1)) {
    const key = formatDateKey(cursor)
    const known = forecastByDate.get(key)
    days.push(known ? withDateLabels(known) : makePlaceholderDay(cursor))
  }
  return days
}

export function tripDayMonthShort(day: TripForecastDay): string {
  return day.monthShort ?? formatDatePart(day.date, { month: 'short' })
}

export function tripDayMonthLong(day: TripForecastDay): string {
  return day.monthLong ?? formatDatePart(day.date, { month: 'long' })
}

export function tripDayDateLabel(day: TripForecastDay): string {
  return `${day.dow} ${tripDayMonthShort(day)} ${day.dom}`
}

function makePlaceholderDay(date: Date): TripForecastDay {
  const moon = moonForDate(date)
  return {
    date: formatDateKey(date),
    dow: formatDatePart(date, { weekday: 'short' }),
    dom: date.getDate(),
    monthShort: formatDatePart(date, { month: 'short' }),
    monthLong: formatDatePart(date, { month: 'long' }),
    available: false,
    conf: 'none',
    moonIllum: moon.illumPct,
    moonPhase: moon.phaseName,
    moonAge: moon.age,
    activity: null,
    grade: '?',
    label: 'Beyond forecast',
    headline: 'Outside live forecast window',
    plan: 'Weather unavailable until this hunt date gets close enough. Re-open the plan inside the forecast window for conditions-driven tactics.',
    flags: [],
  }
}

function withDateLabels(day: TripForecastDay): TripForecastDay {
  const moon = moonForDate(day.date)
  return {
    ...day,
    monthShort: tripDayMonthShort(day),
    monthLong: tripDayMonthLong(day),
    moonIllum: moon.illumPct,
    moonPhase: moon.phaseName,
    moonAge: moon.age,
  }
}

function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function formatDatePart(dateOrKey: Date | string, options: Intl.DateTimeFormatOptions): string {
  const date = typeof dateOrKey === 'string' ? parseDateKey(dateOrKey) : dateOrKey
  return (date ?? new Date()).toLocaleDateString(undefined, options)
}

export function moonForDate(dateOrKey: Date | string): LiveConditions['moon'] {
  const date = typeof dateOrKey === 'string' ? parseDateKey(dateOrKey) ?? new Date(dateOrKey) : dateOrKey
  const knownNewMoon = new Date(2000, 0, 6, 18, 14)
  const lunarMs = 29.530588853 * 24 * 60 * 60 * 1000
  const age = (((date.getTime() - knownNewMoon.getTime()) % lunarMs) + lunarMs) % lunarMs / (24 * 60 * 60 * 1000)
  const illum = Math.round((1 - Math.cos((2 * Math.PI * age) / 29.530588853)) / 2 * 100)
  let phaseName = 'New Moon'
  if (age >= 1.85 && age < 5.54) phaseName = 'Waxing Crescent'
  else if (age >= 5.54 && age < 9.23) phaseName = 'First Quarter'
  else if (age >= 9.23 && age < 12.92) phaseName = 'Waxing Gibbous'
  else if (age >= 12.92 && age < 16.61) phaseName = 'Full Moon'
  else if (age >= 16.61 && age < 20.30) phaseName = 'Waning Gibbous'
  else if (age >= 20.30 && age < 23.99) phaseName = 'Last Quarter'
  else if (age >= 23.99 && age < 27.68) phaseName = 'Waning Crescent'

  const riseHour = (6 + age * 24 / 29.530588853) % 24
  return {
    phaseName,
    illumPct: illum,
    age: Number(age.toFixed(1)),
    rise: formatHour(riseHour),
    set: formatHour(riseHour + 12.4),
    overhead: formatHour(riseHour + 6.2),
    underfoot: formatHour(riseHour + 18.6),
  }
}

function formatHour(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24
  const h = Math.floor(normalized)
  const m = Math.round((normalized - h) * 60) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function activityColor(activity: number | null): string {
  if (activity == null) return 'var(--fg-3)'
  if (activity >= 85) return '#4ade80'
  if (activity >= 65) return '#e8c547'
  if (activity >= 45) return '#f97316'
  return '#ef4444'
}
