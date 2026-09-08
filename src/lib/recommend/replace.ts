import { COURSE_RULES } from '../rules'
import { straightDistanceMeters } from '../geo'
import { findRegion } from '../regions'
import type { Course, Place, RecommendRequest, ReplaceCandidate, ReplaceResponse } from '../types'
import { loadCandidates } from './candidates'
import { resolveSegment } from './segments'
import { summarize } from './course'

/**
 * spec '장소 하나 교체하기'.
 * - 원래 장소 기준 반경 100m(좌표 직선거리) 안의 같은 카테고리 장소만 후보로 삼는다.
 * - 원래 장소와 코스에 이미 포함된 장소는 제외한다.
 * - 반경 내 후보가 없으면 반경을 임의로 넓히지 않고 없음을 알린다(spec 미확정 사항).
 */
export async function findReplacements(
  course: Course,
  placeId: string,
  request: RecommendRequest,
): Promise<ReplaceResponse> {
  const radiusMeters = COURSE_RULES.replaceRadiusMeters
  const target = course.places.find((place) => place.id === placeId)
  const region = findRegion(course.regionId)

  if (!target || !region) {
    return { candidates: [], radiusMeters, message: '교체할 장소를 찾지 못했습니다.' }
  }

  const { places } = await loadCandidates(region)
  const excluded = new Set(course.places.map((place) => place.id))

  const candidates: ReplaceCandidate[] = places
    .filter((place) => place.category === target.category && !excluded.has(place.id))
    .map((place) => ({
      place,
      straightMeters: straightDistanceMeters(target.coordinate, place.coordinate),
    }))
    .filter((candidate) => candidate.straightMeters <= radiusMeters)
    // 기존 취향 태그를 유지한 채 가까운 순으로 정렬한다.
    .sort((a, b) => {
      const bonus = (name: string) =>
        request.preference.tags.some((tag) => tag !== '' && name.includes(tag)) ? -50 : 0
      return (
        a.straightMeters + bonus(a.place.name) - (b.straightMeters + bonus(b.place.name))
      )
    })

  if (candidates.length === 0) {
    return {
      candidates: [],
      radiusMeters,
      message: `${target.name} 기준 반경 ${radiusMeters}m 안에 같은 카테고리의 다른 장소가 없습니다. 반경은 임의로 넓히지 않습니다.`,
    }
  }

  return { candidates, radiusMeters }
}

/**
 * 교체 장소를 적용하고, 앞뒤 이동 구간만 다시 조회해 조건을 재검증한다.
 * 방문 순서와 나머지 장소는 유지한다.
 */
export async function applyReplacement(
  course: Course,
  placeId: string,
  replacement: Place,
  request: RecommendRequest,
): Promise<Course> {
  const index = course.places.findIndex((place) => place.id === placeId)
  if (index === -1) return course

  const places = [...course.places]
  places[index] = replacement

  const segments = [...course.segments]
  if (index > 0) {
    segments[index - 1] = await resolveSegment(places[index - 1], replacement, request)
  }
  if (index < places.length - 1) {
    segments[index] = await resolveSegment(replacement, places[index + 1], request)
  }

  const totals = summarize(segments, request)
  const weatherApplied =
    course.weather.status === 'available' && places.every((place) => place.indoor !== 'unknown')

  const warnings = [...course.warnings]
  if (totals.walkLimit !== 'within' || totals.travelLimit !== 'within') {
    warnings.push('교체 후 앞뒤 구간을 다시 조회했으나 조건 충족을 확정하지 못했습니다')
  }

  return {
    ...course,
    places,
    segments,
    totals,
    weatherApplied,
    warnings: Array.from(new Set(warnings)),
    allConditionsMet:
      totals.travelLimit === 'within' &&
      totals.walkLimit === 'within' &&
      segments.every((segment) => segment.status === 'ok'),
  }
}
