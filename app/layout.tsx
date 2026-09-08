import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '어디로 (Eodiro)',
  description:
    '서울 한 지역 안에서 날씨·이동시간·교통수단 조건에 맞는 카페·식당·놀거리 코스를 추천합니다.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
