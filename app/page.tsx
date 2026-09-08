const options = [
  {
    title: '날씨 반영',
    body: '덥거나 춥거나 비 예보가 있으면 실내 장소를 우선 추천합니다.',
  },
  {
    title: '총 이동시간 상한',
    body: '체류시간을 뺀 구간별 이동시간의 합을 기준으로 코스를 맞춥니다.',
  },
  {
    title: '허용 교통수단',
    body: '버스·지하철·도보를 기본으로 하고, 택시는 필요할 때만 대안으로 둡니다.',
  },
  {
    title: '구간별 최대 도보 거리',
    body: '이동 구간마다 적용하며 최대 1,000m까지 설정할 수 있습니다.',
  },
]

export default function Home() {
  return (
    <main>
      <p className="eyebrow">Eodiro</p>
      <h1>어디로</h1>
      <p className="lead">
        서울 한 지역 안에서 날씨·이동시간·교통수단 조건에 맞는 카페·식당·놀거리
        코스를 추천하는 웹 서비스입니다.
      </p>

      <h2>추천 옵션</h2>
      <ul className="cards">
        {options.map((option) => (
          <li className="card" key={option.title}>
            <strong>{option.title}</strong>
            <span>{option.body}</span>
          </li>
        ))}
      </ul>

      <p className="status">
        현재는 배포 확인용 초기 화면입니다. 기능 정의는 저장소의{' '}
        <a href="https://github.com/ofseo03/eodiro1/blob/main/docs/spec.md">
          docs/spec.md
        </a>
        를 기준으로 합니다.
      </p>
    </main>
  )
}
