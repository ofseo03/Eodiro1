import type { Coordinate } from '../types'

export type WalkLookup =
  /** 실제 보행 경로를 확인한 경우. */
  | { kind: 'route'; meters: number; minutes: number | null }
  /** 정상 조회했으나 보행 경로가 없는 경우. */
  | { kind: 'no-route' }
  /** 조회 오류·시간 초과. */
  | { kind: 'failed'; reason: string }
  /** 보행 경로 제공자가 연동되지 않은 경우. */
  | { kind: 'not-configured'; reason: string }

/**
 * 두 장소 사이의 실제 보행거리를 제공하는 인터페이스.
 *
 * 스펙 5절에서 "장소 간 전체 도보 경로와 실제 보행거리를 제공할 수 있는지"를
 * 핵심 검증 항목으로 두고 있다. 아직 확인된 공공 API가 없으므로 기본 구현은
 * 미연동 상태를 명시적으로 반환하고, 엔진은 직선거리 기반 추정으로 대체한다.
 */
export interface WalkRouteProvider {
  readonly configured: boolean
  readonly notice: string | null
  findRoute(from: Coordinate, to: Coordinate): Promise<WalkLookup>
}

const notConfiguredWalkProvider: WalkRouteProvider = {
  configured: false,
  notice:
    '실제 보행 경로 API를 연동하지 않아 도보 거리는 직선거리 기반 추정값입니다. 최대 도보 거리 충족은 확정하지 않습니다.',
  async findRoute() {
    return {
      kind: 'not-configured',
      reason: '보행 경로 제공자가 연동되지 않았습니다.',
    }
  },
}

export function getWalkRouteProvider(): WalkRouteProvider {
  return notConfiguredWalkProvider
}
