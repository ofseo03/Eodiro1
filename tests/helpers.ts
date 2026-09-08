import type {
  Place,
  RecommendInput,
  WeatherAssessment,
} from '@/lib/types'
import type { TransitLookup, TransitProvider } from '@/lib/routing/transit'
import type { WalkLookup, WalkRouteProvider } from '@/lib/routing/walk'
import type { RoutingProviders } from '@/lib/engine/leg'

export function place(overrides: Partial<Place> & Pick<Place, 'id'>): Place {
  return {
    name: overrides.id,
    category: 'cafe',
    regionId: 'seongsu',
    coordinate: { lat: 37.5445, lng: 127.0557 },
    address: '테스트 주소',
    indoor: 'indoor',
    tags: [],
    source: 'sample',
    ...overrides,
  }
}

export function input(overrides: Partial<RecommendInput> = {}): RecommendInput {
  return {
    regionId: 'seongsu',
    visitAt: '2026-05-01T05:00:00.000Z',
    maxTotalTravelMinutes: 45,
    allowedModes: ['walk'],
    allowTaxiFallback: false,
    maxWalkMetersPerLeg: 600,
    preferences: {
      categories: ['restaurant', 'cafe', 'activity'],
      likedTags: [],
      avoidTags: [],
    },
    ...overrides,
  }
}

export const noWeather: WeatherAssessment = {
  available: false,
  reason: '테스트에서는 날씨를 조회하지 않습니다.',
}

export function providers(
  walk: WalkLookup = { kind: 'not-configured', reason: '미연동' },
  transit: TransitLookup = { kind: 'not-configured', reason: '미연동' },
): RoutingProviders {
  const walkProvider: WalkRouteProvider = {
    configured: walk.kind === 'route',
    notice: null,
    async findRoute() {
      return walk
    },
  }
  const transitProvider: TransitProvider = {
    configured: transit.kind === 'route',
    notice: null,
    async findRoute() {
      return transit
    },
  }
  return { walk: walkProvider, transit: transitProvider }
}
