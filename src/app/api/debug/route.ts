import { NextResponse } from 'next/server'
import { listStitchTools } from '@/lib/stitch'
import fs from 'fs'

const STITCH_URL = 'https://stitch.googleapis.com/mcp'

async function stitchMCP(body: object, sessionId?: string): Promise<{ data: unknown; sessionId: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': process.env.STITCH_API_KEY ?? '',
  }
  if (sessionId) headers['mcp-session-id'] = sessionId

  const res = await fetch(STITCH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  const newSession = res.headers.get('mcp-session-id') ?? sessionId ?? ''
  const text = await res.text()
  let data: unknown
  try { data = JSON.parse(text) } catch { data = text }
  return { data, sessionId: newSession }
}

export async function GET() {
  const results: Record<string, unknown> = {}

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

  // Test OpenAI
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(8000),
    })
    results.openai = res.ok ? '✓' : `✗ HTTP ${res.status}`
  } catch (e) {
    results.openai = `✗ ${e instanceof Error ? e.message : e}`
  }

  // Test Stitch: initialize
  let sessionId = ''
  try {
    const init = await stitchMCP({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'df-debug', version: '1' } },
    })
    sessionId = init.sessionId
    results.stitch_init = `✓ session=${sessionId.slice(0, 20)}…`
  } catch (e) {
    results.stitch_init = `✗ ${e instanceof Error ? e.message : e}`
  }

  // List tools
  if (sessionId) {
    try {
      const tools = await listStitchTools()
      results.stitch_tools = tools.length + ' tools: ' + tools.map(t => t.split(':')[0]).join(', ')
    } catch (e) {
      results.stitch_tools = `✗ ${e instanceof Error ? e.message : e}`
    }

    // Test create_project
    const testProject = `df-debug-${Date.now()}`
    try {
      const cp = await stitchMCP({
        jsonrpc: '2.0', id: 2, method: 'tools/call',
        params: { name: 'create_project', arguments: { project_name: testProject } },
      }, sessionId)
      sessionId = cp.sessionId
      const cpData = cp.data as { result?: { content?: unknown[] } }
      results.stitch_create_project = JSON.stringify(cpData?.result?.content ?? cpData).slice(0, 500)
    } catch (e) {
      results.stitch_create_project = `✗ ${e instanceof Error ? e.message : e}`
    }

    // Test generate_screen_from_text (minimal prompt)
    try {
      const gen = await stitchMCP({
        jsonrpc: '2.0', id: 3, method: 'tools/call',
        params: {
          name: 'generate_screen_from_text',
          arguments: {
            project_name: testProject,
            prompt: 'A dark mobile landing page for a bar called "Debug Bar". Dark background, lime accent color.',
          },
        },
      }, sessionId)
      sessionId = gen.sessionId
      const genData = gen.data as { result?: { content?: unknown[] } }
      results.stitch_generate = JSON.stringify(genData?.result?.content ?? genData).slice(0, 1000)
    } catch (e) {
      results.stitch_generate = `✗ ${e instanceof Error ? e.message : e}`
    }

    // List screens
    try {
      const ls = await stitchMCP({
        jsonrpc: '2.0', id: 4, method: 'tools/call',
        params: { name: 'list_screens', arguments: { project_name: testProject } },
      }, sessionId)
      const lsData = ls.data as { result?: { content?: unknown[] } }
      results.stitch_list_screens = JSON.stringify(lsData?.result?.content ?? lsData).slice(0, 500)
    } catch (e) {
      results.stitch_list_screens = `✗ ${e instanceof Error ? e.message : e}`
    }
  }

  return NextResponse.json(results, { headers: { 'Cache-Control': 'no-store' } })
}
