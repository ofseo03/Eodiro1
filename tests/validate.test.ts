import { describe, expect, it } from 'vitest'
import { MAX_WALK_METERS_LIMIT } from '@/lib/constants'
import { validateRecommendInput } from '@/lib/engine/validate'

const base = {
  regionId: 'seongsu',
  visitAt: '2026-05-01T05:00:00.000Z',
  maxTotalTravelMinutes: 45,
  maxWalkMetersPerLeg: 600,
  allowedModes: ['walk'],
  allowTaxiFallback: false,
  preferences: { categories: ['cafe', 'restaurant'], likedTags: [], avoidTags: [] },
}

describe('validateRecommendInput', () => {
  it('올바른 입력을 통과시킨다', () => {
    const result = validateRecommendInput(base)

    expect(result.ok).toBe(true)
  })

  it('최대 도보 거리 상한을 넘으면 거부한다', () => {
    const result = validateRecommendInput({
      ...base,
      maxWalkMetersPerLeg: MAX_WALK_METERS_LIMIT + 1,
    })

    expect(result.ok).toBe(false)
  })

  it('이동시간과 도보 거리는 양수여야 한다', () => {
    expect(validateRecommendInput({ ...base, maxTotalTravelMinutes: 0 }).ok).toBe(false)
    expect(validateRecommendInput({ ...base, maxWalkMetersPerLeg: -1 }).ok).toBe(false)
  })

  it('허용 교통수단을 하나 이상 선택해야 한다', () => {
    expect(validateRecommendInput({ ...base, allowedModes: [] }).ok).toBe(false)
    expect(validateRecommendInput({ ...base, allowedModes: ['taxi'] }).ok).toBe(false)
  })

  it('지원하지 않는 지역과 잘못된 시각을 거부한다', () => {
    expect(validateRecommendInput({ ...base, regionId: 'busan' }).ok).toBe(false)
    expect(validateRecommendInput({ ...base, visitAt: '언젠가' }).ok).toBe(false)
  })

  it('코스 구성 카테고리는 두 개 이상이어야 한다', () => {
    const result = validateRecommendInput({
      ...base,
      preferences: { categories: ['cafe'], likedTags: [], avoidTags: [] },
    })

    expect(result.ok).toBe(false)
  })
})
