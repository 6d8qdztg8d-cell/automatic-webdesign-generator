'use client'

import { useState, useEffect } from 'react'
import type { GeneratedSite } from '@/types'

function SiteCard({ site }: { site: GeneratedSite }) {
  const initials = site.name
    ? site.name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : '?'

  const targetUrl = site.vercelUrl || `/preview/${site.slug}`

  return (
    <a
      href={targetUrl}
      target={site.vercelUrl ? '_blank' : undefined}
      rel="noopener noreferrer"
      className="block df-card p-4 active:scale-[0.98] transition-transform duration-100"
    >
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="w-[52px] h-[52px] rounded-[14px] bg-[#C8FF00]/[0.12] border border-[#C8FF00]/[0.2] flex items-center justify-center flex-shrink-0">
          <span className="text-[17px] font-black text-[#C8FF00] tracking-tighter">{initials}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-white truncate mb-0.5">{site.name}</p>
          <p className="text-[12px] text-neutral-500 truncate">{new URL(site.originalUrl).hostname.replace('www.', '')}</p>
        </div>

        {/* Arrow */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center">
          <span className="text-[#C8FF00] text-[12px]">→</span>
        </div>
      </div>
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
      .then((data) => {
        setSites(data.filter((s: GeneratedSite) => s.status === 'deployed'))
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
    <div className="min-h-screen bg-[#0F0F0E] flex flex-col">
      {/* Header */}
      <div
        className="pt-safe flex flex-col items-center px-6 pt-14 pb-8"
        style={{ paddingTop: 'max(3.5rem, env(safe-area-inset-top, 0px) + 2rem)' }}
      >
        {/* Logo */}
        <div className="w-14 h-14 rounded-[18px] bg-[#C8FF00] flex items-center justify-center mb-4 shadow-[0_0_40px_rgba(200,255,0,0.25)]">
          <span className="text-[20px] font-black text-[#0F0F0E] tracking-tighter">DF</span>
        </div>

        <h1 className="text-[26px] font-bold text-white tracking-tight text-center mb-1">
          DigitalFrame
        </h1>
        <p className="text-[14px] text-neutral-500 text-center">
          Lokale Webseiten entdecken
        </p>
      </div>

      {/* Gradient divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-6 mb-6" />

      {/* Search */}
      <div className="px-5 mb-5">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 text-[14px]">
            ⌕
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen..."
            className="df-input pl-9"
          />
        </div>
      </div>

      {/* Site list */}
      <div className="flex-1 px-5 pb-8" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 0px) + 1rem)' }}>
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="df-card p-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-[52px] h-[52px] rounded-[14px] bg-white/[0.05]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/[0.05] rounded w-3/4" />
                    <div className="h-3 bg-white/[0.03] rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4 opacity-20">◎</div>
            <p className="text-neutral-600 text-[14px]">
              {search ? 'Keine Treffer gefunden.' : 'Noch keine Webseiten verfügbar.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((site) => (
              <SiteCard key={site.id} site={site} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-4 border-t border-white/[0.04]">
        <p className="text-[11px] text-neutral-700">DigitalFrame © 2026</p>
      </div>
    </div>
  )
}
