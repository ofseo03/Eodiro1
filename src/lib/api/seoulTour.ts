import { ENV, hasSeoulKey } from '../config'
import { straightDistanceMeters } from '../geo'
import type { Region } from '../regions'
import type { IndoorKind, Place, PlaceCategory } from '../types'
import { fetchJson } from './http'
import type { ApiResult } from './http'

/**
 * 서울시 관광 문화 데이터(TbVwAttractions). 열린데이터광장 OpenAPI.
 * 데이터셋: https://data.seoul.go.kr/dataList/OA-21052/S/1/datasetView.do
 *
 * spec 5항에 따라 좌표·운영정보 누락과 실내·실외 분류 미제공 가능성을 전제로 다룬다.
 * 실제 응답 필드는 인증키를 넣고 검증해야 확정할 수 있어, 알려진 필드명을 관대하게 읽는다.
 */

type RawRow = Record<string, unknown>

type TourResponse = Record<string, { list_total_count?: number; row?: RawRow[]; RESULT?: { CODE?: string; MESSAGE?: string } }>

const SERVICE = 'TbVwAttractions'

function str(row: RawRow, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return undefined
}

function num(row: RawRow, ...keys: string[]): number | undefined {
  const value = str(row, ...keys)
  if (value === undefined) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** 관광 데이터의 분류 문자열을 서비스 카테고리로 좁힌다. 판단할 수 없으면 undefined. */
function toCategory(row: RawRow): PlaceCategory | undefined {
  const raw = [str(row, 'CATE1_NAME', 'CATE2_NAME', 'CATE3_NAME', 'SUBJECT_CD'), str(row, 'TAG')]
    .filter(Boolean)
    .join(' ')
  if (raw === '') return undefined
  if (/카페|커피|디저트|베이커리/.test(raw)) return 'cafe'
  if (/음식|식당|맛집|레스토랑|먹거리/.test(raw)) return 'restaurant'
  if (/명소|관광|공원|전시|박물관|미술관|체험|쇼핑|문화/.test(raw)) return 'attraction'
  return undefined
}

/**
 * 실내·실외 분류. 관광 데이터가 이 값을 직접 제공하지 않으므로 확정할 수 없으면 'unknown'.
 * spec: 복합·미확인을 실내로 단정하지 않는다.
 */
function toIndoor(row: RawRow): { indoor: IndoorKind; source: Place['indoorSource'] } {
  const raw = [str(row, 'CATE2_NAME', 'CATE3_NAME'), str(row, 'TAG')].filter(Boolean).join(' ')
  if (/박물관|미술관|전시관|실내|백화점|쇼핑몰|카페|서점/.test(raw)) {
    return { indoor: 'indoor', source: 'api' }
  }
  if (/공원|산|하천|한강|거리|광장|야외|둘레길/.test(raw)) {
    return { indoor: 'outdoor', source: 'api' }
  }
  return { indoor: 'unknown', source: 'unknown' }
}

/** 지역 경계(중심+반경) 안의 관광 데이터를 가져온다. */
export async function fetchTourPlaces(region: Region): Promise<ApiResult<Place[]>> {
  if (!hasSeoulKey()) {
    return { ok: false, reason: 'not_configured', detail: 'SEOUL_OPEN_API_KEY 미설정' }
  }

  const url = `http://openapi.seoul.go.kr:8088/${ENV.seoulOpenApiKey}/json/${SERVICE}/1/1000/`
  const result = await fetchJson<TourResponse>(url)
  if (!result.ok) return result

  const body = result.data[SERVICE]
  if (!body) {
    const code = Object.values(result.data)[0]?.RESULT
    return {
      ok: false,
      reason: 'failed',
      detail: `관광 데이터 응답 형식이 예상과 다릅니다: ${code?.CODE ?? ''} ${code?.MESSAGE ?? ''}`.trim(),
    }
  }

  const rows = body.row ?? []
  const places: Place[] = []
  for (const row of rows) {
    const name = str(row, 'POST_SJ', 'NAME', 'TITLE')
    const lat = num(row, 'LAT', 'Y', 'MAP_Y')
    const lng = num(row, 'LOT', 'LNG', 'X', 'MAP_X')
    const category = toCategory(row)
    if (!name || lat === undefined || lng === undefined || !category) continue

    const coordinate = { lat, lng }
    if (straightDistanceMeters(region.center, coordinate) > region.radiusMeters) continue

    const indoor = toIndoor(row)
    places.push({
      id: `tour:${str(row, 'POST_SN', 'ID') ?? `${name}-${lat}-${lng}`}`,
      name,
      category,
      coordinate,
      address: str(row, 'ADDRESS', 'NEW_ADDRESS', 'ADD_RE'),
      openingHours: str(row, 'USE_TIME', 'OPEN_TIME'),
      indoor: indoor.indoor,
      indoorSource: indoor.source,
      regionId: region.id,
      source: 'seoul-tour-api',
      url: str(row, 'HMPG_ADDR', 'URL'),
    })
  }

  return { ok: true, data: places }
}
