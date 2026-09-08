'use client'

import type { Course, DataSourceReport, Place, ReplaceCandidate } from '@/lib/types'
import {
  CATEGORY_LABEL,
  INDOOR_LABEL,
  MODE_LABEL,
  STATUS_LABEL,
  formatDistance,
  formatDuration,
  walkLimitLabel,
} from './format'

type Props = {
  course: Course
  dataSources: DataSourceReport[]
  replaceTargetId: string | null
  replaceCandidates: ReplaceCandidate[] | null
  replaceMessage: string | null
  replaceLoading: boolean
  onRequestReplace: (placeId: string) => void
  onApplyReplace: (placeId: string, place: Place) => void
  onCancelReplace: () => void
}

export function CourseResult({
  course,
  dataSources,
  replaceTargetId,
  replaceCandidates,
  replaceMessage,
  replaceLoading,
  onRequestReplace,
  onApplyReplace,
  onCancelReplace,
}: Props) {
  const weather = course.weather

  return (
    <>
      <section className="card">
        <h2>추천 코스 · {course.regionName}</h2>
        <p className="hint">
          기준 시각 {new Date(course.basis.visitAt).toLocaleString('ko-KR')} · 기준 위치{' '}
          {course.basis.referenceLabel} (
          {course.basis.referenceCoordinate.lat.toFixed(4)},{' '}
          {course.basis.referenceCoordinate.lng.toFixed(4)})
        </p>

        <p style={{ marginTop: 0 }}>
          {course.allConditionsMet ? (
            <span className="badge ok">모든 조건 충족</span>
          ) : (
            <span className="badge warn">일부 조건 미확정 — 조건 충족으로 표시하지 않음</span>
          )}
        </p>

        <div className="totals">
          <div className="cell">
            <div className="k">
              {course.totals.totalMinutes === null ? '확인된 구간 이동시간 합계' : '총 예상 이동시간'}
            </div>
            <div className="v">{course.totals.confirmedMinutes}분</div>
          </div>
          <div className="cell">
            <div className="k">총 이동시간 상한</div>
            <div className="v">
              {course.totals.travelLimit === 'within'
                ? '충족'
                : course.totals.travelLimit === 'exceeded'
                  ? '초과'
                  : '판단 불가'}
            </div>
          </div>
          <div className="cell">
            <div className="k">구간별 최대 도보 거리</div>
            <div className="v">{walkLimitLabel(course.totals.walkLimit).text}</div>
          </div>
          <div className="cell">
            <div className="k">이동시간 미확인 구간</div>
            <div className="v">{course.totals.unknownSegmentCount}개</div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>날씨</h2>
        {weather.status === 'available' ? (
          <p className="hint" style={{ marginBottom: 0 }}>
            {weather.targetTime} 기준 {weather.temperatureC}℃ · 하늘 {weather.skyCondition || '미확인'} ·
            강수 {weather.precipitationType} (발표 {weather.baseTime})
            <br />
            {course.weatherApplied ? (
              <span className="badge ok">날씨를 반영한 실내 추천</span>
            ) : (
              <span className="badge warn">날씨 반영 미확정</span>
            )}
          </p>
        ) : (
          <p className="hint" style={{ marginBottom: 0 }}>
            <span className="badge warn">날씨 미반영</span> {weather.reason}
          </p>
        )}
      </section>

      <section className="card">
        <h2>방문 순서</h2>
        <p className="hint">장소를 하나 골라 반경 100m 안의 같은 카테고리 장소로 교체할 수 있습니다.</p>

        {course.places.map((place, index) => {
          const segment = course.segments[index]
          return (
            <div key={place.id}>
              <div className="stop">
                <div className="index">{index + 1}</div>
                <div className="body">
                  <div className="title">
                    <span>{place.name}</span>
                    <span className="badge neutral">{CATEGORY_LABEL[place.category]}</span>
                    <span
                      className={`badge ${place.indoor === 'indoor' ? 'ok' : place.indoor === 'unknown' ? 'warn' : 'neutral'}`}
                    >
                      {INDOOR_LABEL[place.indoor]}
                    </span>
                    {place.source === 'sample-dataset' && (
                      <span className="badge warn">샘플 데이터</span>
                    )}
                  </div>
                  {place.address && <p className="meta">{place.address}</p>}
                  {place.openingHours && <p className="meta">이용시간 {place.openingHours}</p>}
                  <p className="meta" style={{ marginTop: 6 }}>
                    <button className="ghost" onClick={() => onRequestReplace(place.id)}>
                      이 장소 교체하기
                    </button>
                  </p>

                  {replaceTargetId === place.id && (
                    <div className="candidates">
                      {replaceLoading && <p className="meta">교체 후보를 찾는 중…</p>}
                      {!replaceLoading && replaceMessage && <p className="meta">{replaceMessage}</p>}
                      {!replaceLoading &&
                        replaceCandidates?.map((candidate) => (
                          <div className="candidate" key={candidate.place.id}>
                            <span>
                              {candidate.place.name}
                              <span className="meta"> · 직선거리 {candidate.straightMeters}m</span>
                            </span>
                            <button
                              className="ghost"
                              onClick={() => onApplyReplace(place.id, candidate.place)}
                            >
                              교체
                            </button>
                          </div>
                        ))}
                      <div>
                        <button className="ghost" onClick={onCancelReplace}>
                          닫기
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {segment && (
                <div className="segment">
                  <div className="head">
                    <span>
                      {segment.mode ? MODE_LABEL[segment.mode] : '이동'} → {course.places[index + 1]?.name}
                    </span>
                    <span className={`badge ${STATUS_LABEL[segment.status].tone}`}>
                      {STATUS_LABEL[segment.status].text}
                    </span>
                    <span className={`badge ${walkLimitLabel(segment.walkLimit).tone}`}>
                      {walkLimitLabel(segment.walkLimit).text}
                    </span>
                  </div>
                  <ul>
                    <li>
                      {formatDistance(segment.distance)} · {formatDuration(segment.duration)}
                      {segment.estimatedWalkMinutes !== undefined &&
                        ` · 직선거리 기준 추정 ${segment.estimatedWalkMinutes}분`}
                    </li>
                    {/* 도보 단일 구간은 위 줄과 같은 내용이라 다시 적지 않는다. */}
                    {(segment.mode === 'walk' ? [] : segment.legs).map((leg, legIndex) => (
                      <li key={legIndex}>
                        {MODE_LABEL[leg.mode]} {leg.label} · {formatDuration(leg.duration)}
                      </li>
                    ))}
                    {segment.accessWalk && (
                      <li>
                        접근·환승 도보 {formatDistance(segment.accessWalk.distance)} —{' '}
                        {segment.accessWalk.note}
                      </li>
                    )}
                    {segment.notes.map((note, noteIndex) => (
                      <li key={`note-${noteIndex}`}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </section>

      {course.warnings.length > 0 && (
        <section className="card">
          <h2>확인이 필요한 항목</h2>
          <ul className="plain">
            {course.warnings.map((warning) => (
              <li key={warning} className="meta">
                · {warning}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>데이터 출처 상태</h2>
        <div className="sources">
          {dataSources.map((source) => (
            <div className="row" key={source.name}>
              <span
                className={`badge ${
                  source.status === 'live' ? 'ok' : source.status === 'failed' ? 'danger' : 'warn'
                }`}
              >
                {source.status === 'live'
                  ? '실호출'
                  : source.status === 'failed'
                    ? '조회 실패'
                    : source.status === 'sample'
                      ? '샘플 데이터'
                      : '키 미설정'}
              </span>
              <strong>{source.name}</strong>
              {source.detail && <span className="detail">{source.detail}</span>}
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
