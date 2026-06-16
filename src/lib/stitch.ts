const STITCH_URL = 'https://stitch.googleapis.com/mcp'

type MCPContent = { type: string; text?: string }
type MCPToolResult = { content?: MCPContent[]; isError?: boolean; structuredContent?: Record<string, unknown> }

async function callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
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
    signal: AbortSignal.timeout(120_000),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Stitch HTTP ${res.status}: ${text.slice(0, 300)}`)
  }

  const body = await res.json() as { result?: MCPToolResult; error?: { message: string } }
  if (body.error) throw new Error(`Stitch: ${body.error.message}`)
  return body.result ?? {}
}

function textFrom(result: MCPToolResult): string {
  return (result.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n')
}

function parseProjectId(text: string): string | null {
  // Response is JSON like: {"name":"projects/7104302003247339255","title":"..."}
  try {
    const parsed = JSON.parse(text)
    const name: string = parsed?.name ?? parsed?.structuredContent?.name ?? ''
    const m = name.match(/projects\/(\d+)/)
    if (m) return m[1]
  } catch { /* not JSON */ }
  // Fallback: extract number from string
  const m = text.match(/projects\/(\d+)/)
  return m ? m[1] : null
}

function parseScreenId(text: string, structuredContent?: Record<string, unknown>): string | null {
  // Try structured content first
  if (structuredContent) {
    const name = structuredContent.name as string | undefined
    if (name) {
      const m = name.match(/screens\/([^/]+)/)
      if (m) return m[1]
    }
    const screens = structuredContent.screens as { name?: string }[] | undefined
    if (screens?.length) {
      const m = screens[0].name?.match(/screens\/([^/]+)/)
      if (m) return m[1]
    }
  }
  // Try text content (could be JSON)
  try {
    const parsed = JSON.parse(text)
    const items = parsed?.screens ?? (Array.isArray(parsed) ? parsed : null)
    if (items?.length) {
      const m = (items[0].name ?? '').match(/screens\/([^/]+)/)
      if (m) return m[1]
    }
    const name = parsed?.name as string | undefined
    if (name) {
      const m = name.match(/screens\/([^/]+)/)
      if (m) return m[1]
    }
  } catch { /* not JSON */ }
  const m = text.match(/screens\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : null
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function generateWithStitch(prompt: string, slug: string): Promise<string> {
  if (!process.env.STITCH_API_KEY) throw new Error('STITCH_API_KEY fehlt')

  const projectTitle = `df-${slug}-${Date.now()}`

  // 1. Create project — uses { title }, returns { name: "projects/{id}", ... }
  const cpResult = await callTool('create_project', { title: projectTitle })
  if (cpResult.isError) throw new Error(`create_project: ${textFrom(cpResult)}`)

  const cpText = textFrom(cpResult)
  const projectId = parseProjectId(cpText) ?? parseProjectId(JSON.stringify(cpResult.structuredContent))
  if (!projectId) throw new Error(`Konnte Projekt-ID nicht parsen. Response: ${cpText.slice(0, 200)}`)

  // 2. Create DigitalFrame design system
  try {
    await callTool('create_design_system', {
      projectId,
      designSystem: {
        displayName: 'DigitalFrame Dark',
        theme: {
          colorMode: 'DARK',
          headlineFont: 'INTER',
          bodyFont: 'INTER',
          roundness: 'ROUND_TWELVE',
          customColor: '#C8FF00',
          overridePrimaryColor: '#C8FF00',
          overrideNeutralColor: '#0F0F0E',
        },
      },
    })
  } catch {
    // Design system is optional — continue anyway
  }

  // 3. Generate screen from text — uses { projectId, prompt, deviceType, modelId }
  const genResult = await callTool('generate_screen_from_text', {
    projectId,
    prompt,
    deviceType: 'MOBILE',
    modelId: 'GEMINI_3_1_PRO',
  })

  if (genResult.isError) throw new Error(`generate_screen_from_text: ${textFrom(genResult)}`)

  const genText = textFrom(genResult)

  // Check for immediate HTML output
  if (genText.includes('<!DOCTYPE') || genText.includes('<html')) return genText

  // Try to extract screen ID from the immediate response
  let screenId = parseScreenId(genText, genResult.structuredContent)

  // 4. If no screenId yet, poll list_screens every 20s (up to 12 attempts = 4 min)
  for (let attempt = 0; attempt < 12; attempt++) {
    await sleep(20_000)

    if (!screenId) {
      const lsResult = await callTool('list_screens', { projectId })
      const lsText = textFrom(lsResult)
      screenId = parseScreenId(lsText, lsResult.structuredContent)
    }

    if (screenId) {
      const gsResult = await callTool('get_screen', { projectId, screenId })
      const gsText = textFrom(gsResult)

      if (gsText.includes('<!DOCTYPE') || gsText.includes('<html')) return gsText

      // Check if it's React/JSX code
      if (gsText.length > 200) return wrapInHTML(gsText, slug)

      // Check structured content for code
      const code = (gsResult.structuredContent?.code as string) ?? (gsResult.structuredContent?.html as string) ?? ''
      if (code.length > 100) return wrapInHTML(code, slug)
    }
  }

  // Last resort: use whatever the generate call returned
  if (genText.length > 100) return wrapInHTML(genText, slug)

  throw new Error('Stitch hat keinen Screen generiert (Timeout nach 4 Min)')
}

function wrapInHTML(content: string, slug: string): string {
  if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) return content

  if (
    content.includes('import React') ||
    content.includes('export default') ||
    content.includes('const App =') ||
    content.includes('function App(')
  ) {
    const cleanContent = content
      .replace(/^import\s+.*?from\s+['"].*?['"]\s*;?\s*$/gm, '')
      .replace(/^export\s+default\s+/m, 'window.__StitchApp = ')
    return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>${slug}</title>
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>
*{box-sizing:border-box;-webkit-font-smoothing:antialiased}
body{margin:0;background:#0F0F0E;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif}
:root{--primary:#C8FF00;--bg:#0F0F0E}
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
${cleanContent}
const RootApp = window.__StitchApp || App
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(RootApp))
</script>
</body>
</html>`
  }

  // Plain text / markdown fallback
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${slug}</title>
<style>body{background:#0F0F0E;color:#fff;font-family:-apple-system,sans-serif;padding:20px;max-width:430px;margin:0 auto}</style>
</head>
<body><pre style="white-space:pre-wrap;word-break:break-word">${content.replace(/</g, '&lt;')}</pre></body>
</html>`
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
  const body = await res.json() as { result?: { tools?: { name: string; description?: string }[] } }
  return (body.result?.tools ?? []).map((t) => `${t.name}: ${t.description ?? ''}`)
}
