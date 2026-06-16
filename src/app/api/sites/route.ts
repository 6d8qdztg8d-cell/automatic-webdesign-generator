import { NextRequest, NextResponse } from 'next/server'
import { getAllSites, deleteSite } from '@/lib/db'

export async function GET() {
  const sites = getAllSites()
  return NextResponse.json(sites)
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  deleteSite(id)
  return NextResponse.json({ ok: true })
}
