const STITCH_URL = 'https://stitch.googleapis.com/mcp'

type MCPContent = { type: string; text?: string }
type MCPToolResult = {
  content?: MCPContent[]
  isError?: boolean
  structuredContent?: Record<string, unknown>
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  timeoutMs = 30_000
): Promise<MCPToolResult> {
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

function parseProjectId(text: string, structured?: Record<string, unknown>): string | null {
  const nameSrc = (structured?.name as string) ?? text
  const m = nameSrc.match(/projects\/(\d+)/)
  if (m) return m[1]
  // Try parsing JSON text
  try {
    const p = JSON.parse(text) as { name?: string }
    const m2 = (p?.name ?? '').match(/projects\/(\d+)/)
    if (m2) return m2[1]
  } catch { /* not JSON */ }
  return null
}

function extractScreenOutput(result: MCPToolResult): string | null {
  const text = textFrom(result)

  // Direct HTML
  if (text.includes('<!DOCTYPE') || text.includes('<html')) return text

  // Code blocks
  const codeMatch = text.match(/```(?:html|jsx?|tsx?)?\n([\s\S]+?)\n```/)
  if (codeMatch) return codeMatch[1]

  // Structured content with code/html field
  const sc = result.structuredContent
  if (sc) {
    const code = (sc.code as string) ?? (sc.html as string) ?? (sc.content as string) ?? ''
    if (code.length > 100) return code
  }

  // Any substantial text (might be JSX or description)
  if (text.length > 200) return text

  return null
}

export async function generateWithStitch(prompt: string, slug: string): Promise<string> {
  if (!process.env.STITCH_API_KEY) throw new Error('STITCH_API_KEY fehlt')

  const projectTitle = `df-${slug}-${Date.now()}`

  // 1. Create project — synchronous, fast
  const cpResult = await callTool('create_project', { title: projectTitle }, 15_000)
  if (cpResult.isError) throw new Error(`create_project fehlgeschlagen: ${textFrom(cpResult)}`)

  const cpText = textFrom(cpResult)
  const projectId = parseProjectId(cpText, cpResult.structuredContent)
  if (!projectId) throw new Error(`Projekt-ID nicht gefunden in: ${cpText.slice(0, 200)}`)

  // 2. Create design system (optional, skip on error)
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
        },
      },
    }, 20_000)
  } catch {
    // Design system is optional
  }

  // 3. Generate screen — BLOCKING (Stitch keeps HTTP connection open for 1-3 min)
  //    We give it 240 seconds (= Vercel max - buffer for other steps)
  const genResult = await callTool('generate_screen_from_text', {
    projectId,
    prompt,
    deviceType: 'MOBILE',
    modelId: 'GEMINI_3_1_PRO',
  }, 240_000)

  if (genResult.isError) throw new Error(`generate_screen_from_text: ${textFrom(genResult)}`)

  // 4. Extract output from the synchronous response
  const output = extractScreenOutput(genResult)
  if (output) return wrapInHTML(output, slug)

  // 5. Fallback: try list_screens once (in case result was stored asynchronously)
  const lsResult = await callTool('list_screens', { projectId }, 15_000)
  const lsText = textFrom(lsResult)

  // Try to parse screen ID
  const screenIdMatch = lsText.match(/screens\/([a-zA-Z0-9_-]+)/)
  if (screenIdMatch) {
    const screenId = screenIdMatch[1]
    const gsResult = await callTool('get_screen', { projectId, screenId }, 15_000)
    const gsOutput = extractScreenOutput(gsResult)
    if (gsOutput) return wrapInHTML(gsOutput, slug)
  }

  // If structuredContent has screens list
  const sc = lsResult.structuredContent
  if (sc) {
    const screens = sc.screens as Array<{ name?: string }> | undefined
    if (screens?.length) {
      const m = screens[0].name?.match(/screens\/([a-zA-Z0-9_-]+)/)
      if (m) {
        const gsResult = await callTool('get_screen', { projectId, screenId: m[1] }, 15_000)
        const gsOutput = extractScreenOutput(gsResult)
        if (gsOutput) return wrapInHTML(gsOutput, slug)
      }
    }
  }

  throw new Error('Stitch hat keinen verwertbaren Output zurückgegeben')
}

function wrapInHTML(content: string, slug: string): string {
  const trimmed = content.trim()

  // Already HTML
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) return content

  // React / JSX component
  if (
    trimmed.includes('export default') ||
    trimmed.includes('const App =') ||
    trimmed.includes('function App(') ||
    trimmed.includes('import React')
  ) {
    const clean = trimmed
      .replace(/^import\s+.*?from\s+['"].*?['"]\s*;?\s*$/gm, '')
      .replace(/^export\s+default\s+/m, 'window.__App = ')
    return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>${slug}</title>
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>*{box-sizing:border-box;-webkit-font-smoothing:antialiased}body{margin:0;background:#0F0F0E;color:#fff;font-family:-apple-system,'Inter',sans-serif}:root{--primary:#C8FF00;--bg:#0F0F0E}</style>
</head>
<body><div id="root"></div>
<script type="text/babel">
${clean}
const _Root = window.__App ?? App
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(_Root))
</script>
</body>
</html>`
  }

  // Fallback: render as pre
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
