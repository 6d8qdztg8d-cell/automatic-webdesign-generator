import { NextResponse } from 'next/server'
import fs from 'fs'

const STITCH_URL = 'https://stitch.googleapis.com/mcp'

async function callTool(name: string, args: Record<string, unknown>, timeoutMs = 30_000): Promise<unknown> {
  const res = await fetch(STITCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.STITCH_API_KEY ?? '',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await res.text()
  try { return JSON.parse(text) } catch { return text }
}

export const maxDuration = 120

export async function GET() {
  const r: Record<string, unknown> = {
    STITCH_API_KEY: process.env.STITCH_API_KEY ? '✓' : '✗ FEHLT',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✓' : '✗ FEHLT',
    IS_VERCEL: process.env.VERCEL ? 'yes' : 'local',
  }

  // Filesystem
  try {
    fs.writeFileSync('/tmp/df-test.json', '{"ok":true}')
    fs.unlinkSync('/tmp/df-test.json')
    r.filesystem = '✓'
  } catch (e) { r.filesystem = `✗ ${e}` }

  // OpenAI
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(8000),
    })
    r.openai = res.ok ? '✓' : `✗ HTTP ${res.status}`
  } catch (e) { r.openai = `✗ ${e}` }

  // Create project
  const testTitle = `df-debug-${Date.now()}`
  let projectId = ''
  try {
    const cp = await callTool('create_project', { title: testTitle }, 15_000) as {
      result?: { content?: { text?: string }[]; structuredContent?: { name?: string } }
    }
    const name = cp?.result?.structuredContent?.name ?? cp?.result?.content?.[0]?.text ?? ''
    const m = name.match(/projects\/(\d+)/)
    if (m) { projectId = m[1]; r.project_id = projectId }
    else {
      // Try parsing JSON text
      try {
        const parsed = JSON.parse(cp?.result?.content?.[0]?.text ?? '') as { name?: string }
        const m2 = (parsed?.name ?? '').match(/projects\/(\d+)/)
        if (m2) { projectId = m2[1]; r.project_id = projectId }
        else r.project_id_err = `no match in: ${JSON.stringify(cp).slice(0, 300)}`
      } catch { r.project_id_err = `parse error: ${JSON.stringify(cp).slice(0, 300)}` }
    }
  } catch (e) { r.create_project_err = `${e}` }

  // Generate screen with 90s timeout to see what it returns
  if (projectId) {
    r.generate_start = new Date().toISOString()
    try {
      const gen = await callTool('generate_screen_from_text', {
        projectId,
        prompt: 'Dark mobile landing page for a cocktail bar. Dark background #0F0F0E, lime green accent #C8FF00.',
        deviceType: 'MOBILE',
        modelId: 'GEMINI_3_1_PRO',
      }, 90_000) as { result?: { content?: { text?: string }[]; isError?: boolean; structuredContent?: unknown } }
      r.generate_end = new Date().toISOString()
      r.generate_is_error = (gen?.result as { isError?: boolean })?.isError
      r.generate_content_length = JSON.stringify(gen?.result?.content).length
      r.generate_preview = JSON.stringify(gen?.result?.content?.[0]?.text ?? '').slice(0, 800)
      r.generate_structured = JSON.stringify(gen?.result?.structuredContent ?? {}).slice(0, 300)
    } catch (e) { r.generate_err = `${e}` }

    // List screens
    try {
      const ls = await callTool('list_screens', { projectId }, 10_000) as unknown
      r.list_screens = JSON.stringify(ls).slice(0, 400)
    } catch (e) { r.list_screens_err = `${e}` }
  }

  return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } })
}
