import { CoursePlanner } from '@/components/course-planner'
import { REGIONS } from '@/lib/data/regions'
import { TAGS } from '@/lib/data/tags'

export default function Home() {
  return (
    <main>
      <header className="hero">
        <p className="eyebrow">Eodiro</p>
        <h1>어디로</h1>
        <p className="lead">
          서울 한 지역 안에서 날씨·이동시간·교통수단 조건에 맞는 카페·식당·놀거리
          코스를 추천합니다.
        </p>
      </header>

      <CoursePlanner regions={REGIONS} tags={TAGS} />

      <footer className="page-footer">
        기능 정의는 저장소의{' '}
        <a href="https://github.com/ofseo03/eodiro1/blob/main/docs/spec.md">
          docs/spec.md
        </a>
        를 기준으로 합니다.
      </footer>
    </main>
  )
}
