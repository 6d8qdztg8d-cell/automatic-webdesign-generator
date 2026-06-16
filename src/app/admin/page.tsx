'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import type { GeneratedSite, GenerateProgress } from '@/types'

type Tab = 'generate' | 'sites' | 'qr'

const STEP_ICON: Record<string, string> = {
  start: '·', scraping: '·', scraped: '✓', analyzing: '·',
  generating: '·', generated: '✓', github: '·', github_done: '✓',
  github_skip: '—', github_warn: '⚠', vercel: '·', vercel_done: '✓',
  vercel_skip: '—', vercel_warn: '⚠', done: '✓', error: '✕',
}

function StatusPill({ status }: { status: GeneratedSite['status'] }) {
  const map = {
    generating: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    deployed:   'bg-[#C8FF00]/10 text-[#C8FF00] border-[#C8FF00]/20',
    failed:     'bg-red-500/10 text-red-400 border-red-500/20',
  }
  const label = { generating: 'Läuft…', deployed: 'Live', failed: 'Fehler' }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${map[status]}`}>
      {label[status]}
    </span>
  )
}

function QRSection() {
  const [qrUrl, setQrUrl] = useState('')

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
    <div className="flex flex-col items-center gap-6 py-4">
      {/* QR */}
      <div className="p-5 bg-white rounded-[24px] shadow-[0_0_60px_rgba(200,255,0,0.2)]">
        <QRCodeSVG
          id="qr-svg"
          value={qrUrl}
          size={200}
          bgColor="#ffffff"
          fgColor="#0F0F0E"
          level="H"
          imageSettings={{ src: '/icon.svg', height: 36, width: 36, excavate: true, x: undefined, y: undefined }}
        />
        <div className="hidden">
          <QRCodeCanvas
            id="qr-canvas"
            value={qrUrl}
            size={800}
            bgColor="#ffffff"
            fgColor="#0F0F0E"
            level="H"
            imageSettings={{ src: '/icon.svg', height: 144, width: 144, excavate: true, x: undefined, y: undefined }}
          />
        </div>
      </div>

      {/* URL */}
      <div className="w-full df-card p-4 text-center">
        <p className="text-[11px] text-neutral-500 mb-1 uppercase tracking-widest">QR-Code zeigt auf</p>
        <p className="text-[12px] text-[#C8FF00] font-mono break-all">{qrUrl}</p>
      </div>

      {/* Download buttons */}
      <div className="w-full flex flex-col gap-3">
        <button onClick={downloadSVG} className="df-btn-primary w-full py-4 text-[15px]">
          ↓ SVG herunterladen
        </button>
        <button onClick={downloadPNG} className="df-btn-secondary w-full py-4 text-[15px]">
          ↓ PNG herunterladen (800×800)
        </button>
      </div>

      <p className="text-[11px] text-neutral-700 text-center">
        Diesen QR-Code auf allen Karteikarten drucken.{'\n'}Er bleibt immer gleich.
      </p>
    </div>
  )
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('generate')
  const [url, setUrl] = useState('')
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState<GenerateProgress[]>([])
  const [result, setResult] = useState<GenerateProgress | null>(null)
  const [sites, setSites] = useState<GeneratedSite[]>([])
  const [elapsed, setElapsed] = useState(0)
  const progressEndRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { loadSites() }, [])
  useEffect(() => {
    progressEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [progress])

  async function loadSites() {
    const res = await fetch('/api/sites')
    if (res.ok) setSites(await res.json())
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    let rawUrl = url.trim()
    if (!rawUrl || generating) return

    // Normalize: add https:// if missing
    if (!/^https?:\/\//i.test(rawUrl)) rawUrl = 'https://' + rawUrl
    setUrl(rawUrl)

    setGenerating(true)
    setProgress([])
    setResult(null)
    setElapsed(0)

    // Start elapsed timer
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rawUrl }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setResult({ step: 'error', message: data.error ?? 'Unbekannter Fehler' })
      } else {
        setResult({ step: 'done', ...data })
        setUrl('')
        loadSites()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verbindungsfehler'
      setResult({ step: 'error', message: msg })
    } finally {
      setGenerating(false)
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
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

  const NAV: { key: Tab; label: string; icon: string }[] = [
    { key: 'generate', label: 'Generieren', icon: '✦' },
    { key: 'sites',    label: 'Webseiten',  icon: '▦' },
    { key: 'qr',       label: 'QR-Code',    icon: '◫' },
  ]

  return (
    <div
      className="min-h-screen bg-[#0F0F0E] text-white flex flex-col"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <div className="w-8 h-8 rounded-[9px] bg-[#C8FF00] flex items-center justify-center flex-shrink-0">
          <span className="text-[11px] font-black text-black">DF</span>
        </div>
        <div>
          <p className="text-[15px] font-semibold leading-tight">DigitalFrame</p>
          <p className="text-[11px] text-neutral-600 leading-tight">Admin</p>
        </div>
        <a href="/" className="ml-auto text-[11px] text-neutral-600 border border-white/[0.08] rounded-lg px-3 py-1.5">
          Live-Seite →
        </a>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-5">

        {/* GENERATE TAB */}
        {tab === 'generate' && (
          <div className="flex flex-col gap-4">
            <div className="df-card p-4">
              <form onSubmit={handleGenerate} className="flex flex-col gap-3">
                <label className="label">URL der Webseite</label>
                <input
                  type="text"
                  inputMode="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="beispiel-bar.ch"
                  className="df-input text-[16px]"
                  disabled={generating}
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                <button
                  type="submit"
                  disabled={generating || !url.trim()}
                  className="df-btn-primary w-full py-4 text-[15px] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {generating
                    ? <>
                        <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin inline-block flex-shrink-0" />
                        <span>Generiert… {elapsed > 0 ? `${elapsed}s` : ''}</span>
                      </>
                    : '✦ Webseite generieren'}
                </button>
                {generating && (
                  <p className="text-[11px] text-neutral-600 text-center">
                    {elapsed < 15 ? 'Webseite wird analysiert…'
                     : elapsed < 40 ? 'Design wird generiert…'
                     : elapsed < 70 ? 'GitHub Repo & Vercel Deployment…'
                     : 'Fast fertig, bitte warten…'}
                  </p>
                )}
              </form>
            </div>

            {/* Progress */}
            {result && (
              <div className={`df-card p-4 ${result.step === 'error' ? 'border-red-500/30' : 'border-[#C8FF00]/20'}`}>
                {result.step === 'error' ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-[14px] text-red-400 font-semibold">✕ Fehler</p>
                    <p className="text-[12px] text-red-400/80 break-words">{result.message}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-[14px] text-[#C8FF00] font-semibold">✓ {result.name} — fertig!</p>
                    {result.vercelUrl && (
                      <a href={result.vercelUrl} target="_blank" rel="noopener noreferrer"
                        className="df-btn-primary text-center py-3.5 text-[15px]">
                        Webseite öffnen →
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SITES TAB */}
        {tab === 'sites' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between mb-1">
              <p className="label mb-0">{sites.length} Webseiten</p>
              <button onClick={loadSites} className="text-[11px] text-neutral-600 hover:text-neutral-300">↻ Neu laden</button>
            </div>

            {sites.length === 0 ? (
              <div className="df-card p-10 text-center">
                <p className="text-neutral-600 text-[13px]">Noch keine Webseiten generiert.</p>
              </div>
            ) : sites.map((site) => (
              <div key={site.id} className="df-card p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-[14px] font-semibold truncate">{site.name || site.slug}</span>
                      <StatusPill status={site.status} />
                    </div>
                    <p className="text-[11px] text-neutral-600 truncate">{site.originalUrl}</p>
                  </div>
                  <button onClick={() => handleDelete(site.id)} className="text-neutral-700 hover:text-red-400 text-[18px] flex-shrink-0">×</button>
                </div>

                {site.vercelUrl && (
                  <a href={site.vercelUrl} target="_blank" rel="noopener noreferrer"
                    className="block w-full df-btn-primary text-center py-3 text-[13px] mt-2">
                    Öffnen →
                  </a>
                )}
                {site.status === 'failed' && site.error && (
                  <p className="text-[11px] text-red-400 mt-2">{site.error}</p>
                )}
                <p className="text-[10px] text-neutral-700 mt-2">
                  {new Date(site.createdAt).toLocaleString('de-CH')}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* QR TAB */}
        {tab === 'qr' && <QRSection />}
      </div>

      {/* Bottom Navigation */}
      <div className="border-t border-white/[0.06] bg-[#0F0F0E] px-4 pt-2 pb-2"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <div className="flex justify-around">
          {NAV.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex flex-col items-center gap-1 px-5 py-2 rounded-xl transition-all ${
                tab === key ? 'text-[#C8FF00]' : 'text-neutral-600'
              }`}
            >
              <span className="text-[18px] leading-none">{icon}</span>
              <span className="text-[10px] font-medium tracking-wide">{label}</span>
              {tab === key && <span className="w-1 h-1 rounded-full bg-[#C8FF00]" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
