import { getSiteBySlug } from '@/lib/db'
import { notFound } from 'next/navigation'

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const site = getSiteBySlug(slug)

  if (!site) notFound()

  // If deployed to Vercel, redirect there
  if (site.vercelUrl) {
    return (
      <div className="min-h-screen bg-[#0F0F0E] flex flex-col items-center justify-center p-6">
        <div className="w-[26px] h-[26px] rounded-[7px] bg-[#C8FF00] flex items-center justify-center mb-4">
          <span className="text-[10px] font-black text-black">DF</span>
        </div>
        <p className="text-white text-[15px] font-semibold mb-2">{site.name}</p>
        <p className="text-neutral-500 text-[13px] mb-6">Diese Seite ist auf Vercel deployed.</p>
        <a
          href={site.vercelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="df-btn-primary"
        >
          Webseite öffnen →
        </a>
        <a href="/" className="mt-4 text-[12px] text-neutral-600 hover:text-neutral-400">
          ← Zurück
        </a>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F0F0E] flex flex-col items-center justify-center p-6">
      <p className="text-neutral-600 text-[13px]">Seite noch nicht deployed.</p>
      <a href="/" className="mt-4 text-[12px] text-[#C8FF00]">← Zurück</a>
    </div>
  )
}
