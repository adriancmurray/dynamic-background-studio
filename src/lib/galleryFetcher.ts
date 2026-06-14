export interface CommunityPreset {
  id: string
  basePresetId: string
  name: string
  description: string
  config: Record<string, any>
  creator: string
  avatarUrl: string
  issueUrl: string
}

// In-memory cache to avoid duplicate API requests during session
let cachedPresets: { repo: string; data: CommunityPreset[]; timestamp: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export async function fetchCommunityGallery(repo: string): Promise<CommunityPreset[]> {
  const normalizedRepo = repo.trim().replace(/\/$/, '')
  if (!normalizedRepo || !normalizedRepo.includes('/')) {
    throw new Error('Invalid GitHub repository format. Expected "owner/repo".')
  }

  // Use cache if still fresh
  const now = Date.now()
  if (cachedPresets && cachedPresets.repo === normalizedRepo && (now - cachedPresets.timestamp) < CACHE_TTL_MS) {
    return cachedPresets.data
  }

  const url = `https://api.github.com/repos/${normalizedRepo}/issues?state=all&per_page=100`
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      }
    })

    if (response.status === 403) {
      // Typically rate-limit exceeded
      const rateLimitReset = response.headers.get('X-RateLimit-Reset')
      let resetMsg = ''
      if (rateLimitReset) {
        const resetTime = new Date(Number(rateLimitReset) * 1000).toLocaleTimeString()
        resetMsg = ` (Resets at ${resetTime})`
      }
      throw new Error(`GitHub API rate limit exceeded. Please try again later${resetMsg}.`)
    }

    if (!response.ok) {
      throw new Error(`GitHub API responded with status ${response.status}`)
    }

    const issues = await response.json()
    if (!Array.isArray(issues)) {
      throw new Error('Invalid response from GitHub API: expected array of issues.')
    }

    const presets: CommunityPreset[] = []

    for (const issue of issues) {
      // Skip Pull Requests (they have 'pull_request' key in the issue object)
      if (issue.pull_request) continue
      
      // Skip issues that don't have a body
      if (!issue.body) continue

      // Look for a JSON code block in the body
      const jsonMatch = issue.body.match(/```json\r?\n([\s\S]*?)\r?\n```/)
      if (!jsonMatch) continue

      try {
        const parsed = JSON.parse(jsonMatch[1].trim())
        
        // Validate parsed JSON schema
        if (parsed && typeof parsed === 'object' && parsed.presetId && parsed.config && typeof parsed.config === 'object') {
          // Extract description: find everything under a description heading if present
          let description = `A custom ${parsed.presetId} configuration.`
          const descMatch = issue.body.match(/\*\*Description\*\*:\s*([^\n\r]+)/i)
          if (descMatch && descMatch[1].trim()) {
            description = descMatch[1].trim()
          }

          presets.push({
            id: `community-${issue.number}`,
            basePresetId: parsed.presetId,
            name: parsed.name || `Preset #${issue.number}`,
            description,
            config: parsed.config,
            creator: issue.user?.login || 'anonymous',
            avatarUrl: issue.user?.avatar_url || '',
            issueUrl: issue.html_url
          })
        }
      } catch (e) {
        // Log locally but don't break the whole loop for one bad issue body
        console.warn(`Failed to parse gallery config for issue #${issue.number}:`, e)
      }
    }

    // Update cache
    cachedPresets = {
      repo: normalizedRepo,
      data: presets,
      timestamp: now
    }

    return presets
  } catch (err: any) {
    // If we have a cached copy, fallback to it on error
    if (cachedPresets && cachedPresets.repo === normalizedRepo) {
      console.warn('GitHub API fetch failed. Falling back to cached community presets:', err)
      return cachedPresets.data
    }
    throw err
  }
}
