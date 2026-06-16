export type GeneratedSite = {
  id: string
  name: string
  originalUrl: string
  slug: string
  githubRepoUrl: string | null
  vercelUrl: string | null
  createdAt: string
  status: 'generating' | 'deployed' | 'failed'
  error?: string
}

export type GenerateProgress = {
  step: string
  message: string
  id?: string
  name?: string
  slug?: string
  githubRepoUrl?: string | null
  vercelUrl?: string | null
}
