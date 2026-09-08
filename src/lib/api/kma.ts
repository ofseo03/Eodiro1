import { ENV, hasDataGoKrKey } from '../config'
import { WEATHER_THRESHOLDS } from '../rules'
import { toKmaGrid } from '../geo'
import type { Coordinate, WeatherInfo, WeatherJudgement } from '../types'
import { fetchJson } from './http'

const BASE_URL =
  'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst'

type KmaItem = {
  category: string
  fcstDate: string
  fcstTime: string
  fcstValue: string
}

type KmaResponse = {
  response?: {
    header?: { resultCode?: string; resultMsg?: string }
    body?: { items?: { item?: KmaItem[] } }
  }
}

/** 단기예보 발표 시각(정시 기준 02,05,08,11,14,17,20,23시). */
function latestBaseDateTime(now: Date): { baseDate: string; baseTime: string } {
  const slots = [2, 5, 8, 11, 14, 17, 20, 23]
  // 발표 후 약 10분 뒤부터 조회 가능하므로 여유를 둔다.
  const shifted = new Date(now.getTime() - 45 * 60 * 1000)
  const kst = new Date(shifted.getTime() + 9 * 60 * 60 * 1000)
  let hour = kst.getUTCHours()
  let slot = slots.filter((s) => s <= hour).pop()
  if (slot === undefined) {
    kst.setUTCDate(kst.getUTCDate() - 1)
    slot = 23
  }
  hour = slot
  const yyyy = kst.getUTCFullYear()
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(kst.getUTCDate()).padStart(2, '0')
  return { baseDate: `${yyyy}${mm}${dd}`, baseTime: `${String(hour).padStart(2, '0')}00` }
}

function kstParts(iso: string): { date: string; hour: string } {
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
  const yyyy = kst.getUTCFullYear()
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(kst.getUTCDate()).padStart(2, '0')
  return { date: `${yyyy}${mm}${dd}`, hour: `${String(kst.getUTCHours()).padStart(2, '0')}00` }
}

const SKY_LABEL: Record<string, string> = {
  '1': '맑음',
  '3': '구름많음',
  '4': '흐림',
}

const PTY_LABEL: Record<string, string> = {
  '0': '없음',
  '1': '비',
  '2': '비/눈',
  '3': '눈',
  '4': '소나기',
  '5': '빗방울',
  '6': '빗방울눈날림',
  '7': '눈날림',
}

/**
 * 방문 시각의 단기예보를 조회한다.
 * 조회 실패·예보 범위 밖은 모두 status:'unavailable' 로 돌려주고, 호출부는 '날씨 미반영'을 표시한다.
 */
export async function fetchShortTermForecast(
  coordinate: Coordinate,
  visitAt: string,
): Promise<WeatherInfo> {
  if (!hasDataGoKrKey()) {
    return { status: 'unavailable', reason: 'DATA_GO_KR_SERVICE_KEY 미설정' }
  }

  const { nx, ny } = toKmaGrid(coordinate)
  const { baseDate, baseTime } = latestBaseDateTime(new Date())
  const params = new URLSearchParams({
    serviceKey: ENV.dataGoKrKey,
    pageNo: '1',
    numOfRows: '1000',
    dataType: 'JSON',
    base_date: baseDate,
    base_time: baseTime,
    nx: String(nx),
    ny: String(ny),
  })

  const result = await fetchJson<KmaResponse>(`${BASE_URL}?${params.toString()}`)
  if (!result.ok) {
    return { status: 'unavailable', reason: `단기예보 조회 실패: ${result.detail}` }
  }

  const header = result.data.response?.header
  if (header?.resultCode && header.resultCode !== '00') {
    return {
      status: 'unavailable',
      reason: `단기예보 응답 오류: ${header.resultCode} ${header.resultMsg ?? ''}`.trim(),
    }
  }

  const items = result.data.response?.body?.items?.item ?? []
  const target = kstParts(visitAt)
  const matched = items.filter(
    (item) => item.fcstDate === target.date && item.fcstTime === target.hour,
  )
  if (matched.length === 0) {
    return { status: 'unavailable', reason: '방문 시각이 예보 제공 범위 밖입니다' }
  }

  const pick = (category: string) =>
    matched.find((item) => item.category === category)?.fcstValue

  const tmpRaw = pick('TMP')
  const ptyRaw = pick('PTY') ?? '0'
  const skyRaw = pick('SKY') ?? ''
  if (tmpRaw === undefined) {
    return { status: 'unavailable', reason: '기온(TMP) 항목을 찾지 못했습니다' }
  }

  const temperatureC = Number(tmpRaw)
  if (Number.isNaN(temperatureC)) {
    return { status: 'unavailable', reason: `기온 값을 해석하지 못했습니다: ${tmpRaw}` }
  }

  const judgements: WeatherJudgement[] = []
  if (temperatureC >= WEATHER_THRESHOLDS.hotCelsius) judgements.push('hot')
  if (temperatureC <= WEATHER_THRESHOLDS.coldCelsius) judgements.push('cold')
  if ((WEATHER_THRESHOLDS.precipitationCodes as readonly string[]).includes(ptyRaw)) {
    judgements.push('rain')
  }
  if (judgements.length === 0) judgements.push('mild')

  return {
    status: 'available',
    baseTime: `${baseDate} ${baseTime}`,
    targetTime: `${target.date} ${target.hour}`,
    temperatureC,
    precipitationType: PTY_LABEL[ptyRaw] ?? ptyRaw,
    skyCondition: SKY_LABEL[skyRaw] ?? skyRaw,
    judgements,
    prefersIndoor: judgements.some((j) => j !== 'mild'),
  }
}
