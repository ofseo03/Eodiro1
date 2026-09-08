import type {
  Category,
  Confidence,
  IndoorKind,
  LegStatus,
  SelectableMode,
  Ternary,
  TransportMode,
} from './types'

export const CATEGORY_LABEL: Record<Category, string> = {
  cafe: '카페',
  restaurant: '식당',
  activity: '놀거리',
}

export const INDOOR_LABEL: Record<IndoorKind, string> = {
  indoor: '실내',
  outdoor: '실외',
  mixed: '복합',
  unknown: '실내외 미확인',
}

export const MODE_LABEL: Record<TransportMode, string> = {
  walk: '도보',
  bus: '버스',
  subway: '지하철',
  taxi: '택시',
}

export const SELECTABLE_MODES: SelectableMode[] = ['walk', 'bus', 'subway']

export const LEG_STATUS_LABEL: Record<LegStatus, string> = {
  walk: '도보',
  transit: '대중교통',
  'taxi-review': '택시 이용 검토 · 소요시간 미확인',
  'no-route': '경로 없음',
  'lookup-failed': '경로 조회 실패',
  'provider-not-configured': '경로 조회 미구성',
}

export const TERNARY_LABEL: Record<Ternary, string> = {
  yes: '충족',
  no: '미충족',
  unknown: '확정 불가',
}

/** 거리 표시. 확정값이 아니면 기준을 함께 밝힌다. */
export function formatDistance(
  meters: number | null,
  confidence: Confidence,
): string {
  if (meters === null) return '거리 미확인'
  const value = meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`
  if (confidence === 'verified') return value
  if (confidence === 'estimated') return `${value} (직선거리 기준 추정)`
  return `${value} (미확인)`
}

/** 시간 표시. 추정값과 확인값을 구분한다. */
export function formatMinutes(
  minutes: number | null,
  confidence: Confidence,
): string {
  if (minutes === null) return '소요시간 미확인'
  if (confidence === 'verified') return `${minutes}분`
  if (confidence === 'estimated') return `약 ${minutes}분 (추정)`
  return `${minutes}분 (미확인)`
}

export function formatVisitAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(date)
}
