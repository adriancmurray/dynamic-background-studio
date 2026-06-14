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

CONVERSATIONAL FLOW:
- The user may reference/attach their current active design configuration inside the conversation history as a JSON object containing "presetId" and "config".
- If you see a referenced configuration in the history, you MUST use it as your base for adjustments, preserving its other parameters unless explicitly asked to modify them (e.g. "make the speed faster", "change color").
- If there is NO referenced configuration or previous history, you should generate a completely new design from scratch.

You must output a JSON object matching this structure:
{
  "presetId": "dotfield" | "constellation" | "flowfield" | "aurora" | "jellyfish" | "matrix" | "nebula" | "hexgrid" | "fireflies" | "synthwave" | "voronoi" | "custom",
  "explanation": "A short explanation of your design choices. If creating or modifying a custom background, YOU MUST output the full Svelte 5 component code inside a \`\`\`svelte markdown block here.",
  "config": {
    // Variables that belong to the chosen preset. You are highly encouraged to add new variables or parameters if it better fits the user's request. Our components accept all additional props.
  }
}

If the user explicitly asks to make a completely NEW background type (not just adjusting a preset) or to modify the active custom background, set presetId to "custom" and provide the COMPLETE Svelte 5 component code inside a \`\`\`svelte ... \`\`\` markdown block within the "explanation" field.

When making or modifying a custom component, you MUST support BOTH light and dark mode:
1. Accept a \`theme\` prop (\`theme?: 'light' | 'dark'\`) in your Props interface, defaulting to 'dark'.
2. Use Svelte's reactive states or derived properties to adjust colors, drawing operations, or backgrounds based on the \`theme\` value.
3. For canvas backgrounds, clear/fill the canvas background with a color matching the theme (e.g., \`#121212\` for dark theme, and \`#faf9f6\` or \`#ffffff\` for light theme), or read CSS custom properties.
4. Adjust drawing composition/opacity for the theme (e.g. use 'screen' or 'lighter' blend modes in dark mode, and 'multiply' or 'source-over' in light mode for bleeding paint/watercolor/particle effects).

Ensure the component uses standard HTML5 Canvas 2D or SVG inside a <script lang="ts"> block with Svelte 5 runes ($props, $effect), handling resizing, unmounts, and drawing properly.

Here is a reference format for a custom Svelte 5 Canvas background supporting both modes:
\`\`\`svelte
<script lang="ts">
  interface Props {
    color?: string;
    theme?: 'light' | 'dark';
  }
  let { color = '#3b82f6', theme = 'dark' }: Props = $props();

  let canvas: HTMLCanvasElement;
  let context: CanvasRenderingContext2D;
  let animationFrame = 0;

  // React to theme changes
  let bgColor = $derived(theme === 'dark' ? '#121212' : '#faf9f6');
  let blendMode = $derived(theme === 'dark' ? 'screen' : 'multiply');

  $effect(() => {
    if (!canvas) return;
    context = canvas.getContext('2d')!;
    
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    const render = () => {
      // Clear/draw background matching theme
      context.fillStyle = bgColor;
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.save();
      context.globalCompositeOperation = blendMode;
      context.fillStyle = color;
      context.fillRect(canvas.width / 2 - 50, canvas.height / 2 - 50, 100, 100);
      context.restore();

      animationFrame = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrame);
    };
  });
</script>
<canvas bind:this={canvas} class="w-full h-full block absolute top-0 left-0" style="pointer-events: none;"></canvas>
\`\`\`
Here are the available presets and their default variables (feel free to add new ones outside this list or invent new properties):

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

Be creative! Select the preset that best fits the request. Output ONLY a raw, valid JSON object matching the schema. Do not wrap the JSON object in markdown backticks or any other formatting.`;

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

function cleanAndParseJSON(text: string): any {
  // 1. Try to find a JSON block in markdown: ```json ... ```
  let jsonText = '';
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    jsonText = jsonBlockMatch[1].trim();
  } else {
    // If no markdown JSON block, find the first '{' and last '}'
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      jsonText = text.substring(startIdx, endIdx + 1).trim();
    }
  }

  // 2. Try parsing the extracted JSON
  let parsedJson: any = null;
  let parseError: Error | null = null;
  if (jsonText) {
    try {
      parsedJson = JSON.parse(jsonText);
    } catch (e: any) {
      parseError = e;
      // If parsing failed, maybe it's because of unescaped newlines/control characters or trailing commas.
      // Let's try to repair the JSON string:
      try {
        let insideString = false;
        let escaped = false;
        let repaired = '';
        for (let i = 0; i < jsonText.length; i++) {
          const char = jsonText[i];
          if (char === '"' && !escaped) {
            insideString = !insideString;
            repaired += char;
          } else if (char === '\\' && insideString && !escaped) {
            escaped = true;
            repaired += char;
          } else {
            if (insideString) {
              if (char === '\n') {
                repaired += '\\n';
              } else if (char === '\r') {
                repaired += '\\r';
              } else if (char === '\t') {
                repaired += '\\t';
              } else {
                repaired += char;
              }
            } else {
              if (char === '}' || char === ']') {
                let lastNonWhitespaceIdx = repaired.length - 1;
                while (lastNonWhitespaceIdx >= 0 && /\s/.test(repaired[lastNonWhitespaceIdx])) {
                  lastNonWhitespaceIdx--;
                }
                if (lastNonWhitespaceIdx >= 0 && repaired[lastNonWhitespaceIdx] === ',') {
                  repaired = repaired.slice(0, lastNonWhitespaceIdx) + repaired.slice(lastNonWhitespaceIdx + 1);
                }
              }
              repaired += char;
            }
            escaped = false;
          }
        }
        parsedJson = JSON.parse(repaired);
        parseError = null; // Successfully repaired!
      } catch (err2) {
        // Keep the original parsing error
      }
    }
  }

  // 3. If we parsed successfully, check if presetId is present
  if (parsedJson && parsedJson.presetId) {
    if (!parsedJson.config) {
      parsedJson.config = {};
    }
    if (parsedJson.explanation === undefined) {
      parsedJson.explanation = '';
    }
    return parsedJson;
  }

  // 4. Fallback: If JSON parsing failed but there is a ```svelte code block in the response,
  // we can reconstruct a "custom" preset response.
  const svelteBlockMatch = text.match(/```svelte\s*([\s\S]*?)\s*```/);
  if (svelteBlockMatch && svelteBlockMatch[1]) {
    return {
      presetId: 'custom',
      explanation: text, // Contain the full text (including the svelte block) so the client can extract it
      config: {}
    };
  }

  if (parseError) {
    throw new Error(`Unable to parse JSON string: ${parseError.message}`);
  }

  throw new Error('Unable to parse JSON string: No JSON object or Svelte component block found in response');
}

export async function askAIDesigner(
  messages: ChatMessage[],
  aiConfig: AIConfig,
  activePresetId: string,
  activeConfig: Record<string, any>,
  galleryPresets?: CommunityPreset[],
  customSvelteCode?: string
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

  let currentStateInstruction = ''
  if (activePresetId === 'custom' && customSvelteCode) {
    currentStateInstruction = `\n\nCURRENT CUSTOM CODE:\nThe user's active background is a custom Svelte 5 component. Here is its current source code:\n\`\`\`svelte\n${customSvelteCode}\n\`\`\`\nUse this code as your base. Modify it according to the user's request and output the full updated Svelte 5 component in the "explanation" field within a \`\`\`svelte markdown block.`
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
          text: msg.config
            ? JSON.stringify({
                presetId: msg.presetId,
                config: msg.config,
                message: msg.content
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
              parts: [{ text: SYSTEM_INSTRUCTION + galleryContext + currentStateInstruction }]
            },
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'object',
                properties: {
                  presetId: {
                    type: 'string',
                    description: 'The ID of the preset chosen, or "custom" if a new custom Svelte component is being created or modified.'
                  },
                  explanation: {
                    type: 'string',
                    description: 'A brief explanation of design choices. If creating or modifying a custom Svelte component, output the full updated Svelte 5 component code inside a ```svelte markdown block here.'
                  },
                  config: {
                    type: 'object',
                    description: 'The config parameters for the chosen preset.'
                  }
                },
                required: ['presetId', 'explanation', 'config']
              },
              maxOutputTokens: 8192,
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

        console.log('Gemini raw textResponse:', textResponse)
        const parsed = cleanAndParseJSON(textResponse)
        console.log('Gemini parsed object:', parsed)
        if (parsed.presetId) {
          if (!parsed.config) {
            parsed.config = {}
          }
          return parsed as AIResponse
        }
        throw new Error(`Response JSON is missing presetId. Keys returned: ${Object.keys(parsed || {}).join(', ')}`)
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
      { role: 'system', content: SYSTEM_INSTRUCTION + galleryContext + currentStateInstruction },
      ...messages.filter(m => !m.isError).map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.config 
          ? JSON.stringify({ presetId: msg.presetId, config: msg.config, message: msg.content })
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

    const parsed = cleanAndParseJSON(content)
    if (parsed.presetId) {
      if (!parsed.config) {
        parsed.config = {}
      }
      return parsed as AIResponse
    }
    throw new Error('Response JSON from Ollama is invalid')

  } else if (aiConfig.provider === 'workers-ai') {
    const messagesPayload = messages.filter(m => !m.isError).map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.config 
        ? JSON.stringify({ presetId: msg.presetId, config: msg.config, message: msg.content })
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
        model: aiConfig.cfModel,
        activePresetId,
        activeConfig,
        customSvelteCode
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
