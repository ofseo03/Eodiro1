import { describe, expect, it } from 'vitest'
import {
  estimateWalkDistanceM,
  estimateWalkMinutes,
  straightLineDistanceM,
} from '@/lib/geo'

describe('straightLineDistanceM', () => {
  it('같은 좌표의 거리는 0이다', () => {
    const point = { lat: 37.5445, lng: 127.0557 }

    expect(straightLineDistanceM(point, point)).toBe(0)
  })

  it('위도 0.001도 차이는 약 111m이다', () => {
    const distance = straightLineDistanceM(
      { lat: 37.5445, lng: 127.0557 },
      { lat: 37.5455, lng: 127.0557 },
    )

    expect(distance).toBeGreaterThan(110)
    expect(distance).toBeLessThan(113)
  })
})

describe('보행 추정', () => {
  it('추정 보행거리는 직선거리보다 길다', () => {
    expect(estimateWalkDistanceM(500)).toBeGreaterThan(500)
  })

  it('짧은 거리도 최소 1분으로 표시한다', () => {
    expect(estimateWalkMinutes(10)).toBe(1)
  })
})
