import type { Place, PlaceSource } from '../types'
import { SAMPLE_PLACES } from './sample-places'

/**
 * 방문 후보 장소를 공급하는 인터페이스.
 *
 * 서울시 관광 문화 데이터 API를 연동할 때는 이 인터페이스를 구현하는
 * provider를 추가하고 getPlaceProvider가 그것을 반환하도록 바꾼다.
 * 엔진과 UI는 provider 종류를 알지 못한다.
 */
export interface PlaceProvider {
  readonly source: PlaceSource
  /** 데이터 신뢰도에 관해 사용자에게 표시할 안내. 없으면 null. */
  readonly notice: string | null
  listByRegion(regionId: string): Promise<Place[]>
  findByIds(ids: string[]): Promise<Place[]>
}

const samplePlaceProvider: PlaceProvider = {
  source: 'sample',
  notice:
    '공공 관광 데이터 API를 아직 연동하지 않아 샘플 장소 데이터로 코스를 구성했습니다. 실제 영업 정보와 다릅니다.',

  async listByRegion(regionId) {
    return SAMPLE_PLACES.filter((place) => place.regionId === regionId)
  },

  async findByIds(ids) {
    const wanted = new Set(ids)
    return SAMPLE_PLACES.filter((place) => wanted.has(place.id))
  },
}

/**
 * 현재 사용할 장소 provider를 반환한다.
 *
 * 공공 API 연동 전까지는 샘플 provider를 사용한다. 실제 API의 응답 형식과
 * 좌표·실내외 분류 제공 여부를 실호출로 확인한 뒤에 교체한다(스펙 5절).
 */
export function getPlaceProvider(): PlaceProvider {
  return samplePlaceProvider
}
