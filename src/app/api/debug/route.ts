import { NextResponse } from 'next/server'
import fs from 'fs'

const STITCH_URL = 'https://stitch.googleapis.com/mcp'

async function stitchRaw(body: object, sessionId?: string): Promise<{ data: unknown; headers: Record<string, string> }> {
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': process.env.STITCH_API_KEY ?? '',
  }
  if (sessionId) reqHeaders['mcp-session-id'] = sessionId

  const res = await fetch(STITCH_URL, {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })

  const respHeaders: Record<string, string> = {}
  res.headers.forEach((v, k) => { respHeaders[k] = v })

  const text = await res.text()
  let data: unknown
  try { data = JSON.parse(text) } catch { data = text.slice(0, 500) }
  return { data, headers: respHeaders }
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

  // Initialize Stitch — capture ALL response headers
  let sessionId = ''
  try {
    const init = await stitchRaw({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'df-debug', version: '1' } },
    })
    results.stitch_init_headers = JSON.stringify(init.headers)
    results.stitch_init_body = JSON.stringify(init.data).slice(0, 300)

    // Try every possible session-ID header
    const h = init.headers
    sessionId = h['mcp-session-id'] ?? h['x-mcp-session-id'] ?? h['session-id'] ?? ''
    results.stitch_session = sessionId ? sessionId.slice(0, 30) + '…' : 'NONE — trying without session'
  } catch (e) {
    results.stitch_init = `✗ ${e instanceof Error ? e.message : e}`
  }

  // List tools (try without session if no session)
  try {
    const tools = await stitchRaw(
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      sessionId || undefined
    )
    const tData = tools.data as { result?: { tools?: { name: string }[] } }
    const names = (tData?.result?.tools ?? []).map((t) => t.name)
    results.stitch_tools = names.length ? names.join(', ') : JSON.stringify(tools.data).slice(0, 300)
  } catch (e) {
    results.stitch_tools = `✗ ${e instanceof Error ? e.message : e}`
  }

  // Test create_project
  const testProject = `df-debug-${Date.now()}`
  try {
    const cp = await stitchRaw({
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: 'create_project', arguments: { project_name: testProject } },
    }, sessionId || undefined)

    const cpSession = cp.headers['mcp-session-id'] ?? cp.headers['x-mcp-session-id'] ?? ''
    if (cpSession) sessionId = cpSession
    results.stitch_create_project = JSON.stringify(cp.data).slice(0, 500)
  } catch (e) {
    results.stitch_create_project = `✗ ${e instanceof Error ? e.message : e}`
  }

  // Test generate_screen_from_text
  try {
    const gen = await stitchRaw({
      jsonrpc: '2.0', id: 4, method: 'tools/call',
      params: {
        name: 'generate_screen_from_text',
        arguments: {
          project_name: testProject,
          prompt: 'Dark mobile landing page for a bar. Dark bg, lime accent.',
        },
      },
    }, sessionId || undefined)

    results.stitch_generate = JSON.stringify(gen.data).slice(0, 1000)
  } catch (e) {
    results.stitch_generate = `✗ ${e instanceof Error ? e.message : e}`
  }

  return NextResponse.json(results, { headers: { 'Cache-Control': 'no-store' } })
}
