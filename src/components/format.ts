import type { DistanceInfo, DurationInfo, SegmentStatus, TransportMode } from '@/lib/types'

export const MODE_LABEL: Record<TransportMode, string> = {
  walk: '도보',
  bus: '버스',
  subway: '지하철',
  taxi: '택시',
}

export const CATEGORY_LABEL = {
  cafe: '카페',
  restaurant: '식당',
  attraction: '놀거리',
} as const

export const INDOOR_LABEL = {
  indoor: '실내',
  outdoor: '실외',
  mixed: '복합',
  unknown: '실내·실외 미확인',
} as const

export const STATUS_LABEL: Record<SegmentStatus, { text: string; tone: 'ok' | 'warn' | 'danger' }> = {
  ok: { text: '이동 가능', tone: 'ok' },
  no_route: { text: '경로 없음', tone: 'warn' },
  lookup_failed: { text: '경로 조회 실패', tone: 'danger' },
  taxi_suggested: { text: '택시 이용 검토 · 소요시간 미확인', tone: 'warn' },
  not_traversable: { text: '이동 방법 없음', tone: 'danger' },
}

export function formatDuration(duration: DurationInfo): string {
  return duration.kind === 'known' ? `${duration.minutes}분` : '소요시간 미확인'
}

export function formatDistance(distance: DistanceInfo): string {
  if (distance.kind === 'unknown') return '거리 미확인'
  if (distance.kind === 'straight') {
    return `직선거리 ${distance.meters}m · 실제 보행거리 미확인`
  }
  return `보행거리 ${distance.meters}m`
}

export function walkLimitLabel(
  state: 'within' | 'exceeded' | 'unconfirmed' | 'not_applicable',
): { text: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' } {
  switch (state) {
    case 'within':
      return { text: '도보 조건 충족', tone: 'ok' }
    case 'exceeded':
      return { text: '도보 조건 초과', tone: 'danger' }
    case 'unconfirmed':
      return { text: '도보 조건 미확정', tone: 'warn' }
    default:
      return { text: '도보 조건 해당 없음', tone: 'neutral' }
  }
}
