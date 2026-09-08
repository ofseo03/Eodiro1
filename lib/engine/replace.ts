import { REPLACEMENT_RADIUS_M } from '../constants'
import { getPlaceProvider, type PlaceProvider } from '../data/places'
import { findRegion } from '../data/regions'
import { straightLineDistanceM } from '../geo'
import type { Course, Place, RecommendInput, WeatherAssessment } from '../types'
import { assessWeather } from '../weather'
import { buildCourse, isExcluded, scorePlace } from './course'
import { defaultProviders, LegPlanner, type RoutingProviders } from './leg'

export interface ReplacementCandidate {
  place: Place
  /** 원래 장소로부터의 직선거리(m). */
  straightLineM: number
}

export interface ReplacementResult {
  target: Place
  candidates: ReplacementCandidate[]
  radiusM: number
  notice: string | null
}

export interface ReplaceDeps {
  placeProvider?: PlaceProvider
  providers?: RoutingProviders
  weather?: WeatherAssessment
  now?: Date
}

/**
 * 교체 후보를 찾는다.
 *
 * 스펙에 따라 원래 장소 기준 반경 100m 이내, 같은 카테고리이며 코스에 이미
 * 포함된 장소는 제외한다. 반경은 좌표 기준 직선거리로 해석하고, 후보가 없을
 * 때 반경을 임의로 넓히지 않는다.
 */
export async function findReplacementCandidates(
  input: RecommendInput,
  coursePlaceIds: string[],
  targetPlaceId: string,
  deps: ReplaceDeps = {},
): Promise<ReplacementResult> {
  const region = findRegion(input.regionId)
  if (!region) throw new Error(`지원하지 않는 지역입니다: ${input.regionId}`)
  if (!coursePlaceIds.includes(targetPlaceId)) {
    throw new Error('교체하려는 장소가 코스에 포함되어 있지 않습니다.')
  }

  const placeProvider = deps.placeProvider ?? getPlaceProvider()
  const coursePlaces = await placeProvider.findByIds(coursePlaceIds)
  const target = coursePlaces.find((place) => place.id === targetPlaceId)
  if (!target) throw new Error('교체하려는 장소를 찾지 못했습니다.')

  const weather =
    deps.weather ??
    (await assessWeather(region.center, new Date(input.visitAt), deps.now))

  const inCourse = new Set(coursePlaceIds)
  const places = await placeProvider.listByRegion(region.id)

  const candidates = places
    .filter((place) => place.category === target.category)
    .filter((place) => !inCourse.has(place.id))
    .filter((place) => !isExcluded(place, input.preferences))
    .map((place) => ({
      place,
      straightLineM: Math.round(
        straightLineDistanceM(target.coordinate, place.coordinate),
      ),
    }))
    .filter((entry) => entry.straightLineM <= REPLACEMENT_RADIUS_M)
    .sort((a, b) => {
      const scoreDiff =
        scorePlace(b.place, input.preferences, weather) -
        scorePlace(a.place, input.preferences, weather)
      return scoreDiff !== 0 ? scoreDiff : a.straightLineM - b.straightLineM
    })

  return {
    target,
    candidates,
    radiusM: REPLACEMENT_RADIUS_M,
    notice:
      candidates.length === 0
        ? `${target.name} 기준 반경 ${REPLACEMENT_RADIUS_M}m 안에서 조건에 맞는 같은 카테고리 장소를 찾지 못했습니다.`
        : null,
  }
}

export interface RecomputedCourse {
  course: Course
  weather: WeatherAssessment
  dataNotices: string[]
}

/**
 * 장소 목록으로 코스를 다시 구성한다.
 * 교체 후 앞뒤 이동 구간과 총 이동시간 조건을 재검증하는 데 사용한다.
 */
export async function recomputeCourse(
  input: RecommendInput,
  placeIds: string[],
  deps: ReplaceDeps = {},
): Promise<RecomputedCourse> {
  const region = findRegion(input.regionId)
  if (!region) throw new Error(`지원하지 않는 지역입니다: ${input.regionId}`)

  const placeProvider = deps.placeProvider ?? getPlaceProvider()
  const providers = deps.providers ?? defaultProviders()
  const found = await placeProvider.findByIds(placeIds)
  const byId = new Map(found.map((place) => [place.id, place]))
  const places = placeIds.map((id) => {
    const place = byId.get(id)
    if (!place) throw new Error(`장소를 찾지 못했습니다: ${id}`)
    return place
  })

  const outside = places.filter((place) => place.regionId !== region.id)
  if (outside.length > 0) {
    throw new Error('선택한 지역 밖의 장소는 코스에 포함할 수 없습니다.')
  }

  const visitAt = new Date(input.visitAt)
  const weather =
    deps.weather ?? (await assessWeather(region.center, visitAt, deps.now))
  const planner = new LegPlanner(input, providers, visitAt)
  const course = await buildCourse(places, input, weather, planner)

  const dataNotices = [
    placeProvider.notice,
    input.allowedModes.includes('walk') ? providers.walk.notice : null,
    input.allowedModes.some((mode) => mode === 'bus' || mode === 'subway')
      ? providers.transit.notice
      : null,
  ].filter((notice): notice is string => Boolean(notice))

  return { course, weather, dataNotices }
}
