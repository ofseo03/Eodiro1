import { recomputeCourse } from '@/lib/engine/replace'
import { validateRecommendInput } from '@/lib/engine/validate'

export const dynamic = 'force-dynamic'

/** 장소를 교체한 뒤 코스를 다시 구성하고 조건을 재검증한다. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    input?: unknown
    placeIds?: unknown
  } | null

  const validation = validateRecommendInput(body?.input)
  if (!validation.ok) {
    return Response.json({ errors: validation.errors }, { status: 400 })
  }

  const placeIds = body?.placeIds
  if (
    !Array.isArray(placeIds) ||
    placeIds.length < 2 ||
    !placeIds.every((id) => typeof id === 'string')
  ) {
    return Response.json({ errors: ['코스 장소 목록이 올바르지 않습니다.'] }, { status: 400 })
  }

  try {
    const result = await recomputeCourse(validation.input, placeIds)
    return Response.json(result)
  } catch (error) {
    return Response.json(
      {
        errors: [
          error instanceof Error ? error.message : '코스 재계산에 실패했습니다.',
        ],
      },
      { status: 400 },
    )
  }
}
