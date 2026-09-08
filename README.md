# 어디로 (Eodiro)

서울 한 지역 안에서 날씨·이동시간·교통수단 조건에 맞는 카페·식당·놀거리 코스를 추천하는 웹 서비스.

기능 정의는 [`docs/spec.md`](docs/spec.md) 를 기준으로 합니다.

## 기술 스택

- Next.js 16 (App Router) · React 19 · TypeScript
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
```

## Vercel 배포

이 저장소는 Vercel이 별도 설정 없이 인식하는 표준 Next.js 구조입니다. 프레임워크 프리셋 `Next.js`, 빌드 명령 `npm run build`, 출력 디렉터리는 자동 감지됩니다.

1. [vercel.com/new](https://vercel.com/new) 에서 GitHub 계정을 연결하고 `ofseo03/eodiro1` 저장소를 임포트합니다.
2. Framework Preset이 `Next.js` 로 잡혔는지만 확인하고 **Deploy** 를 누릅니다. 현재는 필요한 환경 변수가 없습니다.
3. 배포 후 `https://<프로젝트>.vercel.app/api/health` 가 `{"status":"ok"}` 를 반환하면 정상입니다.

- Production 브랜치는 `main` 입니다. 다른 브랜치에 푸시하면 Preview 배포가 생성됩니다.
- 서울 사용자 대상이므로 Project Settings → Functions 의 기본 리전을 `Seoul (icn1)` 로 두는 것을 권장합니다.
- 공공 API 키를 사용하게 되면 Vercel Project Settings → Environment Variables 에 등록하고, 로컬에서는 `.env.local` 을 사용합니다. 두 파일 모두 커밋하지 않습니다.

CLI 로 배포하려면:

```bash
npx vercel        # Preview 배포
npx vercel --prod # Production 배포
```
