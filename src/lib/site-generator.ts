import { analyzeWebsite } from './openai-analyzer'
import { generateWithStitch } from './stitch'
import type { SiteMetadata } from './scraper'

export type GenerationResult = {
  html: string
  analysis: {
    businessType: string
    brandPersonality: string
    stitchPrompt: string
  }
}

export async function generateSiteHTML(
  metadata: SiteMetadata,
  rawHtml: string,
  slug: string
): Promise<GenerationResult> {
  // Step 1: OpenAI analysiert die Webseite und erstellt den Stitch-Prompt
  const analysis = await analyzeWebsite(metadata, rawHtml)

  // Step 2: Stitch generiert die mobile Seite anhand des Prompts
  const html = await generateWithStitch(analysis.stitchPrompt, slug)

  return {
    html,
    analysis: {
      businessType: analysis.businessType,
      brandPersonality: analysis.brandPersonality,
      stitchPrompt: analysis.stitchPrompt,
    },
  }
}
