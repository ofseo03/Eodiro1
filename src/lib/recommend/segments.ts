import { COURSE_RULES } from '../rules'
import { straightDistanceMeters } from '../geo'
import { lookupTransit } from '../api/transit'
import type { Place, RecommendRequest, Segment, TransitLeg } from '../types'

/**
 * 연속한 두 장소 사이의 이동 방법을 결정한다. spec '이동수단 결정' 순서를 그대로 따른다.
 *
 * 1. 도보가 허용되고 조건을 넘지 않으면 도보를 후보로 삼는다.
 * 2. 그렇지 않으면 허용된 버스·지하철로 경로를 조회한다.
 * 3. 택시 없는 대안이 없고 사용자가 택시를 허용하면 '택시 이용 검토'로만 표시한다.
 * 4. 조회 실패는 '경로 조회 실패'이며, 오류만으로 택시 대안으로 전환하지 않는다.
 */
export async function resolveSegment(
  from: Place,
  to: Place,
  request: RecommendRequest,
): Promise<Segment> {
  const straight = straightDistanceMeters(from.coordinate, to.coordinate)
  const base = { fromPlaceId: from.id, toPlaceId: to.id }
  const walkAllowed = request.allowedModes.includes('walk')

  // 직선거리는 실제 보행거리의 하한이므로, 초과하면 도보는 확실히 조건을 벗어난다.
  const walkPossible = walkAllowed && straight <= request.maxWalkMeters

  if (walkPossible) {
    const estimate = Math.max(1, Math.round(straight / COURSE_RULES.walkMetersPerMinute))
    return {
      ...base,
      status: 'ok',
      mode: 'walk',
      legs: [
        {
          mode: 'walk',
          label: '도보',
          duration: { kind: 'unknown' },
          distance: { kind: 'straight', meters: straight },
        },
      ],
      duration: { kind: 'unknown' },
      distance: { kind: 'straight', meters: straight },
      // 실제 보행거리를 확보하지 못했으므로 충족을 확정하지 않는다.
      walkLimit: 'unconfirmed',
      estimatedWalkMinutes: estimate,
      // 거리 표기 자체가 '직선거리 기준'을 밝히므로, 여기서는 추정 시간의 성격만 덧붙인다.
      notes: [
        `직선거리로 추정한 도보 시간 약 ${estimate}분 — 확인된 이동시간 합계에는 넣지 않습니다`,
      ],
    }
  }

  const transitModes = request.allowedModes.filter(
    (mode): mode is 'bus' | 'subway' => mode === 'bus' || mode === 'subway',
  )

  const notes: string[] = []
  if (walkAllowed && straight > request.maxWalkMeters) {
    notes.push(
      `직선거리 ${straight}m 로 구간별 최대 도보 거리(${request.maxWalkMeters}m)를 넘어 도보를 제외했습니다`,
    )
  } else if (!walkAllowed) {
    notes.push('도보를 허용하지 않아 대중교통 경로만 조회했습니다')
  }

  const lookup = await lookupTransit(from.coordinate, to.coordinate, transitModes)

  if (lookup.status === 'ok') {
    const best = pickShortest(lookup.paths)
    const legs: TransitLeg[] = best.legs
    return {
      ...base,
      status: 'ok',
      mode: best.usedModes[0],
      legs,
      duration: best.duration,
      distance: { kind: 'unknown' },
      walkLimit: 'not_applicable',
      accessWalk:
        best.accessWalkMeters !== undefined
          ? {
              distance: { kind: 'walking', meters: best.accessWalkMeters },
              duration: { kind: 'unknown' },
              note: '정류장·역 접근 및 환승 도보 (구간별 최대 도보 거리 적용 방식은 미확정)',
            }
          : undefined,
      notes: [
        ...notes,
        '대중교통 소요시간에 접근 도보·환승·대기가 포함되는지 미확인',
      ],
    }
  }

  if (lookup.status === 'failed') {
    return {
      ...base,
      status: 'lookup_failed',
      legs: [],
      duration: { kind: 'unknown' },
      distance: { kind: 'straight', meters: straight },
      walkLimit: 'unconfirmed',
      notes: [...notes, `경로 조회 실패: ${lookup.detail}`],
    }
  }

  // 정상 조회 결과가 '경로 없음'인 경우에만 택시 대안을 검토한다.
  if (request.allowTaxiFallback) {
    return {
      ...base,
      status: 'taxi_suggested',
      mode: 'taxi',
      legs: [],
      duration: { kind: 'unknown' },
      distance: { kind: 'straight', meters: straight },
      walkLimit: 'not_applicable',
      notes: [...notes, '택시 이용 검토 · 소요시간 미확인'],
    }
  }

  return {
    ...base,
    status: 'not_traversable',
    legs: [],
    duration: { kind: 'unknown' },
    distance: { kind: 'straight', meters: straight },
    walkLimit: 'not_applicable',
    notes: [...notes, '허용한 수단으로 이동할 수 있는 경로를 찾지 못했습니다'],
  }
}

function pickShortest<T extends { duration: { kind: 'known'; minutes: number } | { kind: 'unknown' } }>(
  paths: T[],
): T {
  const known = paths.filter(
    (path): path is T & { duration: { kind: 'known'; minutes: number } } =>
      path.duration.kind === 'known',
  )
  if (known.length === 0) return paths[0]
  return known.reduce((best, path) => (path.duration.minutes < best.duration.minutes ? path : best))
}
