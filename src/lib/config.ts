/** 서버에서만 읽는 외부 API 인증 정보. 클라이언트 번들에 포함되지 않도록 분리했다. */

export const ENV = {
  /** data.go.kr 공통 서비스키 (기상청 단기예보, 대중교통환승경로, 서울교통공사). */
  dataGoKrKey: process.env.DATA_GO_KR_SERVICE_KEY ?? '',
  /** 서울 열린데이터 광장 인증키 (관광문화 데이터, 실시간 도시데이터). */
  seoulOpenApiKey: process.env.SEOUL_OPEN_API_KEY ?? '',
} as const

export function hasDataGoKrKey(): boolean {
  return ENV.dataGoKrKey.trim().length > 0
}

export function hasSeoulKey(): boolean {
  return ENV.seoulOpenApiKey.trim().length > 0
}

/** 외부 API 호출 타임아웃(ms). 초과는 '경로 조회 실패'로 다룬다. */
export const REQUEST_TIMEOUT_MS = 7000
