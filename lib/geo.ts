import type { Coordinate } from './types'

const EARTH_RADIUS_M = 6_371_008.8

const toRad = (deg: number) => (deg * Math.PI) / 180

/** 두 좌표 사이의 직선거리(m). 실제 보행거리와 구분해서 사용한다. */
export function straightLineDistanceM(a: Coordinate, b: Coordinate): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * 직선거리에 적용하는 보행 우회 계수.
 * 실제 보행 경로는 직선보다 길기 때문에 과소평가를 막기 위한 보정이며,
 * 이 값으로 계산한 거리는 확정값이 아니라 추정값으로만 사용한다.
 */
export const WALK_DETOUR_FACTOR = 1.3

/** 도보 속도(m/분). 4.0km/h 기준. */
export const WALK_SPEED_M_PER_MIN = 66.7

/** 직선거리로부터 보행거리를 추정한다. 확정값이 아니다. */
export function estimateWalkDistanceM(straightLineM: number): number {
  return Math.round(straightLineM * WALK_DETOUR_FACTOR)
}

/** 보행거리로부터 도보 이동시간(분)을 추정한다. */
export function estimateWalkMinutes(walkDistanceM: number): number {
  return Math.max(1, Math.round(walkDistanceM / WALK_SPEED_M_PER_MIN))
}
