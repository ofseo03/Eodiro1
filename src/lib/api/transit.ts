import { ENV, hasDataGoKrKey } from '../config'
import type { Coordinate, DurationInfo, TransitLeg } from '../types'
import { fetchJson } from './http'
import type { ApiResult } from './http'

/**
 * 서울특별시_대중교통환승경로 조회 서비스.
 * https://www.data.go.kr/data/15000414/openapi.do
 *
 * 아직 실제 인증키로 응답을 검증하지 않았다(spec 5항 '채택 전 확인할 사항').
 * 따라서 응답 필드를 관대하게 읽고, 해석하지 못하면 소요시간을 '미확인'으로 남긴다.
 * 임의로 0분을 채우지 않는다.
 */

const PATH_BASE = 'http://ws.bus.go.kr/api/rest/pathinfo'

type PathKind = 'bus' | 'subway' | 'busNSub'

const ENDPOINT: Record<PathKind, string> = {
  bus: `${PATH_BASE}/getPathInfoByBus`,
  subway: `${PATH_BASE}/getPathInfoBySubway`,
  busNSub: `${PATH_BASE}/getPathInfoByBusNSub`,
}

type PathResponse = {
  msgBody?: { itemList?: unknown }
  ServiceResult?: { msgBody?: { itemList?: unknown } }
  comMsgHeader?: unknown
}

export type TransitPath = {
  legs: TransitLeg[]
  duration: DurationInfo
  /** 경로에 포함된 승차 수단. 허용하지 않은 수단이 섞이면 호출부에서 제외한다. */
  usedModes: Array<'bus' | 'subway'>
  /** 정류장 접근·환승 도보 정보. API 가 제공하지 않으면 undefined. */
  accessWalkMeters?: number
}

export type TransitLookup =
  | { status: 'ok'; paths: TransitPath[] }
  /** 정상 조회 결과가 '경로 없음'. */
  | { status: 'no_route' }
  /** 오류·시간 초과·미설정. 'no_route' 와 구분한다. */
  | { status: 'failed'; detail: string }

function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[]
  if (value && typeof value === 'object') return [value as Record<string, unknown>]
  return []
}

function readNumber(row: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key]
    const parsed = typeof value === 'number' ? value : Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function readString(row: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return undefined
}

async function lookupOne(
  kind: PathKind,
  from: Coordinate,
  to: Coordinate,
): Promise<ApiResult<TransitPath[]>> {
  const params = new URLSearchParams({
    serviceKey: ENV.dataGoKrKey,
    startX: String(from.lng),
    startY: String(from.lat),
    endX: String(to.lng),
    endY: String(to.lat),
    resultType: 'json',
  })

  const result = await fetchJson<PathResponse>(`${ENDPOINT[kind]}?${params.toString()}`)
  if (!result.ok) return result

  const itemList =
    result.data.msgBody?.itemList ?? result.data.ServiceResult?.msgBody?.itemList
  const rows = asArray(itemList)

  const paths: TransitPath[] = rows.map((row) => {
    const minutes = readNumber(row, 'time', 'totalTime', 'tottime')
    const label =
      readString(row, 'pathList', 'routeNm', 'stationNm', 'name') ??
      (kind === 'bus' ? '버스 경로' : kind === 'subway' ? '지하철 경로' : '버스·지하철 환승 경로')
    const usedModes: Array<'bus' | 'subway'> =
      kind === 'busNSub' ? ['bus', 'subway'] : [kind === 'bus' ? 'bus' : 'subway']
    const duration: DurationInfo =
      minutes !== undefined && minutes > 0 ? { kind: 'known', minutes } : { kind: 'unknown' }

    return {
      legs: usedModes.map((mode) => ({
        mode,
        label,
        duration,
        distance: { kind: 'unknown' as const },
      })),
      duration,
      usedModes,
      accessWalkMeters: readNumber(row, 'walkDistance', 'walk'),
    }
  })

  return { ok: true, data: paths }
}

/**
 * 허용된 수단만으로 이동 가능한 대중교통 경로를 찾는다.
 * 허용하지 않은 승차 수단이 포함된 경로는 제외한다(spec '이동수단 결정').
 */
export async function lookupTransit(
  from: Coordinate,
  to: Coordinate,
  allowed: Array<'bus' | 'subway'>,
): Promise<TransitLookup> {
  if (allowed.length === 0) return { status: 'no_route' }
  if (!hasDataGoKrKey()) {
    return { status: 'failed', detail: 'DATA_GO_KR_SERVICE_KEY 미설정' }
  }

  const kinds: PathKind[] = []
  if (allowed.includes('bus')) kinds.push('bus')
  if (allowed.includes('subway')) kinds.push('subway')
  if (allowed.includes('bus') && allowed.includes('subway')) kinds.push('busNSub')

  const settled = await Promise.all(kinds.map((kind) => lookupOne(kind, from, to)))

  const paths: TransitPath[] = []
  const failures: string[] = []
  for (const item of settled) {
    if (item.ok) paths.push(...item.data)
    else failures.push(item.detail)
  }

  const usable = paths.filter((path) => path.usedModes.every((mode) => allowed.includes(mode)))

  if (usable.length > 0) return { status: 'ok', paths: usable }
  // 모든 조회가 실패했다면 '경로 없음'이 아니라 '조회 실패'다.
  if (failures.length === settled.length) {
    return { status: 'failed', detail: failures.join(' / ') }
  }
  return { status: 'no_route' }
}
