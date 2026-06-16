import OpenAI from 'openai'
import type { SiteMetadata } from './scraper'

function getClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export type WebsiteAnalysis = {
  businessName: string
  businessType: string        // z.B. "Cocktailbar", "Restaurant", "Nightclub"
  shortDescription: string
  brandPersonality: string    // z.B. "premium und elegant", "urban und jung"
  dominantColors: string      // z.B. "#1a1a2e, #e94560 (dunkel, rot-akzent)"
  keyContent: {
    address?: string
    phone?: string
    email?: string
    hours?: string
    socialLinks?: string[]
    specialties?: string[]    // Spezialitäten, Highlights
  }
  stitchPrompt: string        // fertiger Prompt für Stitch
}

export async function analyzeWebsite(
  metadata: SiteMetadata,
  rawHtml: string
): Promise<WebsiteAnalysis> {
  const truncatedHtml = rawHtml.slice(0, 12000)

  const systemPrompt = `Du bist ein Webdesign-Analyst und Prompt-Engineer.
Deine Aufgabe:
1. Analysiere die eingegebene Webseite (URL, Metadaten, HTML-Ausschnitt)
2. Verstehe was das Unternehmen macht, welche Stimmung/Brand es hat, welche Infos wichtig sind
3. Erstelle einen präzisen, detaillierten Prompt für Stitch — ein KI-Tool das daraus eine mobile HTML-Seite generiert

Das Stitch-Design muss folgendem Design-System entsprechen (DigitalFrame):
- Hintergrund: #0F0F0E (sehr dunkles Schwarz)
- Akzentfarbe: #C8FF00 (Lime Grün)
- Karten: rgba(255,255,255,0.04) mit 1px Border rgba(255,255,255,0.07)
- Schrift: -apple-system, BlinkMacSystemFont, SF Pro Display, Helvetica Neue
- Mobile-first, max-width 430px
- Keine externen Abhängigkeiten, alles self-contained HTML

Antworte ausschliesslich mit einem gültigen JSON-Objekt ohne Markdown-Codeblöcke.`

  const userPrompt = `Analysiere diese Webseite:

URL: ${metadata.url}
Titel: ${metadata.title}
Beschreibung: ${metadata.description}
Domain: ${metadata.domain}

HTML-Ausschnitt (erste 12'000 Zeichen):
${truncatedHtml}

Erstelle eine vollständige WebsiteAnalysis. Das stitchPrompt-Feld soll ein kompletter, detaillierter Prompt auf Englisch sein, den man direkt an Stitch schicken kann. Er soll:
- Businessname, Typ, Beschreibung enthalten
- Design-System-Vorgaben (Farben, Rundungen, Karten-Stil) spezifizieren
- Alle extrahierten Infos (Adresse, Öffnungszeiten, Tel, Social) einbauen
- Mobile Seitenstruktur definieren: Hero → Quick Actions → Info Cards → About → Footer
- Fordert self-contained HTML ohne externe Dependencies
- Tonstil und Marke des Unternehmens widerspiegeln`

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const raw = response.choices[0].message.content ?? '{}'
  const analysis = JSON.parse(raw) as WebsiteAnalysis

  // Sicherstellen dass ein stitchPrompt vorhanden ist
  if (!analysis.stitchPrompt) {
    analysis.stitchPrompt = buildFallbackPrompt(metadata, analysis)
  }

  return analysis
}

function buildFallbackPrompt(metadata: SiteMetadata, analysis: WebsiteAnalysis): string {
  return `Generate a premium mobile landing page for the following business:

Business: ${analysis.businessName || metadata.title}
Type: ${analysis.businessType || 'Local Business'}
Description: ${analysis.shortDescription || metadata.description}
Brand Personality: ${analysis.brandPersonality || 'modern and premium'}
URL: ${metadata.url}

DESIGN SYSTEM (must follow exactly):
- Background: #0F0F0E
- Accent: #C8FF00 (lime green)
- Card background: rgba(255,255,255,0.04)
- Card border: 1px solid rgba(255,255,255,0.07)
- Border radius cards: 20px, buttons: 14px
- Font: -apple-system, BlinkMacSystemFont, SF Pro Display, Helvetica Neue, Arial, sans-serif
- Max width: 430px centered
- Mobile-first, self-contained HTML (no external CSS/JS)

PAGE STRUCTURE:
1. Hero: large business name, category tag, gradient with #C8FF00/15 hint
2. Quick action buttons: Call, Directions, Website
3. Info cards: Address (Google Maps link), Hours, Contact
4. About section: description
5. Footer: "Powered by DigitalFrame"

Return ONLY HTML starting with <!DOCTYPE html>, no markdown.`
}
