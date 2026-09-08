import type { Coordinate } from '../types'
import { toForecastGrid } from './grid'
import { addDays, kstDateString, toKstParts } from './kst'

const ENDPOINT =
  'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst'

/** 단기예보 발표 시각(KST). 발표 후 약 10분 뒤부터 조회 가능하다. */
const BASE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23]

/** 단기예보가 제공하는 최대 예보 기간(일). */
const FORECAST_HORIZON_DAYS = 3

export interface KmaForecast {
  temperatureC: number | null
  precipitationProbability: number | null
  /** 강수형태 코드. 0 없음 / 1 비 / 2 비·눈 / 3 눈 / 4 소나기 / 5 빗방울 / 6 빗방울·눈날림 / 7 눈날림 */
  precipitationTypeCode: number | null
  baseDate: string
  baseTime: string
  forecastDate: string
  forecastTime: string
  grid: { nx: number; ny: number }
}

export class KmaError extends Error {}

/**
 * 조회 시각에 사용할 발표 시각을 고른다.
 * 현재 시각보다 이전에 발표된 가장 최근 회차를 사용하며, 발표 직후의 지연을
 * 고려해 10분의 여유를 둔다.
 */
export function resolveBase(now: Date): { baseDate: string; baseTime: string } {
  const { hour, minute } = toKstParts(now)
  const minutesNow = hour * 60 + minute

  for (let i = BASE_HOURS.length - 1; i >= 0; i -= 1) {
    if (minutesNow >= BASE_HOURS[i] * 60 + 10) {
      return {
        baseDate: kstDateString(now),
        baseTime: `${String(BASE_HOURS[i]).padStart(2, '0')}00`,
      }
    }
  }

  // 자정 이후 02:10 이전에는 전날 23시 발표를 사용한다.
  return { baseDate: kstDateString(addDays(now, -1)), baseTime: '2300' }
}

/** 단기예보가 다루는 기간 안의 시각인지 확인한다. */
export function isWithinForecastHorizon(now: Date, target: Date): boolean {
  const diffMs = target.getTime() - now.getTime()
  return diffMs >= -60 * 60 * 1000 && diffMs <= FORECAST_HORIZON_DAYS * 86_400_000
}

interface KmaItem {
  category: string
  fcstDate: string
  fcstTime: string
  fcstValue: string
}

/**
 * 기상청 단기예보에서 대상 시각의 예보를 조회한다.
 *
 * 주의: 이 클라이언트는 공개 문서를 기준으로 작성했고 실제 호출로는 아직
 * 검증하지 않았다(스펙 5절). 인증키가 없거나 응답이 예상과 다르면
 * KmaError를 던지고, 호출부는 '날씨 미반영'으로 처리한다.
 */
export async function fetchForecast(
  coordinate: Coordinate,
  target: Date,
  now: Date = new Date(),
  serviceKey = process.env.KMA_SERVICE_KEY,
): Promise<KmaForecast> {
  if (!serviceKey) {
    throw new KmaError('기상청 단기예보 인증키(KMA_SERVICE_KEY)가 설정되지 않았습니다.')
  }
  if (!isWithinForecastHorizon(now, target)) {
    throw new KmaError('방문 시각이 단기예보 제공 기간을 벗어났습니다.')
  }

  const grid = toForecastGrid(coordinate)
  const { baseDate, baseTime } = resolveBase(now)
  const url = new URL(ENDPOINT)
  url.searchParams.set('serviceKey', serviceKey)
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('numOfRows', '1000')
  url.searchParams.set('dataType', 'JSON')
  url.searchParams.set('base_date', baseDate)
  url.searchParams.set('base_time', baseTime)
  url.searchParams.set('nx', String(grid.nx))
  url.searchParams.set('ny', String(grid.ny))

  const response = await fetch(url, {
    signal: AbortSignal.timeout(5000),
    cache: 'no-store',
  }).catch((error: unknown) => {
    throw new KmaError(`단기예보 조회에 실패했습니다: ${String(error)}`)
  })

  if (!response.ok) {
    throw new KmaError(`단기예보 조회에 실패했습니다: HTTP ${response.status}`)
  }

  const payload = (await response.json().catch(() => null)) as
    | { response?: { body?: { items?: { item?: KmaItem[] } } } }
    | null

  const items = payload?.response?.body?.items?.item
  if (!Array.isArray(items) || items.length === 0) {
    throw new KmaError('단기예보 응답에 예보 항목이 없습니다.')
  }

  return pickForecast(items, target, { baseDate, baseTime, grid })
}

/** 대상 시각과 같은 시(hour)의 예보 항목을 모아 하나의 예보로 만든다. */
export function pickForecast(
  items: KmaItem[],
  target: Date,
  meta: { baseDate: string; baseTime: string; grid: { nx: number; ny: number } },
): KmaForecast {
  const parts = toKstParts(target)
  const targetDate = kstDateString(target)
  const targetTime = `${String(parts.hour).padStart(2, '0')}00`

  const matched = items.filter(
    (item) => item.fcstDate === targetDate && item.fcstTime === targetTime,
  )
  if (matched.length === 0) {
    throw new KmaError('방문 시각에 해당하는 예보 항목을 찾지 못했습니다.')
  }

  const valueOf = (category: string) => {
    const found = matched.find((item) => item.category === category)
    if (!found) return null
    const parsed = Number(found.fcstValue)
    return Number.isFinite(parsed) ? parsed : null
  }

  return {
    temperatureC: valueOf('TMP'),
    precipitationProbability: valueOf('POP'),
    precipitationTypeCode: valueOf('PTY'),
    baseDate: meta.baseDate,
    baseTime: meta.baseTime,
    forecastDate: targetDate,
    forecastTime: targetTime,
    grid: meta.grid,
  }
}
