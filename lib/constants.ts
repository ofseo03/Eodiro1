/** 사용자가 설정할 수 있는 구간별 최대 도보 거리의 상한(m). */
export const MAX_WALK_METERS_LIMIT = 1000

/** 구간별 최대 도보 거리 기본값. */
export const DEFAULT_WALK_METERS = 600

/** 총 이동시간 상한 기본값(분). */
export const DEFAULT_TOTAL_TRAVEL_MINUTES = 45

/**
 * 장소 교체 후보를 찾는 반경(m).
 * 스펙에 따라 좌표 기준 직선거리로 해석하며 실제 보행거리 제한과 별도로 적용한다.
 */
export const REPLACEMENT_RADIUS_M = 100

/** 날씨 판단 기준. 스펙 7절의 미확정 항목을 아래 값으로 확정한다. */
export const WEATHER_THRESHOLDS = {
  /** 이 온도 이상이면 '덥다'로 판단한다. */
  hotC: 28,
  /** 이 온도 이하이면 '춥다'로 판단한다. */
  coldC: 4,
  /** 이 확률 이상이면 비 예보가 있는 것으로 판단한다(%). */
  precipitationProbability: 60,
} as const
