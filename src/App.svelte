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

  // Import data definitions
  import { presetCatalog, type BackgroundPreset } from './lib/presetCatalog'
  import { componentSources } from './lib/componentSources'
  import { generateSvelteUseCode } from './lib/codeGenerator'
  import { askAIDesigner, type AIConfig, type ChatMessage } from './lib/aiDesigner'
  import { fetchCommunityGallery, type CommunityPreset } from './lib/galleryFetcher'

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

  let showOverlay = $state(true)
  let theme = $state<'dark' | 'light'>('dark')
  
  // Command Center Morph State
  let islandMode = $state<'collapsed' | 'presets' | 'variables' | 'export' | 'settings' | 'profile'>('collapsed')
  
  // Exporter panel sub-states
  let activeExportType = $state<'svelte-use' | 'svelte-source'>('svelte-use')
  let copyState = $state<'idle' | 'copied'>('idle')
  let copyTimeout = 0

  // Viewport mode: desktop (full screen), mobile simulator
  let viewportMode = $state<'desktop' | 'mobile'>('desktop')

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
  let showChat = $state(
    (typeof localStorage !== 'undefined' && localStorage.getItem('studio-show-chat') === 'true') || false
  )

  let githubUsername = $state(
    (typeof localStorage !== 'undefined' && localStorage.getItem('studio-github-username')) || ''
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
  $effect(() => { localStorage.setItem('studio-github-username', githubUsername) })
  $effect(() => { localStorage.setItem('studio-local-presets', JSON.stringify(localPresets)) })
  $effect(() => { localStorage.setItem('ai-gemini-model', geminiModel) })
  $effect(() => { localStorage.setItem('studio-chat-messages', JSON.stringify(chatMessages)) })
  $effect(() => { localStorage.setItem('studio-show-chat', showChat.toString()) })

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
      
      const response = await askAIDesigner(chatMessages, config, communityPresets)
      
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
  let activeComponentSource = $derived(componentSources[activePresetId] || '')
</script>

<div class="flex h-dvh w-screen overflow-hidden bg-[var(--bg-studio)] text-[var(--text-primary)] transition-colors duration-500 relative">
  
  <!-- VIEWPORT CONTAINER -->
  <div class="relative flex-1 flex items-center justify-center overflow-hidden transition-all duration-300 z-0">
    
    <!-- Render Container (Stretches full window in desktop mode or simulator frame in mobile) -->
    <div 
      class="transition-all duration-500 flex items-center justify-center {viewportMode === 'desktop' ? 'absolute inset-0 w-screen h-screen z-0' : 'relative h-[70vh] max-h-[700px] min-h-[500px] aspect-[9/18] w-auto rounded-[40px] border-[12px] border-neutral-900 dark:border-neutral-800/80 overflow-hidden shadow-2xl bg-black/5 dark:bg-white/5 z-10'}"
    >
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
      {/if}

      <!-- Interactive Playground Overlay -->
      {#if showOverlay}
        <div 
          class="relative z-10 max-w-md p-8 rounded-2xl border border-white/10 dark:border-white/5 bg-white/20 dark:bg-black/35 backdrop-blur-md shadow-lg text-center mx-4 transition-all duration-500 ease-out pointer-events-auto
            {islandMode !== 'collapsed' ? '-translate-y-24 md:-translate-y-36' : 'translate-y-0'}"
        >
          <button 
            class="absolute top-3 right-3 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-neutral-800 dark:text-neutral-300 transition-colors cursor-pointer"
            onclick={() => showOverlay = false}
          >
            <X size={14} />
          </button>
          <div class="inline-flex p-3 rounded-full bg-blue-500/10 text-blue-500 mb-4 animate-pulse">
            <Sparkles size={24} />
          </div>
          <h1 class="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-white mb-2">
            Dynamic Space
          </h1>
          <p class="text-sm text-neutral-800 dark:text-neutral-300 leading-relaxed mb-6">
            A beautiful Svelte background playground. Customize your canvas variables, prompt the built-in Gemma 4 agent, or copy the standalone code directly into your project.
          </p>
          <div class="flex gap-3 justify-center">
            <button 
              class="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-md active:scale-95 cursor-pointer"
              onclick={() => showOverlay = false}
            >
              Get Started
            </button>
            <button 
              class="px-5 py-2.5 rounded-lg bg-neutral-900/10 hover:bg-neutral-900/20 dark:bg-white/10 dark:hover:bg-white/20 text-neutral-950 dark:text-white font-medium text-sm transition-all active:scale-95 cursor-pointer"
              onclick={() => toggleMode('export')}
            >
              Copy Svelte Code
            </button>
          </div>
        </div>
      {/if}


    </div>
  </div>

  <!-- TOP RIGHT ACTION BAR -->
  <div class="fixed top-4 right-4 z-20 flex gap-2 pointer-events-auto">
    <!-- Overlay Toggle -->
    <button 
      class="p-2.5 rounded-full bg-white/20 dark:bg-black/35 backdrop-blur-md border border-white/10 dark:border-white/5 text-neutral-800 dark:text-neutral-200 hover:bg-white/30 dark:hover:bg-black/50 transition-all cursor-pointer flex items-center justify-center shadow-lg"
      onclick={() => showOverlay = !showOverlay}
      title={showOverlay ? "Hide Content Overlay" : "Show Content Overlay"}
    >
      {#if showOverlay}
        <EyeOff size={14} />
      {:else}
        <Eye size={14} />
      {/if}
    </button>

    <!-- Viewport Mode -->
    <div class="flex gap-1 p-1 rounded-full bg-white/20 dark:bg-black/35 backdrop-blur-md border border-white/10 dark:border-white/5 shadow-lg">
      <button 
        class="p-2 rounded-full transition-all cursor-pointer {viewportMode === 'desktop' ? 'bg-blue-600 text-white shadow' : 'text-neutral-800 dark:text-neutral-200 hover:bg-neutral-950/5 dark:hover:bg-white/5'}"
        onclick={() => viewportMode = 'desktop'}
        title="Desktop Mode"
      >
        <Monitor size={14} />
      </button>
      <button 
        class="p-2 rounded-full transition-all cursor-pointer {viewportMode === 'mobile' ? 'bg-blue-600 text-white shadow' : 'text-neutral-800 dark:text-neutral-200 hover:bg-neutral-950/5 dark:hover:bg-white/5'}"
        onclick={() => viewportMode = 'mobile'}
        title="Mobile Mode"
      >
        <Smartphone size={14} />
      </button>
    </div>

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
      href="https://github.com/adrian/studio" 
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

  <!-- FLOATING MORPHING COMMAND CENTER -->
  <div 
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
                <div class="flex flex-col gap-1 text-xs">
                  <span class="font-medium text-neutral-800 dark:text-neutral-300">GitHub Username</span>
                  <div class="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Username (e.g. octocat)"
                      bind:value={githubUsername}
                      class="flex-1 px-3 py-1.5 text-xs bg-neutral-900/5 dark:bg-white/5 border border-white/10 rounded-lg text-neutral-900 dark:text-neutral-100 select-text cursor-text focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button 
                      class="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-all active:scale-95 cursor-pointer shadow-md"
                      onclick={updateGithubAvatar}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <p class="text-[10px] text-neutral-500 leading-relaxed">
              Your public avatar is retrieved directly from GitHub. This avatar will represent you in the Community Gallery if you submit your custom backgrounds!
            </p>
          </div>
        {/if}
      </div>
    {/if}

    <!-- 2. Bottom Navigation / Input Pill Bar -->
    <div class="px-4 py-3 flex items-center justify-between gap-3 h-14 select-none relative z-10 bg-white/20 dark:bg-black/25">
      <!-- Left Side: User Avatar -->
      <button 
        class="relative w-8 h-8 rounded-full border border-white/10 overflow-hidden flex items-center justify-center bg-white/15 dark:bg-white/5 transition-all hover:scale-105 active:scale-90 cursor-pointer shadow-sm"
        onclick={() => toggleMode('profile')}
        title="Profile Avatar"
      >
        {#if githubAvatarUrl}
          <img src={githubAvatarUrl} alt="Avatar" class="w-full h-full object-cover animate-scale-in" />
        {:else}
          <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" class="text-neutral-800 dark:text-neutral-300"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        {/if}
      </button>

      <!-- Middle: AI Prompt Bar -->
      <form 
        onsubmit={handleAiSubmit}
        class="flex-1 flex items-center gap-2"
      >
        <div class="text-blue-500 flex items-center justify-center">
          {#if aiLoading}
            <svg class="animate-spin h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          {:else}
            <Sparkles size={15} />
          {/if}
        </div>
        
        <input 
          type="text"
          placeholder={aiLoading ? "Gemma 4 is designing..." : "Ask AI to customize or design..."}
          bind:value={aiPrompt}
          disabled={aiLoading}
          class="w-full bg-transparent text-sm text-neutral-900 dark:text-white placeholder-neutral-500 focus:outline-none focus:ring-0 select-text cursor-text disabled:opacity-50"
          onclick={() => { if (islandMode === 'profile') islandMode = 'collapsed' }}
        />
      </form>

      <!-- Right Side: Dock Controls -->
      <div class="flex items-center gap-0.5 bg-black/5 dark:bg-white/5 p-0.5 rounded-full border border-white/5 shadow-inner">
        <button 
          class="p-2 rounded-full transition-all hover:scale-105 active:scale-90 cursor-pointer flex items-center justify-center {islandMode === 'presets' ? 'bg-blue-600 text-white shadow-md' : 'text-neutral-800 dark:text-neutral-300 hover:bg-neutral-950/5 dark:hover:bg-white/10'}"
          onclick={() => toggleMode('presets')}
          title="Presets Grid"
        >
          <Sparkles size={14} />
        </button>
        <button 
          class="p-2 rounded-full transition-all hover:scale-105 active:scale-90 cursor-pointer flex items-center justify-center {islandMode === 'variables' ? 'bg-blue-600 text-white shadow-md' : 'text-neutral-800 dark:text-neutral-300 hover:bg-neutral-950/5 dark:hover:bg-white/10'}"
          onclick={() => toggleMode('variables')}
          title="Variables Editor"
        >
          <Sliders size={14} />
        </button>
        <button 
          class="p-2 rounded-full transition-all hover:scale-105 active:scale-90 cursor-pointer flex items-center justify-center {islandMode === 'export' ? 'bg-blue-600 text-white shadow-md' : 'text-neutral-800 dark:text-neutral-300 hover:bg-neutral-950/5 dark:hover:bg-white/10'}"
          onclick={() => toggleMode('export')}
          title="Code Exporter"
        >
          <Code size={14} />
        </button>
        <button 
          class="p-2 rounded-full transition-all hover:scale-105 active:scale-90 cursor-pointer flex items-center justify-center {islandMode === 'settings' ? 'bg-blue-600 text-white shadow-md' : 'text-neutral-800 dark:text-neutral-300 hover:bg-neutral-950/5 dark:hover:bg-white/10'}"
          onclick={() => toggleMode('settings')}
          title="AI Configuration"
        >
          <Settings size={14} />
        </button>
        <button 
          class="p-2 rounded-full transition-all hover:scale-105 active:scale-90 cursor-pointer flex items-center justify-center {showChat ? 'bg-blue-600 text-white shadow-md' : 'text-neutral-800 dark:text-neutral-300 hover:bg-neutral-950/5 dark:hover:bg-white/10'}"
          onclick={() => showChat = !showChat}
          title="Toggle Chat Drawer"
        >
          <MessageSquare size={14} />
        </button>
      </div>
    </div>
  </div>

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

  <!-- AI Chat Drawer -->
  {#if showChat}
    <div 
      class="absolute inset-y-0 left-0 z-40 w-[380px] max-w-full bg-white/70 dark:bg-black/55 backdrop-blur-3xl border-r border-neutral-200/50 dark:border-white/10 flex flex-col shadow-2xl overflow-hidden transition-all duration-300 animate-scale-in"
      transition:fly={{ x: -380, duration: 300 }}
    >
      <!-- Chat Header -->
      <div class="px-4 py-3 border-b border-neutral-200/50 dark:border-white/10 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
        <div class="flex items-center gap-2">
          <div class="p-1 rounded-lg bg-blue-600 text-white flex items-center justify-center">
            <MessageSquare size={13} />
          </div>
          <span class="font-semibold text-xs text-neutral-900 dark:text-white uppercase tracking-wider font-mono">
            AI Design Partner
          </span>
        </div>
        <div class="flex items-center gap-1">
          {#if chatMessages.length > 0}
            <button 
              class="p-1.5 rounded-lg text-neutral-500 hover:text-red-500 hover:bg-neutral-900/5 dark:hover:bg-white/5 transition-all cursor-pointer flex items-center justify-center"
              onclick={clearChatHistory}
              title="Clear Chat History"
            >
              <Trash2 size={13} />
            </button>
          {/if}
          <button 
            class="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 dark:hover:text-white hover:bg-neutral-900/5 dark:hover:bg-white/5 transition-all cursor-pointer flex items-center justify-center"
            onclick={() => showChat = false}
            title="Hide Chat"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <!-- Chat Messages Feed -->
      <div 
        bind:this={chatFeedContainer}
        class="flex-1 overflow-y-auto p-4 space-y-3.5 select-text"
      >
        {#if chatMessages.length === 0}
          <div class="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500">
            <div class="p-3.5 rounded-full bg-neutral-100 dark:bg-neutral-900 mb-3 text-neutral-400">
              <MessageSquare size={24} />
            </div>
            <p class="text-xs font-medium text-neutral-800 dark:text-neutral-300">Start a conversation</p>
            <p class="text-[10px] max-w-[200px] mt-1 leading-normal">
              Ask the AI to design a background, customize colors, speed, or mix existing components!
            </p>
          </div>
        {:else}
          {#each chatMessages as msg (msg.id)}
            <div class="flex flex-col gap-1 {msg.role === 'user' ? 'items-end' : 'items-start'}">
              <!-- Bubble -->
              <div 
                class="max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-normal relative transition-all duration-300
                  {msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-sm' 
                    : msg.isError 
                      ? 'bg-red-500/10 dark:bg-red-500/15 border border-red-500/20 text-red-650 dark:text-red-400 rounded-tl-none'
                      : 'bg-neutral-100 dark:bg-white/5 border border-neutral-200/50 dark:border-white/5 text-neutral-800 dark:text-neutral-200 rounded-tl-none'}"
              >
                {#if msg.isError}
                  <div class="flex items-start gap-1.5">
                    <span class="mt-0.5">⚠️</span>
                    <span>{msg.content}</span>
                  </div>
                {:else}
                  {msg.content}
                {/if}
              </div>

              <!-- Restore Action Card (if assistant message has preset configs) -->
              {#if msg.role === 'assistant' && msg.presetId && msg.config}
                <div 
                  class="w-full max-w-[85%] mt-1.5 p-2 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200/30 dark:border-white/5 flex items-center justify-between gap-3 text-[10px]"
                  transition:fade
                >
                  <div class="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                    <div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <span class="font-medium capitalize truncate max-w-[100px]">{msg.presetId}</span>
                  </div>
                  <button 
                    class="px-2 py-1 rounded bg-neutral-900/5 dark:bg-white/5 hover:bg-neutral-900/10 dark:hover:bg-white/10 hover:text-neutral-900 dark:hover:text-white transition-all text-neutral-500 font-medium flex items-center gap-1 cursor-pointer"
                    onclick={() => restoreChatMessagePreset(msg)}
                    title="Apply this exact design state"
                  >
                    <RotateCcw size={10} />
                    <span>Restore Design</span>
                  </button>
                </div>
              {/if}

              <!-- Timestamp -->
              <span class="text-[9px] text-neutral-400 dark:text-neutral-600 px-1 font-mono">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          {/each}
        {/if}

        <!-- Typing indicator -->
        {#if aiLoading}
          <div class="flex flex-col gap-1 items-start" transition:fade>
            <div class="px-3.5 py-3 rounded-2xl rounded-tl-none bg-neutral-100 dark:bg-white/5 border border-neutral-200/50 dark:border-white/5 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style="animation-delay: 0ms"></span>
              <span class="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style="animation-delay: 150ms"></span>
              <span class="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style="animation-delay: 300ms"></span>
            </div>
          </div>
        {/if}
      </div>

      <!-- Chat Footer Input Area -->
      <div class="p-3 border-t border-neutral-200/50 dark:border-white/10 bg-neutral-50/50 dark:bg-neutral-900/50">
        <form 
          onsubmit={(e) => {
            e.preventDefault()
            const input = e.currentTarget.elements.namedItem('chatPrompt') as HTMLInputElement
            if (input && input.value.trim()) {
              sendChatMessage(input.value)
              input.value = ''
            }
          }}
          class="flex gap-2"
        >
          <input 
            name="chatPrompt"
            type="text" 
            placeholder="Type design request..."
            disabled={aiLoading}
            class="flex-1 px-3 py-2 text-xs bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 select-text cursor-text focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            autocomplete="off"
          />
          <button 
            type="submit" 
            disabled={aiLoading}
            class="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-50 disabled:bg-blue-600 flex items-center justify-center cursor-pointer shadow"
          >
            <Send size={12} />
          </button>
        </form>
      </div>
    </div>
  {/if}

</div>

<style>
  /* Subtle CSS micro-animations */
  @keyframes scale-in {
    0% { transform: scale(0.92); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  .animate-scale-in {
    animation: scale-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
</style>
