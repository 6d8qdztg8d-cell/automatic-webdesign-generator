const STITCH_URL = 'https://stitch.googleapis.com/mcp'

type MCPContent = { type: string; text?: string }
type MCPResult = {
  content?: MCPContent[]
  isError?: boolean
  structuredContent?: Record<string, unknown>
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  timeoutMs = 30_000
): Promise<MCPResult> {
  const res = await fetch(STITCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.STITCH_API_KEY ?? '',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!res.ok) throw new Error(`Stitch HTTP ${res.status}`)
  const body = await res.json() as { result?: MCPResult; error?: { message: string } }
  if (body.error) throw new Error(`Stitch: ${body.error.message}`)
  return body.result ?? {}
}

function textFrom(result: MCPResult): string {
  return (result.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('')
}

interface StitchScreen {
  screenType: string
  htmlCode?: { downloadUrl: string; name: string }
  screenshot?: { downloadUrl: string }
  width?: string
  height?: string
  title?: string
}

interface StitchOutputComponent {
  designSystem?: unknown
  design?: { screens: StitchScreen[] }
  text?: string
  suggestion?: string
}

interface StitchOutput {
  projectId?: string
  sessionId?: string
  outputComponents?: StitchOutputComponent[]
}

async function downloadHtml(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  return res.text()
}

export async function generateWithStitch(prompt: string, slug: string): Promise<string> {
  if (!process.env.STITCH_API_KEY) throw new Error('STITCH_API_KEY fehlt')

  // 1. Create project
  const cpResult = await callTool('create_project', { title: `df-${slug}-${Date.now()}` }, 15_000)
  if (cpResult.isError) throw new Error(`create_project: ${textFrom(cpResult)}`)

  const cpText = textFrom(cpResult)
  let projectId: string | null = null
  try {
    const parsed = JSON.parse(cpText) as { name?: string }
    const m = (parsed.name ?? '').match(/projects\/(\d+)/)
    if (m) projectId = m[1]
  } catch { /* ignore */ }
  if (!projectId) {
    const m = cpText.match(/projects\/(\d+)/)
    projectId = m?.[1] ?? null
  }
  if (!projectId) throw new Error(`Projekt-ID nicht gefunden: ${cpText.slice(0, 100)}`)

  // 2. Generate screen — blocking HTTP call, Stitch takes 30-90 seconds
  //    Use GEMINI_3_FLASH (GEMINI_3_1_PRO returns "service unavailable")
  const genResult = await callTool('generate_screen_from_text', {
    projectId,
    prompt,
    deviceType: 'MOBILE',
    modelId: 'GEMINI_3_FLASH',
  }, 180_000)

  if (genResult.isError) throw new Error(`generate_screen_from_text: ${textFrom(genResult)}`)

  // 3. Parse outputComponents from response text
  const rawText = textFrom(genResult)
  let output: StitchOutput | null = null
  try {
    output = JSON.parse(rawText) as StitchOutput
  } catch {
    throw new Error(`Stitch output nicht parsebar: ${rawText.slice(0, 200)}`)
  }

  const components = output?.outputComponents ?? []

  // 4. Find DESIGN screen with htmlCode (has the actual HTML file)
  for (const comp of components) {
    const screens = comp.design?.screens ?? []
    for (const screen of screens) {
      if (screen.screenType === 'DESIGN' && screen.htmlCode?.downloadUrl) {
        const html = await downloadHtml(screen.htmlCode.downloadUrl)
        if (html.length > 100) return html
      }
    }
  }

  throw new Error('Stitch: Kein DESIGN screen mit htmlCode gefunden')
}

export async function listStitchTools(): Promise<string[]> {
  const res = await fetch(STITCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.STITCH_API_KEY ?? '',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    signal: AbortSignal.timeout(15_000),
  })
  const body = await res.json() as { result?: { tools?: { name: string }[] } }
  return (body.result?.tools ?? []).map((t) => t.name)
}
