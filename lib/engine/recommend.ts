import { getPlaceProvider, type PlaceProvider } from '../data/places'
import { findRegion } from '../data/regions'
import { straightLineDistanceM } from '../geo'
import type {
  Category,
  Course,
  Place,
  RecommendInput,
  RecommendResult,
  WeatherAssessment,
} from '../types'
import { assessWeather } from '../weather'
import { buildCourse, compareCourses, isExcluded, scorePlace } from './course'
import { defaultProviders, LegPlanner, type RoutingProviders } from './leg'

/** 카테고리별로 검토할 후보 장소 수. 조합 폭발을 막기 위한 상한이다. */
const CANDIDATES_PER_CATEGORY = 4

/** 최종적으로 제시할 코스 수. */
const MAX_COURSES = 3

export interface RecommendDeps {
  placeProvider?: PlaceProvider
  providers?: RoutingProviders
  weather?: WeatherAssessment
  now?: Date
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  const result: T[][] = []
  for (let i = 0; i < items.length; i += 1) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)]
    for (const permutation of permutations(rest)) {
      result.push([items[i], ...permutation])
    }
  }
  return result
}

function combinations(pools: Place[][]): Place[][] {
  return pools.reduce<Place[][]>(
    (acc, pool) => acc.flatMap((prefix) => pool.map((place) => [...prefix, place])),
    [[]],
  )
}

/** 지역 안에 있고 취향에 어긋나지 않는 후보를 카테고리별로 고른다. */
export function selectCandidates(
  places: Place[],
  input: RecommendInput,
  weather: WeatherAssessment,
  regionCenter: { lat: number; lng: number },
  regionRadiusM: number,
): Map<Category, Place[]> {
  const pools = new Map<Category, Place[]>()

  for (const category of input.preferences.categories) {
    const pool = places
      .filter((place) => place.category === category)
      .filter((place) => !isExcluded(place, input.preferences))
      .filter(
        (place) =>
          straightLineDistanceM(regionCenter, place.coordinate) <= regionRadiusM,
      )
      .map((place) => ({
        place,
        score: scorePlace(place, input.preferences, weather),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, CANDIDATES_PER_CATEGORY)
      .map((entry) => entry.place)

    pools.set(category, pool)
  }

  return pools
}

export async function recommendCourses(
  input: RecommendInput,
  deps: RecommendDeps = {},
): Promise<RecommendResult> {
  const region = findRegion(input.regionId)
  if (!region) {
    throw new Error(`지원하지 않는 지역입니다: ${input.regionId}`)
  }

  const placeProvider = deps.placeProvider ?? getPlaceProvider()
  const providers = deps.providers ?? defaultProviders()
  const visitAt = new Date(input.visitAt)
  const weather =
    deps.weather ?? (await assessWeather(region.center, visitAt, deps.now))

  const places = await placeProvider.listByRegion(region.id)
  const pools = selectCandidates(
    places,
    input,
    weather,
    region.center,
    region.radiusM,
  )

  const emptyCategories = [...pools.entries()].filter(
    ([, pool]) => pool.length === 0,
  )
  if (emptyCategories.length > 0) {
    return {
      region,
      visitAt: input.visitAt,
      weather,
      courses: [],
      notice:
        '선택한 지역에서 취향 조건을 만족하는 후보를 찾지 못한 카테고리가 있습니다. 기피 태그나 코스 구성을 조정해 보세요.',
      dataNotices: collectNotices(placeProvider, providers, input),
    }
  }

  const planner = new LegPlanner(input, providers, visitAt)
  const orderedPools = input.preferences.categories.map(
    (category) => pools.get(category) ?? [],
  )

  const courses: Course[] = []
  for (const combination of combinations(orderedPools)) {
    for (const ordered of permutations(combination)) {
      const course = await buildCourse(ordered, input, weather, planner)
      // 이동 방법을 확정하지 못했거나 상한 초과가 확정된 코스는 제외한다.
      if (!course.connected) continue
      if (course.totals.withinTotalLimit === 'no') continue
      courses.push(course)
    }
  }

  courses.sort(compareCourses)
  const selected = pickDistinct(courses, MAX_COURSES)

  return {
    region,
    visitAt: input.visitAt,
    weather,
    courses: selected,
    notice:
      selected.length === 0
        ? '허용한 교통수단과 이동 조건으로 연결할 수 있는 코스를 찾지 못했습니다. 최대 도보 거리나 총 이동시간 상한을 조정해 보세요.'
        : null,
    dataNotices: collectNotices(placeProvider, providers, input),
  }
}

/** 같은 장소 구성이 순서만 바꿔 반복되지 않도록 코스를 고른다. */
function pickDistinct(courses: Course[], limit: number): Course[] {
  const seen = new Set<string>()
  const picked: Course[] = []

  for (const course of courses) {
    const key = course.places
      .map((place) => place.id)
      .sort()
      .join('|')
    if (seen.has(key)) continue
    seen.add(key)
    picked.push(course)
    if (picked.length === limit) break
  }

  return picked
}

function collectNotices(
  placeProvider: PlaceProvider,
  providers: RoutingProviders,
  input: RecommendInput,
): string[] {
  const notices: string[] = []
  if (placeProvider.notice) notices.push(placeProvider.notice)
  if (input.allowedModes.includes('walk') && providers.walk.notice) {
    notices.push(providers.walk.notice)
  }
  if (
    input.allowedModes.some((mode) => mode === 'bus' || mode === 'subway') &&
    providers.transit.notice
  ) {
    notices.push(providers.transit.notice)
  }
  return notices
}
