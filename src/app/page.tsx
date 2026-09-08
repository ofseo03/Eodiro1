'use client'

import { useEffect, useMemo, useState } from 'react'
import { CourseResult } from '@/components/CourseResult'
import { CATEGORY_LABEL, MODE_LABEL } from '@/components/format'
import { COURSE_RULES } from '@/lib/rules'
import { REGIONS } from '@/lib/regions'
import type {
  Course,
  DataSourceReport,
  Place,
  PlaceCategory,
  Preference,
  RecommendRequest,
  RecommendResponse,
  ReplaceCandidate,
  ReplaceResponse,
  SelectableMode,
} from '@/lib/types'

const PREFERENCE_KEY = 'eodiro.preference.v1'
const MODES: SelectableMode[] = ['walk', 'bus', 'subway']
const CATEGORIES: PlaceCategory[] = ['cafe', 'restaurant', 'attraction']

/** 로컬 시각을 datetime-local 입력값 형식으로 만든다. */
function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00`
}

export default function Home() {
  const [regionId, setRegionId] = useState(REGIONS[0].id)
  const [maxTravelMinutes, setMaxTravelMinutes] = useState(40)
  const [maxWalkMeters, setMaxWalkMeters] = useState<number>(COURSE_RULES.defaultWalkMeters)
  const [allowedModes, setAllowedModes] = useState<SelectableMode[]>(['walk', 'subway'])
  const [allowTaxiFallback, setAllowTaxiFallback] = useState(false)
  const [categories, setCategories] = useState<PlaceCategory[]>([...CATEGORIES])
  const [tagsInput, setTagsInput] = useState('')
  const [visitAt, setVisitAt] = useState(() => toLocalInput(new Date()))
  const [preferenceLoaded, setPreferenceLoaded] = useState(false)

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [course, setCourse] = useState<Course | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [dataSources, setDataSources] = useState<DataSourceReport[]>([])

  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null)
  const [replaceCandidates, setReplaceCandidates] = useState<ReplaceCandidate[] | null>(null)
  const [replaceMessage, setReplaceMessage] = useState<string | null>(null)
  const [replaceLoading, setReplaceLoading] = useState(false)

  // 최초 설정한 취향을 이후 추천에 재사용한다(spec 2항). 저장 방식은 우선 기기 내 저장.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PREFERENCE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Preference
        if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
          setCategories(parsed.categories.filter((c) => CATEGORIES.includes(c)))
        }
        if (Array.isArray(parsed.tags)) setTagsInput(parsed.tags.join(', '))
      }
    } catch {
      // 저장값을 읽지 못해도 기본값으로 진행한다.
    }
    setPreferenceLoaded(true)
  }, [])

  const preference = useMemo<Preference>(
    () => ({
      categories,
      tags: tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag !== ''),
    }),
    [categories, tagsInput],
  )

  useEffect(() => {
    if (!preferenceLoaded) return
    try {
      window.localStorage.setItem(PREFERENCE_KEY, JSON.stringify(preference))
    } catch {
      // 저장 실패는 추천 동작에 영향을 주지 않는다.
    }
  }, [preference, preferenceLoaded])

  const requestPayload = useMemo<RecommendRequest>(
    () => ({
      regionId,
      maxTravelMinutes,
      allowedModes,
      maxWalkMeters,
      allowTaxiFallback,
      preference,
      visitAt: new Date(visitAt).toISOString(),
    }),
    [regionId, maxTravelMinutes, allowedModes, maxWalkMeters, allowTaxiFallback, preference, visitAt],
  )

  function toggleMode(mode: SelectableMode) {
    setAllowedModes((current) =>
      current.includes(mode) ? current.filter((m) => m !== mode) : [...current, mode],
    )
  }

  function toggleCategory(category: PlaceCategory) {
    setCategories((current) =>
      current.includes(category) ? current.filter((c) => c !== category) : [...current, category],
    )
  }

  function resetReplaceState() {
    setReplaceTargetId(null)
    setReplaceCandidates(null)
    setReplaceMessage(null)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setErrors([])
    setMessage(null)
    resetReplaceState()

    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(requestPayload),
      })
      const body = (await response.json()) as RecommendResponse & { errors?: string[] }

      if (!response.ok) {
        setErrors(body.errors ?? ['추천을 가져오지 못했습니다.'])
        setCourse(null)
        return
      }

      setCourse(body.course)
      setMessage(body.message ?? null)
      setDataSources(body.dataSources ?? [])
    } catch (error) {
      setErrors([error instanceof Error ? error.message : '추천 요청에 실패했습니다.'])
    } finally {
      setLoading(false)
    }
  }

  async function handleRequestReplace(placeId: string) {
    if (!course) return
    setReplaceTargetId(placeId)
    setReplaceCandidates(null)
    setReplaceMessage(null)
    setReplaceLoading(true)
    try {
      const response = await fetch('/api/replace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'candidates', course, placeId, request: requestPayload }),
      })
      const body = (await response.json()) as ReplaceResponse & { errors?: string[] }
      if (!response.ok) {
        setReplaceMessage((body.errors ?? ['교체 후보를 가져오지 못했습니다.']).join(' '))
        return
      }
      setReplaceCandidates(body.candidates)
      setReplaceMessage(body.message ?? null)
    } catch (error) {
      setReplaceMessage(error instanceof Error ? error.message : '교체 후보 조회에 실패했습니다.')
    } finally {
      setReplaceLoading(false)
    }
  }

  async function handleApplyReplace(placeId: string, place: Place) {
    if (!course) return
    setReplaceLoading(true)
    try {
      const response = await fetch('/api/replace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'apply',
          course,
          placeId,
          replacement: place,
          request: requestPayload,
        }),
      })
      const body = (await response.json()) as { course?: Course; errors?: string[] }
      if (!response.ok || !body.course) {
        setReplaceMessage((body.errors ?? ['교체에 실패했습니다.']).join(' '))
        return
      }
      setCourse(body.course)
      resetReplaceState()
    } catch (error) {
      setReplaceMessage(error instanceof Error ? error.message : '교체 요청에 실패했습니다.')
    } finally {
      setReplaceLoading(false)
    }
  }

  return (
    <main className="page">
      <header className="site-header">
        <h1>어디로</h1>
        <p>
          서울 한 지역 안에서 날씨·이동시간·교통수단 조건에 맞는 카페·식당·놀거리 코스를 추천합니다.
        </p>
      </header>

      <form className="card" onSubmit={handleSubmit}>
        <h2>추천 조건</h2>
        <p className="hint">
          체류시간을 제외한 구간별 이동시간의 합을 기준으로 계산합니다. 도보 거리는 구간별 기준이며 최대{' '}
          {COURSE_RULES.walkLimitCeilingMeters}m 까지 설정할 수 있습니다.
        </p>

        <div className="grid">
          <label className="field">
            추천 지역
            <select value={regionId} onChange={(e) => setRegionId(e.target.value)}>
              {REGIONS.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name} ({region.label})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            방문 날짜·시각
            <span className="sub">날씨와 경로 계산의 기준이 됩니다.</span>
            <input
              type="datetime-local"
              value={visitAt}
              onChange={(e) => setVisitAt(e.target.value)}
              required
            />
          </label>

          <label className="field">
            총 이동시간 상한 (분)
            <span className="sub">체류시간 제외</span>
            <input
              type="number"
              min={1}
              value={maxTravelMinutes}
              onChange={(e) => setMaxTravelMinutes(Number(e.target.value))}
              required
            />
          </label>

          <label className="field">
            구간별 최대 도보 거리 (m)
            <span className="sub">기본값 {COURSE_RULES.defaultWalkMeters}m (잠정)</span>
            <input
              type="number"
              min={1}
              max={COURSE_RULES.walkLimitCeilingMeters}
              value={maxWalkMeters}
              onChange={(e) => setMaxWalkMeters(Number(e.target.value))}
              required
            />
          </label>
        </div>

        <div style={{ marginTop: 18 }}>
          <p className="hint" style={{ marginBottom: 8 }}>허용 교통수단 (하나 이상)</p>
          <div className="checks">
            {MODES.map((mode) => (
              <label key={mode} className={`check ${allowedModes.includes(mode) ? 'on' : ''}`}>
                <input
                  type="checkbox"
                  checked={allowedModes.includes(mode)}
                  onChange={() => toggleMode(mode)}
                />
                {MODE_LABEL[mode]}
              </label>
            ))}
            <label className={`check ${allowTaxiFallback ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={allowTaxiFallback}
                onChange={() => setAllowTaxiFallback((v) => !v)}
              />
              택시 대안 표시 (경로 없음일 때만)
            </label>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <p className="hint" style={{ marginBottom: 8 }}>
            취향 — 한 번 설정하면 다음 추천에도 이어서 사용합니다 (이 브라우저에 저장).
          </p>
          <div className="checks">
            {CATEGORIES.map((category) => (
              <label key={category} className={`check ${categories.includes(category) ? 'on' : ''}`}>
                <input
                  type="checkbox"
                  checked={categories.includes(category)}
                  onChange={() => toggleCategory(category)}
                />
                {CATEGORY_LABEL[category]}
              </label>
            ))}
          </div>
          <label className="field" style={{ marginTop: 12 }}>
            취향 키워드
            <span className="sub">쉼표로 구분 · 예: 조용한, 전시, 디저트</span>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="조용한, 전시"
            />
          </label>
        </div>

        <p style={{ marginTop: 20, marginBottom: 0 }}>
          <button className="primary" type="submit" disabled={loading}>
            {loading ? '코스를 만드는 중…' : '코스 추천받기'}
          </button>
        </p>
      </form>

      {errors.length > 0 && (
        <div className="errors">
          <ul className="plain">
            {errors.map((error) => (
              <li key={error}>· {error}</li>
            ))}
          </ul>
        </div>
      )}

      {message && !course && (
        <section className="card">
          <h2>추천 결과 없음</h2>
          <p className="hint" style={{ marginBottom: 0 }}>{message}</p>
        </section>
      )}

      {course && (
        <CourseResult
          course={course}
          dataSources={dataSources}
          replaceTargetId={replaceTargetId}
          replaceCandidates={replaceCandidates}
          replaceMessage={replaceMessage}
          replaceLoading={replaceLoading}
          onRequestReplace={handleRequestReplace}
          onApplyReplace={handleApplyReplace}
          onCancelReplace={resetReplaceState}
        />
      )}

      <footer className="note">
        공공데이터 출처: 서울열린데이터광장 · 기상청 · 서울특별시 · 서울교통공사. 인증키가 설정되지 않은
        항목은 화면에 &lsquo;키 미설정&rsquo;으로 표시되며, 확인되지 않은 값은 임의로 채우지 않습니다.
      </footer>
    </main>
  )
}
