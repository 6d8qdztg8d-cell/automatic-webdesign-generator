const VERCEL_API = 'https://api.vercel.com'

function headers() {
  return {
    Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

function teamQuery() {
  return process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : ''
}

export async function deployToVercel(slug: string, html: string): Promise<string> {
  const projectName = `generated-site-${slug}`
  const content = Buffer.from(html).toString('base64')

  const res = await fetch(`${VERCEL_API}/v13/deployments${teamQuery()}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      name: projectName,
      files: [
        {
          file: 'index.html',
          data: content,
          encoding: 'base64',
        },
      ],
      projectSettings: {
        framework: null,
        buildCommand: null,
        outputDirectory: null,
        installCommand: null,
        devCommand: null,
      },
      target: 'production',
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Vercel: ${JSON.stringify(err)}`)
  }

  const deployment = await res.json()
  return await waitForDeployment(deployment.id)
}

async function waitForDeployment(deploymentId: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000))

    const res = await fetch(`${VERCEL_API}/v13/deployments/${deploymentId}${teamQuery()}`, {
      headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
    })

    if (!res.ok) continue
    const d = await res.json()

    if (d.readyState === 'READY' || d.status === 'READY') {
      return `https://${d.url}`
    }
    if (d.readyState === 'ERROR' || d.status === 'ERROR') {
      throw new Error('Vercel deployment failed')
    }
  }
  throw new Error('Vercel deployment timed out after 2 minutes')
}
