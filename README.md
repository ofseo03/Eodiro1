# 어디로 (Eodiro)

서울 한 지역 안에서 날씨·이동시간·교통수단 조건에 맞는 카페·식당·놀거리 코스를 추천하는 웹 서비스.

기능 정의는 [`docs/spec.md`](docs/spec.md), 구현 시 확정한 사항과 미검증 항목은
[`docs/implementation.md`](docs/implementation.md) 를 기준으로 합니다.

## 기능

- 취향(코스 구성 카테고리·선호 태그·기피 태그)을 기기에 저장하고 이후 추천에 재사용
- 지역·방문 시각·총 이동시간 상한·허용 교통수단·구간별 최대 도보 거리(최대 1,000m)로 코스 추천
- 날씨가 덥거나 춥거나 비 예보가 있으면 실내 장소를 우선 추천 (조회 실패 시 '날씨 미반영')
- 택시 없이 완성되는 코스를 먼저 제시하고, 필요할 때만 '택시 이용 검토'로 표시
- 구간별 이동수단·거리·예상 시간과 함께 확인된 값·추정값·미확인 구간을 구분해 표시
- 코스의 한 장소를 반경 100m 안의 같은 카테고리 장소로 교체하고 앞뒤 구간을 재검증

## 기술 스택

- Next.js 16 (App Router) · React 19 · TypeScript
- 테스트: Vitest
- 배포: Vercel

## 로컬 실행

```bash
npm install
npm run dev      # http://localhost:3000
```

기타 스크립트

```bash
npm run build    # 프로덕션 빌드
npm run start    # 빌드 결과 실행
npm run typecheck
npm test         # 추천 엔진·날씨 판단·입력 검증 단위 테스트
```

## 환경 변수

| 변수 | 용도 | 없을 때 동작 |
| --- | --- | --- |
| `KMA_SERVICE_KEY` | 기상청 단기예보 조회 서비스 인증키 | 날씨를 조회하지 않고 '날씨 미반영'으로 표시 |

로컬에서는 `.env.local`, 배포 환경에서는 Vercel Project Settings → Environment Variables 에
등록합니다. 두 곳 모두 값을 저장소에 커밋하지 않습니다.

장소·대중교통·보행 경로 데이터는 아직 공공 API를 연동하지 않았습니다. 현재는 샘플 장소 데이터로
동작하며, 그 사실을 화면에도 표시합니다. 연동 방법은 `docs/implementation.md` 를 참고하세요.

## API

| 경로 | 설명 |
| --- | --- |
| `POST /api/recommend` | 조건과 취향으로 코스를 추천 |
| `POST /api/replace` | 코스의 한 장소에 대한 반경 100m 내 교체 후보 조회 |
| `POST /api/course` | 장소 목록으로 코스를 다시 계산하고 조건을 재검증 |
| `GET /api/health` | 배포 상태 확인 |

## Vercel 배포

이 저장소는 Vercel이 별도 설정 없이 인식하는 표준 Next.js 구조입니다. 프레임워크 프리셋 `Next.js`,
빌드 명령 `npm run build`, 출력 디렉터리는 자동 감지됩니다.

1. [vercel.com/new](https://vercel.com/new) 에서 GitHub 계정을 연결하고 `ofseo03/eodiro1` 저장소를 임포트합니다.
2. Framework Preset이 `Next.js` 로 잡혔는지 확인하고 **Deploy** 를 누릅니다.
3. 배포 후 `https://<프로젝트>.vercel.app/api/health` 가 `{"status":"ok"}` 를 반환하면 정상입니다.

- Production 브랜치는 `main` 입니다. 다른 브랜치에 푸시하면 Preview 배포가 생성됩니다.
- 서울 사용자 대상이므로 Project Settings → Functions 의 기본 리전을 `Seoul (icn1)` 로 두는 것을 권장합니다.

CLI 로 배포하려면:

```bash
npx vercel        # Preview 배포
npx vercel --prod # Production 배포
```
