import { COURSE_RULES } from './rules'
import { findRegion } from './regions'
import type { PlaceCategory, RecommendRequest, SelectableMode } from './types'

const MODES: SelectableMode[] = ['walk', 'bus', 'subway']
const CATEGORIES: PlaceCategory[] = ['cafe', 'restaurant', 'attraction']

export type Validated<T> = { ok: true; value: T } | { ok: false; errors: string[] }

/** spec 2항의 입력 제약을 서버에서 다시 확인한다. */
export function parseRecommendRequest(input: unknown): Validated<RecommendRequest> {
  const errors: string[] = []
  const raw = (input ?? {}) as Record<string, unknown>

  const regionId = typeof raw.regionId === 'string' ? raw.regionId : ''
  if (!findRegion(regionId)) errors.push('추천 지역을 선택해 주세요.')

  const maxTravelMinutes = Number(raw.maxTravelMinutes)
  if (!Number.isFinite(maxTravelMinutes) || maxTravelMinutes <= 0) {
    errors.push('총 이동시간 상한은 0보다 큰 값이어야 합니다.')
  }

  const maxWalkMeters = Number(raw.maxWalkMeters)
  if (!Number.isFinite(maxWalkMeters) || maxWalkMeters <= 0) {
    errors.push('구간별 최대 도보 거리는 0보다 큰 값이어야 합니다.')
  } else if (maxWalkMeters > COURSE_RULES.walkLimitCeilingMeters) {
    errors.push(`구간별 최대 도보 거리는 ${COURSE_RULES.walkLimitCeilingMeters}m 이하여야 합니다.`)
  }

  const allowedModes = Array.isArray(raw.allowedModes)
    ? raw.allowedModes.filter((mode): mode is SelectableMode =>
        MODES.includes(mode as SelectableMode),
      )
    : []
  if (allowedModes.length === 0) errors.push('허용 교통수단을 하나 이상 선택해 주세요.')

  const visitAtRaw = typeof raw.visitAt === 'string' ? raw.visitAt : ''
  const visitAt = Number.isNaN(Date.parse(visitAtRaw)) ? '' : new Date(visitAtRaw).toISOString()
  if (visitAt === '') errors.push('방문 날짜·시각을 입력해 주세요.')

  const preferenceRaw = (raw.preference ?? {}) as Record<string, unknown>
  const categories = Array.isArray(preferenceRaw.categories)
    ? preferenceRaw.categories.filter((category): category is PlaceCategory =>
        CATEGORIES.includes(category as PlaceCategory),
      )
    : []
  const tags = Array.isArray(preferenceRaw.tags)
    ? preferenceRaw.tags.filter((tag): tag is string => typeof tag === 'string')
    : []

  let origin: RecommendRequest['origin']
  if (raw.origin && typeof raw.origin === 'object') {
    const candidate = raw.origin as Record<string, unknown>
    const lat = Number(candidate.lat)
    const lng = Number(candidate.lng)
    if (Number.isFinite(lat) && Number.isFinite(lng)) origin = { lat, lng }
  }

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      regionId,
      maxTravelMinutes,
      maxWalkMeters,
      allowedModes,
      allowTaxiFallback: raw.allowTaxiFallback === true,
      preference: { categories: categories.length > 0 ? categories : CATEGORIES, tags },
      visitAt,
      origin,
    },
  }
}
