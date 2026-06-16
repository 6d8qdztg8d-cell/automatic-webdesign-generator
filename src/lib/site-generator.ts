import { analyzeWebsite, generateHTMLWithOpenAI } from './openai-analyzer'
import { generateWithStitch } from './stitch'
import type { SiteMetadata } from './scraper'

export type GenerationResult = {
  html: string
  analysis: {
    businessType: string
    brandPersonality: string
    stitchPrompt: string
  }
  source: 'stitch' | 'openai'
}

export async function generateSiteHTML(
  metadata: SiteMetadata,
  rawHtml: string,
  slug: string
): Promise<GenerationResult> {
  // Step 1: OpenAI analyses the site and creates a design prompt
  const analysis = await analyzeWebsite(metadata, rawHtml)

  // Step 2: Try Stitch first
  let html: string | null = null
  let source: 'stitch' | 'openai' = 'stitch'

  try {
    html = await generateWithStitch(analysis.stitchPrompt, slug)
  } catch (stitchErr) {
    console.warn('Stitch nicht verfügbar, fallback auf OpenAI:', stitchErr instanceof Error ? stitchErr.message : stitchErr)
    source = 'openai'
  }

  // Step 3: OpenAI HTML fallback
  if (!html || html.length < 500) {
    source = 'openai'
    html = await generateHTMLWithOpenAI(metadata, analysis)
  }

  return {
    html,
    analysis: {
      businessType: analysis.businessType,
      brandPersonality: analysis.brandPersonality,
      stitchPrompt: analysis.stitchPrompt,
    },
    source,
  }
}
