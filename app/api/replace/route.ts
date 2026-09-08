import { findReplacementCandidates } from '@/lib/engine/replace'
import { validateRecommendInput } from '@/lib/engine/validate'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    input?: unknown
    coursePlaceIds?: unknown
    targetPlaceId?: unknown
  } | null

  const validation = validateRecommendInput(body?.input)
  if (!validation.ok) {
    return Response.json({ errors: validation.errors }, { status: 400 })
  }

  const coursePlaceIds = body?.coursePlaceIds
  const targetPlaceId = body?.targetPlaceId
  if (
    !Array.isArray(coursePlaceIds) ||
    !coursePlaceIds.every((id) => typeof id === 'string') ||
    typeof targetPlaceId !== 'string'
  ) {
    return Response.json({ errors: ['교체 요청 형식이 올바르지 않습니다.'] }, { status: 400 })
  }

  try {
    const result = await findReplacementCandidates(
      validation.input,
      coursePlaceIds,
      targetPlaceId,
    )
    return Response.json(result)
  } catch (error) {
    return Response.json(
      {
        errors: [
          error instanceof Error ? error.message : '교체 후보 조회에 실패했습니다.',
        ],
      },
      { status: 400 },
    )
  }
}
