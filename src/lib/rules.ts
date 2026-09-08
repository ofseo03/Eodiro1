/**
 * spec 의 '추가로 확정할 사항' 중 구현 전 기준값이 필요한 항목을 모은다.
 * 서버·클라이언트 양쪽에서 쓰므로 환경변수와 분리해 둔다.
 */

export const WEATHER_THRESHOLDS = {
  /** 이 값 이상이면 '덥다'로 판단한다. (잠정)  */
  hotCelsius: 28,
  /** 이 값 이하이면 '춥다'로 판단한다. (잠정) */
  coldCelsius: 4,
  /** 기상청 PTY(강수형태) 코드 중 강수로 판단하는 값. 0 은 없음. */
  precipitationCodes: ['1', '2', '3', '4', '5', '6', '7'],
} as const

export const COURSE_RULES = {
  /** 한 코스의 장소 수. spec '추가로 확정할 사항' — 잠정 고정값. */
  placeCount: 3,
  /** 구간별 최대 도보 거리의 상한(m). spec 2항. */
  walkLimitCeilingMeters: 1000,
  /** 도보 거리 기본값(m). spec 상 미정이므로 잠정값임을 UI 에 표시한다. */
  defaultWalkMeters: 500,
  /** 장소 교체 후보 반경(m). spec 3항 '장소 하나 교체하기'. */
  replaceRadiusMeters: 100,
  /** 도보 속도(m/분). 도보 소요시간 추정에 쓰며 '추정'으로 표시한다. */
  walkMetersPerMinute: 67,
} as const
