'use client'

import { useState, useEffect } from 'react'
import type { GeneratedSite } from '@/types'

function SiteCard({ site }: { site: GeneratedSite }) {
  const initials = site.name
    ? site.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?'

  const href = site.vercelUrl || `/preview/${site.slug}`

  return (
    <a
      href={href}
      target={site.vercelUrl ? '_blank' : undefined}
      rel="noopener noreferrer"
      className="flex items-center gap-4 df-card p-4 active:scale-[0.97] transition-transform duration-100"
    >
      <div className="w-[52px] h-[52px] rounded-[14px] bg-[#C8FF00]/[0.10] border border-[#C8FF00]/[0.18] flex items-center justify-center flex-shrink-0">
        <span className="text-[18px] font-black text-[#C8FF00]">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-white truncate">{site.name}</p>
        <p className="text-[12px] text-neutral-500 truncate mt-0.5">
          {new URL(site.originalUrl).hostname.replace('www.', '')}
        </p>
      </div>
      <span className="text-[#C8FF00] text-[16px] flex-shrink-0">→</span>
    </a>
  )
}

export default function HomePage() {
  const [sites, setSites] = useState<GeneratedSite[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/sites')
      .then((r) => r.json())
      .then((data: GeneratedSite[]) => {
        setSites(data.filter((s) => s.status === 'deployed'))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = sites.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.originalUrl.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div
      className="min-h-screen bg-[#0F0F0E] flex flex-col"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Hero Header */}
      <div
        className="flex flex-col items-center text-center px-6 pb-8"
        style={{ paddingTop: 'max(3rem, env(safe-area-inset-top, 0px) + 2.5rem)' }}
      >
        <div className="w-16 h-16 rounded-[20px] bg-[#C8FF00] flex items-center justify-center mb-5 shadow-[0_0_48px_rgba(200,255,0,0.3)]">
          <span className="text-[22px] font-black text-[#0F0F0E]">DF</span>
        </div>
        <h1 className="text-[28px] font-bold tracking-tight text-white mb-1">DigitalFrame</h1>
        <p className="text-[14px] text-neutral-500 leading-relaxed">
          Scanne. Entdecke. Erlebe.
        </p>
      </div>

      {/* Search */}
      <div className="px-4 mb-4">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 text-[15px]">⌕</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Bar, Restaurant, Club..."
            className="df-input pl-10 py-3.5 text-[16px]"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mx-4 mb-4" />

      {/* Sites */}
      <div className="flex-1 px-4 pb-6">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="df-card p-4 animate-pulse flex items-center gap-4">
                <div className="w-[52px] h-[52px] rounded-[14px] bg-white/[0.05]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/[0.05] rounded-lg w-2/3" />
                  <div className="h-3 bg-white/[0.03] rounded-lg w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-[40px] opacity-10 mb-4">◎</div>
            <p className="text-neutral-600 text-[14px]">
              {search ? 'Nichts gefunden.' : 'Noch keine Webseiten verfügbar.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[11px] text-neutral-700 uppercase tracking-widest mb-1">
              {filtered.length} {filtered.length === 1 ? 'Webseite' : 'Webseiten'}
            </p>
            {filtered.map((site) => <SiteCard key={site.id} site={site} />)}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-5 border-t border-white/[0.04]">
        <p className="text-[11px] text-neutral-800 tracking-wide">DIGITALFRAME © 2026</p>
      </div>
    </div>
  )
}
