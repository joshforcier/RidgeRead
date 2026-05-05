import { liveConditions, moonForDate, type LiveConditions, type LiveModifier, type TripForecastDay } from '@/data/inSeason'
import type { HuntLocation } from '@/types/map'

interface OpenMeteoResponse {
  timezone?: string
  current?: {
    time?: string
    temperature_2m?: number
    precipitation?: number
    precipitation_probability?: number
    cloud_cover?: number
    pressure_msl?: number
    wind_speed_10m?: number
    wind_direction_10m?: number
    wind_gusts_10m?: number
  }
  hourly?: {
    time?: string[]
    temperature_2m?: number[]
    pressure_msl?: number[]
  }
  daily?: {
    time?: string[]
    temperature_2m_max?: number[]
    temperature_2m_min?: number[]
    precipitation_probability_max?: number[]
    precipitation_sum?: number[]
    cloud_cover_mean?: number[]
    pressure_msl_mean?: number[]
    wind_speed_10m_max?: number[]
    wind_direction_10m_dominant?: number[]
    wind_gusts_10m_max?: number[]
  }
}

const HPA_TO_INHG = 0.0295299830714

function directionName(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  const index = Math.round(((degrees % 360) / 22.5)) % directions.length
  return directions[index]
}

function toNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function round(value: number, digits = 0): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function formatTimestamp(isoTime: string | undefined): string {
  const match = isoTime?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (match) {
    const [, year, month, day, hour, minute] = match
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(date)
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date)
    return `${hour}:${minute} - ${weekday} ${monthName} ${Number(day)}`
  }

  const date = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('hour')}:${get('minute')} - ${get('weekday')} ${get('month')} ${get('day')}`
}

function hourlyValueAtOffset(
  hourly: OpenMeteoResponse['hourly'],
  currentTime: string | undefined,
  field: 'temperature_2m' | 'pressure_msl',
  offsetHours: number,
): number | null {
  if (!hourly?.time || !hourly[field] || !currentTime) return null
  const current = new Date(currentTime).getTime()
  const target = current - offsetHours * 60 * 60 * 1000
  let bestIndex = -1
  let bestDelta = Number.POSITIVE_INFINITY
  hourly.time.forEach((time, index) => {
    const delta = Math.abs(new Date(time).getTime() - target)
    if (delta < bestDelta) {
      bestDelta = delta
      bestIndex = index
    }
  })
  return bestIndex >= 0 ? hourly[field]?.[bestIndex] ?? null : null
}

function buildModifiers(
  pressureTrend: number,
  windMph: number,
  windDir: string,
  cloudPct: number,
  moonIllumPct: number,
): LiveModifier[] {
  const pressureModifier: LiveModifier =
    pressureTrend <= -0.03
      ? { label: 'Falling barometer', delta: 6, kind: 'pos', detail: 'Movement +' }
      : pressureTrend >= 0.03
        ? { label: 'Rising barometer', delta: -1, kind: 'neg', detail: 'Settling pressure' }
        : { label: 'Stable pressure', delta: 0, kind: 'neu', detail: 'No barometer edge' }

  const windModifier: LiveModifier = {
    label: `${windDir} wind ${Math.round(windMph)} mph`,
    delta: windMph > 20 ? -2 : 0,
    kind: windMph > 20 ? 'neg' : 'neu',
    detail: windMph > 20 ? 'High wind caution' : 'Plan stalks',
  }

  const cloudModifier: LiveModifier = cloudPct >= 65
    ? { label: 'Heavy cloud cover', delta: 3, kind: 'pos', detail: 'Longer movement' }
    : { label: 'Light cloud cover', delta: 0, kind: 'neu', detail: 'Watch sun exposure' }

  return [
    pressureModifier,
    cloudModifier,
    { label: `Bright moon (${moonIllumPct}%)`, delta: -3, kind: 'neg', detail: 'Midday slump' },
    windModifier,
  ]
}

export async function fetchOpenMeteoCurrentWeather(location: HuntLocation): Promise<LiveConditions> {
  const params = new URLSearchParams({
    latitude: location.lat.toFixed(5),
    longitude: location.lng.toFixed(5),
    current: [
      'temperature_2m',
      'precipitation',
      'precipitation_probability',
      'cloud_cover',
      'pressure_msl',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
    ].join(','),
    hourly: ['temperature_2m', 'pressure_msl'].join(','),
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone: 'auto',
    past_days: '1',
    forecast_days: '1',
  })

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Weather request failed (${response.status})`)
  }

  const data = await response.json() as OpenMeteoResponse
  const current = data.current
  if (!current) throw new Error('Weather response did not include current conditions')

  const tempF = toNumber(current.temperature_2m, liveConditions.tempF)
  const pressureHpa = toNumber(current.pressure_msl, liveConditions.pressureInHg / HPA_TO_INHG)
  const pressureInHg = round(pressureHpa * HPA_TO_INHG, 2)
  const windMph = toNumber(current.wind_speed_10m, liveConditions.wind.mph)
  const windGust = toNumber(current.wind_gusts_10m, windMph)
  const windDeg = toNumber(current.wind_direction_10m, liveConditions.wind.dirDeg)
  const cloudPct = Math.round(toNumber(current.cloud_cover, liveConditions.cloudPct))
  const precipChance = Math.round(toNumber(current.precipitation_probability, current.precipitation ? 100 : 0))

  const tempPast = hourlyValueAtOffset(data.hourly, current.time, 'temperature_2m', 3)
  const pressurePast = hourlyValueAtOffset(data.hourly, current.time, 'pressure_msl', 6)
  const tempTrend = tempPast == null ? 0 : round(tempF - tempPast, 1)
  const pressureTrend = pressurePast == null ? 0 : round(pressureInHg - pressurePast * HPA_TO_INHG, 2)
  const windDir = directionName(windDeg)
  const moon = moonForDate(current.time ?? new Date())

  return {
    ...liveConditions,
    updatedAt: 'just now',
    loc: location.label,
    timestamp: formatTimestamp(current.time),
    tempF: Math.round(tempF),
    tempTrend,
    wind: {
      mph: Math.round(windMph),
      gust: Math.round(windGust),
      dirDeg: Math.round(windDeg),
      dirName: windDir,
    },
    pressureInHg,
    pressureTrend,
    cloudPct,
    precip: { chance: precipChance },
    moon,
    modifiers: buildModifiers(pressureTrend, windMph, windDir, cloudPct, moon.illumPct),
  }
}

export async function fetchOpenMeteoTripForecast(
  location: HuntLocation,
  days: TripForecastDay[],
): Promise<TripForecastDay[]> {
  const window = forecastRequestWindow(days)
  if (!window) return days

  const params = new URLSearchParams({
    latitude: location.lat.toFixed(5),
    longitude: location.lng.toFixed(5),
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'precipitation_sum',
      'cloud_cover_mean',
      'pressure_msl_mean',
      'wind_speed_10m_max',
      'wind_direction_10m_dominant',
      'wind_gusts_10m_max',
    ].join(','),
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone: 'auto',
    start_date: window.start,
    end_date: window.end,
  })

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Trip forecast request failed (${response.status})`)
  }

  const data = await response.json() as OpenMeteoResponse
  const daily = data.daily
  if (!daily?.time) return days

  const byDate = new Map<string, number>()
  daily.time.forEach((date, index) => byDate.set(date, index))

  return days.map((day) => {
    const index = byDate.get(day.date)
    if (index == null) return day
    return enrichTripDay(day, daily, index)
  })
}

function enrichTripDay(
  day: TripForecastDay,
  daily: NonNullable<OpenMeteoResponse['daily']>,
  index: number,
): TripForecastDay {
  const hi = Math.round(toNumber(daily.temperature_2m_max?.[index], day.hi ?? 45))
  const lo = Math.round(toNumber(daily.temperature_2m_min?.[index], day.lo ?? 28))
  const precip = Math.round(toNumber(daily.precipitation_probability_max?.[index], day.precip ?? 0))
  const precipSum = toNumber(daily.precipitation_sum?.[index], 0)
  const cloud = Math.round(toNumber(daily.cloud_cover_mean?.[index], day.cloud ?? 35))
  const pressure = round(toNumber(daily.pressure_msl_mean?.[index], (day.pressure ?? 30) / HPA_TO_INHG) * HPA_TO_INHG, 2)
  const previousPressureHpa = index > 0 ? daily.pressure_msl_mean?.[index - 1] : undefined
  const previousPressure = previousPressureHpa == null ? null : round(previousPressureHpa * HPA_TO_INHG, 2)
  const pressureDelta = previousPressure == null ? 0 : pressure - previousPressure
  const pressureTrend = pressureDelta <= -0.03 ? 'falling' : pressureDelta >= 0.03 ? 'rising' : 'steady'
  const windMph = Math.round(toNumber(daily.wind_speed_10m_max?.[index], day.wind?.mph ?? 8))
  const windGust = Math.round(toNumber(daily.wind_gusts_10m_max?.[index], day.wind?.gust ?? windMph))
  const windDir = directionName(toNumber(daily.wind_direction_10m_dominant?.[index], 270))
  const moon = moonForDate(day.date)
  const flags = dailyFlags({ hi, precip, precipSum, cloud, pressureTrend, pressure, windMph, windGust, moonIllum: moon.illumPct })
  const activity = dailyActivity({ precip, cloud, pressureTrend, windGust, moonIllum: moon.illumPct })
  const grade = activity >= 90 ? 'A+' : activity >= 80 ? 'A' : activity >= 68 ? 'B+' : activity >= 55 ? 'B' : activity >= 42 ? 'C' : 'D'
  const label = activity >= 85 ? 'Prime' : activity >= 68 ? 'Solid' : activity >= 50 ? 'Viable' : 'Marginal'

  return {
    ...day,
    available: true,
    conf: 'high',
    hi,
    lo,
    wind: { mph: windMph, dir: windDir, gust: windGust > windMph ? windGust : undefined },
    precip,
    cloud,
    pressure,
    pressureTrend,
    moonIllum: moon.illumPct,
    moonPhase: moon.phaseName,
    moonAge: moon.age,
    activity,
    grade,
    label,
    headline: dailyHeadline(flags, pressureTrend, precip, windGust),
    plan: dailyPlan(flags, pressureTrend, windGust),
    bestWindow: flags.includes('storm front') ? 'Dawn through dusk' : moon.illumPct >= 90 ? 'First and last light' : 'Dawn + evening',
    flags,
  }
}

function dailyActivity(input: { precip: number; cloud: number; pressureTrend: 'falling' | 'rising' | 'steady'; windGust: number; moonIllum: number }): number {
  let score = 62
  if (input.pressureTrend === 'falling') score += 12
  if (input.pressureTrend === 'rising') score -= 4
  if (input.cloud >= 55) score += 5
  if (input.precip >= 35 && input.pressureTrend === 'falling') score += 10
  if (input.windGust >= 25) score -= 16
  if (input.moonIllum >= 90) score -= 7
  return Math.max(25, Math.min(98, Math.round(score)))
}

function dailyFlags(input: {
  hi: number
  precip: number
  precipSum: number
  cloud: number
  pressureTrend: 'falling' | 'rising' | 'steady'
  pressure: number
  windMph: number
  windGust: number
  moonIllum: number
}): string[] {
  const flags: string[] = []
  if (input.pressureTrend === 'falling') flags.push('falling pressure')
  if (input.precip >= 45 && input.pressureTrend === 'falling') flags.push('storm front')
  if (input.precipSum > 0.05 && input.hi <= 36) flags.push('snow')
  if (input.windGust >= 25 || input.windMph >= 18) flags.push('high wind')
  if (input.cloud >= 65) flags.push('heavy cloud')
  if (input.pressure >= 30.2) flags.push('high pressure')
  if (input.moonIllum >= 90) flags.push('bright moon')
  return flags
}

function dailyHeadline(flags: string[], pressureTrend: 'falling' | 'rising' | 'steady', precip: number, windGust: number): string {
  if (flags.includes('storm front')) return 'Pre-front weather window'
  if (flags.includes('high wind')) return `Wind-driven day, gusts near ${windGust} mph`
  if (flags.includes('high pressure')) return 'High pressure and shorter movement'
  if (pressureTrend === 'falling') return 'Pressure falling, movement edge building'
  if (precip >= 30) return 'Weather chance worth watching'
  return 'Stable forecast, standard movement windows'
}

function dailyPlan(flags: string[], pressureTrend: 'falling' | 'rising' | 'steady', windGust: number): string {
  if (flags.includes('storm front')) return 'Treat the weather as the schedule. Hunt feed and travel early, then stay available for an evening push.'
  if (flags.includes('high wind')) return `Keep setups sheltered. Gusts near ${windGust} mph make leeward timber and protected benches the better play.`
  if (flags.includes('bright moon')) return 'Expect compressed daylight movement. Be set early at first light and again before last light.'
  if (pressureTrend === 'falling') return 'Lean into the morning and protect a clean evening setup while the barometer slides.'
  return 'Run a disciplined standard rotation: dawn feed edge, midday rest/glass, evening travel pinch.'
}

function forecastRequestWindow(days: TripForecastDay[]): { start: string; end: string } | null {
  if (days.length === 0) return null
  const today = localDateKey(new Date())
  const lastForecastDay = localDateKey(addDays(new Date(), 15))
  const first = days[0].date < today ? today : days[0].date
  const last = days[days.length - 1].date > lastForecastDay ? lastForecastDay : days[days.length - 1].date
  return first <= last ? { start: first, end: last } : null
}

function localDateKey(date: Date): string {
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
