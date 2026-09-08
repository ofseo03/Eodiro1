import type { Region } from '../types'

/**
 * 지역 경계는 중심 좌표와 반경으로 근사한다.
 * 행정동 경계 기반 정의는 스펙 7절의 미확정 항목이다.
 */
export const REGIONS: Region[] = [
  {
    id: 'seongsu',
    name: '성수',
    center: { lat: 37.5445, lng: 127.0557 },
    radiusM: 900,
    description: '연무장길과 서울숲 사이의 카페·공방 밀집 지역',
  },
  {
    id: 'yeonnam',
    name: '연남',
    center: { lat: 37.56, lng: 126.9253 },
    radiusM: 900,
    description: '경의선숲길을 따라 이어지는 골목 상권',
  },
  {
    id: 'ikseon',
    name: '익선',
    center: { lat: 37.574, lng: 126.9905 },
    radiusM: 900,
    description: '한옥을 개조한 가게가 모인 종로 일대',
  },
]

export function findRegion(regionId: string): Region | undefined {
  return REGIONS.find((region) => region.id === regionId)
}
