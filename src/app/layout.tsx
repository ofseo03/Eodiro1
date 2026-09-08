import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '어디로 — 서울 코스 추천',
  description:
    '날씨·이동시간·교통수단 조건에 맞춰 서울 한 지역 안의 카페·식당·놀거리 코스를 추천합니다.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
