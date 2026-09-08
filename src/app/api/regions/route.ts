import { NextResponse } from 'next/server'
import { REGIONS } from '@/lib/regions'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({ regions: REGIONS })
}
