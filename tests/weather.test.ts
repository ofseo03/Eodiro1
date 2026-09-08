import { describe, expect, it } from 'vitest'
import { toForecastGrid } from '@/lib/weather/grid'
import { isWithinForecastHorizon, pickForecast, resolveBase } from '@/lib/weather/kma'
import { judgeForecast } from '@/lib/weather'

const coordinate = { lat: 37.5445, lng: 127.0557 }

function forecast(overrides: Partial<Parameters<typeof judgeForecast>[0]> = {}) {
  return {
    temperatureC: 20,
    precipitationProbability: 10,
    precipitationTypeCode: 0,
    baseDate: '20260501',
    baseTime: '0800',
    forecastDate: '20260501',
    forecastTime: '1400',
    grid: { nx: 61, ny: 126 },
    ...overrides,
  }
}

describe('toForecastGrid', () => {
  it('서울시청 좌표를 기상청 격자 (60, 127)로 변환한다', () => {
    expect(toForecastGrid({ lat: 37.5665, lng: 126.978 })).toEqual({ nx: 60, ny: 127 })
  })
})

describe('resolveBase', () => {
  it('가장 최근 발표 회차를 사용한다', () => {
    // 2026-05-01 09:30 KST
    expect(resolveBase(new Date('2026-05-01T00:30:00.000Z'))).toEqual({
      baseDate: '20260501',
      baseTime: '0800',
    })
  })

  it('자정 이후 첫 발표 전에는 전날 23시 발표를 사용한다', () => {
    // 2026-05-01 00:30 KST
    expect(resolveBase(new Date('2026-04-30T15:30:00.000Z'))).toEqual({
      baseDate: '20260430',
      baseTime: '2300',
    })
  })
})

describe('isWithinForecastHorizon', () => {
  const now = new Date('2026-05-01T00:00:00.000Z')

  it('사흘 안의 시각은 예보 범위로 본다', () => {
    expect(isWithinForecastHorizon(now, new Date('2026-05-02T00:00:00.000Z'))).toBe(true)
  })

  it('사흘을 넘는 시각은 예보 범위 밖이다', () => {
    expect(isWithinForecastHorizon(now, new Date('2026-05-10T00:00:00.000Z'))).toBe(false)
  })
})

describe('pickForecast', () => {
  const items = [
    { category: 'TMP', fcstDate: '20260501', fcstTime: '1400', fcstValue: '29' },
    { category: 'POP', fcstDate: '20260501', fcstTime: '1400', fcstValue: '20' },
    { category: 'PTY', fcstDate: '20260501', fcstTime: '1400', fcstValue: '0' },
    { category: 'TMP', fcstDate: '20260501', fcstTime: '1500', fcstValue: '30' },
  ]
  const meta = { baseDate: '20260501', baseTime: '0800', grid: { nx: 61, ny: 126 } }

  it('방문 시각과 같은 시의 예보 항목만 모은다', () => {
    // 2026-05-01 14:00 KST
    const picked = pickForecast(items, new Date('2026-05-01T05:00:00.000Z'), meta)

    expect(picked.temperatureC).toBe(29)
    expect(picked.precipitationProbability).toBe(20)
    expect(picked.forecastTime).toBe('1400')
  })

  it('해당 시각의 예보가 없으면 오류를 낸다', () => {
    expect(() =>
      pickForecast(items, new Date('2026-05-01T10:00:00.000Z'), meta),
    ).toThrow()
  })
})

describe('judgeForecast', () => {
  it('기온이 기준 이상이면 실내를 우선한다', () => {
    const judged = judgeForecast(forecast({ temperatureC: 29 }), coordinate)

    expect(judged.available && judged.indoorRecommended).toBe(true)
  })

  it('기온이 기준 이하이면 실내를 우선한다', () => {
    const judged = judgeForecast(forecast({ temperatureC: 2 }), coordinate)

    expect(judged.available && judged.indoorRecommended).toBe(true)
  })

  it('강수형태가 있으면 실내를 우선한다', () => {
    const judged = judgeForecast(forecast({ precipitationTypeCode: 1 }), coordinate)

    expect(judged.available && judged.indoorRecommended).toBe(true)
    expect(judged.available && judged.precipitationType).toBe('rain')
  })

  it('강수확률이 기준 이상이면 실내를 우선한다', () => {
    const judged = judgeForecast(
      forecast({ precipitationProbability: 70 }),
      coordinate,
    )

    expect(judged.available && judged.indoorRecommended).toBe(true)
  })

  it('덥지도 춥지도 않고 비 예보도 없으면 실내를 강제하지 않는다', () => {
    const judged = judgeForecast(forecast(), coordinate)

    expect(judged.available && judged.indoorRecommended).toBe(false)
  })

  it('기온 값이 없으면 날씨 미반영으로 처리한다', () => {
    const judged = judgeForecast(forecast({ temperatureC: null }), coordinate)

    expect(judged.available).toBe(false)
  })
})
