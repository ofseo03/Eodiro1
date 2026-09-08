import type { Place } from '@/lib/types'

/**
 * 관광 API 키가 없거나 조회에 실패했을 때 화면 흐름을 확인하기 위한 샘플 데이터.
 *
 * - 공원·명소는 실제로 존재하는 공공 장소만 담았다.
 * - 카페·식당은 특정 업소를 사칭하지 않도록 자리표시자 이름을 쓴다.
 * - 모든 항목의 source 는 'sample-dataset' 이며, 응답과 화면에 '샘플 데이터'로 표시한다.
 *   spec 6항의 완료 판단 기준(실제 API 호출 검증)을 대체하지 않는다.
 */

type SampleSeed = {
  regionId: string
  items: Array<
    Pick<Place, 'name' | 'category' | 'indoor'> & { lat: number; lng: number }
  >
}

const SEEDS: SampleSeed[] = [
  {
    regionId: 'seongsu',
    items: [
      { name: '서울숲', category: 'attraction', indoor: 'outdoor', lat: 37.5444, lng: 127.0374 },
      { name: '뚝섬한강공원', category: 'attraction', indoor: 'outdoor', lat: 37.5297, lng: 127.0699 },
      { name: '성수 샘플 전시공간 A', category: 'attraction', indoor: 'indoor', lat: 37.5449, lng: 127.0556 },
      { name: '성수 샘플 카페 A', category: 'cafe', indoor: 'indoor', lat: 37.5438, lng: 127.0546 },
      { name: '성수 샘플 카페 B', category: 'cafe', indoor: 'indoor', lat: 37.5445, lng: 127.0553 },
      { name: '성수 샘플 카페 C', category: 'cafe', indoor: 'mixed', lat: 37.5461, lng: 127.0571 },
      { name: '성수 샘플 식당 A', category: 'restaurant', indoor: 'indoor', lat: 37.5451, lng: 127.0538 },
      { name: '성수 샘플 식당 B', category: 'restaurant', indoor: 'indoor', lat: 37.5433, lng: 127.0567 },
    ],
  },
  {
    regionId: 'hongdae',
    items: [
      { name: '경의선숲길 (홍대 구간)', category: 'attraction', indoor: 'outdoor', lat: 37.5556, lng: 126.9250 },
      { name: '홍대 샘플 복합문화공간 A', category: 'attraction', indoor: 'indoor', lat: 37.5564, lng: 126.9230 },
      { name: '홍대 샘플 카페 A', category: 'cafe', indoor: 'indoor', lat: 37.5559, lng: 126.9241 },
      { name: '홍대 샘플 카페 B', category: 'cafe', indoor: 'indoor', lat: 37.5571, lng: 126.9228 },
      { name: '홍대 샘플 식당 A', category: 'restaurant', indoor: 'indoor', lat: 37.5548, lng: 126.9236 },
      { name: '홍대 샘플 식당 B', category: 'restaurant', indoor: 'indoor', lat: 37.5575, lng: 126.9249 },
    ],
  },
  {
    regionId: 'euljiro',
    items: [
      { name: '청계천 (을지로 구간)', category: 'attraction', indoor: 'outdoor', lat: 37.5686, lng: 126.9915 },
      { name: '을지로 샘플 갤러리 A', category: 'attraction', indoor: 'indoor', lat: 37.5661, lng: 126.9918 },
      { name: '을지로 샘플 카페 A', category: 'cafe', indoor: 'indoor', lat: 37.5657, lng: 126.9906 },
      { name: '을지로 샘플 카페 B', category: 'cafe', indoor: 'indoor', lat: 37.5666, lng: 126.9922 },
      { name: '을지로 샘플 식당 A', category: 'restaurant', indoor: 'indoor', lat: 37.5652, lng: 126.9913 },
      { name: '을지로 샘플 식당 B', category: 'restaurant', indoor: 'indoor', lat: 37.5670, lng: 126.9901 },
    ],
  },
]

export const SAMPLE_PLACES: Place[] = SEEDS.flatMap((seed) =>
  seed.items.map((item, index) => ({
    id: `sample:${seed.regionId}:${index}`,
    name: item.name,
    category: item.category,
    coordinate: { lat: item.lat, lng: item.lng },
    indoor: item.indoor,
    indoorSource: 'curated' as const,
    regionId: seed.regionId,
    source: 'sample-dataset' as const,
  })),
)

export function samplePlacesForRegion(regionId: string): Place[] {
  return SAMPLE_PLACES.filter((place) => place.regionId === regionId)
}
