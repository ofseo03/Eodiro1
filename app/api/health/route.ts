export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({
    status: 'ok',
    service: 'eodiro',
    timestamp: new Date().toISOString(),
  })
}
