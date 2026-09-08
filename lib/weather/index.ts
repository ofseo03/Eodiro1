import { WEATHER_THRESHOLDS } from '../constants'
import type { Coordinate, WeatherAssessment, WeatherAvailable } from '../types'
import { fetchForecast, type KmaForecast } from './kma'

const PRECIPITATION_TYPE: Record<number, WeatherAvailable['precipitationType']> = {
  0: 'none',
  1: 'rain',
  2: 'rain-snow',
  3: 'snow',
  4: 'shower',
  5: 'drizzle',
  6: 'rain-snow',
  7: 'snow',
}

/**
 * 예보 값으로 실내 우선 추천 여부를 판단한다.
 * 기준값은 lib/constants.ts의 WEATHER_THRESHOLDS에 정의되어 있다.
 */
export function judgeForecast(
  forecast: KmaForecast,
  coordinate: Coordinate,
): WeatherAssessment {
  if (forecast.temperatureC === null) {
    return { available: false, reason: '예보에서 기온 값을 찾지 못했습니다.' }
  }

  const reasons: string[] = []
  const temperature = forecast.temperatureC

  if (temperature >= WEATHER_THRESHOLDS.hotC) {
    reasons.push(`기온 ${temperature}℃ (${WEATHER_THRESHOLDS.hotC}℃ 이상)`)
  }
  if (temperature <= WEATHER_THRESHOLDS.coldC) {
    reasons.push(`기온 ${temperature}℃ (${WEATHER_THRESHOLDS.coldC}℃ 이하)`)
  }

  const probability = forecast.precipitationProbability ?? 0
  const typeCode = forecast.precipitationTypeCode ?? 0
  const precipitationType = PRECIPITATION_TYPE[typeCode] ?? 'none'

  if (precipitationType !== 'none') {
    reasons.push('강수 예보 있음')
  } else if (probability >= WEATHER_THRESHOLDS.precipitationProbability) {
    reasons.push(`강수확률 ${probability}%`)
  }

  const forecastTime = `${forecast.forecastDate.slice(0, 4)}-${forecast.forecastDate.slice(4, 6)}-${forecast.forecastDate.slice(6, 8)} ${forecast.forecastTime.slice(0, 2)}:00 KST`

  return {
    available: true,
    temperatureC: temperature,
    precipitationProbability: probability,
    precipitationType,
    indoorRecommended: reasons.length > 0,
    reasons,
    basedOn: {
      coordinate,
      forecastTime,
      source: `기상청 단기예보 (발표 ${forecast.baseDate} ${forecast.baseTime}, 격자 ${forecast.grid.nx},${forecast.grid.ny})`,
    },
  }
}

/**
 * 방문 지역·시각의 날씨를 확인한다.
 * 조회에 실패하거나 예보 범위를 벗어나면 '날씨 미반영'으로 처리한다.
 */
export async function assessWeather(
  coordinate: Coordinate,
  visitAt: Date,
  now: Date = new Date(),
): Promise<WeatherAssessment> {
  try {
    const forecast = await fetchForecast(coordinate, visitAt, now)
    return judgeForecast(forecast, coordinate)
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : '날씨 조회에 실패했습니다.',
    }
  }
}
