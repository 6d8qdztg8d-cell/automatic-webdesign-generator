'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import type { GeneratedSite, GenerateProgress } from '@/types'

const STEPS: Record<string, string> = {
  start: '⟳',
  scraping: '⟳',
  scraped: '✓',
  generating: '⟳',
  generated: '✓',
  github: '⟳',
  github_done: '✓',
  github_skip: '—',
  github_warn: '⚠',
  vercel: '⟳',
  vercel_done: '✓',
  vercel_skip: '—',
  vercel_warn: '⚠',
  done: '✓',
  error: '✗',
}

function StatusDot({ status }: { status: GeneratedSite['status'] }) {
  const colors: Record<string, string> = {
    generating: 'bg-yellow-400',
    deployed: 'bg-[#C8FF00]',
    failed: 'bg-red-500',
  }
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[status] ?? 'bg-neutral-600'} ${status === 'generating' ? 'animate-pulse' : ''}`}
    />
  )
}

const QR_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_MAIN_SITE_URL || window.location.origin)
    : process.env.NEXT_PUBLIC_MAIN_SITE_URL || 'http://localhost:3000'

function QRSection() {
  const [qrUrl, setQrUrl] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    setQrUrl(process.env.NEXT_PUBLIC_MAIN_SITE_URL || window.location.origin)
  }, [])

  const downloadSVG = useCallback(() => {
    const svg = document.getElementById('qr-svg')
    if (!svg) return
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'digitalframe-qr.svg'
    a.click()
  }, [])

  const downloadPNG = useCallback(() => {
    const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement | null
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = 'digitalframe-qr.png'
    a.click()
  }, [])

  if (!qrUrl) return null

  return (
    <div className="df-card p-5 mb-6">
      <p className="label mb-4">QR-Code</p>
      <div className="flex flex-col sm:flex-row items-start gap-5">
        {/* QR Code */}
        <div className="flex-shrink-0 p-4 bg-white rounded-[16px] shadow-[0_0_30px_rgba(200,255,0,0.12)]">
          <QRCodeSVG
            id="qr-svg"
            value={qrUrl}
            size={148}
            bgColor="#ffffff"
            fgColor="#0F0F0E"
            level="H"
            imageSettings={{
              src: '/icon.svg',
              x: undefined,
              y: undefined,
              height: 28,
              width: 28,
              excavate: true,
            }}
          />
          {/* Hidden canvas for PNG download */}
          <div className="hidden">
            <QRCodeCanvas
              id="qr-canvas"
              value={qrUrl}
              size={600}
              bgColor="#ffffff"
              fgColor="#0F0F0E"
              level="H"
              imageSettings={{
                src: '/icon.svg',
                x: undefined,
                y: undefined,
                height: 110,
                width: 110,
                excavate: true,
              }}
            />
          </div>
        </div>

        {/* Info + Download */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-white font-medium mb-1">Dieser QR-Code bleibt immer gleich</p>
          <p className="text-[12px] text-neutral-500 mb-1">
            Auf allen Karteikarten drucken — er zeigt immer auf:
          </p>
          <p className="text-[12px] text-[#C8FF00]/80 break-all mb-4 font-mono">{qrUrl}</p>

          <div className="flex flex-col gap-2">
            <button
              onClick={downloadSVG}
              className="df-btn-primary text-[13px] py-2.5 flex items-center gap-2 justify-center"
            >
              ↓ SVG herunterladen
            </button>
            <button
              onClick={downloadPNG}
              className="df-btn-secondary text-[13px] py-2.5 flex items-center gap-2 justify-center"
            >
              ↓ PNG herunterladen (600×600)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [url, setUrl] = useState('')
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState<GenerateProgress[]>([])
  const [sites, setSites] = useState<GeneratedSite[]>([])
  const [result, setResult] = useState<GenerateProgress | null>(null)
  const progressEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadSites()
  }, [])

  useEffect(() => {
    progressEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [progress])

  async function loadSites() {
    const res = await fetch('/api/sites')
    if (res.ok) setSites(await res.json())
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim() || generating) return

    setGenerating(true)
    setProgress([])
    setResult(null)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data: GenerateProgress = JSON.parse(line.slice(6))
            setProgress((prev) => [...prev, data])
            if (data.step === 'done') {
              setResult(data)
              setUrl('')
              loadSites()
            }
            if (data.step === 'error') {
              setResult(data)
              loadSites()
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      setProgress((prev) => [
        ...prev,
        { step: 'error', message: err instanceof Error ? err.message : 'Verbindungsfehler' },
      ])
    } finally {
      setGenerating(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch('/api/sites', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadSites()
  }

  return (
    <div className="flex h-screen bg-[#0F0F0E] text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[200px] flex-shrink-0 flex flex-col bg-white/[0.025] border-r border-white/[0.06]">
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-2.5 mb-0.5">
            <div className="w-[26px] h-[26px] rounded-[7px] bg-[#C8FF00] flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-black text-black tracking-tighter">DF</span>
            </div>
            <span className="text-[14px] font-semibold text-white tracking-tight">DigitalFrame</span>
          </div>
          <p className="text-[11px] text-neutral-600 pl-[34px] mt-0.5">Admin Panel</p>
        </div>

        <div className="h-px bg-white/[0.06] mx-4" />

        <nav className="flex flex-col gap-0.5 px-3 pt-3 flex-1">
          <div className="flex items-center gap-2.5 px-3 py-[9px] rounded-[10px] bg-[#C8FF00]/[0.11] text-[#C8FF00]">
            <span className="text-[15px] leading-none w-5 text-center">✦</span>
            <span className="text-[12px] font-medium tracking-[0.07em]">GENERIEREN</span>
            <span className="w-[5px] h-[5px] rounded-full bg-[#C8FF00] opacity-70" />
          </div>
          <a
            href="/"
            className="flex items-center gap-2.5 px-3 py-[9px] rounded-[10px] text-left text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.04] transition-all"
          >
            <span className="text-[15px] leading-none w-5 text-center">◎</span>
            <span className="text-[12px] font-medium tracking-[0.07em]">QR-SEITE</span>
          </a>
        </nav>

        <div className="px-5 pb-5">
          <div className="flex items-center gap-1.5">
            <span className="w-[5px] h-[5px] rounded-full bg-[#C8FF00]/30" />
            <p className="text-[11px] text-neutral-700">v1.0 MVP</p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-[22px] font-bold tracking-tight mb-1">Webseite generieren</h1>
            <p className="text-[13px] text-neutral-500">
              URL eingeben → OpenAI analysiert → Stitch generiert → GitHub + Vercel Deployment
            </p>
          </div>

          {/* QR Code */}
          <QRSection />

          {/* URL Form */}
          <div className="df-card p-5 mb-6">
            <form onSubmit={handleGenerate} className="flex flex-col gap-4">
              <div>
                <label className="label">URL der Webseite</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://beispiel-bar.ch"
                  className="df-input"
                  disabled={generating}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={generating || !url.trim()}
                className="df-btn-primary flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Generiert...
                  </>
                ) : (
                  <>✦ Webseite generieren</>
                )}
              </button>
            </form>
          </div>

          {/* Progress */}
          {progress.length > 0 && (
            <div className="df-card p-5 mb-6">
              <p className="label mb-3">Fortschritt</p>
              <div className="flex flex-col gap-2">
                {progress.map((p, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span
                      className={`text-[13px] w-4 text-center flex-shrink-0 mt-0.5 ${
                        p.step === 'done'
                          ? 'text-[#C8FF00]'
                          : p.step === 'error'
                          ? 'text-red-400'
                          : p.step.endsWith('_warn')
                          ? 'text-yellow-400'
                          : p.step.includes('_done') || p.step === 'scraped' || p.step === 'generated'
                          ? 'text-[#C8FF00]'
                          : p.step.includes('_skip')
                          ? 'text-neutral-600'
                          : 'text-neutral-400'
                      }`}
                    >
                      {STEPS[p.step] ?? '·'}
                    </span>
                    <span
                      className={`text-[13px] ${
                        p.step === 'error' ? 'text-red-400' : 'text-neutral-300'
                      }`}
                    >
                      {p.message}
                    </span>
                  </div>
                ))}
                <div ref={progressEndRef} />
              </div>

              {result && result.step === 'done' && (
                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  <p className="text-[13px] text-[#C8FF00] font-semibold mb-2">✓ Erfolgreich erstellt!</p>
                  {result.vercelUrl && (
                    <a
                      href={result.vercelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] text-[#C8FF00]/70 hover:text-[#C8FF00] underline break-all"
                    >
                      {result.vercelUrl}
                    </a>
                  )}
                  {result.slug && (
                    <div className="mt-2">
                      <a
                        href={`/preview/${result.slug}`}
                        className="text-[12px] text-neutral-400 hover:text-white underline"
                      >
                        Vorschau ansehen →
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Site List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="label mb-0">Generierte Webseiten ({sites.length})</p>
              <button
                onClick={loadSites}
                className="text-[11px] text-neutral-600 hover:text-neutral-300 transition-colors"
              >
                ↻ Aktualisieren
              </button>
            </div>

            {sites.length === 0 ? (
              <div className="df-card p-8 text-center">
                <p className="text-neutral-600 text-[13px]">Noch keine Webseiten generiert.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {sites.map((site) => (
                  <div key={site.id} className="df-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusDot status={site.status} />
                          <span className="text-[14px] font-semibold truncate">
                            {site.name || site.slug || site.originalUrl}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-600 truncate mb-2">{site.originalUrl}</p>
                        {site.vercelUrl && (
                          <a
                            href={site.vercelUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-[#C8FF00]/70 hover:text-[#C8FF00] transition-colors truncate block"
                          >
                            {site.vercelUrl}
                          </a>
                        )}
                        {site.status === 'failed' && site.error && (
                          <p className="text-[11px] text-red-400 mt-1">{site.error}</p>
                        )}
                        <p className="text-[11px] text-neutral-700 mt-1">
                          {new Date(site.createdAt).toLocaleString('de-CH')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {site.slug && site.status === 'deployed' && (
                          <a
                            href={`/preview/${site.slug}`}
                            className="text-[11px] text-neutral-400 hover:text-white transition-colors border border-white/[0.08] rounded-lg px-2.5 py-1.5"
                          >
                            Vorschau
                          </a>
                        )}
                        {site.githubRepoUrl && (
                          <a
                            href={site.githubRepoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-neutral-400 hover:text-white transition-colors border border-white/[0.08] rounded-lg px-2.5 py-1.5"
                          >
                            GitHub
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(site.id)}
                          className="text-[11px] text-neutral-600 hover:text-red-400 transition-colors border border-white/[0.06] rounded-lg px-2.5 py-1.5"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
