<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    spacing?: number
    dotSize?: number
    intensity?: number
    pulseEvery?: number
    autoPulse?: boolean
    dotColor?: string
    accentColor?: string
    interaction?: 'repel' | 'attract' | 'none'
  }

  let {
    spacing = 28,
    dotSize = 1.5,
    intensity = 1.2,
    pulseEvery = 2800,
    autoPulse = true,
    dotColor = '#0ea5e9',
    accentColor = '#f59e0b',
    interaction = 'repel',
  }: Props = $props()

  type Point = {
    depth: number
    drift: number
    x: number
    y: number
    phase: number
  }

  type Ripple = {
    x: number
    y: number
    born: number
    force: number
  }

  let canvas: HTMLCanvasElement
  let context: CanvasRenderingContext2D
  let points: Point[] = []
  let ripples: Ripple[] = []
  let animationFrame = 0
  let pulseInterval = 0
  let width = 0
  let height = 0
  let pixelRatio = 1
  let lastMove = 0
  let reducedMotion = false
  let mouseX = 0
  let mouseY = 0
  let isMousePresent = false

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value))
  }

  function smoothstep(edge0: number, edge1: number, value: number) {
    const x = clamp((value - edge0) / (edge1 - edge0), 0, 1)
    return x * x * (3 - 2 * x)
  }

  function hash(seed: number) {
    return Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1
  }

  function buildGrid() {
    if (!width || !height) return
    points = []
    const localSpacing = window.innerWidth < 720 ? Math.max(19, spacing - 6) : spacing
    const cols = Math.ceil(width / localSpacing) + 2
    const rows = Math.ceil(height / localSpacing) + 2

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const seed = row * 97 + col * 53
        points.push({
          depth: 0.18 + hash(seed + 1.7) * 0.82,
          drift: hash(seed + 8.2) * Math.PI * 2,
          x: col * localSpacing - localSpacing,
          y: row * localSpacing - localSpacing,
          phase: ((row * 17 + col * 31) % 100) / 100,
        })
      }
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
    buildGrid()
    draw(performance.now())
  }

  function addLocalRipple(x: number, y: number, force = 1) {
    if (reducedMotion || !canvas) return

    ripples.push({
      x,
      y,
      born: performance.now(),
      force,
    })

    if (ripples.length > 8) {
      ripples = ripples.slice(-8)
    }

    start()
  }

  function addRipple(clientX: number, clientY: number, force = 1) {
    if (reducedMotion || !canvas) return
    const rect = canvas.getBoundingClientRect()
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return
    }

    addLocalRipple(clientX - rect.left, clientY - rect.top, force)
  }

  function addPulseRipple(force = 0.78) {
    if (!width || !height) return
    const now = performance.now()
    const originX = isMousePresent ? mouseX : width / 2
    const originY = isMousePresent ? mouseY : height / 2
    const jitterX = Math.sin(now * 0.00031) * spacing * 0.9
    const jitterY = Math.cos(now * 0.00027) * spacing * 0.6
    addLocalRipple(originX + jitterX, originY + jitterY, force)
  }

  function handlePointerMove(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    mouseX = event.clientX - rect.left
    mouseY = event.clientY - rect.top
    isMousePresent = true

    const now = performance.now()
    if (now - lastMove < 90) return
    lastMove = now
    addRipple(event.clientX, event.clientY, 0.42)
  }

  function handlePointerLeave() {
    isMousePresent = false
  }

  function handlePointerDown(event: PointerEvent) {
    addRipple(event.clientX, event.clientY, 1.2)
  }

  function draw(now: number) {
    if (!context || !width || !height) return

    context.clearRect(0, 0, width, height)
    context.fillStyle = dotColor

    const maxDistance = Math.max(1, Math.sqrt(width * width + height * height) * 0.62)

    for (const point of points) {
      let offsetX = 0
      let offsetY = 0
      let energy = 0
      let depthEnergy = 0

      // Pointer interaction (Attract / Repel)
      if (isMousePresent && interaction !== 'none') {
        const dx = point.x - mouseX
        const dy = point.y - mouseY
        const distance = Math.hypot(dx, dy) || 1
        const maxInfluence = 180

        if (distance < maxInfluence) {
          const power = (1 - distance / maxInfluence) ** 2
          const forceAmount = power * 22 * (0.3 + point.depth * 0.7)
          
          if (interaction === 'repel') {
            offsetX += (dx / distance) * forceAmount
            offsetY += (dy / distance) * forceAmount
          } else if (interaction === 'attract') {
            offsetX -= (dx / distance) * forceAmount
            offsetY -= (dy / distance) * forceAmount
          }
        }
      }

      // Ripple interaction
      for (const ripple of ripples) {
        const age = now - ripple.born
        const radius = age * (0.25 + point.depth * 0.07)
        const dx = point.x - ripple.x
        const dy = point.y - ripple.y
        const distance = Math.sqrt(dx * dx + dy * dy) || 1
        const band = Math.exp(-Math.abs(distance - radius) / (28 + point.depth * 28))
        const decay = Math.max(0, 1 - age / 2100)
        const wave = Math.sin((distance - radius) * 0.055)
        const push = band * decay * ripple.force * intensity
        
        offsetX += (dx / distance) * push * (5 + point.depth * 8)
        offsetY += (dy / distance) * push * (5 + point.depth * 8)
        energy += Math.abs(wave) * push
        depthEnergy += push
      }

      const focalDistance = isMousePresent 
        ? Math.hypot(point.x - mouseX, point.y - mouseY)
        : Math.hypot(point.x - width / 2, point.y - height / 2)
        
      const falloff = 1 - smoothstep(maxDistance * 0.22, maxDistance, focalDistance)
      const edgeFadeX = smoothstep(-spacing, width * 0.16, point.x) * (1 - smoothstep(width * 0.82, width + spacing, point.x))
      const edgeFadeY = smoothstep(-spacing, height * 0.08, point.y) * (1 - smoothstep(height * 0.92, height + spacing, point.y))
      const depthScale = 0.42 + point.depth * 0.9
      const shimmer = 0.56 + Math.sin(now * 0.00042 + point.phase * 6.28 + point.drift) * 0.1
      const breathing = autoPulse && !reducedMotion ? Math.sin(now * 0.00024 + focalDistance * 0.006) * 0.05 : 0
      const size = Math.max(0.45, Math.min(10, (dotSize + point.depth * 0.95 + energy * 1.45) * (0.88 + breathing)))
      const alpha = (0.055 + point.depth * 0.18 + falloff * 0.18 + depthEnergy * 0.5) * edgeFadeX * edgeFadeY
      
      context.globalAlpha = Math.min(0.92, alpha) * shimmer
      context.beginPath()
      context.arc(point.x + offsetX * depthScale, point.y + offsetY * depthScale, size, 0, Math.PI * 2)
      context.fill()

      if (energy > 0.22) {
        context.globalAlpha = Math.min(0.58, energy * 0.35 * (0.6 + point.depth))
        context.fillStyle = accentColor
        context.beginPath()
        context.arc(point.x + offsetX * depthScale, point.y + offsetY * depthScale, size * 1.28, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = dotColor
      }
    }

    context.globalAlpha = 1
  }

  function frame(now: number) {
    ripples = ripples.filter((ripple) => now - ripple.born < 2200)
    draw(now)

    if (ripples.length > 0 || isMousePresent || (autoPulse && !reducedMotion)) {
      animationFrame = requestAnimationFrame(frame)
    } else {
      animationFrame = 0
    }
  }

  function start() {
    if (!animationFrame) {
      animationFrame = requestAnimationFrame(frame)
    }
  }

  // Svelte 5 effects to respond to prop changes
  $effect(() => {
    // Whenever grid size/spacing changes, rebuild the grid
    if (spacing) {
      buildGrid()
      start()
    }
  })

  $effect(() => {
    // Whenever autoPulse settings change, manage timers
    if (pulseInterval) clearInterval(pulseInterval)
    if (autoPulse && !reducedMotion) {
      pulseInterval = setInterval(() => addPulseRipple(), pulseEvery)
    }
  })

  onMount(() => {
    context = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerdown', handlePointerDown, { passive: true })
    canvas.addEventListener('pointerleave', handlePointerLeave, { passive: true })

    resize()

    if (autoPulse && !reducedMotion) {
      setTimeout(() => addPulseRipple(0.96), 420)
      pulseInterval = setInterval(() => addPulseRipple(), pulseEvery)
      start()
    }

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerdown', handlePointerDown)
      canvas?.removeEventListener('pointerleave', handlePointerLeave)
      if (pulseInterval) clearInterval(pulseInterval)
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  })
</script>

<canvas bind:this={canvas} class="dot-field" aria-hidden="true"></canvas>

<style>
  .dot-field {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  }
</style>
