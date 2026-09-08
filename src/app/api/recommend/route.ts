import { NextResponse } from 'next/server'
import { buildCourse } from '@/lib/recommend/course'
import { parseRecommendRequest } from '@/lib/validate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ errors: ['요청 본문을 해석하지 못했습니다.'] }, { status: 400 })
  }

  const parsed = parseRecommendRequest(body)
  if (!parsed.ok) return NextResponse.json({ errors: parsed.errors }, { status: 400 })

  const result = await buildCourse(parsed.value)
  return NextResponse.json(result)
}
