import type { Coordinate } from './types'

/**
 * spec '추가로 확정할 사항' — 지역 경계 정의는 미확정이다.
 * 현재는 중심 좌표 + 반경으로 근사하며, 행정경계가 확정되면 이 모듈만 교체한다.
 */
export type Region = {
  id: string
  name: string
  center: Coordinate
  /** 지역 경계 근사 반경(m). */
  radiusMeters: number
  /** 기준 위치 표시에 쓰는 설명. */
  label: string
}

export const REGIONS: Region[] = [
  { id: 'seongsu', name: '성수', center: { lat: 37.5446, lng: 127.0559 }, radiusMeters: 1200, label: '성수역 일대' },
  { id: 'hongdae', name: '홍대', center: { lat: 37.5563, lng: 126.9236 }, radiusMeters: 1200, label: '홍대입구역 일대' },
  { id: 'yeonnam', name: '연남', center: { lat: 37.5602, lng: 126.9255 }, radiusMeters: 900, label: '연남동 일대' },
  { id: 'euljiro', name: '을지로', center: { lat: 37.5660, lng: 126.9910 }, radiusMeters: 1000, label: '을지로3가역 일대' },
  { id: 'gangnam', name: '강남', center: { lat: 37.4979, lng: 127.0276 }, radiusMeters: 1200, label: '강남역 일대' },
  { id: 'ikseon', name: '익선·종로', center: { lat: 37.5729, lng: 126.9899 }, radiusMeters: 1000, label: '종로3가역 일대' },
  { id: 'itaewon', name: '이태원', center: { lat: 37.5346, lng: 126.9946 }, radiusMeters: 1000, label: '이태원역 일대' },
  { id: 'yeouido', name: '여의도', center: { lat: 37.5216, lng: 126.9243 }, radiusMeters: 1500, label: '여의도역 일대' },
  { id: 'jamsil', name: '잠실', center: { lat: 37.5133, lng: 127.1000 }, radiusMeters: 1500, label: '잠실역 일대' },
  { id: 'seochon', name: '서촌', center: { lat: 37.5787, lng: 126.9700 }, radiusMeters: 900, label: '경복궁역 일대' },
]

export function findRegion(id: string): Region | undefined {
  return REGIONS.find((region) => region.id === id)
}
