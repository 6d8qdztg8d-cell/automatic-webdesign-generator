import { NextResponse } from 'next/server'

const STITCH_URL = 'https://stitch.googleapis.com/mcp'

async function stitch(body: object): Promise<unknown> {
  const res = await fetch(STITCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.STITCH_API_KEY ?? '',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  const text = await res.text()
  try { return JSON.parse(text) } catch { return text }
}

export async function GET() {
  const results: Record<string, unknown> = {
    STITCH_API_KEY: process.env.STITCH_API_KEY ? '✓' : '✗ FEHLT',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✓' : '✗ FEHLT',
  }

  // Get full tool schemas
  try {
    const toolsResp = await stitch({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) as {
      result?: { tools?: { name: string; description?: string; inputSchema?: unknown }[] }
    }
    const tools = toolsResp?.result?.tools ?? []

    // Show schema for create_project and generate_screen_from_text
    const cp = tools.find(t => t.name === 'create_project')
    const gen = tools.find(t => t.name === 'generate_screen_from_text')
    const gs = tools.find(t => t.name === 'get_screen')
    const ls = tools.find(t => t.name === 'list_screens')
    const ds = tools.find(t => t.name === 'create_design_system')

    results.schema_create_project = JSON.stringify(cp)
    results.schema_generate_screen = JSON.stringify(gen)
    results.schema_get_screen = JSON.stringify(gs)
    results.schema_list_screens = JSON.stringify(ls)
    results.schema_create_design_system = JSON.stringify(ds)
    results.all_tool_names = tools.map(t => t.name).join(', ')
  } catch (e) {
    results.tools_error = `✗ ${e instanceof Error ? e.message : e}`
  }

  // Try create_project with different arg names
  const testProject = `df-test-${Date.now()}`

  // Attempt 1: { name }
  try {
    const r1 = await stitch({
      jsonrpc: '2.0', id: 10, method: 'tools/call',
      params: { name: 'create_project', arguments: { name: testProject } },
    })
    results.create_project_name = JSON.stringify(r1).slice(0, 300)
  } catch (e) {
    results.create_project_name = `✗ ${e instanceof Error ? e.message : e}`
  }

  // Attempt 2: { project_name } (what we tried before)
  try {
    const r2 = await stitch({
      jsonrpc: '2.0', id: 11, method: 'tools/call',
      params: { name: 'create_project', arguments: { project_name: testProject } },
    })
    results.create_project_project_name = JSON.stringify(r2).slice(0, 300)
  } catch (e) {
    results.create_project_project_name = `✗ ${e instanceof Error ? e.message : e}`
  }

  // Attempt 3: { title }
  try {
    const r3 = await stitch({
      jsonrpc: '2.0', id: 12, method: 'tools/call',
      params: { name: 'create_project', arguments: { title: testProject } },
    })
    results.create_project_title = JSON.stringify(r3).slice(0, 300)
  } catch (e) {
    results.create_project_title = `✗ ${e instanceof Error ? e.message : e}`
  }

  return NextResponse.json(results, { headers: { 'Cache-Control': 'no-store' } })
}
