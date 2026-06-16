import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'

export async function GET(request: NextRequest) {
  const results: Record<string, string> = {}

  // 1. Env vars vorhanden?
  results.OPENAI_API_KEY = process.env.OPENAI_API_KEY ? `✓ (${process.env.OPENAI_API_KEY.slice(0, 10)}...)` : '✗ FEHLT'
  results.STITCH_API_KEY = process.env.STITCH_API_KEY ? `✓ (${process.env.STITCH_API_KEY.slice(0, 8)}...)` : '✗ FEHLT'
  results.GITHUB_TOKEN   = process.env.GITHUB_TOKEN   ? '✓ vorhanden' : '✗ FEHLT'
  results.VERCEL_TOKEN   = process.env.VERCEL_TOKEN   ? '✓ vorhanden' : '✗ FEHLT'
  results.IS_VERCEL      = process.env.VERCEL         ? '✓ ja' : '✗ nein (lokal)'

  // 2. Filesystem schreibbar?
  try {
    const testPath = process.env.VERCEL ? '/tmp/df-test.json' : '/tmp/df-test.json'
    fs.writeFileSync(testPath, JSON.stringify({ ok: true, ts: Date.now() }))
    fs.unlinkSync(testPath)
    results.filesystem = '✓ /tmp schreibbar'
  } catch (e) {
    results.filesystem = `✗ Fehler: ${e instanceof Error ? e.message : e}`
  }

  // 3. OpenAI erreichbar?
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(8000),
    })
    results.openai_reachable = res.ok ? `✓ HTTP ${res.status}` : `✗ HTTP ${res.status}`
  } catch (e) {
    results.openai_reachable = `✗ ${e instanceof Error ? e.message : e}`
  }

  // 4. Stitch MCP erreichbar?
  try {
    const res = await fetch('https://stitch.googleapis.com/mcp', {
      method: 'POST',
      headers: {
        'X-Goog-Api-Key': process.env.STITCH_API_KEY ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } } }),
      signal: AbortSignal.timeout(8000),
    })
    const text = await res.text()
    results.stitch_reachable = `HTTP ${res.status}: ${text.slice(0, 120)}`
  } catch (e) {
    results.stitch_reachable = `✗ ${e instanceof Error ? e.message : e}`
  }

  return NextResponse.json(results, { status: 200 })
}
