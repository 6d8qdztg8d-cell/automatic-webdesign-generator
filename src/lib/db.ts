import fs from 'fs'
import path from 'path'
import type { GeneratedSite } from '@/types'

// Vercel has a read-only filesystem except /tmp
const DB_PATH = process.env.VERCEL
  ? '/tmp/digitalframe-sites.json'
  : path.join(process.cwd(), 'data', 'sites.json')

function ensureDB() {
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ sites: [] }, null, 2))
}

function readDB(): { sites: GeneratedSite[] } {
  try {
    ensureDB()
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
  } catch {
    return { sites: [] }
  }
}

function writeDB(data: { sites: GeneratedSite[] }) {
  ensureDB()
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
}

export function getAllSites(): GeneratedSite[] {
  return readDB().sites.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function getSiteById(id: string): GeneratedSite | undefined {
  return readDB().sites.find((s) => s.id === id)
}

export function getSiteBySlug(slug: string): GeneratedSite | undefined {
  return readDB().sites.find((s) => s.slug === slug)
}

export function createSite(site: GeneratedSite): void {
  const db = readDB()
  db.sites.push(site)
  writeDB(db)
}

export function updateSite(id: string, updates: Partial<GeneratedSite>): void {
  const db = readDB()
  const idx = db.sites.findIndex((s) => s.id === id)
  if (idx !== -1) {
    db.sites[idx] = { ...db.sites[idx], ...updates }
    writeDB(db)
  }
}

export function deleteSite(id: string): void {
  const db = readDB()
  db.sites = db.sites.filter((s) => s.id !== id)
  writeDB(db)
}
