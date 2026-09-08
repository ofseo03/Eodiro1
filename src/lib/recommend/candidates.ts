import { fetchTourPlaces } from '../api/seoulTour'
import { samplePlacesForRegion } from '@/data/samplePlaces'
import type { Region } from '../regions'
import type { DataSourceReport, Place } from '../types'

export type CandidateResult = {
  places: Place[]
  report: DataSourceReport
}

/**
 * 지역 안의 방문 후보를 모은다.
 * 관광 API 가 비어 있거나 실패하면 샘플 데이터로 화면 흐름을 유지하되,
 * 응답에 출처를 'sample' 로 표시해 실제 검증 결과와 혼동하지 않게 한다.
 */
export async function loadCandidates(region: Region): Promise<CandidateResult> {
  const result = await fetchTourPlaces(region)

  if (result.ok && result.data.length > 0) {
    return {
      places: result.data,
      report: {
        name: '서울시 관광 문화 데이터',
        status: 'live',
        detail: `${region.name} 반경 ${region.radiusMeters}m 안에서 ${result.data.length}건`,
      },
    }
  }

  const fallback = samplePlacesForRegion(region.id)
  const detail = result.ok
    ? '조회 결과에 해당 지역 후보가 없어 샘플 데이터로 대체했습니다'
    : result.reason === 'not_configured'
      ? `${result.detail} — 샘플 데이터로 대체했습니다`
      : `조회 실패(${result.detail}) — 샘플 데이터로 대체했습니다`

  return {
    places: fallback,
    report: { name: '서울시 관광 문화 데이터', status: 'sample', detail },
  }
}
