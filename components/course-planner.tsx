'use client'

import { useEffect, useState } from 'react'
import {
  DEFAULT_TOTAL_TRAVEL_MINUTES,
  DEFAULT_WALK_METERS,
  MAX_WALK_METERS_LIMIT,
} from '@/lib/constants'
import {
  CATEGORY_LABEL,
  INDOOR_LABEL,
  LEG_STATUS_LABEL,
  MODE_LABEL,
  SELECTABLE_MODES,
  TERNARY_LABEL,
  formatDistance,
  formatMinutes,
  formatVisitAt,
} from '@/lib/labels'
import type {
  Category,
  Course,
  Leg,
  Place,
  Preferences,
  RecommendInput,
  RecommendResult,
  Region,
  SelectableMode,
  WeatherAssessment,
} from '@/lib/types'

const PREFERENCES_KEY = 'eodiro:preferences:v1'
const ALL_CATEGORIES: Category[] = ['restaurant', 'cafe', 'activity']

const DEFAULT_PREFERENCES: Preferences = {
  categories: ['restaurant', 'cafe', 'activity'],
  likedTags: [],
  avoidTags: [],
}

/** datetime-local 입력에 넣을 현재 시각(브라우저 로컬 기준). */
function nowForInput(): string {
  const now = new Date()
  now.setMinutes(0, 0, 0)
  now.setHours(now.getHours() + 1)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function loadPreferences(): Preferences | null {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Preferences>
    if (!Array.isArray(parsed.categories)) return null
    return {
      categories: parsed.categories.filter((category): category is Category =>
        ALL_CATEGORIES.includes(category as Category),
      ),
      likedTags: Array.isArray(parsed.likedTags) ? parsed.likedTags : [],
      avoidTags: Array.isArray(parsed.avoidTags) ? parsed.avoidTags : [],
    }
  } catch {
    return null
  }
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value]
}

interface ReplacementState {
  courseId: string
  targetPlaceId: string
  loading: boolean
  candidates: { place: Place; straightLineM: number }[]
  notice: string | null
  error: string | null
}

export function CoursePlanner({
  regions,
  tags,
}: {
  regions: Region[]
  tags: readonly string[]
}) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [preferencesSaved, setPreferencesSaved] = useState(false)
  const [showPreferences, setShowPreferences] = useState(true)

  const [regionId, setRegionId] = useState(regions[0]?.id ?? '')
  const [visitAt, setVisitAt] = useState('')
  const [maxTotalTravelMinutes, setMaxTotalTravelMinutes] = useState(
    DEFAULT_TOTAL_TRAVEL_MINUTES,
  )
  const [allowedModes, setAllowedModes] = useState<SelectableMode[]>(['walk'])
  const [allowTaxiFallback, setAllowTaxiFallback] = useState(false)
  const [maxWalkMetersPerLeg, setMaxWalkMetersPerLeg] = useState(DEFAULT_WALK_METERS)

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [result, setResult] = useState<RecommendResult | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [replacedCourseIds, setReplacedCourseIds] = useState<string[]>([])
  const [replacement, setReplacement] = useState<ReplacementState | null>(null)
  const [usedInput, setUsedInput] = useState<RecommendInput | null>(null)

  useEffect(() => {
    setVisitAt(nowForInput())
    const stored = loadPreferences()
    if (stored && stored.categories.length >= 2) {
      setPreferences(stored)
      setPreferencesSaved(true)
      setShowPreferences(false)
    }
  }, [])

  function savePreferences() {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
    setPreferencesSaved(true)
    setShowPreferences(false)
  }

  function buildInput(): RecommendInput {
    return {
      regionId,
      visitAt: new Date(visitAt).toISOString(),
      maxTotalTravelMinutes,
      allowedModes,
      allowTaxiFallback,
      maxWalkMetersPerLeg,
      preferences,
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setErrors([])
    setReplacement(null)
    setReplacedCourseIds([])

    const input = buildInput()
    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      const payload = await response.json()

      if (!response.ok) {
        setErrors(payload.errors ?? ['추천에 실패했습니다.'])
        setResult(null)
        setCourses([])
        return
      }

      setResult(payload as RecommendResult)
      setCourses((payload as RecommendResult).courses)
      setUsedInput(input)
    } catch {
      setErrors(['네트워크 오류로 추천을 받지 못했습니다.'])
    } finally {
      setLoading(false)
    }
  }

  async function openReplacement(course: Course, place: Place) {
    if (!usedInput) return
    setReplacement({
      courseId: course.id,
      targetPlaceId: place.id,
      loading: true,
      candidates: [],
      notice: null,
      error: null,
    })

    try {
      const response = await fetch('/api/replace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          input: usedInput,
          coursePlaceIds: course.places.map((item) => item.id),
          targetPlaceId: place.id,
        }),
      })
      const payload = await response.json()

      if (!response.ok) {
        setReplacement({
          courseId: course.id,
          targetPlaceId: place.id,
          loading: false,
          candidates: [],
          notice: null,
          error: (payload.errors ?? ['교체 후보 조회에 실패했습니다.'])[0],
        })
        return
      }

      setReplacement({
        courseId: course.id,
        targetPlaceId: place.id,
        loading: false,
        candidates: payload.candidates ?? [],
        notice: payload.notice ?? null,
        error: null,
      })
    } catch {
      setReplacement({
        courseId: course.id,
        targetPlaceId: place.id,
        loading: false,
        candidates: [],
        notice: null,
        error: '네트워크 오류로 교체 후보를 받지 못했습니다.',
      })
    }
  }

  async function applyReplacement(course: Course, replacementPlace: Place) {
    if (!usedInput || !replacement) return
    const placeIds = course.places.map((place) =>
      place.id === replacement.targetPlaceId ? replacementPlace.id : place.id,
    )

    setReplacement({ ...replacement, loading: true })
    try {
      const response = await fetch('/api/course', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: usedInput, placeIds }),
      })
      const payload = await response.json()

      if (!response.ok) {
        setReplacement({
          ...replacement,
          loading: false,
          error: (payload.errors ?? ['코스 재계산에 실패했습니다.'])[0],
        })
        return
      }

      const nextCourse = payload.course as Course
      setCourses((current) =>
        current.map((item) => (item.id === course.id ? nextCourse : item)),
      )
      setReplacedCourseIds((current) => [...current, nextCourse.id])
      setReplacement(null)
    } catch {
      setReplacement({
        ...replacement,
        loading: false,
        error: '네트워크 오류로 코스를 다시 계산하지 못했습니다.',
      })
    }
  }

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <h2>취향 설정</h2>
          <button
            type="button"
            className="link-button"
            onClick={() => setShowPreferences((value) => !value)}
          >
            {showPreferences ? '접기' : '수정'}
          </button>
        </div>

        {preferencesSaved && !showPreferences ? (
          <p className="muted">
            {preferences.categories.map((category) => CATEGORY_LABEL[category]).join(' · ')}
            {preferences.likedTags.length > 0
              ? ` / 선호 ${preferences.likedTags.join(', ')}`
              : ''}
            {preferences.avoidTags.length > 0
              ? ` / 기피 ${preferences.avoidTags.join(', ')}`
              : ''}
          </p>
        ) : null}

        {showPreferences ? (
          <div className="stack">
            <fieldset>
              <legend>코스 구성</legend>
              <div className="chips">
                {ALL_CATEGORIES.map((category) => (
                  <label key={category} className="chip">
                    <input
                      type="checkbox"
                      checked={preferences.categories.includes(category)}
                      onChange={() =>
                        setPreferences((current) => ({
                          ...current,
                          categories: toggle(current.categories, category),
                        }))
                      }
                    />
                    {CATEGORY_LABEL[category]}
                  </label>
                ))}
              </div>
              <p className="hint">두 개 이상 선택하세요. 방문 순서는 추천이 정합니다.</p>
            </fieldset>

            <fieldset>
              <legend>선호 태그</legend>
              <div className="chips">
                {tags.map((tag) => (
                  <label key={tag} className="chip">
                    <input
                      type="checkbox"
                      checked={preferences.likedTags.includes(tag)}
                      disabled={preferences.avoidTags.includes(tag)}
                      onChange={() =>
                        setPreferences((current) => ({
                          ...current,
                          likedTags: toggle(current.likedTags, tag),
                        }))
                      }
                    />
                    {tag}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>기피 태그</legend>
              <div className="chips">
                {tags.map((tag) => (
                  <label key={tag} className="chip">
                    <input
                      type="checkbox"
                      checked={preferences.avoidTags.includes(tag)}
                      disabled={preferences.likedTags.includes(tag)}
                      onChange={() =>
                        setPreferences((current) => ({
                          ...current,
                          avoidTags: toggle(current.avoidTags, tag),
                        }))
                      }
                    />
                    {tag}
                  </label>
                ))}
              </div>
              <p className="hint">기피 태그가 붙은 장소는 후보에서 제외합니다.</p>
            </fieldset>

            <button type="button" className="secondary" onClick={savePreferences}>
              이 기기에 취향 저장
            </button>
          </div>
        ) : null}
      </section>

      <form className="panel" onSubmit={submit}>
        <h2>추천 조건</h2>

        <div className="grid">
          <label>
            지역
            <select value={regionId} onChange={(e) => setRegionId(e.target.value)}>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            방문 시각
            <input
              type="datetime-local"
              value={visitAt}
              onChange={(e) => setVisitAt(e.target.value)}
              required
            />
          </label>

          <label>
            총 이동시간 상한 (분)
            <input
              type="number"
              min={1}
              value={maxTotalTravelMinutes}
              onChange={(e) => setMaxTotalTravelMinutes(Number(e.target.value))}
              required
            />
          </label>

          <label>
            구간별 최대 도보 거리 (m)
            <input
              type="number"
              min={1}
              max={MAX_WALK_METERS_LIMIT}
              value={maxWalkMetersPerLeg}
              onChange={(e) => setMaxWalkMetersPerLeg(Number(e.target.value))}
              required
            />
          </label>
        </div>

        <fieldset>
          <legend>허용 교통수단</legend>
          <div className="chips">
            {SELECTABLE_MODES.map((mode) => (
              <label key={mode} className="chip">
                <input
                  type="checkbox"
                  checked={allowedModes.includes(mode)}
                  onChange={() => setAllowedModes((current) => toggle(current, mode))}
                />
                {MODE_LABEL[mode]}
              </label>
            ))}
          </div>
          <label className="chip standalone">
            <input
              type="checkbox"
              checked={allowTaxiFallback}
              onChange={(e) => setAllowTaxiFallback(e.target.checked)}
            />
            연결할 방법이 없을 때 택시 대안 표시
          </label>
          <p className="hint">택시 없이 완성되는 코스를 먼저 추천합니다.</p>
        </fieldset>

        <button type="submit" disabled={loading}>
          {loading ? '코스를 찾는 중…' : '코스 추천받기'}
        </button>

        {errors.length > 0 ? (
          <ul className="errors">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
      </form>

      {result ? (
        <section className="results">
          <WeatherCard weather={result.weather} visitAt={result.visitAt} />

          {result.dataNotices.length > 0 ? (
            <ul className="notices">
              {result.dataNotices.map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
          ) : null}

          {result.notice ? <p className="notice-block">{result.notice}</p> : null}

          {courses.map((course, index) => (
            <CourseCard
              key={course.id}
              course={course}
              index={index}
              weather={result.weather}
              replaced={replacedCourseIds.includes(course.id)}
              replacement={
                replacement && replacement.courseId === course.id ? replacement : null
              }
              onRequestReplacement={(place) => openReplacement(course, place)}
              onApplyReplacement={(place) => applyReplacement(course, place)}
              onCancelReplacement={() => setReplacement(null)}
            />
          ))}
        </section>
      ) : null}
    </>
  )
}

function WeatherCard({
  weather,
  visitAt,
}: {
  weather: WeatherAssessment
  visitAt: string
}) {
  if (!weather.available) {
    return (
      <div className="panel weather">
        <h2>날씨 미반영</h2>
        <p className="muted">{weather.reason}</p>
        <p className="muted">기준 시각 {formatVisitAt(visitAt)}</p>
      </div>
    )
  }

  return (
    <div className="panel weather">
      <h2>
        {weather.indoorRecommended ? '실내 코스 우선 추천' : '실내 우선 조건 아님'}
      </h2>
      <p>
        기온 {weather.temperatureC}℃ · 강수확률 {weather.precipitationProbability}%
      </p>
      {weather.reasons.length > 0 ? (
        <p className="muted">판단 근거: {weather.reasons.join(', ')}</p>
      ) : null}
      <p className="muted">
        기준 {formatVisitAt(visitAt)} · {weather.basedOn.source}
      </p>
    </div>
  )
}

function CourseCard({
  course,
  index,
  weather,
  replaced,
  replacement,
  onRequestReplacement,
  onApplyReplacement,
  onCancelReplacement,
}: {
  course: Course
  index: number
  weather: WeatherAssessment
  replaced: boolean
  replacement: ReplacementState | null
  onRequestReplacement: (place: Place) => void
  onApplyReplacement: (place: Place) => void
  onCancelReplacement: () => void
}) {
  const weatherApplied = weather.available && weather.indoorRecommended

  return (
    <article className="panel course">
      <div className="panel-head">
        <h2>코스 {index + 1}</h2>
        <div className="badges">
          {replaced ? <span className="badge">장소 교체 반영</span> : null}
          <span className={`badge ${course.usesTaxi ? 'warn' : 'ok'}`}>
            {course.usesTaxi ? '택시 구간 포함' : '택시 없음'}
          </span>
          <span className={`badge ${course.fullyConfirmed ? 'ok' : 'warn'}`}>
            {course.fullyConfirmed ? '조건 충족 확정' : '일부 조건 확정 불가'}
          </span>
        </div>
      </div>

      <ol className="timeline">
        {course.places.map((place, placeIndex) => (
          <li key={place.id}>
            <div className="place">
              <div>
                <strong>
                  {placeIndex + 1}. {place.name}
                </strong>
                <span className="muted">
                  {CATEGORY_LABEL[place.category]} · {INDOOR_LABEL[place.indoor]}
                  {weatherApplied && place.indoor === 'indoor'
                    ? ' · 날씨 반영 실내 추천'
                    : ''}
                  {weatherApplied && place.indoor !== 'indoor'
                    ? ' · 실내로 확정하지 않음'
                    : ''}
                </span>
                <span className="muted">{place.address}</span>
                {place.tags.length > 0 ? (
                  <span className="muted">#{place.tags.join(' #')}</span>
                ) : null}
              </div>
              <button
                type="button"
                className="link-button"
                onClick={() => onRequestReplacement(place)}
              >
                이 장소 교체
              </button>
            </div>

            {replacement && replacement.targetPlaceId === place.id ? (
              <ReplacementPanel
                replacement={replacement}
                onApply={onApplyReplacement}
                onCancel={onCancelReplacement}
              />
            ) : null}

            {placeIndex < course.legs.length ? (
              <LegRow leg={course.legs[placeIndex]} />
            ) : null}
          </li>
        ))}
      </ol>

      <dl className="totals">
        <div>
          <dt>{course.totals.allMinutesVerified ? '총 이동시간' : '확인된 구간 이동시간 합계'}</dt>
          <dd>{course.totals.knownMinutes}분</dd>
        </div>
        <div>
          <dt>총 이동시간 상한</dt>
          <dd>{TERNARY_LABEL[course.totals.withinTotalLimit]}</dd>
        </div>
      </dl>

      {course.warnings.length > 0 ? (
        <ul className="notices">
          {course.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}

function LegRow({ leg }: { leg: Leg }) {
  const isProblem =
    leg.status === 'no-route' ||
    leg.status === 'lookup-failed' ||
    leg.status === 'provider-not-configured'

  return (
    <div className={`leg ${isProblem ? 'leg-problem' : ''}`}>
      <span className="leg-mode">{LEG_STATUS_LABEL[leg.status]}</span>
      <span className="muted">
        {formatDistance(leg.walkDistanceM, leg.walkDistanceConfidence)} ·{' '}
        {formatMinutes(leg.minutes, leg.minutesConfidence)} · 직선 {leg.straightLineM}m
      </span>
      {leg.detail ? <span className="muted">{leg.detail}</span> : null}
      <span className="muted">
        최대 도보 거리 {TERNARY_LABEL[leg.withinWalkLimit]}
      </span>
      {leg.notes.map((note) => (
        <span className="muted" key={note}>
          {note}
        </span>
      ))}
    </div>
  )
}

function ReplacementPanel({
  replacement,
  onApply,
  onCancel,
}: {
  replacement: ReplacementState
  onApply: (place: Place) => void
  onCancel: () => void
}) {
  return (
    <div className="replacement">
      <div className="panel-head">
        <h3>반경 100m 안의 같은 카테고리 후보</h3>
        <button type="button" className="link-button" onClick={onCancel}>
          닫기
        </button>
      </div>

      {replacement.loading ? <p className="muted">불러오는 중…</p> : null}
      {replacement.error ? <p className="muted">{replacement.error}</p> : null}
      {replacement.notice ? <p className="muted">{replacement.notice}</p> : null}

      <ul className="candidates">
        {replacement.candidates.map(({ place, straightLineM }) => (
          <li key={place.id}>
            <div>
              <strong>{place.name}</strong>
              <span className="muted">
                {INDOOR_LABEL[place.indoor]} · 직선 {straightLineM}m
                {place.tags.length > 0 ? ` · #${place.tags.join(' #')}` : ''}
              </span>
            </div>
            <button
              type="button"
              className="secondary"
              disabled={replacement.loading}
              onClick={() => onApply(place)}
            >
              이 장소로 교체
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
