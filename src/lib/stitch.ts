const STITCH_URL = 'https://stitch.googleapis.com/mcp'

interface MCPResponse {
  result?: Record<string, unknown>
  error?: { message: string }
}

async function mcpPost(body: object, sessionId?: string): Promise<{ data: MCPResponse; sessionId: string }> {
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': process.env.STITCH_API_KEY ?? '',
  }
  if (sessionId) reqHeaders['mcp-session-id'] = sessionId

  const res = await fetch(STITCH_URL, {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })

  const newSession = res.headers.get('mcp-session-id') ?? sessionId ?? ''
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Stitch HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  const data = await res.json() as MCPResponse
  if (data.error) throw new Error(`Stitch error: ${data.error.message}`)
  return { data, sessionId: newSession }
}

async function callTool(
  sessionId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content?: { type: string; text?: string }[]; output?: string; sessionId: string }> {
  const resp = await mcpPost(
    { jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: toolName, arguments: args } },
    sessionId
  )
  const result = resp.data.result as { content?: { type: string; text?: string }[] } | undefined
  const content = result?.content ?? []
  return { content, sessionId: resp.sessionId }
}

function extractText(content: { type: string; text?: string }[]): string {
  return content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n')
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function generateWithStitch(prompt: string, slug: string): Promise<string> {
  if (!process.env.STITCH_API_KEY) throw new Error('STITCH_API_KEY fehlt')

  const projectName = `df-${slug}-${Date.now()}`

  // 1. Initialize session
  const init = await mcpPost({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'digitalframe', version: '1.0' } },
  })
  let sessionId = init.sessionId

  // 2. Create project
  const createResp = await callTool(sessionId, 'create_project', { project_name: projectName })
  sessionId = createResp.sessionId

  // 3. Set DigitalFrame design system
  const dsResp = await callTool(sessionId, 'create_design_system', {
    project_name: projectName,
    primary_color: '#C8FF00',
    appearance: 'dark',
    font_family: 'Inter',
    shape: 'rounded',
    design_md: `# DigitalFrame Design System
Background: #0F0F0E (very dark)
Accent: #C8FF00 (lime green)
Cards: rgba(255,255,255,0.04) with 1px border rgba(255,255,255,0.07)
Border radius: 20px cards, 14px buttons
Typography: Inter, -apple-system, SF Pro Display
Mobile-first, max-width 430px`,
  })
  sessionId = dsResp.sessionId

  // 4. Generate screen from text (async — Stitch takes 1-3 minutes)
  const genResp = await callTool(sessionId, 'generate_screen_from_text', {
    project_name: projectName,
    prompt,
  })
  sessionId = genResp.sessionId

  // Check if we already have output
  const immediateOutput = extractText(genResp.content ?? [])
  if (immediateOutput.includes('<!DOCTYPE') || immediateOutput.includes('<html')) {
    return immediateOutput
  }

  // 5. Poll get_screen every 25 seconds (up to 10 times = ~4 min)
  for (let attempt = 0; attempt < 10; attempt++) {
    await sleep(25_000)

    const screensResp = await callTool(sessionId, 'list_screens', { project_name: projectName })
    sessionId = screensResp.sessionId
    const screensText = extractText(screensResp.content ?? [])

    // Try to parse screen ID from list
    let screenId: string | undefined
    try {
      const lines = screensText.split('\n').filter(Boolean)
      // Look for something that looks like a screen ID
      const idLine = lines.find((l) => l.match(/screen[_\s-]?id|id:/i))
      if (idLine) {
        screenId = idLine.match(/[a-zA-Z0-9_-]{8,}/)?.[0]
      }
    } catch { /* ignore */ }

    if (screenId) {
      const screenResp = await callTool(sessionId, 'get_screen', {
        project_name: projectName,
        screen_id: screenId,
      })
      sessionId = screenResp.sessionId
      const screenText = extractText(screenResp.content ?? [])
      if (screenText && screenText.length > 100) {
        return wrapInHTML(screenText, slug)
      }
    }

    // Also check if list_screens already returned the code
    if (screensText && screensText.length > 500) {
      return wrapInHTML(screensText, slug)
    }
  }

  // Fallback: return whatever we got from generate_screen_from_text
  if (immediateOutput && immediateOutput.length > 100) {
    return wrapInHTML(immediateOutput, slug)
  }

  throw new Error('Stitch hat keinen Screen generiert nach 10 Versuchen')
}

function wrapInHTML(content: string, slug: string): string {
  // If already HTML, return as-is
  if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
    return content
  }
  // If it's React JSX, wrap it in an HTML file with React CDN
  if (content.includes('import React') || content.includes('export default') || content.includes('const App')) {
    const cleanContent = content
      .replace(/^import.*\n/gm, '')
      .replace(/^export default /m, 'window.App = ')
    return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>${slug}</title>
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>*{box-sizing:border-box;-webkit-font-smoothing:antialiased}body{margin:0;background:#0F0F0E;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif}</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
${cleanContent}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App))
</script>
</body>
</html>`
  }
  // Otherwise treat as text/markdown — render as plain page
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${slug}</title>
<style>body{background:#0F0F0E;color:#fff;font-family:-apple-system,sans-serif;padding:20px;max-width:430px;margin:0 auto}</style>
</head>
<body><pre style="white-space:pre-wrap;word-break:break-word">${content}</pre></body>
</html>`
}

export async function listStitchTools(): Promise<string[]> {
  const init = await mcpPost({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'digitalframe', version: '1.0' } },
  })
  const toolsResp = await mcpPost({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, init.sessionId)
  const result = toolsResp.data.result as { tools?: { name: string; description?: string }[] } | undefined
  return (result?.tools ?? []).map((t) => `${t.name}: ${t.description ?? ''}`)
}
