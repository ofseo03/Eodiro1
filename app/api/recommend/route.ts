import { recommendCourses } from '@/lib/engine/recommend'
import { validateRecommendInput } from '@/lib/engine/validate'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const validation = validateRecommendInput(body)

  if (!validation.ok) {
    return Response.json({ errors: validation.errors }, { status: 400 })
  }

  try {
    const result = await recommendCourses(validation.input)
    return Response.json(result)
  } catch (error) {
    return Response.json(
      { errors: [error instanceof Error ? error.message : '추천에 실패했습니다.'] },
      { status: 500 },
    )
  }
}
