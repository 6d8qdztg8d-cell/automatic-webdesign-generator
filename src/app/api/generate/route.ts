import { NextRequest, NextResponse } from 'next/server'
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
  let id = ''
  try {
    const { url } = await request.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL fehlt' }, { status: 400 })
    }

    id = crypto.randomUUID()

    const site: GeneratedSite = {
      id, name: '', originalUrl: url, slug: '',
      githubRepoUrl: null, vercelUrl: null,
      createdAt: new Date().toISOString(), status: 'generating',
    }
    createSite(site)

    // 1. Scrape
    const { metadata, rawHtml } = await scrapeUrl(url)
    const slug = slugify(metadata.title) || slugify(metadata.domain) || id.slice(0, 8)
    updateSite(id, { name: metadata.title, slug })

    // 2. OpenAI → Stitch
    const { html, analysis } = await generateSiteHTML(metadata, rawHtml)

    // 3. GitHub
    let githubRepoUrl: string | null = null
    if (process.env.GITHUB_TOKEN) {
      try {
        githubRepoUrl = await createGithubRepo(slug, `Mobile Landingpage: ${metadata.title}`)
        await pushHtmlToRepo(githubRepoUrl, html)
        updateSite(id, { githubRepoUrl })
      } catch (e) {
        console.error('GitHub error:', e)
      }
    }

    // 4. Vercel
    let vercelUrl: string | null = null
    if (process.env.VERCEL_TOKEN) {
      try {
        vercelUrl = await deployToVercel(slug, html)
        updateSite(id, { vercelUrl, status: 'deployed' })
      } catch (e) {
        console.error('Vercel error:', e)
        updateSite(id, { status: 'deployed' })
      }
    } else {
      updateSite(id, { status: 'deployed' })
    }

    return NextResponse.json({
      ok: true,
      id,
      name: metadata.title,
      slug,
      businessType: analysis.businessType,
      githubRepoUrl,
      vercelUrl,
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Generate error:', message)
    if (id) {
      try { updateSite(id, { status: 'failed', error: message }) } catch { /* ignore */ }
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
