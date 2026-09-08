/**
 * spec.md 의 표기 규칙을 타입으로 고정한다.
 * 핵심 원칙: 모르는 값을 0 이나 false 로 뭉개지 않고 '미확인'으로 남긴다.
 */

/** 장소 카테고리. spec 3항의 '카페·식당·놀거리'. */
export type PlaceCategory = 'cafe' | 'restaurant' | 'attraction'

/** spec '날씨와 실내 장소': 복합·미확인을 실내로 단정하지 않는다. */
export type IndoorKind = 'indoor' | 'outdoor' | 'mixed' | 'unknown'

export type Coordinate = {
  lat: number
  lng: number
}

export type Place = {
  id: string
  name: string
  category: PlaceCategory
  coordinate: Coordinate
  address?: string
  openingHours?: string
  indoor: IndoorKind
  /** 실내·실외 분류의 근거. 확인되지 않은 분류를 확정으로 표시하지 않기 위해 남긴다. */
  indoorSource: 'api' | 'curated' | 'unknown'
  regionId: string
  source: PlaceDataSource
  url?: string
}

export type PlaceDataSource = 'seoul-tour-api' | 'sample-dataset'

/**
 * 거리 값. 실제 보행거리와 직선거리를 구분한다(spec '거리·시간의 정확성').
 */
export type DistanceInfo =
  | { kind: 'walking'; meters: number }
  | { kind: 'straight'; meters: number }
  | { kind: 'unknown' }

/** 소요시간. 미확인을 0분으로 처리하지 않는다. */
export type DurationInfo = { kind: 'known'; minutes: number } | { kind: 'unknown' }

export type TransportMode = 'walk' | 'bus' | 'subway' | 'taxi'

/** 사용자가 선택할 수 있는 수단. 택시는 별도 '대안 허용' 플래그로 다룬다. */
export type SelectableMode = Exclude<TransportMode, 'taxi'>

export type SegmentStatus =
  /** 허용 조건 안에서 이동 방법을 찾았다. */
  | 'ok'
  /** 정상 조회했으나 조건에 맞는 경로가 없다. */
  | 'no_route'
  /** API 오류·시간 초과. 'no_route' 와 구분한다. */
  | 'lookup_failed'
  /** 대중교통 대안이 없고 사용자가 택시 대안을 허용했다. */
  | 'taxi_suggested'
  /** 택시도 허용되지 않아 이동 가능으로 처리하지 않는다. */
  | 'not_traversable'

export type TransitLeg = {
  mode: TransportMode
  /** 노선명 · 역명 등 사람이 읽을 수 있는 설명. */
  label: string
  duration: DurationInfo
  distance: DistanceInfo
}

export type Segment = {
  fromPlaceId: string
  toPlaceId: string
  status: SegmentStatus
  /** 채택한 이동수단. status 가 ok/taxi_suggested 일 때만 의미가 있다. */
  mode?: TransportMode
  legs: TransitLeg[]
  duration: DurationInfo
  distance: DistanceInfo
  /**
   * 구간별 최대 도보 거리 조건의 판정 결과.
   * 'unconfirmed' 는 실제 보행거리를 확보하지 못해 충족을 확정할 수 없는 경우다.
   */
  walkLimit: 'within' | 'exceeded' | 'unconfirmed' | 'not_applicable'
  /**
   * 직선거리로 계산한 참고용 도보 소요시간(분).
   * 실제 보행거리가 아니므로 확인된 이동시간 합계에 넣지 않는다.
   */
  estimatedWalkMinutes?: number
  /** 정류장 접근·환승 도보를 별도로 표시한다. */
  accessWalk?: {
    distance: DistanceInfo
    duration: DurationInfo
    note: string
  }
  notes: string[]
}

export type WeatherJudgement = 'hot' | 'cold' | 'rain' | 'mild'

export type WeatherInfo =
  | {
      status: 'available'
      /** 예보 기준 시각(ISO). 결과에 기준 시각을 표시하기 위해 남긴다. */
      baseTime: string
      targetTime: string
      temperatureC: number
      precipitationType: string
      skyCondition: string
      judgements: WeatherJudgement[]
      prefersIndoor: boolean
    }
  /** 조회 실패 또는 예보 범위 밖. spec: '날씨 미반영'을 표시한다. */
  | { status: 'unavailable'; reason: string }

export type WalkPreference = {
  /** 구간별 최대 도보 거리(m). 최대 1,000. */
  maxWalkMeters: number
}

export type Preference = {
  categories: PlaceCategory[]
  /** 취향 태그. 최초 설정 후 재사용한다(브라우저 localStorage). */
  tags: string[]
}

export type RecommendRequest = {
  regionId: string
  /** 관광·식사 등 체류시간을 제외한, 구간별 이동시간 합계의 상한(분). */
  maxTravelMinutes: number
  allowedModes: SelectableMode[]
  maxWalkMeters: number
  /** 대중교통 대안이 없을 때 택시 대안을 표시할지 여부. */
  allowTaxiFallback: boolean
  preference: Preference
  /** 방문 기준 시각(ISO). 날씨·경로 계산의 기준으로 결과에 표시한다. */
  visitAt: string
  /** 출발 위치. 미입력이면 지역 중심을 기준으로 삼는다. */
  origin?: Coordinate
}

export type CourseTotals = {
  /** 모든 구간의 시간이 확인된 경우에만 값이 있다. */
  totalMinutes: number | null
  /** 확인된 구간 이동시간 합계. 항상 값이 있다. */
  confirmedMinutes: number
  unknownSegmentCount: number
  /** 총 이동시간 상한 충족 여부. 미확인 구간이 있으면 'unconfirmed'. */
  travelLimit: 'within' | 'exceeded' | 'unconfirmed'
  /** 모든 구간의 도보 조건 판정 요약. */
  walkLimit: 'within' | 'exceeded' | 'unconfirmed'
}

export type Course = {
  id: string
  regionId: string
  regionName: string
  places: Place[]
  segments: Segment[]
  weather: WeatherInfo
  totals: CourseTotals
  /** 날씨를 반영한 실내 추천으로 표시할 수 있는지 여부. */
  weatherApplied: boolean
  basis: {
    visitAt: string
    referenceCoordinate: Coordinate
    referenceLabel: string
  }
  /** 이 코스가 조건을 모두 충족했다고 표시할 수 있는가. */
  allConditionsMet: boolean
  warnings: string[]
}

export type RecommendResponse = {
  course: Course | null
  /** 코스를 만들지 못한 이유. */
  message?: string
  dataSources: DataSourceReport[]
}

export type DataSourceReport = {
  name: string
  status: 'live' | 'not_configured' | 'failed' | 'sample'
  detail?: string
}

export type ReplaceRequest = {
  course: Course
  /** 교체할 장소의 id. */
  placeId: string
  request: RecommendRequest
}

export type ReplaceCandidate = {
  place: Place
  /** 원래 장소 기준 직선거리(m). 100m 반경 판정에 쓴다. */
  straightMeters: number
}

export type ReplaceResponse = {
  candidates: ReplaceCandidate[]
  radiusMeters: number
  message?: string
}
