import {
  estimateWalkDistanceM,
  estimateWalkMinutes,
  straightLineDistanceM,
} from '../geo'
import type { Leg, Place, RecommendInput } from '../types'
import { getTransitProvider, type TransitProvider } from '../routing/transit'
import { getWalkRouteProvider, type WalkRouteProvider } from '../routing/walk'

export interface RoutingProviders {
  walk: WalkRouteProvider
  transit: TransitProvider
}

export function defaultProviders(): RoutingProviders {
  return { walk: getWalkRouteProvider(), transit: getTransitProvider() }
}

function baseLeg(from: Place, to: Place, straightLineM: number): Leg {
  return {
    from,
    to,
    status: 'no-route',
    mode: null,
    straightLineM: Math.round(straightLineM),
    walkDistanceM: null,
    walkDistanceConfidence: 'unknown',
    minutes: null,
    minutesConfidence: 'unknown',
    withinWalkLimit: 'unknown',
    detail: null,
    notes: [],
  }
}

/**
 * 한 이동 구간의 이동수단과 소요시간을 결정한다.
 *
 * 순서는 스펙 3절을 따른다. 도보가 허용되고 거리 조건을 만족하면 도보를 쓰고,
 * 그렇지 않으면 허용된 버스·지하철 경로를 조회한다. 조회 결과가 '경로 없음'인
 * 경우에만 택시 대안을 검토하며, 조회 실패나 미연동은 택시로 전환하지 않는다.
 */
export async function planLeg(
  from: Place,
  to: Place,
  input: RecommendInput,
  providers: RoutingProviders,
  departAt: Date,
): Promise<Leg> {
  const straightLineM = straightLineDistanceM(from.coordinate, to.coordinate)
  const leg = baseLeg(from, to, straightLineM)
  const walkAllowed = input.allowedModes.includes('walk')
  const transitModes = input.allowedModes.filter(
    (mode): mode is 'bus' | 'subway' => mode === 'bus' || mode === 'subway',
  )

  if (walkAllowed) {
    const lookup = await providers.walk.findRoute(from.coordinate, to.coordinate)

    if (lookup.kind === 'route') {
      leg.walkDistanceM = Math.round(lookup.meters)
      leg.walkDistanceConfidence = 'verified'

      if (leg.walkDistanceM <= input.maxWalkMetersPerLeg) {
        leg.status = 'walk'
        leg.mode = 'walk'
        leg.withinWalkLimit = 'yes'
        leg.minutes = lookup.minutes ?? estimateWalkMinutes(leg.walkDistanceM)
        leg.minutesConfidence = lookup.minutes === null ? 'estimated' : 'verified'
        return leg
      }

      leg.withinWalkLimit = 'no'
      leg.notes.push(
        `실제 보행거리 ${leg.walkDistanceM}m로 설정한 ${input.maxWalkMetersPerLeg}m를 초과합니다.`,
      )
    } else {
      const estimated = estimateWalkDistanceM(straightLineM)
      leg.walkDistanceM = estimated
      leg.walkDistanceConfidence = 'estimated'
      leg.notes.push('직선거리 기준 · 실제 보행거리 미확인')

      if (lookup.kind === 'failed') {
        leg.notes.push(`보행 경로 조회 실패: ${lookup.reason}`)
      }

      if (estimated <= input.maxWalkMetersPerLeg) {
        leg.status = 'walk'
        leg.mode = 'walk'
        // 실제 보행거리를 확인하지 못했으므로 충족을 확정하지 않는다.
        leg.withinWalkLimit = 'unknown'
        leg.minutes = estimateWalkMinutes(estimated)
        leg.minutesConfidence = 'estimated'
        return leg
      }

      leg.withinWalkLimit = 'no'
      leg.notes.push(
        `추정 보행거리 ${estimated}m로 설정한 ${input.maxWalkMetersPerLeg}m를 초과합니다.`,
      )
    }
  }

  if (transitModes.length > 0) {
    const lookup = await providers.transit.findRoute(
      from.coordinate,
      to.coordinate,
      transitModes,
      departAt,
    )

    if (lookup.kind === 'route') {
      leg.status = 'transit'
      leg.mode = lookup.mode
      leg.minutes = lookup.minutes
      leg.minutesConfidence = 'verified'
      leg.detail = lookup.detail
      if (lookup.accessWalkM !== null) {
        leg.notes.push(`정류장·환승 도보 약 ${lookup.accessWalkM}m 포함`)
      } else {
        leg.notes.push('정류장·환승 도보 거리 미확인')
      }
      if (!lookup.minutesIncludeAccessWalk) {
        leg.notes.push('소요시간에 접근 도보·대기시간이 포함되지 않았습니다.')
      }
      return leg
    }

    if (lookup.kind === 'failed') {
      leg.status = 'lookup-failed'
      leg.notes.push(`경로 조회 실패: ${lookup.reason}`)
      return leg
    }

    if (lookup.kind === 'not-configured') {
      leg.status = 'provider-not-configured'
      leg.notes.push(lookup.reason)
      return leg
    }

    leg.notes.push('허용한 대중교통 수단으로 이용할 수 있는 경로가 없습니다.')
  }

  // 여기까지 왔다면 도보·대중교통으로는 구간을 연결하지 못했다.
  if (input.allowTaxiFallback) {
    leg.status = 'taxi-review'
    leg.mode = 'taxi'
    leg.minutes = null
    leg.minutesConfidence = 'unknown'
    leg.notes.push('택시 이용 검토 · 소요시간 미확인')
    return leg
  }

  leg.status = 'no-route'
  return leg
}

/** 같은 장소 쌍을 여러 코스에서 재사용하므로 구간 계획 결과를 캐시한다. */
export class LegPlanner {
  private readonly cache = new Map<string, Promise<Leg>>()

  constructor(
    private readonly input: RecommendInput,
    private readonly providers: RoutingProviders,
    private readonly departAt: Date,
  ) {}

  plan(from: Place, to: Place): Promise<Leg> {
    const key = `${from.id}->${to.id}`
    const cached = this.cache.get(key)
    if (cached) return cached

    const planned = planLeg(from, to, this.input, this.providers, this.departAt)
    this.cache.set(key, planned)
    return planned
  }

  get notices(): string[] {
    return [this.providers.walk.notice, this.providers.transit.notice].filter(
      (notice): notice is string => Boolean(notice),
    )
  }
}
