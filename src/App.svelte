<script lang="ts">
  import { onMount } from 'svelte'
  import { slide, fade, scale, fly } from 'svelte/transition'
  import {
    Sparkles,
    Sliders,
    Code,
    Copy,
    Check,
    Eye,
    EyeOff,
    Sun,
    Moon,
    RotateCcw,
    Monitor,
    Smartphone,
    Layers,
    ChevronRight,
    X,
    Settings,
    Search,
    RefreshCw,
    ExternalLink,
    MessageSquare,
    Send,
    Trash2,
    Plus,
    User,
    CircleQuestionMark,
  } from '@lucide/svelte'

  // Import dynamic backgrounds
  import DotField from './lib/components/DotField.svelte'
  import Constellation from './lib/components/Constellation.svelte'
  import FlowField from './lib/components/FlowField.svelte'
  import Aurora from './lib/components/Aurora.svelte'
  import Jellyfish from './lib/components/Jellyfish.svelte'
  import MatrixRain from './lib/components/MatrixRain.svelte'
  import Nebula from './lib/components/Nebula.svelte'
  import HexGrid from './lib/components/HexGrid.svelte'
  import Fireflies from './lib/components/Fireflies.svelte'
  import Synthwave from './lib/components/Synthwave.svelte'
  import Voronoi from './lib/components/Voronoi.svelte'
  import CustomGenerated from './lib/components/CustomGenerated.svelte'

  // Import data definitions
  import { presetCatalog, type BackgroundPreset } from './lib/presetCatalog'
  import { componentSources } from './lib/componentSources'
  import { generateSvelteUseCode } from './lib/codeGenerator'
  import { askAIDesigner, type AIConfig, type ChatMessage } from './lib/aiDesigner'
  import { fetchCommunityGallery, type CommunityPreset } from './lib/galleryFetcher'
  import { parseMarkdown } from './lib/utils/markdown'

  // --- Svelte 5 Runes for App State ---
  let activePresetId = $state('dotfield')
  
  // Clone default configs so users can mutate them
  let configs = $state<Record<string, Record<string, any>>>(
    presetCatalog.reduce((acc, preset) => {
      acc[preset.id] = { ...preset.defaultConfig }
      return acc
    }, {} as Record<string, Record<string, any>>)
  )

  let activeConfig = $derived(configs[activePresetId])
  let activePreset = $derived(presetCatalog.find(p => p.id === activePresetId)!)

  let showOverlay = $state(false)
  let theme = $state<'dark' | 'light'>('dark')
  let customSvelteCode = $state('')
  let commandCenterHeight = $state(0)
  
  // Command Center Morph State
  let islandMode = $state<'collapsed' | 'presets' | 'variables' | 'export' | 'settings' | 'profile'>('collapsed')
  
  let showCodePanel = $state(false);
  let sideCodeType = $state<'svelte-use' | 'svelte-source'>('svelte-source');
  let sideCodeCopyState = $state<'idle' | 'copied'>('idle');
  let sideCodeCopyTimeout: ReturnType<typeof setTimeout>;
  function copySideCodeText(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      sideCodeCopyState = 'copied';
      if (sideCodeCopyTimeout) clearTimeout(sideCodeCopyTimeout);
      sideCodeCopyTimeout = setTimeout(() => {
        sideCodeCopyState = 'idle';
      }, 2000);
    });
  }

  // Exporter panel sub-states
  let activeExportType = $state<'svelte-use' | 'svelte-source'>('svelte-use')
  let copyState = $state<'idle' | 'copied'>('idle')

  let showToast = $state(false);
  let toastMessage = $state('');
  let toastType = $state<'success' | 'error' | 'info'>('info');
  let toastTimeout: ReturnType<typeof setTimeout>;

  function showToastMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
    toastMessage = message;
    toastType = type;
    showToast = true;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      showToast = false;
    }, 3000);
  }
  let copyTimeout = 0


  // --- URL State Synchronization ---
  let blockHashSync = false

  function serializeState(presetId: string, config: Record<string, any>): string {
    const params = new URLSearchParams()
    params.set('p', presetId)
    Object.entries(config).forEach(([key, val]) => {
      params.set(key, String(val))
    })
    return params.toString()
  }

  function deserializeState(hash: string) {
    const params = new URLSearchParams(hash.replace('#', ''))
    const p = params.get('p')
    if (!p) return null
    const config: Record<string, any> = {}
    params.forEach((val, key) => {
      if (key === 'p') return
      const preset = presetCatalog.find(pr => pr.id === p)
      const defaultVal = preset?.defaultConfig[key]
      if (typeof defaultVal === 'number') {
        config[key] = Number(val)
      } else if (typeof defaultVal === 'boolean') {
        config[key] = val === 'true'
      } else {
        config[key] = val
      }
    })
    return { presetId: p, config }
  }

  // --- AI Designer & User Profile State ---
  let aiPrompt = $state('')
  let aiLoading = $state(false)
  let aiError = $state('')
  
  let aiProvider = $state<'gemini' | 'ollama' | 'workers-ai'>(
    (typeof localStorage !== 'undefined' && localStorage.getItem('ai-provider') as any) || 'gemini'
  )
  let aiApiKey = $state(
    (typeof localStorage !== 'undefined' && localStorage.getItem('ai-api-key')) || ''
  )
  let ollamaModel = $state(
    (typeof localStorage !== 'undefined' && localStorage.getItem('ai-ollama-model')) || 'gemma4'
  )
  let ollamaUrl = $state(
    (typeof localStorage !== 'undefined' && localStorage.getItem('ai-ollama-url')) || 'http://localhost:11434'
  )
  let cfModel = $state<'@cf/google/gemma-4-26b-a4b-it' | '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b' | '@cf/meta/llama-3.3-70b-instruct-fp8-fast' | '@cf/meta/llama-3.1-8b-instruct-fp8'>(
    (typeof localStorage !== 'undefined' && localStorage.getItem('ai-cf-model') as any) || '@cf/google/gemma-4-26b-a4b-it'
  )
  let geminiModel = $state(
    (typeof localStorage !== 'undefined' && localStorage.getItem('ai-gemini-model')) || 'gemini-3.5-flash'
  )
  let chatMessages = $state<ChatMessage[]>(
    (typeof localStorage !== 'undefined' && JSON.parse(localStorage.getItem('studio-chat-messages') || '[]')) || []
  )
  const hasReferenceInHistory = $derived(chatMessages.some(m => m.config !== undefined))
  let showChat = $state(
    (typeof localStorage !== 'undefined' && localStorage.getItem('studio-show-chat') === 'true') || false
  )

  let githubUsername = $state(
    (typeof localStorage !== 'undefined' && localStorage.getItem('studio-github-username')) || 
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GIT_USERNAME) || 
    ''
  )
  let githubAvatarUrl = $derived(
    githubUsername ? `https://github.com/${githubUsername}.png` : ''
  )

  // Gallery Repository and State
  let galleryRepo = $state(
    (typeof localStorage !== 'undefined' && localStorage.getItem('studio-gallery-repo')) || 'adriancmurray/dynamic-background-studio'
  )
  let communityPresets = $state<CommunityPreset[]>([])
  let galleryLoading = $state(false)
  let galleryError = $state('')
  let presetsQuery = $state('')

  let userRepos = $state<string[]>([])
  let loadingRepos = $state(false)
  let customRepoSelected = $state(false)
  let showCustomRepoInput = $derived(customRepoSelected || !githubUsername || userRepos.length === 0 || !userRepos.includes(galleryRepo))

  // Local saved presets list (No GitHub friction)
  interface LocalPreset {
    id: string
    name: string
    basePresetId: string
    config: Record<string, any>
    timestamp: number
  }

  let localPresets = $state<LocalPreset[]>(
    (typeof localStorage !== 'undefined' && JSON.parse(localStorage.getItem('studio-local-presets') || '[]')) || []
  )
  
  // Custom name input for saving a design
  let savePresetName = $state('')
  let showSaveModal = $state(false)

  // Share copy state
  let shareCopyState = $state<'idle' | 'copied'>('idle')
  let shareCopyTimeout = 0

  // --- Derived Filters ---
  let filteredCorePresets = $derived(
    presetCatalog.filter(preset => {
      const q = presetsQuery.trim().toLowerCase()
      if (!q) return true
      return preset.name.toLowerCase().includes(q) || 
             preset.description.toLowerCase().includes(q) ||
             preset.id.toLowerCase().includes(q)
    })
  )

  let filteredCommunityPresets = $derived(
    communityPresets.filter(preset => {
      const q = presetsQuery.trim().toLowerCase()
      if (!q) return true
      const basePreset = presetCatalog.find(p => p.id === preset.basePresetId)
      return preset.name.toLowerCase().includes(q) || 
             preset.description.toLowerCase().includes(q) ||
             preset.creator.toLowerCase().includes(q) ||
             (basePreset?.name.toLowerCase().includes(q) ?? false)
    })
  )

  async function loadGallery() {
    galleryLoading = true
    galleryError = ''
    try {
      communityPresets = await fetchCommunityGallery(galleryRepo)
    } catch (err: any) {
      galleryError = err.message || 'Failed to load community presets.'
    } finally {
      galleryLoading = false
    }
  }

  async function fetchUserRepos() {
    if (!githubUsername.trim()) {
      userRepos = []
      return
    }
    loadingRepos = true
    try {
      const res = await fetch(`https://api.github.com/users/${githubUsername.trim()}/repos?sort=updated&per_page=100`)
      if (res.ok) {
        const data = await res.json()
        userRepos = data.map((r: any) => r.full_name)
      } else {
        userRepos = []
      }
    } catch {
      userRepos = []
    } finally {
      loadingRepos = false
    }
  }

  onMount(() => {
    // Parse URL Hash authentication redirect from GitHub OAuth
    const hash = window.location.hash
    if (hash.startsWith('#auth=github')) {
      const params = new URLSearchParams(hash.replace('#', ''))
      const username = params.get('username')
      if (username) {
        githubUsername = username
        localStorage.setItem('studio-github-username', username)
        
        // Clean hash from URL without reloading
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
        
        // Switch to profile settings view
        islandMode = 'profile'
      }
    }

    // Detect initial theme
    const savedTheme = localStorage.getItem('studio-theme')
    if (savedTheme === 'light' || savedTheme === 'dark') {
      theme = savedTheme
    } else {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    document.documentElement.dataset.theme = theme

    // Parse URL Hash configuration
    const urlState = deserializeState(window.location.hash)
    if (urlState) {
      blockHashSync = true
      activePresetId = urlState.presetId
      configs[urlState.presetId] = { ...configs[urlState.presetId], ...urlState.config }
      setTimeout(() => { blockHashSync = false }, 120)
    }

    if (githubUsername) {
      fetchUserRepos()
    }
    loadGallery()

    // Fetch custom Svelte code if present on server
    fetch('/__save-custom')
      .then(res => res.json())
      .then(data => {
        if (data.code) {
          customSvelteCode = data.code
        }
      })
      .catch(err => console.error('Failed to load custom Svelte code on mount:', err))
  })

  // Hash updates automatically on config mutations
  $effect(() => {
    if (blockHashSync) return
    const hash = serializeState(activePresetId, activeConfig)
    window.history.replaceState(null, '', '#' + hash)
  })

  // AI, Profile & Gallery settings persistence
  $effect(() => { localStorage.setItem('ai-provider', aiProvider) })
  $effect(() => { localStorage.setItem('ai-api-key', aiApiKey) })
  $effect(() => { localStorage.setItem('ai-ollama-model', ollamaModel) })
  $effect(() => { localStorage.setItem('ai-ollama-url', ollamaUrl) })
  $effect(() => { localStorage.setItem('ai-cf-model', cfModel) })
  $effect(() => { localStorage.setItem('studio-gallery-repo', galleryRepo) })
  let repoDebounceTimeout: any
  $effect(() => {
    localStorage.setItem('studio-github-username', githubUsername)
    if (githubUsername.trim()) {
      clearTimeout(repoDebounceTimeout)
      repoDebounceTimeout = setTimeout(() => {
        fetchUserRepos()
      }, 500)
    } else {
      userRepos = []
    }
  })
  $effect(() => { localStorage.setItem('studio-local-presets', JSON.stringify(localPresets)) })
  $effect(() => { localStorage.setItem('ai-gemini-model', geminiModel) })
  $effect(() => { localStorage.setItem('studio-chat-messages', JSON.stringify(chatMessages)) })
  $effect(() => { localStorage.setItem('studio-show-chat', showChat.toString()) })

  // Initialize welcome message if chat history is empty
  $effect(() => {
    if (chatMessages.length === 0) {
      chatMessages = [
        {
          id: 'welcome-message',
          role: 'assistant',
          content: `Hello! I'm your AI Design Partner. 

Welcome to Background Studio! Here's how you can use this interactive space:
- 🌌 Aesthetic Prompts: Describe what you want to see (e.g. "make a cyber-themed ripple effect with neon greens" or "a slow, calming sunset flowfield").
- 🎛️ Manual Controls: Click the morphing island at the bottom to adjust presets, fine-tune variables directly, or copy the Svelte/CSS code.
- 📐 Reference Canvas: Attach your active canvas config to direct modifications to your current design.
- 📘 Guide Sheet: Tap the Help (?) icon anytime to view keyboard shortcuts and detailed instructions.

How can I help you design today?`,
          timestamp: Date.now()
        }
      ]
    }
  })

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = theme
    localStorage.setItem('studio-theme', theme)
  }

  function resetPresetConfig() {
    const defaultVals = presetCatalog.find(p => p.id === activePresetId)?.defaultConfig
    if (defaultVals) {
      configs[activePresetId] = { ...defaultVals }
    }
  }

  function copyTextToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      copyState = 'copied'
      if (copyTimeout) clearTimeout(copyTimeout)
      copyTimeout = window.setTimeout(() => {
        copyState = 'idle'
      }, 2000)
    })
  }

  function copyShareLink() {
    const url = window.location.href
    navigator.clipboard.writeText(url).then(() => {
      shareCopyState = 'copied'
      if (shareCopyTimeout) clearTimeout(shareCopyTimeout)
      shareCopyTimeout = window.setTimeout(() => {
        shareCopyState = 'idle'
      }, 2000)
    })
  }

  let chatFeedContainer = $state<HTMLElement | null>(null)

  function scrollToBottom() {
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        if (chatFeedContainer) {
          chatFeedContainer.scrollTop = chatFeedContainer.scrollHeight
        }
      }, 50)
    }
  }

  // Scroll to bottom when message list or loading state changes
  $effect(() => {
    if (chatMessages.length || aiLoading) {
      scrollToBottom()
    }
  })

  async function sendChatMessage(text: string) {
    if (!text.trim()) return
    
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    }
    
    chatMessages = [...chatMessages, userMsg]
    aiLoading = true
    aiError = ''
    showChat = true // Open chat drawer automatically
    
    try {
      const config: AIConfig = {
        provider: aiProvider,
        apiKey: aiApiKey,
        ollamaModel,
        ollamaUrl,
        cfModel,
        geminiModel
      }
      
      let activeCustomCode = customSvelteCode
      if (activePresetId === 'custom') {
        try {
          const res = await fetch('/__save-custom')
          const data = await res.json()
          if (data.code) {
            activeCustomCode = data.code
            customSvelteCode = data.code
          }
        } catch (e) {
          console.error('Failed to fetch latest custom code before sending message:', e)
        }
      }
      
      const response = await askAIDesigner(chatMessages, config, activePresetId, configs[activePresetId], communityPresets, activeCustomCode)
      
      if (response.presetId === 'custom') {
        const match = response.explanation.match(/```svelte\s*([\s\S]*?)\s*```/)
        if (match && match[1]) {
          const svelteCode = match[1]
          try {
            await fetch('/__save-custom', {
              method: 'POST',
              body: JSON.stringify({ code: svelteCode })
            })
            customSvelteCode = svelteCode
            showToastMessage('Custom background generated and applied!', 'success')
          } catch (e) {
            console.error('Failed to save custom component:', e)
          }
        }
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.explanation,
        presetId: response.presetId,
        config: response.config,
        timestamp: Date.now()
      }
      
      chatMessages = [...chatMessages, assistantMsg]
      
      // Load the generated preset/config
      activePresetId = response.presetId
      configs[response.presetId] = { ...configs[response.presetId], ...response.config }
      
      // Collapse settings/etc panel so user can see background
      islandMode = 'collapsed'
      
    } catch (err: any) {
      aiError = err.message || 'Error generating background'
      
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: err.message || 'Failed to design. Please check your model key or settings.',
        timestamp: Date.now(),
        isError: true
      }
      
      chatMessages = [...chatMessages, errorMsg]
    } finally {
      aiLoading = false
    }
  }

  async function handleAiSubmit(e: SubmitEvent) {
    e.preventDefault()
    if (!aiPrompt.trim()) return
    const text = aiPrompt
    aiPrompt = ''
    await sendChatMessage(text)
  }

  function clearChatHistory() {
    chatMessages = []
    aiError = ''
  }

  function attachCurrentCanvasMessage() {
    const refMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: `Base the next modifications on this design (${activePreset.name}).`,
      presetId: activePresetId,
      config: JSON.parse(JSON.stringify(configs[activePresetId])),
      timestamp: Date.now()
    }
    chatMessages = [...chatMessages, refMsg]
    showChat = true
    
    // Focus the chat input field
    setTimeout(() => {
      const input = document.getElementsByName('chatPrompt')[0] as HTMLInputElement;
      if (input) input.focus();
    }, 50);
  }

  function restoreChatMessagePreset(msg: ChatMessage) {
    if (msg.presetId && msg.config) {
      activePresetId = msg.presetId
      configs[msg.presetId] = { ...configs[msg.presetId], ...msg.config }
    }
  }

  function submitToGithubGallery() {
    const configStr = JSON.stringify({
      presetId: activePresetId,
      name: activePreset.name,
      config: activeConfig
    }, null, 2)
    
    const title = encodeURIComponent(`Gallery Submission: Custom ${activePreset.name}`)
    const body = encodeURIComponent(`### Custom Preset Configuration\n\`\`\`json\n${configStr}\n\`\`\`\n\n**Submitted By**: [Your Name/GitHub Handle]\n**Description**: [Describe your custom background aesthetic here!]`)
    
    const url = `https://github.com/${galleryRepo}/issues/new?title=${title}&body=${body}`
    window.open(url, '_blank')
  }

  function updateGithubAvatar() {
    const username = githubUsername.trim()
    if (username) {
      localStorage.setItem('studio-github-username', username)
      fetchUserRepos()
    } else {
      userRepos = []
      localStorage.removeItem('studio-github-username')
    }
    islandMode = 'collapsed'
  }

  function toggleMode(mode: typeof islandMode) {
    if (islandMode === mode) {
      islandMode = 'collapsed'
    } else {
      islandMode = mode
      showChat = false // Close chat when expanding other tools
    }
  }

  function triggerSavePreset() {
    savePresetName = `My ${activePreset.name}`
    showSaveModal = true
  }

  function handleSavePreset() {
    const trimmed = savePresetName.trim()
    if (!trimmed) return
    const newPreset: LocalPreset = {
      id: `local-${Date.now()}`,
      name: trimmed,
      basePresetId: activePresetId,
      config: JSON.parse(JSON.stringify(activeConfig)),
      timestamp: Date.now()
    }
    localPresets = [newPreset, ...localPresets]
    showSaveModal = false
  }

  function loadLocalPreset(preset: LocalPreset) {
    activePresetId = preset.basePresetId
    configs[preset.basePresetId] = { ...configs[preset.basePresetId], ...preset.config }
  }

  function deleteLocalPreset(id: string) {
    localPresets = localPresets.filter(p => p.id !== id)
  }

  // --- Code Generation Helpers ---
  let generatedSvelteUseCode = $derived(generateSvelteUseCode(activePresetId, activeConfig, theme))
  let activeComponentSource = $derived(activePresetId === 'custom' ? customSvelteCode : (componentSources[activePresetId] || ''))
</script>

<div class="flex h-dvh w-screen overflow-hidden bg-[var(--bg-studio)] text-[var(--text-primary)] transition-colors duration-500 relative">
  
  <!-- VIEWPORT CONTAINER -->
  <div class="relative flex-1 flex items-center justify-center overflow-hidden transition-all duration-300 z-0">
    
    <!-- Render Container -->
    <div class="absolute inset-0 w-screen h-screen z-0">
      <!-- Background Render Target -->
      {#if activePresetId === 'dotfield'}
        <DotField {...activeConfig} />
      {:else if activePresetId === 'constellation'}
        <Constellation {...activeConfig} />
      {:else if activePresetId === 'flowfield'}
        <FlowField {...activeConfig} />
      {:else if activePresetId === 'aurora'}
        <Aurora {...activeConfig} />
      {:else if activePresetId === 'jellyfish'}
        <Jellyfish {...activeConfig} />
      {:else if activePresetId === 'matrix'}
        <MatrixRain {...activeConfig} />
      {:else if activePresetId === 'nebula'}
        <Nebula {...activeConfig} />
      {:else if activePresetId === 'hexgrid'}
        <HexGrid {...activeConfig} />
      {:else if activePresetId === 'fireflies'}
        <Fireflies {...activeConfig} />
      {:else if activePresetId === 'synthwave'}
        <Synthwave {...activeConfig} />
      {:else if activePresetId === 'voronoi'}
        <Voronoi {...activeConfig} />
      {:else if activePresetId === 'custom'}
        <CustomGenerated {...activeConfig} theme={theme} />
      {/if}

      <!-- Interactive Instructions Sheet Overlay -->
      {#if showOverlay}
        <div 
          class="relative z-10 max-w-lg w-full p-6 md:p-8 rounded-2xl border border-neutral-200/20 dark:border-white/10 bg-white/75 dark:bg-neutral-900/80 backdrop-blur-xl shadow-2xl text-left mx-4 transition-all duration-300 pointer-events-auto max-h-[85vh] overflow-y-auto"
          transition:scale={{ duration: 200, start: 0.95 }}
        >
          <button 
            class="absolute top-4 right-4 p-2 rounded-full hover:bg-neutral-900/10 dark:hover:bg-white/10 text-neutral-800 dark:text-neutral-300 transition-colors cursor-pointer flex items-center justify-center"
            onclick={() => showOverlay = false}
            aria-label="Close instructions"
          >
            <X size={16} />
          </button>
          
          <div class="flex items-center gap-3 mb-6 select-none">
            <div class="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 dark:text-blue-400">
              <CircleQuestionMark size={24} />
            </div>
            <div>
              <h2 class="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Studio Guide</h2>
              <p class="text-xs text-neutral-600 dark:text-neutral-400">Master the interactive generative backgrounds</p>
            </div>
          </div>

          <div class="space-y-6 text-sm text-neutral-800 dark:text-neutral-300 leading-relaxed">
            <div>
              <h3 class="font-semibold text-neutral-950 dark:text-white mb-1.5 flex items-center gap-1.5 select-none">
                <Sparkles size={16} class="text-yellow-500" />
                AI Design Partner
              </h3>
              <p class="text-xs text-neutral-600 dark:text-neutral-400">
                Interact with the built-in local or remote models (e.g. Gemma 4, Gemini) to craft custom shaders. Describe your design prompts in the chat box, attach your active design to steer modifications, or use preset options.
              </p>
            </div>

            <div>
              <h3 class="font-semibold text-neutral-950 dark:text-white mb-1.5 flex items-center gap-1.5 select-none">
                <Sliders size={16} class="text-blue-500" />
                Manual Controls & Variables
              </h3>
              <p class="text-xs text-neutral-600 dark:text-neutral-400 mb-2">
                Click the morphing island at the bottom to expand options:
              </p>
              <ul class="list-disc pl-5 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                <li><strong>Presets:</strong> Choose between Dotfield, Constellation, Flowfield, Voronoi, Nebula, Synthwave, and more.</li>
                <li><strong>Variables:</strong> Adjust particle counts, speeds, trail fades, sizes, opacities, and hex color codes.</li>
                <li><strong>Viewport:</strong> Toggle between Desktop full-screen preview and Mobile device simulator (top-right).</li>
              </ul>
            </div>

            <div>
              <h3 class="font-semibold text-neutral-950 dark:text-white mb-1.5 flex items-center gap-1.5 select-none">
                <Code size={16} class="text-emerald-500" />
                Developer Integration & Export
              </h3>
              <p class="text-xs text-neutral-600 dark:text-neutral-400">
                Once satisfied with your design, use the <strong>Export Svelte Code</strong> feature in the bottom island to copy a fully-functioning, responsive standalone background component ready for your project.
              </p>
            </div>

            <div class="pt-4 border-t border-neutral-200/50 dark:border-white/10 flex justify-end">
              <button 
                class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md hover:shadow-blue-500/20 active:scale-95 cursor-pointer"
                onclick={() => showOverlay = false}
              >
                Start Designing
              </button>
            </div>
          </div>
        </div>
      {/if}


    </div>
  </div>

  <!-- TOP RIGHT ACTION BAR -->
  <div class="fixed top-4 right-4 z-35 flex gap-2 pointer-events-auto">
    <!-- Code Panel Toggle -->
    <button 
      class="p-2.5 rounded-full bg-white/20 dark:bg-black/35 backdrop-blur-md border border-white/10 dark:border-white/5 text-neutral-800 dark:text-neutral-200 hover:bg-white/30 dark:hover:bg-black/50 transition-all cursor-pointer flex items-center justify-center shadow-lg {showCodePanel ? 'bg-blue-600/20 text-blue-500 border-blue-500/30' : ''}"
      onclick={() => showCodePanel = !showCodePanel}
      title={showCodePanel ? "Hide Code" : "Show Code"}
    >
      <Code size={14} />
    </button>

    <!-- Theme Toggle -->
    <button 
      class="p-2.5 rounded-full bg-white/20 dark:bg-black/35 backdrop-blur-md border border-white/10 dark:border-white/5 text-neutral-800 dark:text-neutral-200 hover:bg-white/30 dark:hover:bg-black/50 transition-all cursor-pointer flex items-center justify-center shadow-lg"
      onclick={toggleTheme}
      title="Toggle Theme"
    >
      {#if theme === 'dark'}
        <Sun size={14} />
      {:else}
        <Moon size={14} />
      {/if}
    </button>

    <!-- GitHub Link -->
    <a 
      href="https://github.com/adriancmurray/dynamic-background-studio" 
      target="_blank" 
      rel="noreferrer"
      class="p-2.5 rounded-full bg-white/20 dark:bg-black/35 backdrop-blur-md border border-white/10 dark:border-white/5 text-neutral-800 dark:text-neutral-200 hover:bg-white/30 dark:hover:bg-black/50 transition-all cursor-pointer flex items-center justify-center shadow-lg"
      title="GitHub Repo"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.1" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>
    </a>
  </div>

  <!-- FLOATING IMAGES / LOGO DETAILS (Top Left) -->
  <div class="fixed top-4 left-4 z-20 flex items-center gap-2.5 pointer-events-none select-none">
    <div class="p-1.5 rounded-lg bg-blue-600 text-white shadow-lg pointer-events-auto">
      <Layers size={16} />
    </div>
    <span class="font-semibold text-sm tracking-tight text-neutral-900 dark:text-white drop-shadow-sm pointer-events-auto">
      Background Studio
    </span>
  </div>

  <!-- Floating AI Chat Feed (Anchored above the bottom Command Center) -->
  {#if showChat}
    <div 
      bind:this={chatFeedContainer}
      class="fixed left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-2xl overflow-y-auto scrollbar-none pointer-events-auto flex flex-col gap-4 p-4 select-text transition-[bottom,max-height] duration-300"
      style="bottom: {commandCenterHeight + 20}px; max-height: calc(100vh - {commandCenterHeight + 32}px);"
      transition:fly={{ y: 20, duration: 250 }}
    >
      {#if chatMessages.length === 0}
        <div class="mx-auto my-auto p-6 rounded-3xl bg-white/40 dark:bg-black/35 backdrop-blur-xl border border-neutral-200/35 dark:border-white/10 shadow-lg flex flex-col items-center justify-center text-center max-w-sm pointer-events-auto transition-all duration-300">
          <div class="p-3 rounded-full bg-neutral-100/50 dark:bg-neutral-900/50 mb-2.5 text-neutral-500 dark:text-neutral-400">
            <MessageSquare size={20} />
          </div>
          <p class="text-xs font-bold text-neutral-800 dark:text-neutral-200 tracking-wide">AI Design Partner</p>
          <p class="text-[10.5px] text-neutral-600 dark:text-neutral-400 max-w-[220px] mt-1.5 leading-normal mb-4">
            Describe your dream aesthetic, or customize your existing canvas with AI!
          </p>
          
          <div class="flex flex-col gap-2 w-full max-w-[250px]">
            <button 
              class="px-3.5 py-2 text-[10px] font-bold text-left rounded-xl border border-neutral-200/50 dark:border-white/10 hover:bg-neutral-900/10 dark:hover:bg-white/10 text-neutral-800 dark:text-neutral-200 transition-all cursor-pointer flex items-center gap-2 bg-white/50 dark:bg-white/5 shadow-sm"
              onclick={() => {
                const input = document.getElementsByName('chatPrompt')[0] as HTMLInputElement;
                if (input) input.focus();
              }}
            >
              <span>✨</span>
              <span>Create new design from scratch</span>
            </button>
            <button 
              class="px-3.5 py-2 text-[10px] font-bold text-left rounded-xl border border-neutral-200/50 dark:border-white/10 hover:bg-neutral-900/10 dark:hover:bg-white/10 text-neutral-800 dark:text-neutral-200 transition-all cursor-pointer flex items-center gap-2 bg-white/50 dark:bg-white/5 shadow-sm"
              onclick={attachCurrentCanvasMessage}
            >
              <span>✏️</span>
              <span>Modify current background</span>
            </button>
          </div>
        </div>
      {:else}
        {#each chatMessages as msg (msg.id)}
          <div 
            class="flex flex-col gap-1 {msg.role === 'user' ? 'items-end' : 'items-start'} pointer-events-none"
            transition:fly={{ y: 15, duration: 250 }}
          >
            <!-- Bubble -->
            {#if msg.role === 'user' && msg.config}
              <div 
                class="max-w-[85%] px-3.5 py-2 rounded-2xl text-xs leading-normal relative transition-all duration-300 bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-tr-none flex items-center gap-2 shadow-sm font-sans backdrop-blur-sm pointer-events-auto hover:bg-blue-500/15 dark:hover:bg-blue-500/25"
              >
                <Layers size={11} />
                <span>Referencing active <strong class="capitalize font-mono font-bold">{msg.presetId}</strong> design</span>
              </div>
            {:else}
              <div 
                class="max-w-[85%] px-4 py-2.5 rounded-2xl text-xs leading-normal relative transition-all duration-300 pointer-events-auto select-text whitespace-pre-wrap
                  {msg.role === 'user' 
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-500/90 dark:to-blue-650/90 text-white rounded-tr-none shadow-md shadow-blue-500/5 border border-blue-500/15' 
                    : msg.isError 
                      ? 'bg-red-500/10 dark:bg-red-500/15 backdrop-blur-md border border-red-500/30 dark:border-red-500/25 text-red-600 dark:text-red-400 rounded-tl-none shadow-sm shadow-red-500/5'
                      : 'bg-white/85 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200/50 dark:border-white/10 text-neutral-900 dark:text-neutral-100 rounded-tl-none shadow-md shadow-black/5 hover:bg-white/90 dark:hover:bg-neutral-900/65'}"
              >
                {#if msg.isError}
                  <div class="flex items-start gap-1.5 markdown-content">
                    <span class="mt-0.5">⚠️</span>
                    <span>{msg.content}</span>
                  </div>
                {:else}
                  <div class="markdown-content">
                    {@html parseMarkdown(msg.content)}
                  </div>
                {/if}
              </div>
            {/if}

            <!-- Restore Action Card (if assistant message has preset configs) -->
            {#if msg.role === 'assistant' && msg.presetId && msg.config}
              <div 
                class="w-full max-w-[85%] mt-1.5 p-2.5 rounded-xl bg-white/75 dark:bg-neutral-900/50 backdrop-blur-md border border-neutral-200/40 dark:border-white/5 flex items-center justify-between gap-3 text-[10px] pointer-events-auto shadow-md"
                transition:fade
              >
                <div class="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                  <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse"></div>
                  <span class="font-bold capitalize truncate max-w-[100px]">{msg.presetId}</span>
                </div>
                <button 
                  class="px-2.5 py-1 rounded bg-neutral-900/5 dark:bg-white/5 hover:bg-neutral-900/10 dark:hover:bg-white/10 hover:text-neutral-900 dark:hover:text-white transition-all text-neutral-500 font-semibold flex items-center gap-1 cursor-pointer border border-neutral-200/40 dark:border-white/5 shadow-sm"
                  onclick={() => restoreChatMessagePreset(msg)}
                  title="Apply this exact design state"
                >
                  <RotateCcw size={10} />
                  <span>Restore Design</span>
                </button>
              </div>
            {/if}

            <!-- Timestamp -->
            <span class="text-[9px] text-neutral-500 dark:text-neutral-400 px-2 font-mono select-none">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        {/each}
      {/if}

      <!-- Typing indicator -->
      {#if aiLoading}
        <div class="flex flex-col gap-1 items-start pointer-events-none" transition:fade>
          <div class="px-4 py-3 rounded-2xl rounded-tl-none bg-white/85 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200/50 dark:border-white/10 flex items-center gap-1 shadow-md pointer-events-auto">
            <span class="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style="animation-delay: 0ms"></span>
            <span class="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style="animation-delay: 150ms"></span>
            <span class="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style="animation-delay: 300ms"></span>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- FLOATING MORPHING COMMAND CENTER -->
  <div 
    bind:clientHeight={commandCenterHeight}
    class="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-2xl bg-white/70 dark:bg-black/35 backdrop-blur-2xl border border-white/15 dark:border-white/5 rounded-3xl shadow-2xl pointer-events-auto flex flex-col overflow-hidden transition-[transform,background-color,border-color,box-shadow] duration-500 ease-out"
    style="transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);"
  >
    <!-- 1. Expanded Panel Content -->
    {#if islandMode !== 'collapsed'}
      <div 
        class="p-5 border-b border-white/10 dark:border-white/5 overflow-y-auto max-h-[50vh] transition-all duration-300"
        transition:slide={{ duration: 320 }}
      >
        <!-- PRESETS GRID -->
        {#if islandMode === 'presets'}
          <div class="space-y-4">
            <!-- Search bar -->
            <div class="relative">
              <span class="absolute inset-y-0 left-3 flex items-center text-neutral-500 pointer-events-none">
                <Search size={13} />
              </span>
              <input 
                type="text"
                placeholder="Search presets, styles, creators..."
                bind:value={presetsQuery}
                class="w-full pl-8 pr-8 py-1.5 text-xs bg-neutral-900/5 dark:bg-white/5 border border-white/10 rounded-xl text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-blue-500 select-text cursor-text"
              />
              {#if presetsQuery}
                <button 
                  class="absolute inset-y-0 right-3 flex items-center text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer"
                  onclick={() => presetsQuery = ''}
                >
                  <X size={11} />
                </button>
              {/if}
            </div>

            <div class="space-y-4 max-h-[35vh] overflow-y-auto pr-1">
              <!-- My Saved Presets -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <h2 class="text-[10px] font-semibold tracking-wider text-neutral-800 dark:text-neutral-300 uppercase font-mono">
                    My Saved Presets ({localPresets.length})
                  </h2>
                  {#if localPresets.length > 0}
                    <button 
                      class="text-[10px] text-blue-500 hover:underline cursor-pointer"
                      onclick={triggerSavePreset}
                    >
                      + Save Current
                    </button>
                  {/if}
                </div>

                {#if localPresets.length > 0}
                  <div class="grid grid-cols-2 gap-2">
                    {#each localPresets as preset}
                      <div class="relative group flex items-center">
                        <button 
                          class="w-full p-2.5 rounded-xl border text-left transition-all duration-200 cursor-pointer {activePresetId === preset.basePresetId && JSON.stringify(activeConfig) === JSON.stringify(preset.config) ? 'border-blue-500 bg-blue-500/5' : 'border-white/10 dark:border-white/5 bg-white/5 dark:bg-white/5 hover:border-neutral-500'} pr-8 truncate"
                          onclick={() => loadLocalPreset(preset)}
                          title="Load {preset.name}"
                        >
                          <h3 class="font-medium text-xs text-neutral-950 dark:text-white mb-0.5 truncate">
                            {preset.name}
                          </h3>
                          <p class="text-[8px] text-neutral-500 font-mono capitalize">
                            Base: {preset.basePresetId}
                          </p>
                        </button>
                        <!-- Delete button -->
                        <button 
                          class="absolute right-2 p-1.5 rounded hover:bg-red-500/10 text-neutral-400 hover:text-red-500 cursor-pointer transition-colors"
                          onclick={(e) => { e.stopPropagation(); deleteLocalPreset(preset.id); }}
                          title="Delete Preset"
                        >
                          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <div class="p-3 text-center border border-dashed border-white/10 rounded-xl bg-neutral-900/5 dark:bg-white/5">
                    <p class="text-[10px] text-neutral-500 mb-1.5">No saved designs yet.</p>
                    <button 
                      class="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-[9px] transition-all cursor-pointer shadow-sm"
                      onclick={triggerSavePreset}
                    >
                      Save Current Design
                    </button>
                  </div>
                {/if}
              </div>

              <!-- Core Presets -->
              <div class="space-y-2 border-t border-white/10 dark:border-white/5 pt-3">
                <h2 class="text-[10px] font-semibold tracking-wider text-neutral-800 dark:text-neutral-300 uppercase font-mono">
                  Core Templates ({filteredCorePresets.length})
                </h2>
                
                <div class="grid grid-cols-2 gap-2">
                  {#each filteredCorePresets as preset}
                    <button 
                      class="p-2.5 rounded-xl border text-left transition-all duration-200 cursor-pointer {activePresetId === preset.id ? 'border-blue-500 bg-blue-500/5' : 'border-white/10 dark:border-white/5 bg-white/5 dark:bg-white/5 hover:border-neutral-500'}"
                      onclick={() => { activePresetId = preset.id }}
                    >
                      <h3 class="font-medium text-xs text-neutral-950 dark:text-white mb-0.5 flex items-center justify-between">
                        <span>{preset.name}</span>
                        <span class="text-[8px] bg-neutral-900/10 dark:bg-white/10 px-1 py-0.2 rounded font-mono font-normal">Core</span>
                      </h3>
                      <p class="text-[9px] text-neutral-800 dark:text-neutral-400 leading-normal line-clamp-2">
                        {preset.description}
                      </p>
                    </button>
                  {/each}
                  {#if filteredCorePresets.length === 0}
                    <div class="col-span-2 text-center py-4 text-xs text-neutral-500">
                      No matching core templates.
                    </div>
                  {/if}
                </div>
              </div>

              <!-- Community Gallery -->
              <div class="space-y-2 border-t border-white/10 dark:border-white/5 pt-3">
                <div class="flex items-center justify-between">
                  <h2 class="text-[10px] font-semibold tracking-wider text-neutral-800 dark:text-neutral-300 uppercase font-mono">
                    Community Designs ({filteredCommunityPresets.length})
                  </h2>
                  <button 
                    class="p-1 rounded hover:bg-neutral-900/5 dark:hover:bg-white/5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-all cursor-pointer flex items-center justify-center"
                    onclick={loadGallery}
                    disabled={galleryLoading}
                    title="Refresh Gallery"
                  >
                    <RefreshCw size={10} class={galleryLoading ? 'animate-spin' : ''} />
                  </button>
                </div>

                {#if galleryLoading}
                  <div class="flex items-center justify-center py-6 gap-2 text-xs text-neutral-500">
                    <svg class="animate-spin h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Fetching community gallery...</span>
                  </div>
                {:else if galleryError}
                  <div class="text-center py-4 text-xs text-red-500 space-y-1">
                    <p>{galleryError}</p>
                    <button 
                      class="text-[10px] text-blue-500 hover:underline cursor-pointer"
                      onclick={loadGallery}
                    >
                      Retry
                    </button>
                  </div>
                {:else}
                  <div class="grid grid-cols-2 gap-2">
                    {#each filteredCommunityPresets as preset}
                      <button 
                        class="p-2.5 rounded-xl border text-left transition-all duration-200 cursor-pointer border-white/10 dark:border-white/5 bg-white/5 dark:bg-white/5 hover:border-neutral-500 flex flex-col justify-between"
                        onclick={() => {
                          activePresetId = preset.basePresetId
                          configs[preset.basePresetId] = { ...configs[preset.basePresetId], ...preset.config }
                        }}
                      >
                        <div>
                          <h3 class="font-medium text-xs text-neutral-950 dark:text-white mb-0.5 flex items-center justify-between">
                            <span class="truncate">{preset.name}</span>
                            <span class="text-[8px] bg-blue-500/10 dark:bg-blue-400/15 text-blue-500 px-1 py-0.2 rounded font-mono font-normal capitalize">{preset.basePresetId}</span>
                          </h3>
                          <p class="text-[9px] text-neutral-800 dark:text-neutral-400 leading-normal line-clamp-2 mb-2">
                            {preset.description}
                          </p>
                        </div>
                        <div class="flex items-center justify-between text-[8px] border-t border-white/5 pt-1.5 mt-1">
                          <span class="flex items-center gap-1 text-neutral-500 font-mono">
                            {#if preset.avatarUrl}
                              <img src={preset.avatarUrl} alt={preset.creator} class="w-3.5 h-3.5 rounded-full border border-white/5" />
                            {/if}
                            <span class="truncate">@{preset.creator}</span>
                          </span>
                          <a 
                            href={preset.issueUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            class="text-neutral-500 hover:text-blue-500 flex items-center gap-0.5 cursor-pointer"
                            onclick={(e) => e.stopPropagation()}
                          >
                            <span>Issue</span>
                            <ExternalLink size={8} />
                          </a>
                        </div>
                      </button>
                    {/each}
                    {#if filteredCommunityPresets.length === 0}
                      <div class="col-span-2 text-center py-4 text-xs text-neutral-500">
                        No community presets found.
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>

            <button 
              class="w-full py-2 px-4 rounded-xl border border-dashed border-white/10 hover:text-blue-500 hover:border-blue-500/50 transition-all flex items-center justify-center gap-2 cursor-pointer bg-neutral-900/5 dark:bg-white/5 text-xs text-neutral-800 dark:text-neutral-300"
              onclick={submitToGithubGallery}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>
              <span>Submit Design to GitHub Gallery</span>
            </button>
          </div>

        <!-- VARIABLES EDITOR -->
        {:else if islandMode === 'variables'}
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="text-xs font-semibold tracking-wider text-neutral-800 dark:text-neutral-300 uppercase font-mono">
                Adjust Settings: {activePreset.name}
              </h2>
              <div class="flex gap-2.5">
                <button 
                  class="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium hover:text-blue-500 transition-colors cursor-pointer"
                  onclick={triggerSavePreset}
                >
                  <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2" fill="none"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                  <span>Save Design</span>
                </button>
                <button 
                  class="flex items-center gap-1 text-[11px] text-neutral-800 dark:text-neutral-400 hover:text-blue-500 transition-colors cursor-pointer"
                  onclick={resetPresetConfig}
                >
                  <RotateCcw size={11} />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            <div class="space-y-3.5 max-h-[35vh] overflow-y-auto pr-1">
              {#each activePreset.controls as ctrl}
                <div class="space-y-1">
                  <div class="flex justify-between items-center text-xs">
                    <label for={ctrl.key} class="font-medium text-neutral-800 dark:text-neutral-300">
                      {ctrl.label}
                    </label>
                    {#if ctrl.type === 'slider'}
                      <span class="font-mono text-[10px] text-neutral-800 dark:text-neutral-400 bg-neutral-900/5 dark:bg-white/5 px-1.5 py-0.5 rounded">
                        {activeConfig[ctrl.key]}
                      </span>
                    {/if}
                  </div>

                  {#if ctrl.type === 'slider'}
                    <input 
                      id={ctrl.key}
                      type="range" 
                      min={ctrl.min} 
                      max={ctrl.max} 
                      step={ctrl.step} 
                      bind:value={configs[activePresetId][ctrl.key]}
                      class="w-full accent-blue-600 bg-neutral-900/10 dark:bg-white/10 h-1 rounded-lg cursor-pointer appearance-none animate-scale-in"
                    />
                  {:else if ctrl.type === 'toggle'}
                    <label class="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        id={ctrl.key}
                        type="checkbox" 
                        bind:checked={configs[activePresetId][ctrl.key]} 
                        class="sr-only peer"
                      />
                      <div class="w-9 h-5 bg-neutral-900/10 dark:bg-white/15 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  {:else if ctrl.type === 'color'}
                    <div class="flex items-center gap-2.5">
                      <input 
                        id={ctrl.key}
                        type="color" 
                        bind:value={configs[activePresetId][ctrl.key]}
                        class="w-7 h-7 rounded border border-white/10 bg-transparent cursor-pointer p-0 block"
                      />
                      <span class="font-mono text-xs uppercase text-neutral-800 dark:text-neutral-400">
                        {activeConfig[ctrl.key]}
                      </span>
                    </div>
                  {:else if ctrl.type === 'select'}
                    <select 
                      id={ctrl.key}
                      bind:value={configs[activePresetId][ctrl.key]}
                      class="w-full px-2.5 py-1.5 text-xs bg-neutral-900/5 dark:bg-white/5 border border-white/10 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      {#each ctrl.options || [] as opt}
                        <option value={opt.value}>{opt.label}</option>
                      {/each}
                    </select>
                  {:else if ctrl.type === 'text'}
                    <input 
                      id={ctrl.key}
                      type="text" 
                      bind:value={configs[activePresetId][ctrl.key]}
                      class="w-full px-2.5 py-1.5 text-xs bg-neutral-900/5 dark:bg-white/5 border border-white/10 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-text"
                    />
                  {/if}
                </div>
              {/each}
            </div>
          </div>

        <!-- CODE EXPORT -->
        {:else if islandMode === 'export'}
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <h2 class="text-xs font-semibold tracking-wider text-neutral-800 dark:text-neutral-300 uppercase font-mono">
                Get Svelte Code
              </h2>
              <button 
                class="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-[10px] transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                onclick={copyShareLink}
              >
                {#if shareCopyState === 'copied'}
                  <Check size={10} />
                  <span>Link Copied!</span>
                {:else}
                  <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2.1" fill="none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                  <span>Copy Shareable Link</span>
                {/if}
              </button>
            </div>
            
            <div class="flex p-1 rounded-lg bg-neutral-900/10 dark:bg-white/5 border border-white/10">
              <button 
                class="flex-1 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer {activeExportType === 'svelte-use' ? 'bg-blue-600 text-white' : 'text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white'}"
                onclick={() => activeExportType = 'svelte-use'}
              >
                Usage props
              </button>
              <button 
                class="flex-1 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer {activeExportType === 'svelte-source' ? 'bg-blue-600 text-white' : 'text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white'}"
                onclick={() => activeExportType = 'svelte-source'}
              >
                Source component
              </button>
            </div>

            <div class="relative rounded-xl border border-white/10 bg-black/40 dark:bg-black/60 overflow-hidden">
              <div class="flex justify-between items-center px-3 py-1.5 border-b border-white/10 bg-neutral-900/20 text-neutral-800 dark:text-neutral-400 text-[10px] font-mono select-none">
                <span>
                  {activeExportType === 'svelte-use' 
                    ? 'App.svelte' 
                    : `${activePreset.componentName}.svelte`}
                </span>
                <button 
                  class="flex items-center gap-1 hover:text-blue-500 transition-colors cursor-pointer"
                  onclick={() => copyTextToClipboard(activeExportType === 'svelte-use' ? generatedSvelteUseCode : activeComponentSource)}
                >
                  {#if copyState === 'copied'}
                    <Check size={11} class="text-emerald-500" />
                    <span class="text-emerald-500 font-medium">Copied!</span>
                  {:else}
                    <Copy size={11} />
                    <span>Copy</span>
                  {/if}
                </button>
              </div>
              
              <pre class="p-3 overflow-x-auto text-[10px] font-mono text-neutral-300 leading-relaxed max-h-[200px] select-all"><code>{activeExportType === 'svelte-use' ? generatedSvelteUseCode : activeComponentSource}</code></pre>
            </div>
          </div>

        <!-- AI CONFIG SETTINGS -->
        {:else if islandMode === 'settings'}
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <h2 class="text-xs font-semibold tracking-wider text-neutral-800 dark:text-neutral-300 uppercase font-mono">
                AI Designer Settings (Gemma 4)
              </h2>
            </div>

            <div class="space-y-3.5 text-xs text-left">
              <div class="flex flex-col gap-1">
                <span class="font-medium text-neutral-800 dark:text-neutral-300">Model Provider</span>
                <select 
                  bind:value={aiProvider}
                  class="px-2.5 py-1.5 bg-neutral-900/5 dark:bg-white/5 border border-white/10 rounded-lg text-neutral-900 dark:text-neutral-100 cursor-pointer"
                >
                  <option value="gemini">Google AI Studio (Gemma 4 / Gemini)</option>
                  <option value="ollama">Local Ollama API (gemma4)</option>
                  <option value="workers-ai">Cloudflare Workers AI (Serverless Edge)</option>
                </select>
              </div>

              {#if aiProvider === 'workers-ai'}
                <div class="flex flex-col gap-1">
                  <span class="font-medium text-neutral-800 dark:text-neutral-300">Workers AI Model</span>
                  <select 
                    bind:value={cfModel}
                    class="px-2.5 py-1.5 bg-neutral-900/5 dark:bg-white/5 border border-white/10 rounded-lg text-neutral-900 dark:text-neutral-100 cursor-pointer"
                  >
                    <option value="@cf/google/gemma-4-26b-a4b-it">Google Gemma 4 26B (Default - Intelligent & Fast)</option>
                    <option value="@cf/deepseek-ai/deepseek-r1-distill-qwen-32b">DeepSeek R1 (Qwen 32B Distill - Reasoning)</option>
                    <option value="@cf/meta/llama-3.3-70b-instruct-fp8-fast">Meta Llama 3.3 70B (High Capacity)</option>
                    <option value="@cf/meta/llama-3.1-8b-instruct-fp8">Meta Llama 3.1 8B (Fast / Low Latency)</option>
                  </select>
                  <span class="text-[10px] text-neutral-500">
                    Runs at the serverless edge via Cloudflare. Gemma 4 26B is recommended.
                  </span>
                </div>
              {/if}

              {#if aiProvider === 'gemini'}
                <div class="flex flex-col gap-2">
                  <div class="flex flex-col gap-1">
                    <span class="font-medium text-neutral-800 dark:text-neutral-300 flex justify-between">
                      <span>API Key</span>
                      <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" class="text-[10px] text-blue-500 hover:underline">Get Key</a>
                    </span>
                    <input 
                      type="password" 
                      placeholder="Google AI Studio Key"
                      bind:value={aiApiKey}
                      class="px-2.5 py-1.5 bg-neutral-900/5 dark:bg-white/5 border border-white/10 rounded-lg text-neutral-900 dark:text-neutral-100 select-text cursor-text"
                    />
                  </div>

                  <div class="flex flex-col gap-1">
                    <span class="font-medium text-neutral-800 dark:text-neutral-300">Gemini Model</span>
                    <select 
                      bind:value={geminiModel}
                      class="px-2.5 py-1.5 bg-neutral-900/5 dark:bg-white/5 border border-white/10 rounded-lg text-neutral-900 dark:text-neutral-100 cursor-pointer"
                    >
                      <option value="gemini-3.5-flash">Gemini 3.5 Flash (Default - Ultra Fast & Intelligent)</option>
                      <option value="gemini-3.5-pro">Gemini 3.5 Pro (Frontier Intelligence)</option>
                      <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (Low Latency)</option>
                      <option value="gemini-3.0-flash">Gemini 3.0 Flash</option>
                      <option value="gemini-3.0-pro">Gemini 3.0 Pro</option>
                      <option value="gemma-4-26b">Gemma 4 26B (MoE Reasoning)</option>
                      <option value="gemma-4-12b">Gemma 4 12B (On-device Multimodal)</option>
                      <option value="gemma-4-31b">Gemma 4 31B (Dense Enterprise)</option>
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Legacy)</option>
                    </select>
                  </div>

                  <span class="text-[10px] text-neutral-500">
                    🔒 Stored locally in your browser. API calls go directly to Google.
                  </span>
                </div>
              {/if}

              {#if aiProvider === 'ollama'}
                <div class="grid grid-cols-2 gap-2">
                  <div class="flex flex-col gap-1">
                    <span class="font-medium text-neutral-800 dark:text-neutral-300">Ollama URL</span>
                    <input 
                      type="text" 
                      bind:value={ollamaUrl}
                      class="px-2.5 py-1.5 bg-neutral-900/5 dark:bg-white/5 border border-white/10 rounded-lg text-neutral-900 dark:text-neutral-100 select-text cursor-text"
                    />
                  </div>
                  <div class="flex flex-col gap-1">
                    <span class="font-medium text-neutral-800 dark:text-neutral-300">Model Name</span>
                    <input 
                      type="text" 
                      bind:value={ollamaModel}
                      class="px-2.5 py-1.5 bg-neutral-900/5 dark:bg-white/5 border border-white/10 rounded-lg text-neutral-900 dark:text-neutral-100 select-text cursor-text"
                    />
                  </div>
                </div>
                <span class="text-[10px] text-neutral-500 block">
                  Ollama must be running. Run `ollama pull gemma4` locally first.
                </span>
              {/if}

              <!-- GitHub Gallery Repository Configuration -->
              <div class="flex flex-col gap-1.5 border-t border-white/10 dark:border-white/5 pt-3.5 mt-1.5">
                <span class="font-medium text-neutral-800 dark:text-neutral-300">GitHub Gallery Repository</span>
                
                {#if githubUsername}
                  {#if loadingRepos}
                    <div class="flex items-center gap-2 py-1.5 text-xs text-neutral-500 font-mono">
                      <svg class="animate-spin h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Fetching your repositories...</span>
                    </div>
                  {:else if userRepos.length > 0}
                    <select 
                      value={customRepoSelected ? 'custom' : (userRepos.includes(galleryRepo) ? galleryRepo : 'custom')}
                      onchange={(e) => {
                        const val = e.currentTarget.value
                        if (val === 'custom') {
                          customRepoSelected = true
                        } else {
                          customRepoSelected = false
                          galleryRepo = val
                          loadGallery()
                        }
                      }}
                      class="w-full px-2.5 py-1.5 bg-neutral-900/5 dark:bg-white/5 border border-white/10 rounded-lg text-neutral-900 dark:text-neutral-100 cursor-pointer text-xs"
                    >
                      <option value={galleryRepo}>{galleryRepo} (Selected)</option>
                      {#each userRepos.filter(r => r !== galleryRepo) as repo}
                        <option value={repo}>{repo}</option>
                      {/each}
                      <option value="custom">✍️ Enter Custom Repository...</option>
                    </select>
                  {/if}
                {/if}

                {#if showCustomRepoInput}
                  <div class="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="owner/repo (e.g. adrian/studio)"
                      bind:value={galleryRepo}
                      class="flex-1 px-2.5 py-1.5 bg-neutral-900/5 dark:bg-white/5 border border-white/10 rounded-lg text-neutral-900 dark:text-neutral-100 select-text cursor-text text-xs"
                    />
                    <button 
                      class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-all active:scale-95 cursor-pointer shadow-md"
                      onclick={() => {
                        customRepoSelected = false
                        loadGallery()
                      }}
                    >
                      Load
                    </button>
                  </div>
                {/if}
                
                <span class="text-[10px] text-neutral-500">
                  Loads user submissions from this repository's issues database.
                </span>
              </div>
            </div>
          </div>

        <!-- PROFILE CUSTOMIZATION -->
        {:else if islandMode === 'profile'}
          <div class="space-y-4">
            <h2 class="text-xs font-semibold tracking-wider text-neutral-800 dark:text-neutral-300 uppercase font-mono">
              Personalize Profile
            </h2>
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-full border border-white/10 overflow-hidden flex items-center justify-center bg-white/10 dark:bg-white/5 shadow-md">
                {#if githubAvatarUrl}
                  <img src={githubAvatarUrl} alt="Avatar" class="w-full h-full object-cover animate-scale-in" />
                {:else}
                  <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.8" fill="none" class="text-neutral-800 dark:text-neutral-300"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                {/if}
              </div>
              <div class="flex-1 space-y-2">
                <div class="flex flex-col gap-1.5 text-xs">
                  {#if !githubUsername}
                    <a 
                      href="/api/auth/github"
                      class="w-full py-2 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>
                      <span>Sign in with GitHub</span>
                    </a>
                    <div class="flex items-center gap-2 my-1 select-none">
                      <div class="flex-1 h-px bg-neutral-300/30 dark:bg-white/10"></div>
                      <span class="text-[9px] text-neutral-400 font-medium font-mono uppercase">or manual</span>
                      <div class="flex-1 h-px bg-neutral-300/30 dark:bg-white/10"></div>
                    </div>
                  {/if}

                  <span class="font-medium text-neutral-800 dark:text-neutral-300">GitHub Username</span>
                  <div class="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Username (e.g. octocat)"
                      bind:value={githubUsername}
                      class="flex-1 px-3 py-1.5 text-xs bg-neutral-900/5 dark:bg-white/5 border border-white/10 rounded-lg text-neutral-900 dark:text-neutral-100 select-text cursor-text focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {#if githubUsername}
                      <button 
                        class="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-xs transition-all active:scale-95 cursor-pointer shadow-md"
                        onclick={() => {
                          githubUsername = '';
                          updateGithubAvatar();
                        }}
                        title="Sign Out"
                      >
                        Sign Out
                      </button>
                    {:else}
                      <button 
                        class="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-all active:scale-95 cursor-pointer shadow-md"
                        onclick={updateGithubAvatar}
                      >
                        Apply
                      </button>
                    {/if}
                  </div>
                  {#if typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GIT_USERNAME && githubUsername !== import.meta.env.VITE_GIT_USERNAME}
                    <button 
                      type="button"
                      class="w-full text-center mt-2 px-3 py-1.5 rounded-lg border border-neutral-200/50 dark:border-white/10 hover:bg-neutral-900/10 dark:hover:bg-white/10 text-neutral-800 dark:text-neutral-200 text-xs font-semibold transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                      onclick={() => {
                        githubUsername = import.meta.env.VITE_GIT_USERNAME;
                        updateGithubAvatar();
                      }}
                    >
                      <span>👤</span>
                      <span>Autofill as {import.meta.env.VITE_GIT_USERNAME} (detected from local git)</span>
                    </button>
                  {/if}
                </div>
              </div>
            </div>
            <p class="text-[10px] text-neutral-500 leading-relaxed">
              Your public avatar is retrieved directly from GitHub and loaded automatically as you type. This avatar represents you in the Community Gallery if you submit custom backgrounds!
            </p>
          </div>
        {/if}
      </div>
    {/if}

    <!-- 2. Taller Unified Chat Input & Tool Bar -->
    <div class="p-3.5 flex flex-col gap-3 relative z-10 bg-white/20 dark:bg-black/25">
      
      <!-- Top Row: Input Field -->
      <form 
        onsubmit={handleAiSubmit}
        class="flex items-end gap-2.5"
      >
        <div class="flex items-center justify-center pl-0.5 pb-1.5">
          {#if githubAvatarUrl}
            <button 
              type="button"
              onclick={() => toggleMode('profile')}
              class="w-8 h-8 rounded-full overflow-hidden border border-white/10 shadow-sm transition-transform hover:scale-105 active:scale-95 flex-shrink-0 relative group"
              title="Profile Settings"
            >
              <img src={githubAvatarUrl} alt="Avatar" class="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
              {#if aiLoading}
                <div class="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                  <svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              {/if}
            </button>
          {:else}
            <div class="text-blue-500 flex items-center justify-center w-8 h-8">
              {#if aiLoading}
                <svg class="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              {:else}
                <button type="button" onclick={() => toggleMode('profile')} class="w-8 h-8 rounded-full border border-neutral-200/50 dark:border-white/10 hover:bg-neutral-900/5 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow-sm" title="Profile Settings">
                  <MessageSquare size={14} class="text-neutral-500 dark:text-neutral-400" />
                </button>
              {/if}
            </div>
          {/if}
        </div>
        
        <div class="relative flex-1 flex items-center bg-neutral-100 dark:bg-black/20 border border-neutral-200/50 dark:border-white/5 rounded-2xl shadow-inner transition-colors focus-within:border-blue-500/30 dark:focus-within:border-blue-500/30">
          <textarea 
            name="chatPrompt"
            placeholder={aiLoading ? "Gemma 4 is designing..." : "Ask AI to customize or design..."}
            bind:value={aiPrompt}
            disabled={aiLoading}
            rows="1"
            class="w-full bg-transparent text-sm text-neutral-900 dark:text-white placeholder-neutral-500 focus:outline-none focus:ring-0 select-text cursor-text disabled:opacity-50 resize-none max-h-32 overflow-y-auto py-3 pl-3 pr-10 rounded-2xl"
            onclick={() => { 
              if (islandMode === 'profile') islandMode = 'collapsed';
              showChat = true; // Auto-open chat feed when starting to type
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const form = e.currentTarget.closest('form');
                if (form) form.requestSubmit();
              }
            }}
            oninput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 128) + 'px';
            }}
          ></textarea>
          
          <div class="absolute right-1.5 bottom-1.5">
            <button 
              type="submit" 
              disabled={aiLoading || !aiPrompt.trim()}
              class="p-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-50 disabled:bg-neutral-400 dark:disabled:bg-neutral-700 flex items-center justify-center cursor-pointer shadow-sm"
              title="Send design request"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </form>

      <!-- Bottom Row: Controls & Quick Actions -->
      <div class="flex items-center justify-between gap-2 border-t border-neutral-200/20 dark:border-white/5 pt-2.5">
        
        <!-- Left: Action Group -->
        <div class="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-0.5 rounded-full border border-white/5 shadow-inner select-none">
          <!-- New Chat -->
          <button 
            type="button"
            class="p-2 rounded-full transition-all hover:scale-105 active:scale-90 cursor-pointer flex items-center justify-center text-neutral-800 dark:text-neutral-300 hover:bg-neutral-950/5 dark:hover:bg-white/10"
            onclick={clearChatHistory}
            title="Start New Chat"
          >
            <Plus size={14} />
          </button>

          <!-- Reference Canvas -->
          <button 
            type="button"
            disabled={aiLoading}
            class="p-2 rounded-full transition-all cursor-pointer flex items-center justify-center disabled:opacity-50
              {hasReferenceInHistory 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-neutral-800 dark:text-neutral-300 hover:bg-neutral-950/5 dark:hover:bg-white/10'}"
            onclick={attachCurrentCanvasMessage}
            title="Reference current canvas state"
          >
            <Layers size={14} />
          </button>

          <div class="w-px h-4 bg-neutral-300/30 dark:bg-white/10 mx-1"></div>

          <!-- Presets Grid Toggle -->
          <button 
            type="button"
            class="p-2 rounded-full transition-all hover:scale-105 active:scale-90 cursor-pointer flex items-center justify-center 
              {islandMode === 'presets' ? 'bg-blue-600 text-white shadow-md' : 'text-neutral-800 dark:text-neutral-300 hover:bg-neutral-950/5 dark:hover:bg-white/10'}"
            onclick={() => toggleMode('presets')}
            title="Presets Grid"
          >
            <Sparkles size={14} />
          </button>

          <!-- Variables Editor Toggle -->
          <button 
            type="button"
            class="p-2 rounded-full transition-all hover:scale-105 active:scale-90 cursor-pointer flex items-center justify-center 
              {islandMode === 'variables' ? 'bg-blue-600 text-white shadow-md' : 'text-neutral-800 dark:text-neutral-300 hover:bg-neutral-950/5 dark:hover:bg-white/10'}"
            onclick={() => toggleMode('variables')}
            title="Variables Editor"
          >
            <Sliders size={14} />
          </button>



          <!-- AI Configuration Toggle -->
          <button 
            type="button"
            class="p-2 rounded-full transition-all hover:scale-105 active:scale-90 cursor-pointer flex items-center justify-center 
              {islandMode === 'settings' ? 'bg-blue-600 text-white shadow-md' : 'text-neutral-800 dark:text-neutral-300 hover:bg-neutral-950/5 dark:hover:bg-white/10'}"
            onclick={() => toggleMode('settings')}
            title="AI Configuration"
          >
            <Settings size={14} />
          </button>

          <div class="w-px h-4 bg-neutral-300/30 dark:bg-white/10 mx-1"></div>

          <!-- Toggle Chat -->
          <button 
            type="button"
            class="p-2 rounded-full transition-all hover:scale-105 active:scale-90 cursor-pointer flex items-center justify-center 
              {showChat ? 'bg-blue-600 text-white shadow-md' : 'text-neutral-800 dark:text-neutral-300 hover:bg-neutral-950/5 dark:hover:bg-white/10'}"
            onclick={() => {
              showChat = !showChat;
              if (showChat) {
                islandMode = 'collapsed';
                setTimeout(() => {
                  const input = document.getElementsByName('chatPrompt')[0] as HTMLInputElement;
                  if (input) input.focus();
                }, 50);
              }
            }}
            title="Toggle Floating Chat Feed"
          >
            <MessageSquare size={14} />
          </button>


        </div>

        <!-- Right: Model Selector & Send Button -->
        <div class="flex items-center gap-2 select-none">
          <!-- Quick Model Dropdown -->
          <div class="relative flex items-center">
            {#if aiProvider === 'gemini'}
              <select 
                bind:value={geminiModel}
                class="appearance-none bg-black/5 dark:bg-white/5 border border-neutral-300/20 dark:border-white/5 rounded-xl pl-2.5 pr-6 py-1.5 text-[10px] font-mono text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white focus:outline-none transition-all cursor-pointer shadow-sm"
              >
                <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                <option value="gemini-3.5-pro">Gemini 3.5 Pro</option>
                <option value="gemini-3.1-flash-lite">Gemini 3.1 Lite</option>
                <option value="gemini-3.0-flash">Gemini 3.0 Flash</option>
                <option value="gemma-4-26b">Gemma 4 26B</option>
                <option value="gemma-4-12b">Gemma 4 12B</option>
              </select>
            {:else if aiProvider === 'workers-ai'}
              <select 
                bind:value={cfModel}
                class="appearance-none bg-black/5 dark:bg-white/5 border border-neutral-300/20 dark:border-white/5 rounded-xl pl-2.5 pr-6 py-1.5 text-[10px] font-mono text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white focus:outline-none transition-all cursor-pointer shadow-sm"
              >
                <option value="@cf/google/gemma-4-26b-a4b-it">Gemma 4 26B</option>
                <option value="@cf/deepseek-ai/deepseek-r1-distill-qwen-32b">DeepSeek R1</option>
                <option value="@cf/meta/llama-3.3-70b-instruct-fp8-fast">Llama 3.3</option>
                <option value="@cf/meta/llama-3.1-8b-instruct-fp8">Llama 3.1</option>
              </select>
            {:else}
              <span class="text-[10px] font-mono text-neutral-500 capitalize px-2">{aiProvider}</span>
            {/if}
            <!-- Caret Down Icon -->
            <div class="absolute inset-y-0 right-2 flex items-center pointer-events-none text-neutral-500">
              <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>


        </div>

      </div>
    </div>
  </div>

  <!-- Sliding Side Code Panel -->
  {#if showCodePanel}
    <div 
      class="fixed top-0 right-0 h-full w-[450px] max-w-[90vw] z-40 bg-neutral-900/95 dark:bg-black/95 backdrop-blur-2xl border-l border-neutral-200/20 dark:border-white/10 shadow-2xl flex flex-col text-left pointer-events-auto"
      transition:fly={{ x: 450, duration: 300, opacity: 1 }}
    >
      <!-- Header -->
      <div class="p-4 border-b border-neutral-200/20 dark:border-white/10 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Code size={16} class="text-blue-500" />
          <h3 class="text-xs font-bold text-neutral-800 dark:text-white capitalize">
            {activePresetId} Code
          </h3>
        </div>
        <button 
          class="p-1.5 rounded-full hover:bg-neutral-900/10 dark:hover:bg-white/10 text-neutral-500 dark:text-neutral-400 transition-colors cursor-pointer flex items-center justify-center"
          onclick={() => showCodePanel = false}
          aria-label="Close code panel"
        >
          <X size={16} />
        </button>
      </div>

      <!-- Mode Selector Tabs -->
      <div class="px-4 py-3 border-b border-neutral-200/20 dark:border-white/10 flex gap-2">
        <button 
          class="flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all cursor-pointer text-center
            {sideCodeType === 'svelte-source'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-white/5 dark:bg-white/5 border-neutral-200/20 dark:border-white/5 text-neutral-700 dark:text-neutral-300 hover:bg-white/10 dark:hover:bg-white/10'}"
          onclick={() => sideCodeType = 'svelte-source'}
        >
          Standalone Component
        </button>
        <button 
          class="flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all cursor-pointer text-center
            {sideCodeType === 'svelte-use'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-white/5 dark:bg-white/5 border-neutral-200/20 dark:border-white/5 text-neutral-700 dark:text-neutral-300 hover:bg-white/10 dark:hover:bg-white/10'}"
          onclick={() => sideCodeType = 'svelte-use'}
        >
          How to Use
        </button>
      </div>

      <!-- Code Viewer -->
      <div class="flex-1 overflow-hidden p-4 select-text relative">
        <!-- Copy Button overlay -->
        <div class="absolute right-6 top-6 z-10">
          <button 
            class="p-2 rounded-xl bg-neutral-900/80 dark:bg-black/80 backdrop-blur-md border border-neutral-200/20 dark:border-white/10 hover:bg-neutral-900 dark:hover:bg-black text-neutral-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
            onclick={() => copySideCodeText(sideCodeType === 'svelte-use' ? generatedSvelteUseCode : activeComponentSource)}
            title="Copy to clipboard"
          >
            {#if sideCodeCopyState === 'copied'}
              <Check size={12} class="text-emerald-500 animate-pulse" />
              <span class="text-[9px] font-bold text-emerald-400">Copied!</span>
            {:else}
              <Copy size={12} />
              <span class="text-[9px] font-bold">Copy</span>
            {/if}
          </button>
        </div>

        <pre class="w-full h-full overflow-auto p-3.5 rounded-xl bg-black/45 border border-neutral-200/15 dark:border-white/5 text-[10px] font-mono text-neutral-300 leading-relaxed select-all scrollbar-none"><code class="select-all">{sideCodeType === 'svelte-use' ? generatedSvelteUseCode : activeComponentSource}</code></pre>
      </div>
    </div>
  {/if}

  <!-- Save Preset Modal -->
  {#if showSaveModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all pointer-events-auto">
      <div class="w-full max-w-sm p-6 rounded-2xl border border-white/10 dark:border-white/5 bg-white dark:bg-neutral-900 shadow-2xl mx-4 animate-scale-in">
        <h3 class="text-base font-semibold text-neutral-950 dark:text-white mb-2">
          Save Custom Design
        </h3>
        <p class="text-xs text-neutral-500 leading-normal mb-4">
          Save your current background settings to your browser's local storage under a custom name.
        </p>
        
        <div class="space-y-3.5 mb-5">
          <div class="flex flex-col gap-1 text-xs">
            <span class="font-medium text-neutral-800 dark:text-neutral-300">Design Name</span>
            <input 
              type="text" 
              placeholder="e.g. My Hot Nebula"
              bind:value={savePresetName}
              class="w-full px-3 py-2 text-xs bg-neutral-900/5 dark:bg-white/5 border border-white/10 rounded-lg text-neutral-900 dark:text-neutral-100 select-text cursor-text focus:outline-none focus:ring-1 focus:ring-blue-500"
              onkeydown={(e) => { if (e.key === 'Enter') handleSavePreset() }}
            />
          </div>
        </div>

        <div class="flex gap-2.5 justify-end">
          <button 
            class="px-4 py-2 rounded-lg bg-neutral-900/5 hover:bg-neutral-900/10 dark:bg-white/5 dark:hover:bg-white/10 text-neutral-950 dark:text-white font-medium text-xs transition-all cursor-pointer"
            onclick={() => showSaveModal = false}
          >
            Cancel
          </button>
          <button 
            class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-all cursor-pointer shadow-md"
            onclick={handleSavePreset}
          >
            Save Design
          </button>
        </div>
      </div>
    </div>
  {/if}



</div>

<style>
  /* Hide scrollbar for Chrome, Safari and Opera */
  .scrollbar-none::-webkit-scrollbar {
    display: none;
  }
  /* Hide scrollbar for IE, Edge and Firefox */
  .scrollbar-none {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }

  /* Subtle CSS micro-animations */
  @keyframes scale-in {
    0% { transform: scale(0.92); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  .animate-scale-in {
    animation: scale-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
</style>
