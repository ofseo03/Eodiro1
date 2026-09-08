import { describe, expect, it } from 'vitest'
import { planLeg } from '@/lib/engine/leg'
import { input, place, providers } from './helpers'

const from = place({ id: 'from', coordinate: { lat: 37.5445, lng: 127.0557 } })
/** from에서 직선거리 약 500m. 추정 보행거리는 약 651m. */
const far = place({ id: 'far', coordinate: { lat: 37.549, lng: 127.0557 } })
/** from에서 직선거리 약 333m. 추정 보행거리는 약 434m. */
const near = place({ id: 'near', coordinate: { lat: 37.5475, lng: 127.0557 } })

const departAt = new Date('2026-05-01T05:00:00.000Z')

describe('planLeg', () => {
  it('보행 경로를 확인하지 못하면 직선거리 기준 추정으로 도보를 제안하되 충족을 확정하지 않는다', async () => {
    const leg = await planLeg(from, near, input(), providers(), departAt)

    expect(leg.status).toBe('walk')
    expect(leg.walkDistanceConfidence).toBe('estimated')
    expect(leg.withinWalkLimit).toBe('unknown')
    expect(leg.minutesConfidence).toBe('estimated')
    expect(leg.notes).toContain('직선거리 기준 · 실제 보행거리 미확인')
  })

  it('실제 보행거리가 설정값과 같으면 도보에 포함하고 충족을 확정한다', async () => {
    const leg = await planLeg(
      from,
      near,
      input({ maxWalkMetersPerLeg: 600 }),
      providers({ kind: 'route', meters: 600, minutes: 9 }),
      departAt,
    )

    expect(leg.status).toBe('walk')
    expect(leg.walkDistanceConfidence).toBe('verified')
    expect(leg.withinWalkLimit).toBe('yes')
    expect(leg.minutes).toBe(9)
    expect(leg.minutesConfidence).toBe('verified')
  })

  it('실제 보행거리가 설정값을 넘으면 도보에서 제외한다', async () => {
    const leg = await planLeg(
      from,
      near,
      input({ maxWalkMetersPerLeg: 600 }),
      providers({ kind: 'route', meters: 601, minutes: 9 }),
      departAt,
    )

    expect(leg.status).not.toBe('walk')
    expect(leg.withinWalkLimit).toBe('no')
  })

  it('도보 거리를 넘고 대중교통도 없으면 경로 없음으로 처리한다', async () => {
    const leg = await planLeg(from, far, input(), providers(), departAt)

    expect(leg.status).toBe('no-route')
    expect(leg.mode).toBeNull()
  })

  it('경로가 없고 택시 대안을 허용하면 소요시간 미확인으로 표시한다', async () => {
    const leg = await planLeg(
      from,
      far,
      input({ allowTaxiFallback: true }),
      providers(),
      departAt,
    )

    expect(leg.status).toBe('taxi-review')
    expect(leg.minutes).toBeNull()
    expect(leg.minutesConfidence).toBe('unknown')
  })

  it('대중교통 조회 실패는 택시 대안으로 전환하지 않고 조회 실패로 남긴다', async () => {
    const leg = await planLeg(
      from,
      far,
      input({ allowedModes: ['walk', 'bus'], allowTaxiFallback: true }),
      providers(undefined, { kind: 'failed', reason: '시간 초과' }),
      departAt,
    )

    expect(leg.status).toBe('lookup-failed')
  })

  it('대중교통 경로 없음과 조회 실패를 구분한다', async () => {
    const noRoute = await planLeg(
      from,
      far,
      input({ allowedModes: ['walk', 'subway'] }),
      providers(undefined, { kind: 'no-route' }),
      departAt,
    )

    expect(noRoute.status).toBe('no-route')
  })

  it('대중교통 경로를 확보하면 소요시간과 노선 정보를 표시한다', async () => {
    const leg = await planLeg(
      from,
      far,
      input({ allowedModes: ['walk', 'bus'] }),
      providers(undefined, {
        kind: 'route',
        mode: 'bus',
        minutes: 12,
        detail: '2016번 승차 3정거장',
        accessWalkM: 180,
        minutesIncludeAccessWalk: true,
      }),
      departAt,
    )

    expect(leg.status).toBe('transit')
    expect(leg.mode).toBe('bus')
    expect(leg.minutes).toBe(12)
    expect(leg.minutesConfidence).toBe('verified')
    expect(leg.detail).toBe('2016번 승차 3정거장')
  })

  it('도보를 허용하지 않으면 짧은 구간이라도 도보로 제안하지 않는다', async () => {
    const leg = await planLeg(
      from,
      near,
      input({ allowedModes: ['subway'] }),
      providers({ kind: 'route', meters: 100, minutes: 2 }),
      departAt,
    )

    expect(leg.status).not.toBe('walk')
  })
})
