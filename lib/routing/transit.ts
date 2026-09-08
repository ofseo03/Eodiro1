import type { Coordinate, SelectableMode } from '../types'

export type TransitLookup =
  /** 허용된 수단만으로 구성된 경로를 확보한 경우. */
  | {
      kind: 'route'
      mode: 'bus' | 'subway'
      minutes: number
      detail: string
      /** 정류장·역 접근 및 환승 도보(m). 알 수 없으면 null. */
      accessWalkM: number | null
      /** minutes에 접근 도보·환승·대기가 포함되어 있는지. */
      minutesIncludeAccessWalk: boolean
    }
  /** 정상 조회했으나 경로가 없는 경우. */
  | { kind: 'no-route' }
  /** API 오류·시간 초과. */
  | { kind: 'failed'; reason: string }
  /** 경로 제공자가 연동되지 않은 경우. 조회 실패와 구분한다. */
  | { kind: 'not-configured'; reason: string }

/**
 * 대중교통 경로를 제공하는 인터페이스.
 *
 * 서울특별시 대중교통환승경로 API와 서울교통공사 최단경로 API를 연동할 때
 * 이 인터페이스를 구현한다. 두 API 모두 실제 응답의 소요시간·도보 구간 필드를
 * 확인한 뒤에 채택한다(스펙 5절).
 */
export interface TransitProvider {
  readonly configured: boolean
  readonly notice: string | null
  findRoute(
    from: Coordinate,
    to: Coordinate,
    allowedModes: SelectableMode[],
    departAt: Date,
  ): Promise<TransitLookup>
}

const notConfiguredTransitProvider: TransitProvider = {
  configured: false,
  notice:
    '대중교통 경로 API를 연동하지 않아 버스·지하철 구간은 소요시간을 확인할 수 없습니다.',
  async findRoute() {
    return {
      kind: 'not-configured',
      reason: '대중교통 경로 제공자가 연동되지 않았습니다.',
    }
  },
}

export function getTransitProvider(): TransitProvider {
  return notConfiguredTransitProvider
}
