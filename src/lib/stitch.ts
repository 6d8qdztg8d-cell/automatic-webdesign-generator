import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const STITCH_MCP_URL = 'https://stitch.googleapis.com/mcp'

export async function generateWithStitch(prompt: string): Promise<string> {
  const apiKey = process.env.STITCH_API_KEY
  if (!apiKey) throw new Error('STITCH_API_KEY nicht konfiguriert')

  const transport = new StreamableHTTPClientTransport(new URL(STITCH_MCP_URL), {
    requestInit: {
      headers: { 'X-Goog-Api-Key': apiKey },
    },
  })

  const client = new Client(
    { name: 'digitalframe-generator', version: '1.0.0' },
    { capabilities: {} }
  )

  await client.connect(transport)

  try {
    // Discover available Stitch tools
    const { tools } = await client.listTools()

    // Find a tool for generating UI / web content
    const generateTool =
      tools.find((t) => t.name === 'generate_ui') ??
      tools.find((t) => t.name === 'create_ui') ??
      tools.find((t) => t.name.includes('generate') || t.name.includes('create'))

    if (!generateTool) {
      const names = tools.map((t) => t.name).join(', ')
      throw new Error(`Kein Stitch-Generierungstool gefunden. Verfügbare Tools: ${names}`)
    }

    const result = await client.callTool({
      name: generateTool.name,
      arguments: { prompt },
    })

    if (!Array.isArray(result.content)) {
      throw new Error('Stitch: Unerwartetes Response-Format')
    }

    const textItem = result.content.find((c) => c.type === 'text')
    if (!textItem || textItem.type !== 'text') {
      throw new Error('Stitch: Kein HTML in der Antwort')
    }

    return (textItem.text as string).replace(/^```html\n?/, '').replace(/\n?```$/, '').trim()
  } finally {
    await client.close()
  }
}
