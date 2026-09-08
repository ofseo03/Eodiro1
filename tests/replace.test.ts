import { describe, expect, it } from 'vitest'
import { REPLACEMENT_RADIUS_M } from '@/lib/constants'
import { findReplacementCandidates, recomputeCourse } from '@/lib/engine/replace'
import { input, noWeather, providers } from './helpers'

const deps = { weather: noWeather, providers: providers() }
const coursePlaceIds = ['seongsu-food-1', 'seongsu-cafe-1', 'seongsu-act-1']

describe('findReplacementCandidates', () => {
  it('원래 장소 기준 반경 안의 같은 카테고리 장소만 제안한다', async () => {
    const result = await findReplacementCandidates(
      input(),
      coursePlaceIds,
      'seongsu-act-1',
      deps,
    )

    expect(result.radiusM).toBe(REPLACEMENT_RADIUS_M)
    expect(result.candidates.length).toBeGreaterThan(0)
    for (const candidate of result.candidates) {
      expect(candidate.place.category).toBe('activity')
      expect(candidate.straightLineM).toBeLessThanOrEqual(REPLACEMENT_RADIUS_M)
    }
  })

  it('원래 장소와 코스에 이미 포함된 장소는 후보에서 제외한다', async () => {
    const result = await findReplacementCandidates(
      input(),
      coursePlaceIds,
      'seongsu-act-1',
      deps,
    )
    const ids = result.candidates.map((candidate) => candidate.place.id)

    for (const id of coursePlaceIds) {
      expect(ids).not.toContain(id)
    }
  })

  it('반경 안에 후보가 없으면 범위를 넓히지 않고 안내한다', async () => {
    const result = await findReplacementCandidates(
      input(),
      ['seongsu-food-1', 'seongsu-cafe-3', 'seongsu-act-1'],
      'seongsu-cafe-3',
      deps,
    )

    expect(result.candidates).toHaveLength(0)
    expect(result.notice).not.toBeNull()
  })

  it('코스에 없는 장소는 교체 대상이 될 수 없다', async () => {
    await expect(
      findReplacementCandidates(input(), coursePlaceIds, 'seongsu-cafe-4', deps),
    ).rejects.toThrow()
  })
})

describe('recomputeCourse', () => {
  it('교체한 장소만 바뀌고 앞뒤 구간을 다시 계산한다', async () => {
    const before = await recomputeCourse(input(), coursePlaceIds, deps)
    const after = await recomputeCourse(
      input(),
      ['seongsu-food-1', 'seongsu-cafe-1', 'seongsu-act-5'],
      deps,
    )

    expect(after.course.places.map((place) => place.id)).toEqual([
      'seongsu-food-1',
      'seongsu-cafe-1',
      'seongsu-act-5',
    ])
    expect(after.course.legs).toHaveLength(2)
    // 교체한 장소가 마지막이므로 마지막 구간의 도착지가 바뀐다.
    expect(after.course.legs[1].to.id).toBe('seongsu-act-5')
    expect(before.course.legs[1].to.id).toBe('seongsu-act-1')
  })

  it('교체 후 조건을 벗어나면 충족으로 표시하지 않는다', async () => {
    const result = await recomputeCourse(
      input({ maxWalkMetersPerLeg: 100 }),
      ['seongsu-food-1', 'seongsu-cafe-3', 'seongsu-act-1'],
      deps,
    )

    expect(result.course.connected).toBe(false)
    expect(result.course.fullyConfirmed).toBe(false)
  })

  it('선택한 지역 밖의 장소는 코스에 넣을 수 없다', async () => {
    await expect(
      recomputeCourse(
        input(),
        ['seongsu-food-1', 'seongsu-cafe-1', 'yeonnam-act-1'],
        deps,
      ),
    ).rejects.toThrow()
  })
})
