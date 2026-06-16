import { NextRequest } from 'next/server'
import { createSite, updateSite } from '@/lib/db'
import { scrapeUrl } from '@/lib/scraper'
import { generateSiteHTML } from '@/lib/site-generator'
import { createGithubRepo, pushHtmlToRepo } from '@/lib/github'
import { deployToVercel } from '@/lib/vercel-api'
import type { GeneratedSite } from '@/types'

export const maxDuration = 300

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export async function POST(request: NextRequest) {
  const { url } = await request.json()

  if (!url || typeof url !== 'string') {
    return new Response('URL required', { status: 400 })
  }

  const encoder = new TextEncoder()
  const id = crypto.randomUUID()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch { /* stream closed */ }
      }

      try {
        // Init DB record
        const site: GeneratedSite = {
          id,
          name: '',
          originalUrl: url,
          slug: '',
          githubRepoUrl: null,
          vercelUrl: null,
          createdAt: new Date().toISOString(),
          status: 'generating',
        }
        createSite(site)
        send({ step: 'start', id, message: 'Gestartet...' })

        // Step 1: Scrape
        send({ step: 'scraping', message: 'Webseite wird geladen...' })
        const { metadata, rawHtml } = await scrapeUrl(url)
        const rawSlug = slugify(metadata.title) || slugify(metadata.domain)
        const slug = rawSlug || id.slice(0, 8)
        updateSite(id, { name: metadata.title, slug })
        send({ step: 'scraped', message: `"${metadata.title}" gefunden` })

        // Step 2: OpenAI analyse + Stitch generiert
        send({ step: 'analyzing', message: 'OpenAI analysiert Design & Inhalt...' })
        send({ step: 'generating', message: 'Stitch generiert mobile Seite...' })
        const { html, analysis } = await generateSiteHTML(metadata, rawHtml)
        send({ step: 'generated', message: `Seite generiert (${Math.round(html.length / 1024)}kb) — ${analysis.businessType}` })

        // Step 3: GitHub
        let githubRepoUrl: string | null = null
        if (process.env.GITHUB_TOKEN) {
          send({ step: 'github', message: 'GitHub Repository wird erstellt...' })
          try {
            githubRepoUrl = await createGithubRepo(slug, `Mobile Landingpage: ${metadata.title}`)
            await pushHtmlToRepo(githubRepoUrl, html)
            updateSite(id, { githubRepoUrl })
            send({ step: 'github_done', message: 'GitHub Repository erstellt' })
          } catch (e) {
            send({ step: 'github_warn', message: `GitHub: ${e instanceof Error ? e.message : 'Fehler'}` })
          }
        } else {
          send({ step: 'github_skip', message: 'GitHub übersprungen' })
        }

        // Step 4: Vercel
        let vercelUrl: string | null = null
        if (process.env.VERCEL_TOKEN) {
          send({ step: 'vercel', message: 'Wird auf Vercel deployed...' })
          try {
            vercelUrl = await deployToVercel(slug, html)
            updateSite(id, { vercelUrl, status: 'deployed' })
            send({ step: 'vercel_done', message: 'Deployment erfolgreich' })
          } catch (e) {
            send({ step: 'vercel_warn', message: `Vercel: ${e instanceof Error ? e.message : 'Fehler'}` })
            updateSite(id, { status: 'deployed' })
          }
        } else {
          updateSite(id, { status: 'deployed' })
          send({ step: 'vercel_skip', message: 'Vercel übersprungen' })
        }

        send({ step: 'done', id, name: metadata.title, slug, githubRepoUrl, vercelUrl, message: 'Fertig!' })

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        try { updateSite(id, { status: 'failed', error: message }) } catch { /* ignore */ }
        send({ step: 'error', message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
