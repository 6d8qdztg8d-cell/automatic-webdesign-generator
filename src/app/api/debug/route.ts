import { NextResponse } from 'next/server'
import fs from 'fs'

const STITCH_URL = 'https://stitch.googleapis.com/mcp'

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(STITCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.STITCH_API_KEY ?? '',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }),
    signal: AbortSignal.timeout(60_000),
  })
  const text = await res.text()
  try { return JSON.parse(text) } catch { return text }
}

export async function GET() {
  const r: Record<string, unknown> = {
    STITCH_API_KEY: process.env.STITCH_API_KEY ? '✓' : '✗ FEHLT',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✓' : '✗ FEHLT',
    IS_VERCEL: process.env.VERCEL ? 'yes' : 'local',
  }

  // Filesystem test
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

  // Stitch: create project with correct args
  const testTitle = `df-debug-${Date.now()}`
  let projectId = ''
  try {
    const cp = await callTool('create_project', { title: testTitle }) as {
      result?: { content?: { text?: string }[]; structuredContent?: { name?: string } }
    }
    const raw = JSON.stringify(cp).slice(0, 500)
    r.create_project_raw = raw

    // Parse project ID
    const text = cp?.result?.content?.map((c) => c.text).join('') ?? ''
    const sc = cp?.result?.structuredContent
    const nameField = sc?.name ?? ''
    const m = (text + nameField).match(/projects\/(\d+)/)
    if (m) {
      projectId = m[1]
      r.project_id = projectId
    } else {
      r.project_id = `NOT FOUND in: ${text.slice(0, 200)}`
    }
  } catch (e) { r.create_project_error = `${e}` }

  // Stitch: generate screen (only if we have a project ID)
  if (projectId) {
    try {
      const gen = await callTool('generate_screen_from_text', {
        projectId,
        prompt: 'Dark mobile landing page for a bar. Dark background, lime green accent, Inter font.',
        deviceType: 'MOBILE',
        modelId: 'GEMINI_3_1_PRO',
      }) as { result?: { content?: { text?: string }[]; isError?: boolean } }
      r.generate_raw = JSON.stringify(gen).slice(0, 800)
      r.generate_is_error = (gen?.result as { isError?: boolean })?.isError ?? false
    } catch (e) { r.generate_error = `${e}` }

    // List screens immediately after generate
    try {
      const ls = await callTool('list_screens', { projectId }) as unknown
      r.list_screens_raw = JSON.stringify(ls).slice(0, 500)
    } catch (e) { r.list_screens_error = `${e}` }
  }

  return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } })
}
