import { NextResponse } from 'next/server'
import { applyReplacement, findReplacements } from '@/lib/recommend/replace'
import { parseRecommendRequest } from '@/lib/validate'
import type { Course, Place } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * mode:'candidates' — 교체 후보 조회. mode:'apply' — 선택한 후보로 교체하고 앞뒤 구간 재검증.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ errors: ['요청 본문을 해석하지 못했습니다.'] }, { status: 400 })
  }

  const parsed = parseRecommendRequest(body.request)
  if (!parsed.ok) return NextResponse.json({ errors: parsed.errors }, { status: 400 })

  const course = body.course as Course | undefined
  const placeId = typeof body.placeId === 'string' ? body.placeId : ''
  if (!course || placeId === '') {
    return NextResponse.json({ errors: ['코스와 교체할 장소를 지정해 주세요.'] }, { status: 400 })
  }

  if (body.mode === 'apply') {
    const replacement = body.replacement as Place | undefined
    if (!replacement) {
      return NextResponse.json({ errors: ['교체할 장소를 지정해 주세요.'] }, { status: 400 })
    }
    const updated = await applyReplacement(course, placeId, replacement, parsed.value)
    return NextResponse.json({ course: updated })
  }

  const result = await findReplacements(course, placeId, parsed.value)
  return NextResponse.json(result)
}
