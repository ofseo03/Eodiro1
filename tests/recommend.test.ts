import { describe, expect, it } from 'vitest'
import { recommendCourses } from '@/lib/engine/recommend'
import { input, noWeather, providers } from './helpers'

const deps = { weather: noWeather, providers: providers() }

describe('recommendCourses', () => {
  it('선택한 지역 안의 장소로만 코스를 구성한다', async () => {
    const result = await recommendCourses(input({ regionId: 'yeonnam' }), deps)

    expect(result.courses.length).toBeGreaterThan(0)
    for (const course of result.courses) {
      for (const place of course.places) {
        expect(place.regionId).toBe('yeonnam')
      }
    }
  })

  it('취향의 카테고리 구성만큼 장소를 배치한다', async () => {
    const result = await recommendCourses(
      input({
        preferences: { categories: ['cafe', 'restaurant'], likedTags: [], avoidTags: [] },
      }),
      deps,
    )

    expect(result.courses[0].places).toHaveLength(2)
    const categories = result.courses[0].places.map((place) => place.category).sort()
    expect(categories).toEqual(['cafe', 'restaurant'])
  })

  it('기피 태그가 붙은 장소는 추천하지 않는다', async () => {
    const result = await recommendCourses(
      input({
        preferences: {
          categories: ['cafe', 'restaurant', 'activity'],
          likedTags: [],
          avoidTags: ['야외'],
        },
      }),
      deps,
    )

    for (const course of result.courses) {
      for (const place of course.places) {
        expect(place.tags).not.toContain('야외')
      }
    }
  })

  it('택시 없는 코스를 먼저 추천한다', async () => {
    const result = await recommendCourses(
      input({ maxWalkMetersPerLeg: 200, allowTaxiFallback: true }),
      deps,
    )

    expect(result.courses.length).toBeGreaterThan(0)
    expect(result.courses[0].usesTaxi).toBe(false)
  })

  it('연결할 수 없는 조건에서는 코스를 만들지 않고 사유를 알린다', async () => {
    const result = await recommendCourses(input({ maxWalkMetersPerLeg: 10 }), deps)

    expect(result.courses).toHaveLength(0)
    expect(result.notice).not.toBeNull()
  })

  it('추천한 코스는 모든 구간이 이동 가능한 것으로 처리된다', async () => {
    const result = await recommendCourses(input(), deps)

    for (const course of result.courses) {
      expect(course.connected).toBe(true)
      expect(course.legs).toHaveLength(course.places.length - 1)
    }
  })

  it('보행거리를 확인하지 못하면 조건 충족을 확정하지 않는다', async () => {
    const result = await recommendCourses(input(), deps)

    for (const course of result.courses) {
      expect(course.fullyConfirmed).toBe(false)
      expect(course.totals.withinTotalLimit).not.toBe('yes')
    }
  })

  it('날씨를 조회하지 못하면 날씨 미반영을 알린다', async () => {
    const result = await recommendCourses(input(), deps)

    expect(result.weather.available).toBe(false)
    expect(result.courses[0].warnings).toContain('날씨 미반영')
  })

  it('같은 장소 구성이 순서만 바꿔 중복되지 않는다', async () => {
    const result = await recommendCourses(input(), deps)
    const keys = result.courses.map((course) =>
      course.places
        .map((place) => place.id)
        .sort()
        .join('|'),
    )

    expect(new Set(keys).size).toBe(keys.length)
  })
})
