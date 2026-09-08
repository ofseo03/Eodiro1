import { describe, expect, it } from 'vitest'
import { scorePlace, summarize } from '@/lib/engine/course'
import type { Leg, WeatherAssessment } from '@/lib/types'
import { noWeather, place } from './helpers'

function leg(overrides: Partial<Leg>): Leg {
  return {
    from: place({ id: 'a' }),
    to: place({ id: 'b' }),
    status: 'walk',
    mode: 'walk',
    straightLineM: 100,
    walkDistanceM: 130,
    walkDistanceConfidence: 'verified',
    minutes: 2,
    minutesConfidence: 'verified',
    withinWalkLimit: 'yes',
    detail: null,
    notes: [],
    ...overrides,
  }
}

const indoorWeather: WeatherAssessment = {
  available: true,
  temperatureC: 31,
  precipitationProbability: 10,
  precipitationType: 'none',
  indoorRecommended: true,
  reasons: ['기온 31℃'],
  basedOn: {
    coordinate: { lat: 37.5445, lng: 127.0557 },
    forecastTime: '2026-05-01 14:00 KST',
    source: 'test',
  },
}

describe('summarize', () => {
  it('모든 구간이 확인된 값이고 상한 이내면 충족으로 표시한다', () => {
    const totals = summarize([leg({ minutes: 10 }), leg({ minutes: 12 })], 45)

    expect(totals.knownMinutes).toBe(22)
    expect(totals.withinTotalLimit).toBe('yes')
  })

  it('추정값이 섞여 있으면 상한 충족을 확정하지 않는다', () => {
    const totals = summarize(
      [leg({ minutes: 10 }), leg({ minutes: 12, minutesConfidence: 'estimated' })],
      45,
    )

    expect(totals.withinTotalLimit).toBe('unknown')
  })

  it('미확인 구간을 0분으로 처리하지 않고 확정하지 않는다', () => {
    const totals = summarize(
      [leg({ minutes: 10 }), leg({ minutes: null, minutesConfidence: 'unknown' })],
      45,
    )

    expect(totals.knownMinutes).toBe(10)
    expect(totals.hasUnknownMinutes).toBe(true)
    expect(totals.withinTotalLimit).toBe('unknown')
  })

  it('확인된 구간만으로 상한을 넘으면 미충족이 확정된다', () => {
    const totals = summarize(
      [leg({ minutes: 50 }), leg({ minutes: null, minutesConfidence: 'unknown' })],
      45,
    )

    expect(totals.withinTotalLimit).toBe('no')
  })
})

describe('scorePlace', () => {
  const preferences = { categories: [], likedTags: ['디저트'], avoidTags: [] }

  it('선호 태그가 맞으면 점수를 올린다', () => {
    const scored = scorePlace(
      place({ id: 'p', tags: ['디저트'] }),
      { categories: [], likedTags: ['디저트'], avoidTags: [] },
      noWeather,
    )

    expect(scored).toBeGreaterThan(0)
  })

  it('실내 우선 조건에서 복합·미확인 장소를 실내로 취급하지 않는다', () => {
    const indoor = scorePlace(place({ id: 'i', indoor: 'indoor' }), preferences, indoorWeather)
    const mixed = scorePlace(place({ id: 'm', indoor: 'mixed' }), preferences, indoorWeather)
    const unknown = scorePlace(place({ id: 'u', indoor: 'unknown' }), preferences, indoorWeather)
    const outdoor = scorePlace(place({ id: 'o', indoor: 'outdoor' }), preferences, indoorWeather)

    expect(indoor).toBeGreaterThan(mixed)
    expect(indoor).toBeGreaterThan(unknown)
    expect(mixed).toBeGreaterThan(outdoor)
  })
})
