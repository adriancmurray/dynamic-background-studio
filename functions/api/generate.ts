interface Env {
  AI: any
}

const SYSTEM_INSTRUCTION = `You are an expert creative frontend web designer.
Your task is to take a design description from a user and translate it into a Svelte background configuration.

You must output a JSON object matching this structure:
{
  "presetId": "dotfield" | "constellation" | "flowfield" | "aurora" | "jellyfish" | "matrix" | "nebula" | "hexgrid" | "fireflies" | "synthwave" | "voronoi",
  "explanation": "A short (1-sentence) explanation of your design choices.",
  "config": {
    // Only variables that belong to the chosen preset!
  }
}

Here are the available presets and their allowed variables (do not output variables from other presets):

1. "dotfield":
   - spacing: number (15 to 60)
   - dotSize: number (0.5 to 4.0)
   - intensity: number (0.1 to 3.0)
   - pulseEvery: number (1000 to 8000)
   - autoPulse: boolean
   - dotColor: hex string
   - accentColor: hex string
   - interaction: "repel" | "attract" | "none"

2. "constellation":
   - particleCount: number (20 to 200)
   - particleSize: number (0.5 to 5.0)
   - linkDistance: number (50 to 250)
   - speed: number (0.1 to 4.0)
   - color: hex string
   - lineOpacity: number (0.05 to 0.9)
   - interactive: boolean

3. "flowfield":
   - particleCount: number (100 to 800)
   - speed: number (0.5 to 5.0)
   - noiseScale: number (0.001 to 0.02)
   - trailFade: number (0.01 to 0.3)
   - lineWidth: number (0.5 to 4.0)
   - primaryColor: hex string
   - secondaryColor: hex string

4. "aurora":
   - blobCount: number (2 to 6)
   - blur: number (40 to 150)
   - speed: number (5 to 60)
   - opacity: number (0.1 to 1.0)
   - color1: hex string
   - color2: hex string
   - color3: hex string
   - color4: hex string

5. "jellyfish":
   - waveCount: number (2 to 12)
   - lineThickness: number (0.5 to 6.0)
   - speed: number (0.1 to 4.0)
   - frequency: number (0.001 to 0.01)
   - amplitude: number (10 to 120)
   - color: hex string
   - opacity: number (0.1 to 1.0)
   - interactive: boolean

6. "matrix":
   - speed: number (0.2 to 3.0)
   - fontSize: number (8 to 32)
   - trailFade: number (0.01 to 0.2)
   - color: hex string
   - customText: string (alphanumeric, max 10 chars)
   - density: number (0.1 to 0.95)
   - interactive: boolean

7. "nebula":
   - starCount: number (50 to 300)
   - orbitRadius: number (50 to 350)
   - rotateSpeed: number (0.1 to 4.0)
   - starSize: number (0.5 to 5.0)
   - starColor: hex string
   - coreColor: hex string
   - tailLength: number (0.01 to 0.3)

8. "hexgrid":
   - cellSize: number (12 to 80)
   - gapSize: number (0 to 10)
   - rippleSpeed: number (0.1 to 1.2)
   - color: hex string
   - bgColor: hex string
   - opacity: number (0.05 to 0.8)
   - interactive: boolean

9. "fireflies":
   - particleCount: number (10 to 150)
   - particleSize: number (1.0 to 6.0)
   - glowRadius: number (2 to 20)
   - speed: number (0.1 to 4.0)
   - color: hex string
   - trailLength: number (0.05 to 0.5)
   - interactive: boolean

10. "synthwave":
    - gridSpeed: number (0.5 to 5.0)
    - gridColor: hex string
    - sunColor: hex string
    - sunSize: number (50 to 200)
    - sunY: number (-50 to 250)
    - perspective: number (100 to 600)
    - fogDensity: number (0.1 to 0.9)

11. "voronoi":
    - cellCount: number (10 to 80)
    - lineWidth: number (0.5 to 5.0)
    - speed: number (0.1 to 3.0)
    - lineColor: hex string
    - bgGradient1: hex string
    - bgGradient2: hex string
    - interactive: boolean

Choose the preset that fits best. Output ONLY valid JSON inside markdown block \`\`\`json.`;

export const onRequest: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    if (!env.AI) {
      return new Response('Cloudflare Workers AI binding is not configured', { status: 500 })
    }

    const { prompt, galleryPresets } = await request.json<{ prompt: string; galleryPresets?: any[] }>().catch(() => ({ prompt: '', galleryPresets: [] }))
    if (!prompt) {
      return new Response('Prompt is required', { status: 400 })
    }

    let galleryContext = ''
    if (galleryPresets && galleryPresets.length > 0) {
      galleryContext = `\n\nThere is also a Community Gallery of custom pre-made designs created by users.
If one of these community presets matches the user's request, or serves as a great starting point, you should select it!
To select a community preset, output its exact "presetId" (base background type) and its exact "config" values. You may also slightly modify its config values if needed to better fit the request.

Here are the available Community Gallery presets:
${galleryPresets.map((p, idx) => `${idx + 1}. ID: "${p.id}", Name: "${p.name}", Base Background Type: "${p.basePresetId}", Creator: "@${p.creator}", Description: "${p.description}", Config: ${JSON.stringify(p.config)}`).join('\n')}
`
    }

    // Call Llama 3.3 70B in Workers AI
    const model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast' // State-of-the-art 70B parameter model
    const response = await env.AI.run(model, {
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION + galleryContext },
        { role: 'user', content: `Create a background for: "${prompt}"` }
      ],
      response_format: { type: 'json_object' }
    })

    const result = response.response
    let parsed: any

    if (typeof result === 'object' && result !== null) {
      parsed = result
    } else if (typeof result === 'string') {
      let jsonText = result.trim()
      const mdMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/)
      if (mdMatch) {
        jsonText = mdMatch[1]
      }
      parsed = JSON.parse(jsonText)
    } else {
      throw new Error('Unsupported response format from AI model: ' + typeof result)
    }

    if (!parsed || !parsed.presetId || !parsed.config) {
      throw new Error('Response JSON is missing presetId or config')
    }

    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    return new Response(err.message || err.toString(), { status: 500 })
  }
}
