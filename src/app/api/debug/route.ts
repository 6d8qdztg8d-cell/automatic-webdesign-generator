import { NextResponse } from 'next/server'
import { listStitchTools } from '@/lib/stitch'
import fs from 'fs'

export async function GET() {
  const results: Record<string, string> = {}

  results.OPENAI_API_KEY = process.env.OPENAI_API_KEY ? '✓' : '✗ FEHLT'
  results.STITCH_API_KEY = process.env.STITCH_API_KEY ? '✓' : '✗ FEHLT'
  results.IS_VERCEL = process.env.VERCEL ? '✓' : 'lokal'

  try {
    fs.writeFileSync('/tmp/df-test.json', '{"ok":true}')
    fs.unlinkSync('/tmp/df-test.json')
    results.filesystem = '✓'
  } catch (e) {
    results.filesystem = `✗ ${e instanceof Error ? e.message : e}`
  }

  try {
    const tools = await listStitchTools()
    results.stitch_tools = tools.join(' | ')
  } catch (e) {
    results.stitch_tools = `✗ ${e instanceof Error ? e.message : e}`
  }

  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(8000),
    })
    results.openai = res.ok ? '✓' : `✗ HTTP ${res.status}`
  } catch (e) {
    results.openai = `✗ ${e instanceof Error ? e.message : e}`
  }

  return NextResponse.json(results)
}
