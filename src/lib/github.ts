const GITHUB_API = 'https://api.github.com'

function headers() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function getAuthenticatedUser(): Promise<string> {
  const res = await fetch(`${GITHUB_API}/user`, { headers: headers() })
  if (!res.ok) throw new Error('GitHub auth failed')
  const user = await res.json()
  return user.login as string
}

export async function createGithubRepo(slug: string, description: string): Promise<string> {
  const repoName = `generated-site-${slug}`

  const res = await fetch(`${GITHUB_API}/user/repos`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      name: repoName,
      description,
      private: false,
      auto_init: false,
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    // If repo already exists, return existing URL
    if (res.status === 422) {
      const login = await getAuthenticatedUser()
      return `https://github.com/${login}/${repoName}`
    }
    throw new Error(`GitHub: ${err.message}`)
  }

  const repo = await res.json()
  return repo.html_url as string
}

export async function pushHtmlToRepo(repoUrl: string, html: string): Promise<void> {
  const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/')
  const content = Buffer.from(html).toString('base64')

  // Check if file exists (to get SHA for update)
  let sha: string | undefined
  const check = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/index.html`, {
    headers: headers(),
  })
  if (check.ok) {
    const existing = await check.json()
    sha = existing.sha
  }

  const body: Record<string, string> = {
    message: 'Generated mobile landing page via DigitalFrame',
    content,
  }
  if (sha) body.sha = sha

  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/index.html`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`GitHub push: ${err.message}`)
  }
}
