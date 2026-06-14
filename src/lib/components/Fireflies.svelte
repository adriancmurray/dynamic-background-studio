<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    particleCount?: number
    particleSize?: number
    glowRadius?: number
    speed?: number
    color?: string
    trailLength?: number
    interactive?: boolean
  }

  let {
    particleCount = 60,
    particleSize = 3.0,
    glowRadius = 8,
    speed = 1.0,
    color = '#eab308',
    trailLength = 0.15,
    interactive = true,
  }: Props = $props()

  type Particle = {
    x: number
    y: number
    vx: number
    vy: number
    size: number
    alpha: number
    angle: number
    speedMultiplier: number
    history: { x: number; y: number }[]
  }

  let canvas: HTMLCanvasElement
  let context: CanvasRenderingContext2D
  let particles: Particle[] = []
  let animationFrame = 0
  let width = 0
  let height = 0
  let pixelRatio = 1
  let mouseX = 0
  let mouseY = 0
  let isMousePresent = false
  let reducedMotion = false

  function resize() {
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    width = rect.width
    height = rect.height
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.floor(width * pixelRatio))
    canvas.height = Math.max(1, Math.floor(height * pixelRatio))
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    initParticles()
  }

  function initParticles() {
    if (!width || !height) return
    particles = []
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        size: (0.4 + Math.random() * 0.6) * particleSize,
        alpha: 0.2 + Math.random() * 0.8,
        angle: Math.random() * Math.PI * 2,
        speedMultiplier: 0.6 + Math.random() * 0.8,
        history: [],
      })
    }
  }

  function handlePointerMove(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    mouseX = event.clientX - rect.left
    mouseY = event.clientY - rect.top
    isMousePresent = true
  }

  function handlePointerLeave() {
    isMousePresent = false
  }

  function getRgb(hexColor: string): string {
    let hex = hexColor.replace('#', '')
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('')
    }
    const num = parseInt(hex, 16)
    if (isNaN(num)) return '234, 179, 8'
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`
  }

  function draw() {
    if (!context || !width || !height) return

    context.clearRect(0, 0, width, height)

    const rgbColor = getRgb(color)
    const historyLimit = Math.max(1, Math.floor(trailLength * 60))

    for (let p of particles) {
      // Brownian motion drift (random walk)
      p.angle += (Math.random() - 0.5) * 0.3
      
      let targetVx = Math.cos(p.angle) * 0.5 * speed * p.speedMultiplier
      let targetVy = Math.sin(p.angle) * 0.5 * speed * p.speedMultiplier

      // Pointer interaction (attract)
      if (interactive && isMousePresent) {
        const dx = mouseX - p.x
        const dy = mouseY - p.y
        const dist = Math.hypot(dx, dy)
        if (dist < 250) {
          const force = (250 - dist) / 250
          targetVx += (dx / dist) * force * 0.8 * speed
          targetVy += (dy / dist) * force * 0.8 * speed
        }
      }

      // Smooth interpolation of velocities
      p.vx += (targetVx - p.vx) * 0.08
      p.vy += (targetVy - p.vy) * 0.08

      // Apply velocity
      if (!reducedMotion) {
        p.x += p.vx
        p.y += p.vy
      }

      // Wrap edges
      if (p.x < -20) p.x = width + 20
      else if (p.x > width + 20) p.x = -20
      if (p.y < -20) p.y = height + 20
      else if (p.y > height + 20) p.y = -20

      // Flash/flicker effect
      p.alpha += (Math.random() - 0.5) * 0.06
      p.alpha = Math.max(0.1, Math.min(1.0, p.alpha))

      // Track history coordinates for trails
      if (!reducedMotion) {
        p.history.push({ x: p.x, y: p.y })
        if (p.history.length > historyLimit) {
          p.history.shift()
        }
      } else {
        p.history = []
      }

      // 1. Draw trail
      for (let i = 0; i < p.history.length; i++) {
        const pt = p.history[i]
        const ratio = i / p.history.length
        const trailAlpha = p.alpha * ratio * 0.25
        context.beginPath()
        context.arc(pt.x, pt.y, p.size * (0.6 + ratio * 0.4), 0, Math.PI * 2)
        context.fillStyle = `rgba(${rgbColor}, ${trailAlpha})`
        context.fill()
      }

      // 2. Draw glow core
      const gradient = context.createRadialGradient(
        p.x, p.y, 0,
        p.x, p.y, p.size + glowRadius
      )
      gradient.addColorStop(0, `rgba(${rgbColor}, ${p.alpha})`)
      gradient.addColorStop(0.3, `rgba(${rgbColor}, ${p.alpha * 0.4})`)
      gradient.addColorStop(1, `rgba(${rgbColor}, 0)`)

      context.beginPath()
      context.arc(p.x, p.y, p.size + glowRadius, 0, Math.PI * 2)
      context.fillStyle = gradient
      context.fill()

      // 3. Draw solid core
      context.beginPath()
      context.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2)
      context.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.95})`
      context.fill()
    }

    animationFrame = requestAnimationFrame(draw)
  }

  $effect(() => {
    // Re-initialize particles if count changes
    initParticles()
  })

  onMount(() => {
    context = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D
    // Handle accessibility preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion = mediaQuery.matches
    const handleMotionChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches
    }
    mediaQuery.addEventListener('change', handleMotionChange)

    resize()
    window.addEventListener('resize', resize)
    animationFrame = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      mediaQuery.removeEventListener('change', handleMotionChange)
      cancelAnimationFrame(animationFrame)
    }
  })
</script>

<canvas
  bind:this={canvas}
  onpointermove={handlePointerMove}
  onpointerleave={handlePointerLeave}
  class="fireflies-canvas"
  aria-hidden="true"
></canvas>

<style>
  .fireflies-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: block;
    pointer-events: auto;
    z-index: 1;
    background: transparent;
  }
</style>
