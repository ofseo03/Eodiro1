import { fetchShortTermForecast } from '../api/kma'
import { hasDataGoKrKey } from '../config'
import { COURSE_RULES } from '../rules'
import { straightDistanceMeters } from '../geo'
import { findRegion } from '../regions'
import type {
  Coordinate,
  Course,
  CourseTotals,
  DataSourceReport,
  Place,
  PlaceCategory,
  RecommendRequest,
  RecommendResponse,
  Segment,
  WeatherInfo,
} from '../types'
import { loadCandidates } from './candidates'
import { resolveSegment } from './segments'

const CATEGORY_ORDER: PlaceCategory[] = ['cafe', 'restaurant', 'attraction']

export async function buildCourse(request: RecommendRequest): Promise<RecommendResponse> {
  const region = findRegion(request.regionId)
  const dataSources: DataSourceReport[] = []

  if (!region) {
    return { course: null, message: `알 수 없는 지역입니다: ${request.regionId}`, dataSources }
  }

  const origin = request.origin ?? region.center
  const [{ places: candidates, report }, weather] = await Promise.all([
    loadCandidates(region),
    fetchShortTermForecast(region.center, request.visitAt),
  ])
  dataSources.push(report)
  dataSources.push({
    name: '기상청 단기예보',
    status: weather.status === 'available' ? 'live' : hasDataGoKrKey() ? 'failed' : 'not_configured',
    detail: weather.status === 'available' ? undefined : weather.reason,
  })
  dataSources.push({
    name: '서울특별시 대중교통환승경로',
    status: hasDataGoKrKey() ? 'live' : 'not_configured',
    detail: hasDataGoKrKey()
      ? '구간별 조회 결과는 각 구간 상태에 표시됩니다'
      : 'DATA_GO_KR_SERVICE_KEY 미설정 — 모든 대중교통 구간은 조회 실패로 표시됩니다',
  })

  const selected = selectPlaces(candidates, request, weather, origin)
  if (selected.length < 2) {
    return {
      course: null,
      message: `${region.name}에서 조건에 맞는 방문 후보를 충분히 찾지 못했습니다.`,
      dataSources,
    }
  }

  const ordered = orderByNearestNeighbour(selected, origin)

  const segments: Segment[] = []
  for (let i = 0; i < ordered.length - 1; i += 1) {
    segments.push(await resolveSegment(ordered[i], ordered[i + 1], request))
  }

  const totals = summarize(segments, request)
  const weatherApplied =
    weather.status === 'available' && ordered.every((place) => place.indoor !== 'unknown')

  const warnings: string[] = []
  if (weather.status !== 'available') warnings.push(`날씨 미반영 — ${weather.reason}`)
  if (!weatherApplied && weather.status === 'available') {
    warnings.push('실내·실외 분류가 확인되지 않은 장소가 있어 날씨 반영을 확정하지 않았습니다')
  }
  if (report.status === 'sample') warnings.push('장소 데이터가 샘플 데이터입니다 — 실제 API 검증 결과가 아닙니다')
  if (totals.walkLimit === 'unconfirmed') {
    warnings.push('실제 보행거리를 확보하지 못해 구간별 최대 도보 거리 충족을 확정하지 않았습니다')
  }
  if (totals.unknownSegmentCount > 0) {
    warnings.push(`이동시간이 미확인인 구간 ${totals.unknownSegmentCount}개가 있어 총 이동시간을 확정하지 않았습니다`)
  }

  const allConditionsMet =
    totals.travelLimit === 'within' &&
    totals.walkLimit === 'within' &&
    segments.every((segment) => segment.status === 'ok')

  const course: Course = {
    id: `${region.id}-${Date.parse(request.visitAt) || Date.now()}`,
    regionId: region.id,
    regionName: region.name,
    places: ordered,
    segments,
    weather,
    totals,
    weatherApplied,
    basis: {
      visitAt: request.visitAt,
      referenceCoordinate: origin,
      referenceLabel: request.origin ? '사용자 입력 출발 위치' : `${region.label} (지역 중심)`,
    },
    allConditionsMet,
    warnings,
  }

  return { course, dataSources }
}

/**
 * 취향·날씨를 반영해 방문 장소를 고른다.
 * 실내 우선은 실내로 '확인된' 장소에만 적용한다. 복합·미확인은 실내로 단정하지 않는다.
 */
function selectPlaces(
  candidates: Place[],
  request: RecommendRequest,
  weather: WeatherInfo,
  origin: Coordinate,
): Place[] {
  const wanted = request.preference.categories.length > 0
    ? request.preference.categories
    : CATEGORY_ORDER
  const preferIndoor = weather.status === 'available' && weather.prefersIndoor

  const score = (place: Place) => {
    let value = 0
    if (preferIndoor) {
      if (place.indoor === 'indoor') value -= 2000
      else if (place.indoor === 'outdoor') value += 2000
      // 복합·미확인은 가산도 감산도 하지 않는다.
    }
    if (request.preference.tags.some((tag) => tag !== '' && place.name.includes(tag))) {
      value -= 300
    }
    return value + straightDistanceMeters(origin, place.coordinate) / 10
  }

  const picked: Place[] = []
  const used = new Set<string>()

  // 요청한 카테고리를 한 번씩 채운 뒤, 남은 자리는 점수 순으로 채운다.
  for (const category of wanted) {
    if (picked.length >= COURSE_RULES.placeCount) break
    const best = candidates
      .filter((place) => place.category === category && !used.has(place.id))
      .sort((a, b) => score(a) - score(b))[0]
    if (best) {
      picked.push(best)
      used.add(best.id)
    }
  }

  const rest = candidates
    .filter((place) => !used.has(place.id) && wanted.includes(place.category))
    .sort((a, b) => score(a) - score(b))

  for (const place of rest) {
    if (picked.length >= COURSE_RULES.placeCount) break
    picked.push(place)
    used.add(place.id)
  }

  return picked
}

/** 출발 위치에서 가장 가까운 장소부터 이어 붙여 방문 순서를 만든다. */
function orderByNearestNeighbour(places: Place[], origin: Coordinate): Place[] {
  const remaining = [...places]
  const ordered: Place[] = []
  let current = origin

  while (remaining.length > 0) {
    let bestIndex = 0
    let bestDistance = Number.POSITIVE_INFINITY
    remaining.forEach((place, index) => {
      const distance = straightDistanceMeters(current, place.coordinate)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = index
      }
    })
    const [next] = remaining.splice(bestIndex, 1)
    ordered.push(next)
    current = next.coordinate
  }

  return ordered
}

/**
 * 구간 상태를 합산한다.
 * 미확인 시간을 0분으로 처리하지 않으며, 미확인이 하나라도 있으면 상한 충족을 확정하지 않는다.
 */
export function summarize(segments: Segment[], request: RecommendRequest): CourseTotals {
  let confirmedMinutes = 0
  let unknownSegmentCount = 0

  for (const segment of segments) {
    if (segment.duration.kind === 'known') confirmedMinutes += segment.duration.minutes
    else unknownSegmentCount += 1
  }

  const totalMinutes = unknownSegmentCount === 0 ? confirmedMinutes : null

  let travelLimit: CourseTotals['travelLimit']
  if (confirmedMinutes > request.maxTravelMinutes) {
    // 확인된 시간만으로도 상한을 넘으면, 나머지가 미확인이어도 초과가 확정된다.
    travelLimit = 'exceeded'
  } else if (unknownSegmentCount > 0) {
    travelLimit = 'unconfirmed'
  } else {
    travelLimit = 'within'
  }

  const walkStates = segments
    .map((segment) => segment.walkLimit)
    .filter((state) => state !== 'not_applicable')

  let walkLimit: CourseTotals['walkLimit']
  if (walkStates.includes('exceeded')) walkLimit = 'exceeded'
  else if (walkStates.includes('unconfirmed')) walkLimit = 'unconfirmed'
  else walkLimit = 'within'

  return { totalMinutes, confirmedMinutes, unknownSegmentCount, travelLimit, walkLimit }
}
