<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    particleCount?: number
    speed?: number
    noiseScale?: number
    trailFade?: number
    lineWidth?: number
    primaryColor?: string
    secondaryColor?: string
  }

  let {
    particleCount = 300,
    speed = 1.5,
    noiseScale = 0.005,
    trailFade = 0.08,
    lineWidth = 1.2,
    primaryColor = '#6366f1',
    secondaryColor = '#ec4899',
  }: Props = $props()

  type Particle = {
    x: number
    y: number
    oldX: number
    oldY: number
    life: number
    maxLife: number
    color: string
  }

  let canvas: HTMLCanvasElement
  let context: CanvasRenderingContext2D
  let particles: Particle[] = []
  let animationFrame = 0
  let width = 0
  let height = 0
  let pixelRatio = 1
  let isDark = true
  let reducedMotion = false

  // --- Inline Noise Engine ---
  function hash2D(x: number, y: number): number {
    const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123
    return h - Math.floor(h)
  }

  function noise2D(x: number, y: number): number {
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const fx = x - ix
    const fy = y - iy

    const ux = fx * fx * (3.0 - 2.0 * fx)
    const uy = fy * fy * (3.0 - 2.0 * fy)

    const a = hash2D(ix, iy)
    const b = hash2D(ix + 1, iy)
    const c = hash2D(ix, iy + 1)
    const d = hash2D(ix + 1, iy + 1)

    return a * (1.0 - ux) * (1.0 - uy) +
           b * ux * (1.0 - uy) +
           c * (1.0 - ux) * uy +
           d * ux * uy
  }

  function fbm(x: number, y: number): number {
    let value = 0.0
    let amplitude = 0.5
    let frequency = 1.0
    for (let i = 0; i < 3; i++) {
      value += amplitude * noise2D(x * frequency, y * frequency)
      amplitude *= 0.5
      frequency *= 2.0
    }
    return value
  }

  // --- Helper to interpolate colors ---
  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    let cleanHex = hex.replace('#', '')
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(char => char + char).join('')
    }
    const num = parseInt(cleanHex, 16)
    if (isNaN(num)) return { r: 99, g: 102, b: 241 } // Default fallback
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    }
  }

  function interpolateColor(colorA: string, colorB: string, percent: number): string {
    const rgbA = hexToRgb(colorA)
    const rgbB = hexToRgb(colorB)
    const r = Math.round(rgbA.r + (rgbB.r - rgbA.r) * percent)
    const g = Math.round(rgbA.g + (rgbB.g - rgbA.g) * percent)
    const b = Math.round(rgbA.b + (rgbB.b - rgbA.b) * percent)
    return `rgb(${r}, ${g}, ${b})`
  }

  function createParticle(): Particle {
    const rx = Math.random() * width
    const ry = Math.random() * height
    const life = 50 + Math.random() * 100
    // Color depends on horizontal position to create a gradient-like wave
    const color = interpolateColor(primaryColor, secondaryColor, rx / width)
    return {
      x: rx,
      y: ry,
      oldX: rx,
      oldY: ry,
      life,
      maxLife: life,
      color,
    }
  }

  function initParticles() {
    if (!width || !height) return
    particles = []
    for (let i = 0; i < particleCount; i++) {
      particles.push(createParticle())
    }
  }

  function resize() {
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    width = rect.width
    height = rect.height
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.floor(width * pixelRatio))
    canvas.height = Math.max(1, Math.floor(height * pixelRatio))
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    
    // Clear canvas to matching background color initially
    detectTheme()
    context.fillStyle = isDark ? '#000000' : '#f5f5f7'
    context.fillRect(0, 0, width, height)

    initParticles()
  }

  function detectTheme() {
    if (!canvas) return
    // Simple attribute or style checker
    const htmlTheme = document.documentElement.dataset.theme
    if (htmlTheme) {
      isDark = htmlTheme === 'dark'
    } else {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
  }

  function draw() {
    if (!context || !width || !height) return

    // Apply trail fade by filling background with high transparency
    detectTheme()
    const fadeColor = isDark ? `rgba(0, 0, 0, ${trailFade})` : `rgba(245, 245, 247, ${trailFade})`
    context.fillStyle = fadeColor
    context.fillRect(0, 0, width, height)

    context.lineWidth = lineWidth
    context.lineCap = 'round'

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]

      p.oldX = p.x
      p.oldY = p.y

      // Get flow direction vector from our noise engine
      const angle = fbm(p.x * noiseScale, p.y * noiseScale) * Math.PI * 4
      
      p.x += Math.cos(angle) * speed
      p.y += Math.sin(angle) * speed
      p.life--

      // Bounding checks
      const isOut = p.x < 0 || p.x > width || p.y < 0 || p.y > height

      if (p.life <= 0 || isOut) {
        particles[i] = createParticle()
      } else {
        context.strokeStyle = p.color
        context.beginPath()
        context.moveTo(p.oldX, p.oldY)
        context.lineTo(p.x, p.y)
        context.stroke()
      }
    }
  }

  function frame() {
    if (!reducedMotion) {
      draw()
    }
    animationFrame = requestAnimationFrame(frame)
  }

  // React to particleCount or color changes
  $effect(() => {
    if (particleCount && width && height) {
      if (particles.length < particleCount) {
        while (particles.length < particleCount) {
          particles.push(createParticle())
        }
      } else if (particles.length > particleCount) {
        particles = particles.slice(0, particleCount)
      }
    }
  })

  onMount(() => {
    context = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    const mutationObserver = new MutationObserver(() => detectTheme())
    mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    resize()
    frame()

    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  })
</script>

<canvas bind:this={canvas} class="flowfield-canvas" aria-hidden="true"></canvas>

<style>
  .flowfield-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  }
</style>
