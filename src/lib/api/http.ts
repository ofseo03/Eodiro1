import { REQUEST_TIMEOUT_MS } from '../config'

export type ApiResult<T> =
  | { ok: true; data: T }
  /** 인증키 미설정. 호출을 시도하지 않았다는 뜻이며 '조회 실패'와 구분한다. */
  | { ok: false; reason: 'not_configured'; detail: string }
  /** 호출은 했으나 오류·시간 초과. spec 의 '경로 조회 실패'에 해당한다. */
  | { ok: false; reason: 'failed'; detail: string }

export async function fetchJson<T>(url: string): Promise<ApiResult<T>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
    if (!response.ok) {
      return { ok: false, reason: 'failed', detail: `HTTP ${response.status}` }
    }
    const text = await response.text()
    try {
      return { ok: true, data: JSON.parse(text) as T }
    } catch {
      // 공공 API 는 오류 시 XML 을 돌려주는 경우가 있어 원문 일부를 남긴다.
      return { ok: false, reason: 'failed', detail: `JSON 파싱 실패: ${text.slice(0, 120)}` }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return { ok: false, reason: 'failed', detail }
  } finally {
    clearTimeout(timer)
  }
}
