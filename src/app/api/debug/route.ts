import { NextResponse } from 'next/server'

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
    STITCH_API_KEY: process.env.STITCH_API_KEY ? `✓ (${process.env.STITCH_API_KEY.slice(0, 10)}...)` : '✗ FEHLT',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✓' : '✗ FEHLT',
    IS_VERCEL: process.env.VERCEL ? 'yes' : 'local',
  }

  // Create project
  let projectId = ''
  try {
    const cp = await callTool('create_project', { title: `df-debug-${Date.now()}` }, 15_000) as {
      result?: { content?: { text?: string }[] }
    }
    const text = cp?.result?.content?.[0]?.text ?? ''
    try {
      const parsed = JSON.parse(text) as { name?: string }
      const m = (parsed.name ?? '').match(/projects\/(\d+)/)
      if (m) { projectId = m[1]; r.project_id = projectId }
      else r.create_project_err = `no ID in: ${text.slice(0, 100)}`
    } catch { r.create_project_err = `parse err: ${text.slice(0, 100)}` }
  } catch (e) { r.create_project_err = `${e}` }

  // Generate with GEMINI_3_FLASH
  if (projectId) {
    r.generate_start = new Date().toISOString()
    try {
      const gen = await callTool('generate_screen_from_text', {
        projectId,
        prompt: 'Dark mobile landing page for a bar. Dark background, lime accent.',
        deviceType: 'MOBILE',
        modelId: 'GEMINI_3_FLASH',
      }, 90_000) as { result?: { content?: { text?: string }[]; isError?: boolean } }
      r.generate_end = new Date().toISOString()
      r.generate_is_error = gen?.result?.isError
      const text = gen?.result?.content?.[0]?.text ?? ''
      r.generate_text_preview = text.slice(0, 200)
      // Check for outputComponents
      try {
        const obj = JSON.parse(text) as { outputComponents?: unknown[] }
        r.output_components_count = obj?.outputComponents?.length ?? 0
        // Find DESIGN screen
        const comps = (obj?.outputComponents ?? []) as Array<{ design?: { screens?: Array<{ screenType?: string; htmlCode?: { downloadUrl?: string } }> } }>
        for (const comp of comps) {
          for (const screen of comp.design?.screens ?? []) {
            if (screen.screenType === 'DESIGN' && screen.htmlCode?.downloadUrl) {
              r.design_screen_found = true
              r.html_download_url = screen.htmlCode.downloadUrl.slice(0, 80) + '...'
              // Try to download
              try {
                const dlRes = await fetch(screen.htmlCode.downloadUrl, { signal: AbortSignal.timeout(15_000) })
                const html = await dlRes.text()
                r.html_length = html.length
                r.html_preview = html.slice(0, 200)
              } catch (e2) { r.download_err = `${e2}` }
              break
            }
          }
        }
      } catch (e2) { r.parse_err = `${e2}` }
    } catch (e) { r.generate_err = `${e}` }
  }

  return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } })
}
