import type {
  Course,
  CourseTotals,
  Leg,
  Place,
  Preferences,
  RecommendInput,
  Ternary,
  WeatherAssessment,
} from '../types'
import type { LegPlanner } from './leg'

/** 이동 가능한 것으로 처리하는 구간 상태. */
const CONNECTED_STATUSES = new Set<Leg['status']>(['walk', 'transit', 'taxi-review'])

export function summarize(legs: Leg[], maxTotalMinutes: number): CourseTotals {
  const knownMinutes = legs.reduce((sum, leg) => sum + (leg.minutes ?? 0), 0)
  const hasUnknownMinutes = legs.some((leg) => leg.minutes === null)
  const allMinutesVerified =
    legs.length > 0 && legs.every((leg) => leg.minutesConfidence === 'verified')

  let withinTotalLimit: Ternary
  if (knownMinutes > maxTotalMinutes) {
    // 확인된 구간만으로도 상한을 넘으므로 초과가 확정된다.
    withinTotalLimit = 'no'
  } else if (!hasUnknownMinutes && allMinutesVerified) {
    withinTotalLimit = 'yes'
  } else {
    // 추정값이 섞여 있거나 미확인 구간이 있으면 충족을 확정하지 않는다.
    withinTotalLimit = 'unknown'
  }

  return { knownMinutes, hasUnknownMinutes, allMinutesVerified, withinTotalLimit }
}

/** 취향과 날씨를 반영한 장소 점수. 값이 클수록 우선한다. */
export function scorePlace(
  place: Place,
  preferences: Preferences,
  weather: WeatherAssessment,
): number {
  let score = 0

  for (const tag of place.tags) {
    if (preferences.likedTags.includes(tag)) score += 3
  }

  if (weather.available && weather.indoorRecommended) {
    // 복합·미확인 장소는 실내로 단정하지 않는다.
    if (place.indoor === 'indoor') score += 4
    else if (place.indoor === 'outdoor') score -= 6
    else score -= 1
  }

  return score
}

/** 취향에서 기피 태그를 지정한 장소는 후보에서 제외한다. */
export function isExcluded(place: Place, preferences: Preferences): boolean {
  return place.tags.some((tag) => preferences.avoidTags.includes(tag))
}

export function courseId(places: Place[]): string {
  return places.map((place) => place.id).join('__')
}

export async function buildCourse(
  places: Place[],
  input: RecommendInput,
  weather: WeatherAssessment,
  planner: LegPlanner,
): Promise<Course> {
  const legs: Leg[] = []
  for (let i = 0; i < places.length - 1; i += 1) {
    legs.push(await planner.plan(places[i], places[i + 1]))
  }

  const totals = summarize(legs, input.maxTotalTravelMinutes)
  const connected = legs.every((leg) => CONNECTED_STATUSES.has(leg.status))
  const usesTaxi = legs.some((leg) => leg.status === 'taxi-review')
  const walkLimitConfirmed = legs.every(
    (leg) => leg.status !== 'walk' || leg.withinWalkLimit === 'yes',
  )

  const warnings: string[] = []
  if (!connected) {
    warnings.push('이동 방법을 확정하지 못한 구간이 있습니다.')
  }
  if (!walkLimitConfirmed) {
    warnings.push('실제 보행거리를 확인하지 못해 최대 도보 거리 충족을 확정하지 않았습니다.')
  }
  if (totals.hasUnknownMinutes) {
    warnings.push('이동시간을 알 수 없는 구간이 있어 총 이동시간을 확정하지 않았습니다.')
  }
  if (!weather.available) {
    warnings.push('날씨 미반영')
  }

  const placeScore = places.reduce(
    (sum, place) => sum + scorePlace(place, input.preferences, weather),
    0,
  )

  const fullyConfirmed =
    connected && walkLimitConfirmed && totals.withinTotalLimit === 'yes'

  return {
    id: courseId(places),
    places,
    legs,
    totals,
    usesTaxi,
    connected,
    fullyConfirmed,
    warnings,
    // 택시 없는 코스와 이동시간이 짧은 코스를 우선한다.
    score: placeScore - (usesTaxi ? 50 : 0) - totals.knownMinutes * 0.2,
  }
}

/** 추천 순서. 택시 없는 코스, 확정된 코스, 높은 점수 순. */
export function compareCourses(a: Course, b: Course): number {
  if (a.usesTaxi !== b.usesTaxi) return a.usesTaxi ? 1 : -1
  if (a.fullyConfirmed !== b.fullyConfirmed) return a.fullyConfirmed ? -1 : 1
  if (b.score !== a.score) return b.score - a.score
  return a.totals.knownMinutes - b.totals.knownMinutes
}
