import { MAX_WALK_METERS_LIMIT } from '../constants'
import { findRegion } from '../data/regions'
import type { Category, RecommendInput, SelectableMode } from '../types'

const CATEGORIES: Category[] = ['cafe', 'restaurant', 'activity']
const MODES: SelectableMode[] = ['walk', 'bus', 'subway']

export type ValidationResult =
  | { ok: true; input: RecommendInput }
  | { ok: false; errors: string[] }

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

/** 요청 본문을 검증한다. 스펙 2절의 입력 제약을 그대로 적용한다. */
export function validateRecommendInput(raw: unknown): ValidationResult {
  const errors: string[] = []
  const body = (raw ?? {}) as Record<string, unknown>

  const regionId = typeof body.regionId === 'string' ? body.regionId : ''
  if (!findRegion(regionId)) {
    errors.push('지원하지 않는 지역입니다.')
  }

  const visitAt = typeof body.visitAt === 'string' ? body.visitAt : ''
  if (!visitAt || Number.isNaN(Date.parse(visitAt))) {
    errors.push('방문 시각이 올바르지 않습니다.')
  }

  const maxTotalTravelMinutes = Number(body.maxTotalTravelMinutes)
  if (!Number.isFinite(maxTotalTravelMinutes) || maxTotalTravelMinutes <= 0) {
    errors.push('총 이동시간 상한은 0보다 큰 값이어야 합니다.')
  }

  const maxWalkMetersPerLeg = Number(body.maxWalkMetersPerLeg)
  if (!Number.isFinite(maxWalkMetersPerLeg) || maxWalkMetersPerLeg <= 0) {
    errors.push('최대 도보 거리는 0보다 큰 값이어야 합니다.')
  } else if (maxWalkMetersPerLeg > MAX_WALK_METERS_LIMIT) {
    errors.push(`최대 도보 거리는 ${MAX_WALK_METERS_LIMIT}m 이하여야 합니다.`)
  }

  const rawModes = isStringArray(body.allowedModes) ? body.allowedModes : []
  const allowedModes = MODES.filter((mode) => rawModes.includes(mode))
  if (allowedModes.length === 0) {
    errors.push('허용 교통수단을 하나 이상 선택해야 합니다.')
  }

  const preferencesRaw = (body.preferences ?? {}) as Record<string, unknown>
  const rawCategories = isStringArray(preferencesRaw.categories)
    ? preferencesRaw.categories
    : []
  const categories = CATEGORIES.filter((category) =>
    rawCategories.includes(category),
  )
  if (categories.length < 2) {
    errors.push('코스 구성 카테고리를 두 개 이상 선택해야 합니다.')
  }

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    input: {
      regionId,
      visitAt,
      maxTotalTravelMinutes,
      maxWalkMetersPerLeg,
      allowedModes,
      allowTaxiFallback: body.allowTaxiFallback === true,
      preferences: {
        categories,
        likedTags: isStringArray(preferencesRaw.likedTags)
          ? preferencesRaw.likedTags
          : [],
        avoidTags: isStringArray(preferencesRaw.avoidTags)
          ? preferencesRaw.avoidTags
          : [],
      },
    },
  }
}
