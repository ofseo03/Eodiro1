/** 방문 장소의 카테고리. 스펙의 카페·식당·놀거리에 대응한다. */
export type Category = 'cafe' | 'restaurant' | 'activity'

/**
 * 실내·실외 구분. 스펙에 따라 '복합'과 '미확인'을 실내로 단정하지 않는다.
 */
export type IndoorKind = 'indoor' | 'outdoor' | 'mixed' | 'unknown'

export type TransportMode = 'walk' | 'bus' | 'subway' | 'taxi'

/** 사용자가 선택할 수 있는 이동수단. 택시는 별도 대안 허용 여부로 다룬다. */
export type SelectableMode = Exclude<TransportMode, 'taxi'>

export interface Region {
  id: string
  name: string
  /** 지역 경계는 중심 좌표와 반경으로 근사한다. (스펙 7절 미확정 항목) */
  center: Coordinate
  radiusM: number
  description: string
}

export interface Coordinate {
  lat: number
  lng: number
}

export interface Place {
  id: string
  name: string
  category: Category
  regionId: string
  coordinate: Coordinate
  address: string
  indoor: IndoorKind
  tags: string[]
  /** 데이터 출처. 공공 API 연동 시 provider가 값을 채운다. */
  source: PlaceSource
}

export type PlaceSource = 'sample' | 'seoul-tour-api'

export interface Preferences {
  /** 코스에 포함할 카테고리 구성. 순서는 추천 엔진이 결정한다. */
  categories: Category[]
  likedTags: string[]
  avoidTags: string[]
}

export interface RecommendInput {
  regionId: string
  /** 방문 시각(ISO 8601). 날씨 조회와 결과 표시 기준이 된다. */
  visitAt: string
  /** 체류시간을 제외한 구간별 이동시간 합계의 상한(분). */
  maxTotalTravelMinutes: number
  /** 사용자가 허용한 이동수단. 최소 하나 이상이어야 한다. */
  allowedModes: SelectableMode[]
  /** 조건에 맞는 경로가 없을 때 택시 대안을 표시할지 여부. */
  allowTaxiFallback: boolean
  /** 이동 구간별 최대 도보 거리(m). 상한은 1,000m. */
  maxWalkMetersPerLeg: number
  preferences: Preferences
}

/** 거리·시간이 실제 조회로 확인된 값인지 추정값인지 구분한다. */
export type Confidence = 'verified' | 'estimated' | 'unknown'

export type Ternary = 'yes' | 'no' | 'unknown'

export type LegStatus =
  /** 도보로 이동 가능한 구간. */
  | 'walk'
  /** 대중교통 경로를 확보한 구간. */
  | 'transit'
  /** 택시 이용 검토 · 소요시간 미확인. */
  | 'taxi-review'
  /** 정상 조회했으나 경로가 없는 구간. */
  | 'no-route'
  /** API 오류·시간 초과로 조회에 실패한 구간. */
  | 'lookup-failed'
  /** 경로 제공자가 아직 연동되지 않은 구간. 조회 실패와 구분한다. */
  | 'provider-not-configured'

export interface Leg {
  from: Place
  to: Place
  status: LegStatus
  mode: TransportMode | null
  /** 좌표 기준 직선거리(m). 항상 계산 가능하다. */
  straightLineM: number
  /** 보행거리(m). verified가 아니면 직선거리 기반 추정값이다. */
  walkDistanceM: number | null
  walkDistanceConfidence: Confidence
  /** 이동시간(분). */
  minutes: number | null
  minutesConfidence: Confidence
  /** 구간별 최대 도보 거리 충족 여부. 미확인이면 'unknown'. */
  withinWalkLimit: Ternary
  /** 노선·환승 등 부가 설명. */
  detail: string | null
  notes: string[]
}

export interface WeatherUnavailable {
  available: false
  reason: string
}

export interface WeatherAvailable {
  available: true
  temperatureC: number
  precipitationProbability: number
  /** 기상청 강수형태(PTY) 해석 결과. */
  precipitationType: 'none' | 'rain' | 'rain-snow' | 'snow' | 'shower' | 'drizzle'
  indoorRecommended: boolean
  reasons: string[]
  /** 판단에 사용한 기준 위치와 시각. 결과에 표시한다. */
  basedOn: { coordinate: Coordinate; forecastTime: string; source: string }
}

export type WeatherAssessment = WeatherUnavailable | WeatherAvailable

export interface CourseTotals {
  /** 이동시간이 확인·추정된 구간들의 합(분). */
  knownMinutes: number
  /** 이동시간을 알 수 없는 구간이 있는지. */
  hasUnknownMinutes: boolean
  /** 모든 구간의 이동시간이 실제 조회로 확인되었는지. */
  allMinutesVerified: boolean
  withinTotalLimit: Ternary
}

export interface Course {
  id: string
  places: Place[]
  legs: Leg[]
  totals: CourseTotals
  usesTaxi: boolean
  /** 모든 구간이 이동 가능한 것으로 처리되었는지. */
  connected: boolean
  /** 모든 조건 충족이 확정되었는지. 미확인 구간이 있으면 false. */
  fullyConfirmed: boolean
  warnings: string[]
  score: number
}

export interface RecommendResult {
  region: Region
  visitAt: string
  weather: WeatherAssessment
  courses: Course[]
  /** 조건에 맞는 코스를 찾지 못한 경우의 사유. */
  notice: string | null
  dataNotices: string[]
}
