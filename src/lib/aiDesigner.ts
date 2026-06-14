export interface AIConfig {
  provider: 'gemini' | 'ollama' | 'workers-ai'
  apiKey?: string
  ollamaModel?: string
  ollamaUrl?: string
  cfModel?: string
  geminiModel?: string
}

export interface AIResponse {
  presetId: string
  explanation: string
  config: Record<string, any>
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

1. "dotfield": (Reacting dot grid)
   - spacing: number (15 to 60)
   - dotSize: number (0.5 to 4.0)
   - intensity: number (0.1 to 3.0)
   - pulseEvery: number (1000 to 8000)
   - autoPulse: boolean
   - dotColor: hex string
   - accentColor: hex string
   - interaction: "repel" | "attract" | "none"

2. "constellation": (Floating nodes with lines)
   - particleCount: number (20 to 200)
   - particleSize: number (0.5 to 5.0)
   - linkDistance: number (50 to 250)
   - speed: number (0.1 to 4.0)
   - color: hex string
   - lineOpacity: number (0.05 to 0.9)
   - interactive: boolean

3. "flowfield": (Paint streams along noise field)
   - particleCount: number (100 to 800)
   - speed: number (0.5 to 5.0)
   - noiseScale: number (0.001 to 0.02)
   - trailFade: number (0.01 to 0.3)
   - lineWidth: number (0.5 to 4.0)
   - primaryColor: hex string
   - secondaryColor: hex string

4. "aurora": (Liquid gradient blobs)
   - blobCount: number (2 to 6)
   - blur: number (40 to 150)
   - speed: number (5 to 60)
   - opacity: number (0.1 to 1.0)
   - color1: hex string
   - color2: hex string
   - color3: hex string
   - color4: hex string

5. "jellyfish": (Sinuous waves bending under pointer)
   - waveCount: number (2 to 12)
   - lineThickness: number (0.5 to 6.0)
   - speed: number (0.1 to 4.0)
   - frequency: number (0.001 to 0.01)
   - amplitude: number (10 to 120)
   - color: hex string
   - opacity: number (0.1 to 1.0)
   - interactive: boolean

6. "matrix": (Terminal matrix code rain)
   - speed: number (0.2 to 3.0)
   - fontSize: number (8 to 32)
   - trailFade: number (0.01 to 0.2)
   - color: hex string
   - customText: string (alphanumeric, max 10 chars)
   - density: number (0.1 to 0.95)
   - interactive: boolean

7. "nebula": (Orbiting stars rotating around core)
   - starCount: number (50 to 300)
   - orbitRadius: number (50 to 350)
   - rotateSpeed: number (0.1 to 4.0)
   - starSize: number (0.5 to 5.0)
   - starColor: hex string
   - coreColor: hex string
   - tailLength: number (0.01 to 0.3)

8. "hexgrid": (Honeycomb hexagons that ripple on click)
   - cellSize: number (12 to 80)
   - gapSize: number (0 to 10)
   - rippleSpeed: number (0.1 to 1.2)
   - color: hex string
   - bgColor: hex string
   - opacity: number (0.05 to 0.8)
   - interactive: boolean

9. "fireflies": (Glowing particles with random walks)
   - particleCount: number (10 to 150)
   - particleSize: number (1.0 to 6.0)
   - glowRadius: number (2 to 20)
   - speed: number (0.1 to 4.0)
   - color: hex string
   - trailLength: number (0.05 to 0.5)
   - interactive: boolean

10. "synthwave": (3D perspective grid with sun)
    - gridSpeed: number (0.5 to 5.0)
    - gridColor: hex string
    - sunColor: hex string
    - sunSize: number (50 to 200)
    - sunY: number (-50 to 250)
    - perspective: number (100 to 600)
    - fogDensity: number (0.1 to 0.9)

11. "voronoi": (Morphing convex cells over gradients)
    - cellCount: number (10 to 80)
    - lineWidth: number (0.5 to 5.0)
    - speed: number (0.1 to 3.0)
    - lineColor: hex string
    - bgGradient1: hex string
    - bgGradient2: hex string
    - interactive: boolean

Be creative! Select the preset that best fits the request. Output ONLY valid JSON inside markdown block \`\`\`json.`;

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  presetId?: string
  config?: Record<string, any>
  timestamp: number
  isError?: boolean
}

import type { CommunityPreset } from './galleryFetcher'

export async function askAIDesigner(
  messages: ChatMessage[],
  aiConfig: AIConfig,
  galleryPresets?: CommunityPreset[]
): Promise<AIResponse> {
  let galleryContext = ''
  if (galleryPresets && galleryPresets.length > 0) {
    galleryContext = `\n\nThere is also a Community Gallery of custom pre-made designs created by users.
If one of these community presets matches the user's request, or serves as a great starting point, you should select it!
To select a community preset, output its exact "presetId" (base background type) and its exact "config" values. You may also slightly modify its config values if needed to better fit the request.

Here are the available Community Gallery presets:
${galleryPresets.map((p, idx) => `${idx + 1}. ID: "${p.id}", Name: "${p.name}", Base Background Type: "${p.basePresetId}", Creator: "@${p.creator}", Description: "${p.description}", Config: ${JSON.stringify(p.config)}`).join('\n')}
`
  }

  if (aiConfig.provider === 'gemini') {
    if (!aiConfig.apiKey) {
      throw new Error('API Key is required for Google AI Studio (Gemini).')
    }

    // Standard available Gemini API models with user preference prioritized (2026 versions)
    const selectedModel = aiConfig.geminiModel || 'gemini-3.5-flash'
    const models = Array.from(new Set([
      selectedModel,
      'gemini-3.5-flash',
      'gemini-3.5-pro',
      'gemini-3.1-flash-lite',
      'gemini-3.0-flash',
      'gemini-3.0-pro',
      'gemma-4-26b',
      'gemma-4-12b',
      'gemma-4-31b',
      'gemini-2.5-flash'
    ]))
    let lastError = ''

    // Map chat history for Gemini API
    const contents = messages.filter(m => !m.isError).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [
        {
          text: msg.role === 'assistant'
            ? JSON.stringify({
                presetId: msg.presetId,
                config: msg.config,
                explanation: msg.content
              })
            : msg.content
        }
      ]
    }))

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${aiConfig.apiKey}`
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents,
            systemInstruction: {
              parts: [{ text: SYSTEM_INSTRUCTION + galleryContext }]
            },
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
        })

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData?.error?.message || `HTTP ${response.status} using ${model}`)
        }

        const data = await response.json()
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (!textResponse) throw new Error('Empty response from model')

        const parsed = JSON.parse(textResponse)
        if (parsed.presetId && parsed.config) {
          return parsed as AIResponse
        }
        throw new Error('Response JSON is missing presetId or config')
      } catch (err: any) {
        lastError = err.message || err.toString()
        // If it's a model-not-found error, try the next model
        if (lastError.includes('not found') || lastError.includes('404')) {
          continue
        }
        // For other errors, throw immediately
        throw err
      }
    }
    throw new Error(`Failed to call AI models. Last error: ${lastError}`)

  } else if (aiConfig.provider === 'ollama') {
    const url = `${aiConfig.ollamaUrl || 'http://localhost:11434'}/api/chat`
    const model = aiConfig.ollamaModel || 'gemma4'

    const messagesPayload = [
      { role: 'system', content: SYSTEM_INSTRUCTION + galleryContext },
      ...messages.filter(m => !m.isError).map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.role === 'assistant' 
          ? JSON.stringify({ presetId: msg.presetId, config: msg.config, explanation: msg.content })
          : msg.content
      }))
    ]

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: messagesPayload,
        stream: false,
        format: 'json',
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama request failed: HTTP ${response.status}`)
    }

    const data = await response.json()
    const content = data.message?.content
    if (!content) throw new Error('No content returned from Ollama')

    const parsed = JSON.parse(content)
    if (parsed.presetId && parsed.config) {
      return parsed as AIResponse
    }
    throw new Error('Response JSON from Ollama is invalid')

  } else if (aiConfig.provider === 'workers-ai') {
    const messagesPayload = messages.filter(m => !m.isError).map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.role === 'assistant' 
        ? JSON.stringify({ presetId: msg.presetId, config: msg.config, explanation: msg.content })
        : msg.content
    }))

    // Call our Cloudflare serverless proxy
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messagesPayload,
        galleryPresets,
        model: aiConfig.cfModel
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(errText || `Workers AI request failed: HTTP ${response.status}`)
    }

    const parsed = await response.json()
    if (parsed.presetId && parsed.config) {
      return parsed as AIResponse
    }
    throw new Error('Response JSON from Workers AI is invalid')
  }

  throw new Error('Unsupported AI provider')
}
