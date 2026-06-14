interface Env {
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const code = url.searchParams.get('code')

  // 1. If GITHUB_CLIENT_ID is not configured, show a friendly developer instructions page
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    const errorHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>OAuth Configuration Needed - Background Studio</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #0b0f12;
            color: #d1d5db;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
          }
          .card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            padding: 32px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
          }
          h1 {
            color: #fff;
            font-size: 22px;
            margin-top: 0;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          p {
            font-size: 14px;
            line-height: 1.6;
            color: #9ca3af;
          }
          ol {
            font-size: 13px;
            line-height: 1.6;
            padding-left: 20px;
            color: #d1d5db;
          }
          li {
            margin-bottom: 12px;
          }
          code {
            font-family: monospace;
            background: rgba(255, 255, 255, 0.1);
            padding: 2px 6px;
            border-radius: 4px;
            color: #60a5fa;
            font-size: 12px;
          }
          .btn {
            display: inline-block;
            background: #2563eb;
            color: #fff;
            text-decoration: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            margin-top: 16px;
            transition: background 0.2s;
          }
          .btn:hover {
            background: #1d4ed8;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🔑 GitHub OAuth Setup Required</h1>
          <p>To enable GitHub Sign-In, please bind your GitHub OAuth Credentials in Cloudflare Pages:</p>
          <ol>
            <li>Create a new GitHub OAuth App in your GitHub settings (Developer Settings > OAuth Apps).</li>
            <li>Set the Authorization callback URL to: <br><code>${url.origin}/api/auth/github</code></li>
            <li>Go to your Cloudflare Pages dashboard > <strong>Settings</strong> > <strong>Environment variables</strong>.</li>
            <li>Add <code>GITHUB_CLIENT_ID</code> and <code>GITHUB_CLIENT_SECRET</code> as environment variables.</li>
            <li>Redeploy or restart wrangler with the local env file configuration.</li>
          </ol>
          <a href="/" class="btn">Return to Studio</a>
        </div>
      </body>
      </html>
    `;
    return new Response(errorHtml, {
      headers: { 'Content-Type': 'text/html' }
    })
  }

  // 2. EXCHANGE CODE FOR ACCESS TOKEN (GitHub Callback Flow)
  if (code) {
    try {
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'cloudflare-pages-auth'
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code
        })
      })

      const tokenData = await tokenResponse.json<{ access_token?: string; error?: string }>()
      if (tokenData.error || !tokenData.access_token) {
        return new Response(`GitHub OAuth Error: ${tokenData.error || 'No access token received'}`, { status: 400 })
      }

      // Fetch User Details from GitHub
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'User-Agent': 'cloudflare-pages-auth'
        }
      })

      if (!userResponse.ok) {
        return new Response('Failed to retrieve user profile from GitHub API', { status: 500 })
      }

      const userData = await userResponse.json<{ login: string; avatar_url: string }>()

      // Redirect back to landing page, encoding credentials in the hash to keep them client-only
      const redirectUrl = new URL(request.url)
      redirectUrl.pathname = '/'
      redirectUrl.search = ''
      redirectUrl.hash = `#auth=github&username=${encodeURIComponent(userData.login)}&avatar=${encodeURIComponent(userData.avatar_url || '')}`

      return Response.redirect(redirectUrl.toString(), 302)
    } catch (err: any) {
      return new Response(err.message || err.toString(), { status: 500 })
    }
  }

  // 3. INITIATE OAUTH FLOW (Redirect to GitHub)
  const redirectUri = new URL(request.url)
  redirectUri.search = '' // Strip code or other query params

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri.toString())}&scope=read:user`
  return Response.redirect(githubAuthUrl, 302)
}
