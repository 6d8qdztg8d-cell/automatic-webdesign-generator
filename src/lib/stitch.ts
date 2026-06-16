const STITCH_URL = 'https://stitch.googleapis.com/mcp'

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': process.env.STITCH_API_KEY ?? '',
  }
}

async function mcpPost(body: object, sessionId?: string): Promise<{ data: Record<string, unknown>; sessionId?: string }> {
  const reqHeaders: Record<string, string> = { ...headers() }
  if (sessionId) reqHeaders['mcp-session-id'] = sessionId

  const res = await fetch(STITCH_URL, {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Stitch HTTP ${res.status}: ${text.slice(0, 300)}`)
  }

  const newSession = res.headers.get('mcp-session-id') ?? undefined
  const data = await res.json() as Record<string, unknown>
  return { data, sessionId: newSession ?? sessionId }
}

export async function generateWithStitch(prompt: string): Promise<string> {
  if (!process.env.STITCH_API_KEY) throw new Error('STITCH_API_KEY fehlt')

  // 1. Initialize
  const init = await mcpPost({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'digitalframe', version: '1.0' } },
  })
  const sessionId = init.sessionId

  // 2. List tools to find the right one
  const toolsResp = await mcpPost({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, sessionId)
  const toolsResult = (toolsResp.data as { result?: { tools?: { name: string }[] } }).result
  const tools: { name: string }[] = toolsResult?.tools ?? []

  if (tools.length === 0) throw new Error('Stitch hat keine Tools zurückgegeben')

  const toolName =
    tools.find((t) => t.name === 'generate_ui')?.name ??
    tools.find((t) => t.name === 'create_ui')?.name ??
    tools.find((t) => t.name.includes('generat') || t.name.includes('creat') || t.name.includes('build'))?.name ??
    tools[0].name

  // 3. Call the generation tool
  const callResp = await mcpPost({
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: toolName, arguments: { prompt } },
  }, sessionId)

  const callResult = (callResp.data as { result?: { content?: { type: string; text?: string }[] } }).result
  const content = callResult?.content ?? []
  const textItem = content.find((c) => c.type === 'text')

  if (!textItem?.text) {
    throw new Error(`Stitch Tool '${toolName}' hat kein HTML zurückgegeben. Response: ${JSON.stringify(callResp.data).slice(0, 300)}`)
  }

  return textItem.text.replace(/^```html\n?/, '').replace(/\n?```$/, '').trim()
}

export async function listStitchTools(): Promise<string[]> {
  const init = await mcpPost({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'digitalframe', version: '1.0' } },
  })
  const toolsResp = await mcpPost({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, init.sessionId)
  const result = (toolsResp.data as { result?: { tools?: { name: string; description?: string }[] } }).result
  return (result?.tools ?? []).map((t) => `${t.name}: ${t.description ?? ''}`)
}
