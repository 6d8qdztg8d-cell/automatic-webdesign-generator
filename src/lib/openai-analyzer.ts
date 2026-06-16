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

export async function generateHTMLWithOpenAI(
  metadata: SiteMetadata,
  analysis: WebsiteAnalysis
): Promise<string> {
  const kc = analysis.keyContent
  const info: string[] = []
  if (kc.address) info.push(`Address: ${kc.address}`)
  if (kc.phone) info.push(`Phone: ${kc.phone}`)
  if (kc.email) info.push(`Email: ${kc.email}`)
  if (kc.hours) info.push(`Hours: ${kc.hours}`)
  if (kc.specialties?.length) info.push(`Specialties: ${kc.specialties.join(', ')}`)
  if (kc.socialLinks?.length) info.push(`Social: ${kc.socialLinks.join(', ')}`)

  const systemPrompt = `You are an expert frontend developer creating a beautiful, self-contained mobile landing page.
Output ONLY a complete HTML file starting with <!DOCTYPE html>. No markdown, no code blocks, no explanation.
The HTML must be fully self-contained (all CSS inline in <style>, no external dependencies).`

  const userPrompt = `Create a stunning mobile landing page for this business:

Business: ${analysis.businessName || metadata.title}
Type: ${analysis.businessType}
Description: ${analysis.shortDescription}
Brand Personality: ${analysis.brandPersonality}
URL: ${metadata.url}
${info.length ? '\nKey Info:\n' + info.join('\n') : ''}

REQUIRED DESIGN SYSTEM (follow exactly):
- Background: #0F0F0E (near black)
- Accent: #C8FF00 (lime green)
- Card bg: rgba(255,255,255,0.04), border: 1px solid rgba(255,255,255,0.07)
- Border radius: 20px cards, 14px buttons, 12px inputs
- Font: -apple-system, BlinkMacSystemFont, 'Inter', 'SF Pro Display', Helvetica, Arial, sans-serif
- Text: white primary, rgba(255,255,255,0.5) secondary
- Max-width: 430px centered, padding: 20px
- Mobile viewport, safe-area-inset support

PAGE SECTIONS:
1. <header> — Business initials avatar (40px, lime bg, black text), name, category badge
2. Hero card — large heading with subtle lime glow, short tagline
3. Quick action buttons row — CTA buttons (lime primary, dark secondary)
4. Info cards — grid of cards: Address (with map emoji + Google Maps link), Hours, Phone/Email
5. About section — styled description card
6. Social links — if available, pill buttons
7. Footer — "Powered by DigitalFrame" small text

STYLE REQUIREMENTS:
- No external fonts, no CDN links, no images
- Smooth animations: cards fade-in on load (CSS @keyframes)
- Hover states on buttons and cards
- Lime glow effect on hero: box-shadow: 0 0 80px rgba(200,255,0,0.1)
- All links open in _blank with rel="noopener"

Return the complete HTML file only.`

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4096,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  let html = response.choices[0].message.content ?? ''
  // Strip any markdown wrapping just in case
  html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim()
  if (!html.startsWith('<!DOCTYPE')) {
    const idx = html.indexOf('<!DOCTYPE')
    if (idx > 0) html = html.slice(idx)
  }
  return html
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
