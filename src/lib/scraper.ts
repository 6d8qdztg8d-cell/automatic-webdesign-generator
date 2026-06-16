export type SiteMetadata = {
  title: string
  description: string
  url: string
  domain: string
}

export type ScrapeResult = {
  metadata: SiteMetadata
  rawHtml: string
}

function extractMeta(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["']`, 'i'),
    new RegExp(`<meta[^>]*property=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${name}["']`, 'i'),
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m) return m[1].trim()
  }
  return ''
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  let rawHtml = ''
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DigitalFrame/1.0; +https://digitalframe.app)' },
      signal: AbortSignal.timeout(12000),
    })
    rawHtml = await res.text()
  } catch {
    // Continue with empty HTML — OpenAI will work with URL + domain info
  }

  const titleMatch = rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i)
  const rawTitle = titleMatch ? titleMatch[1].trim() : ''

  const ogTitle = extractMeta(rawHtml, 'og:title')
  const ogDesc = extractMeta(rawHtml, 'og:description')
  const metaDesc = extractMeta(rawHtml, 'description')

  const domain = new URL(url).hostname.replace(/^www\./, '')
  const title = ogTitle || rawTitle || domain

  return {
    rawHtml,
    metadata: {
      title,
      description: ogDesc || metaDesc || '',
      url,
      domain,
    },
  }
}
