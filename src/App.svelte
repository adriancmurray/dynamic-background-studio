<script lang="ts">
  import { onMount } from 'svelte'
  import { slide, fade, scale } from 'svelte/transition'
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
  import { askAIDesigner, type AIConfig } from './lib/aiDesigner'
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
  
  let aiProvider = $state<'gemini' | 'ollama' | 'workers-ai'>('gemini')
  let aiApiKey = $state('')
  let ollamaModel = $state('gemma4')
  let ollamaUrl = $state('http://localhost:11434')

  let githubUsername = $state('')
  let githubAvatarUrl = $state('')

  // Gallery Repository and State
  let galleryRepo = $state('adriancmurray/dynamic-background-studio')
  let communityPresets = $state<CommunityPreset[]>([])
  let galleryLoading = $state(false)
  let galleryError = $state('')
  let presetsQuery = $state('')

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

    // Load AI settings
    const savedProvider = localStorage.getItem('ai-provider') as any
    if (savedProvider) aiProvider = savedProvider
    const savedKey = localStorage.getItem('ai-api-key')
    if (savedKey) aiApiKey = savedKey
    const savedModel = localStorage.getItem('ai-ollama-model')
    if (savedModel) ollamaModel = savedModel
    const savedUrl = localStorage.getItem('ai-ollama-url')
    if (savedUrl) ollamaUrl = savedUrl

    // Load Profile Settings
    const savedGithubUser = localStorage.getItem('studio-github-username')
    if (savedGithubUser) {
      githubUsername = savedGithubUser
      githubAvatarUrl = `https://github.com/${savedGithubUser}.png`
    }

    // Load Gallery Repository
    const savedGalleryRepo = localStorage.getItem('studio-gallery-repo')
    if (savedGalleryRepo) {
      galleryRepo = savedGalleryRepo
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
  $effect(() => { localStorage.setItem('studio-gallery-repo', galleryRepo) })

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

  async function handleAiSubmit(e: SubmitEvent) {
    e.preventDefault()
    if (!aiPrompt.trim()) return
    aiLoading = true
    aiError = ''
    try {
      const config: AIConfig = {
        provider: aiProvider,
        apiKey: aiApiKey,
        ollamaModel,
        ollamaUrl
      }
      const response = await askAIDesigner(aiPrompt, config, communityPresets)
      activePresetId = response.presetId
      configs[response.presetId] = { ...configs[response.presetId], ...response.config }
      aiPrompt = ''
      islandMode = 'collapsed' // Return to collapsed on success
    } catch (err: any) {
      aiError = err.message || 'Error generating background'
    } finally {
      aiLoading = false
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
      githubAvatarUrl = `https://github.com/${username}.png`
      localStorage.setItem('studio-github-username', username)
    } else {
      githubAvatarUrl = ''
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
              <!-- Core Presets -->
              <div class="space-y-2">
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
              <button 
                class="flex items-center gap-1 text-[11px] text-neutral-800 dark:text-neutral-400 hover:text-blue-500 transition-colors cursor-pointer"
                onclick={resetPresetConfig}
              >
                <RotateCcw size={11} />
                <span>Reset</span>
              </button>
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
            <h2 class="text-xs font-semibold tracking-wider text-neutral-800 dark:text-neutral-300 uppercase font-mono">
              Get Svelte Code
            </h2>
            
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

              {#if aiProvider === 'gemini'}
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
                <div class="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="owner/repo (e.g. adrian/studio)"
                    bind:value={galleryRepo}
                    class="flex-1 px-2.5 py-1.5 bg-neutral-900/5 dark:bg-white/5 border border-white/10 rounded-lg text-neutral-900 dark:text-neutral-100 select-text cursor-text"
                  />
                  <button 
                    class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-all active:scale-95 cursor-pointer shadow-md"
                    onclick={loadGallery}
                  >
                    Load
                  </button>
                </div>
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
      </div>
    </div>
  </div>

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
