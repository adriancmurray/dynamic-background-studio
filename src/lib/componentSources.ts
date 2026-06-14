export const componentSources: Record<string, string> = {
  dotfield: `<script lang="ts">
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

  $effect(() => {
    if (spacing) {
      buildGrid()
      start()
    }
  })

  $effect(() => {
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
</style>`,
  constellation: `<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    particleCount?: number
    particleSize?: number
    linkDistance?: number
    speed?: number
    color?: string
    lineOpacity?: number
    interactive?: boolean
  }

  let {
    particleCount = 80,
    particleSize = 2.0,
    linkDistance = 120,
    speed = 1.0,
    color = '#a855f7',
    lineOpacity = 0.25,
    interactive = true,
  }: Props = $props()

  type Particle = {
    x: number
    y: number
    vx: number
    vy: number
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

  function initParticles() {
    if (!width || !height) return
    particles = []
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
      })
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
    initParticles()
    draw()
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
    if (isNaN(num)) return '168, 85, 247'
    return \`\${(num >> 16) & 255}, \${(num >> 8) & 255}, \${num & 255}\`
  }

  function draw() {
    if (!context || !width || !height) return

    context.clearRect(0, 0, width, height)

    const rgbColor = getRgb(color)
    context.fillStyle = \`rgb(\${rgbColor})\`

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]

      if (!reducedMotion) {
        p.x += p.vx * speed
        p.y += p.vy * speed

        if (interactive && isMousePresent) {
          const dx = mouseX - p.x
          const dy = mouseY - p.y
          const dist = Math.hypot(dx, dy)
          if (dist < 250) {
            const force = (1 - dist / 250) * 0.18
            p.vx += (dx / dist) * force
            p.vy += (dy / dist) * force
          }
        }

        const maxVelocity = 2.5
        const curSpeed = Math.hypot(p.vx, p.vy)
        if (curSpeed > maxVelocity) {
          p.vx = (p.vx / curSpeed) * maxVelocity
          p.vy = (p.vy / curSpeed) * maxVelocity
        }

        if (p.x < 0) {
          p.x = 0
          p.vx *= -1
        } else if (p.x > width) {
          p.x = width
          p.vx *= -1
        }

        if (p.y < 0) {
          p.y = 0
          p.vy *= -1
        } else if (p.y > height) {
          p.y = height
          p.vy *= -1
        }
      }

      context.beginPath()
      context.arc(p.x, p.y, particleSize, 0, Math.PI * 2)
      context.fill()
    }

    for (let i = 0; i < particles.length; i++) {
      const pi = particles[i]

      if (interactive && isMousePresent) {
        const dx = mouseX - pi.x
        const dy = mouseY - pi.y
        const dist = Math.hypot(dx, dy)
        if (dist < linkDistance) {
          const alpha = (1 - dist / linkDistance) * lineOpacity * 1.5
          context.strokeStyle = \`rgba(\${rgbColor}, \${Math.min(0.9, alpha)})\`
          context.lineWidth = 1.0
          context.beginPath()
          context.moveTo(pi.x, pi.y)
          context.lineTo(mouseX, mouseY)
          context.stroke()
        }
      }

      for (let j = i + 1; j < particles.length; j++) {
        const pj = particles[j]
        const dx = pi.x - pj.x
        const dy = pi.y - pj.y
        const dist = Math.hypot(dx, dy)

        if (dist < linkDistance) {
          const alpha = (1 - dist / linkDistance) * lineOpacity
          context.strokeStyle = \`rgba(\${rgbColor}, \${alpha})\`
          context.lineWidth = 0.75
          context.beginPath()
          context.moveTo(pi.x, pi.y)
          context.lineTo(pj.x, pj.y)
          context.stroke()
        }
      }
    }
  }

  function frame() {
    draw()
    animationFrame = requestAnimationFrame(frame)
  }

  $effect(() => {
    if (particleCount && width && height) {
      if (particles.length < particleCount) {
        while (particles.length < particleCount) {
          particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
          })
        }
      } else if (particles.length > particleCount) {
        particles = particles.slice(0, particleCount)
      }
    }
  })

  onMount(() => {
    context = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    canvas.addEventListener('pointerleave', handlePointerLeave, { passive: true })

    resize()
    frame()

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', handlePointerMove)
      canvas?.removeEventListener('pointerleave', handlePointerLeave)
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  })
</script>

<canvas bind:this={canvas} class="constellation-canvas" aria-hidden="true"></canvas>

<style>
  .constellation-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  }
</style>`,
  flowfield: `<script lang="ts">
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

  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    let cleanHex = hex.replace('#', '')
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(char => char + char).join('')
    }
    const num = parseInt(cleanHex, 16)
    if (isNaN(num)) return { r: 99, g: 102, b: 241 }
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
    return \`rgb(\${r}, \${g}, \${b})\`
  }

  function createParticle(): Particle {
    const rx = Math.random() * width
    const ry = Math.random() * height
    const life = 50 + Math.random() * 100
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
    
    detectTheme()
    context.fillStyle = isDark ? '#000000' : '#f5f5f7'
    context.fillRect(0, 0, width, height)

    initParticles()
  }

  function detectTheme() {
    if (!canvas) return
    const htmlTheme = document.documentElement.dataset.theme
    if (htmlTheme) {
      isDark = htmlTheme === 'dark'
    } else {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
  }

  function draw() {
    if (!context || !width || !height) return

    detectTheme()
    const fadeColor = isDark ? \`rgba(0, 0, 0, \${trailFade})\` : \`rgba(245, 245, 247, \${trailFade})\`
    context.fillStyle = fadeColor
    context.fillRect(0, 0, width, height)

    context.lineWidth = lineWidth
    context.lineCap = 'round'

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]

      p.oldX = p.x
      p.oldY = p.y

      const angle = fbm(p.x * noiseScale, p.y * noiseScale) * Math.PI * 4
      
      p.x += Math.cos(angle) * speed
      p.y += Math.sin(angle) * speed
      p.life--

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
</style>`,
  aurora: `<script lang="ts">
  interface Props {
    blobCount?: number
    blur?: number
    speed?: number
    opacity?: number
    color1?: string
    color2?: string
    color3?: string
    color4?: string
    color5?: string
    color6?: string
  }

  let {
    blobCount = 4,
    blur = 80,
    speed = 20,
    opacity = 0.5,
    color1 = '#a855f7',
    color2 = '#0ea5e9',
    color3 = '#10b981',
    color4 = '#f43f5e',
    color5 = '#eab308',
    color6 = '#f97316',
  }: Props = $props()

  let colors = $derived([
    color1,
    color2,
    color3,
    color4,
    color5,
    color6
  ].slice(0, Math.max(2, Math.min(6, blobCount))))
</script>

<div 
  class="aurora-wrapper" 
  style="--aurora-blur: {blur}px; --aurora-opacity: {opacity};"
  aria-hidden="true"
>
  <div class="aurora-container">
    {#each colors as color, index}
      <div 
        class="aurora-blob blob-{index + 1}" 
        style="
          --blob-color: {color};
          --blob-speed: {speed + index * 4}s;
          --blob-delay: {index * -2.5}s;
        "
      ></div>
    {/each}
  </div>
</div>

<style>
  .aurora-wrapper {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    z-index: 0;
    pointer-events: none;
    opacity: var(--aurora-opacity);
    transition: opacity 0.5s ease;
  }

  .aurora-container {
    position: relative;
    width: 100%;
    height: 100%;
    filter: blur(var(--aurora-blur));
    transform: translate3d(0, 0, 0);
  }

  .aurora-blob {
    position: absolute;
    background: var(--blob-color);
    border-radius: 50%;
    mix-blend-mode: screen;
    opacity: 0.75;
    animation: move-blob var(--blob-speed) infinite ease-in-out var(--blob-delay);
    transition: background-color 0.8s ease;
  }

  .blob-1 {
    width: 55vw;
    height: 55vw;
    top: -10%;
    left: -10%;
    animation-name: move-blob-1;
  }

  .blob-2 {
    width: 50vw;
    height: 50vw;
    bottom: -15%;
    right: -10%;
    animation-name: move-blob-2;
  }

  .blob-3 {
    width: 45vw;
    height: 45vw;
    top: 30%;
    left: 40%;
    animation-name: move-blob-3;
  }

  .blob-4 {
    width: 48vw;
    height: 48vw;
    bottom: 20%;
    left: -15%;
    animation-name: move-blob-4;
  }

  .blob-5 {
    width: 40vw;
    height: 40vw;
    top: -20%;
    right: 15%;
    animation-name: move-blob-5;
  }

  .blob-6 {
    width: 38vw;
    height: 38vw;
    bottom: -10%;
    left: 30%;
    animation-name: move-blob-6;
  }

  :global(html[data-theme="light"]) .aurora-blob {
    mix-blend-mode: multiply;
    opacity: 0.28;
  }

  @keyframes move-blob-1 {
    0% { transform: translate(0px, 0px) scale(1); }
    33% { transform: translate(15vw, -10vh) scale(1.15); }
    66% { transform: translate(-10vw, 15vh) scale(0.9); }
    100% { transform: translate(0px, 0px) scale(1); }
  }

  @keyframes move-blob-2 {
    0% { transform: translate(0px, 0px) scale(1); }
    50% { transform: translate(-20vw, 12vh) scale(1.2); }
    100% { transform: translate(0px, 0px) scale(1); }
  }

  @keyframes move-blob-3 {
    0% { transform: translate(0px, 0px) scale(1); }
    33% { transform: translate(-12vw, -15vh) scale(0.85); }
    66% { transform: translate(18vw, 8vh) scale(1.1); }
    100% { transform: translate(0px, 0px) scale(1); }
  }

  @keyframes move-blob-4 {
    0% { transform: translate(0px, 0px) scale(1); }
    50% { transform: translate(15vw, 15vh) scale(0.95); }
    100% { transform: translate(0px, 0px) scale(1); }
  }

  @keyframes move-blob-5 {
    0% { transform: translate(0px, 0px) scale(1); }
    33% { transform: translate(-18vw, 10vh) scale(1.1); }
    66% { transform: translate(10vw, -12vh) scale(0.85); }
    100% { transform: translate(0px, 0px) scale(1); }
  }

  @keyframes move-blob-6 {
    0% { transform: translate(0px, 0px) scale(1); }
    50% { transform: translate(12vw, -18vh) scale(1.15); }
    100% { transform: translate(0px, 0px) scale(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .aurora-blob {
      animation: none !important;
    }
  }
</style>`,
  jellyfish: `<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    waveCount?: number
    lineThickness?: number
    speed?: number
    frequency?: number
    amplitude?: number
    color?: string
    opacity?: number
    interactive?: boolean
  }

  let {
    waveCount = 6,
    lineThickness = 2.0,
    speed = 1.0,
    frequency = 0.003,
    amplitude = 45,
    color = '#60a5fa',
    opacity = 0.35,
    interactive = true,
  }: Props = $props()

  let canvas: HTMLCanvasElement
  let context: CanvasRenderingContext2D
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
    if (isNaN(num)) return '96, 165, 250'
    return \`\${(num >> 16) & 255}, \${(num >> 8) & 255}, \${num & 255}\`
  }

  function draw(now: number) {
    if (!context || !width || !height) return

    context.clearRect(0, 0, width, height)

    const rgbColor = getRgb(color)
    const pointsCount = 45
    const step = width / (pointsCount - 1)

    for (let w = 0; w < waveCount; w++) {
      context.beginPath()
      context.lineWidth = lineThickness
      const waveOpacity = opacity * (0.35 + (w / waveCount) * 0.65)
      context.strokeStyle = \`rgba(\${rgbColor}, \${waveOpacity})\`

      const offsetPhase = w * (Math.PI / waveCount) * 1.5
      const waveSpeed = speed * (0.0008 + w * 0.0002)

      let prevX = 0
      let prevY = 0

      for (let i = 0; i < pointsCount; i++) {
        const x = i * step
        
        const angle = x * frequency + now * waveSpeed + offsetPhase
        const baseY = height * 0.2 + (w * (height * 0.6 / waveCount))
        let y = baseY + Math.sin(angle) * amplitude * Math.cos(angle * 0.5)

        if (interactive && isMousePresent) {
          const dx = x - mouseX
          const dy = y - mouseY
          const dist = Math.hypot(dx, dy)
          const influence = 160
          if (dist < influence) {
            const force = (1 - dist / influence) ** 2
            y += (dy / dist) * force * 55
          }
        }

        if (i === 0) {
          context.moveTo(x, y)
        } else {
          const xc = (x + prevX) / 2
          const yc = (y + prevY) / 2
          context.quadraticCurveTo(prevX, prevY, xc, yc)
        }

        prevX = x
        prevY = y
      }

      context.lineTo(prevX, prevY)
      context.stroke()
    }
  }

  function frame(now: number) {
    draw(now)
    animationFrame = requestAnimationFrame(frame)
  }

  onMount(() => {
    context = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    canvas.addEventListener('pointerleave', handlePointerLeave, { passive: true })

    resize()
    animationFrame = requestAnimationFrame(frame)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', handlePointerMove)
      canvas?.removeEventListener('pointerleave', handlePointerLeave)
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  })
</script>

<canvas bind:this={canvas} class="jellyfish-canvas" aria-hidden="true"></canvas>

<style>
  .jellyfish-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  }
</style>`,
  matrix: `<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    speed?: number
    fontSize?: number
    trailFade?: number
    color?: string
    customText?: string
    density?: number
    interactive?: boolean
  }

  let {
    speed = 1.2,
    fontSize = 14,
    trailFade = 0.06,
    color = '#10b981',
    customText = '01',
    density = 0.85,
    interactive = true,
  }: Props = $props()

  let canvas: HTMLCanvasElement
  let context: CanvasRenderingContext2D
  let animationFrame = 0
  let width = 0
  let height = 0
  let pixelRatio = 1
  let columns: number[] = []
  let columnSpeeds: number[] = []
  let isMousePresent = false
  let mouseX = 0
  let mouseY = 0
  let reducedMotion = false

  function initRain() {
    if (!width || !height) return
    const colCount = Math.floor(width / fontSize)
    columns = []
    columnSpeeds = []
    for (let i = 0; i < colCount; i++) {
      columns.push(Math.random() * -100 - 20)
      columnSpeeds.push((0.5 + Math.random() * 0.8) * speed)
    }
  }

  function resize() {
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    width = rect.width
    height = rect.height
    pixelRatio = 1
    canvas.width = width
    canvas.height = height
    initRain()
    context.fillStyle = '#000000'
    context.fillRect(0, 0, width, height)
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

  function draw() {
    if (!context || !width || !height) return

    context.fillStyle = \`rgba(0, 0, 0, \${trailFade})\`
    context.fillRect(0, 0, width, height)

    context.fillStyle = color
    context.font = \`\${fontSize}px monospace\`

    const charSource = customText.trim() || '01'

    for (let i = 0; i < columns.length; i++) {
      if (Math.sin(i * 0.15) > density) continue

      const x = i * fontSize
      let y = columns[i] * fontSize

      const charIndex = Math.floor(Math.random() * charSource.length)
      const char = charSource.charAt(charIndex)

      if (y > 0) {
        if (Math.random() > 0.96) {
          context.fillStyle = '#ffffff'
        } else {
          context.fillStyle = color
        }
        context.fillText(char, x, y)
      }

      let localSpeed = columnSpeeds[i]

      if (interactive && isMousePresent) {
        const dx = x - mouseX
        const dy = y - mouseY
        const dist = Math.hypot(dx, dy)
        if (dist < 120) {
          localSpeed *= (dist / 120)
        }
      }

      if (!reducedMotion) {
        columns[i] += localSpeed
      }

      if (y > height && Math.random() > 0.975) {
        columns[i] = 0
      }
    }
  }

  function frame() {
    draw()
    animationFrame = requestAnimationFrame(frame)
  }

  $effect(() => {
    if (fontSize && width && height) {
      initRain()
    }
  })

  onMount(() => {
    context = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    canvas.addEventListener('pointerleave', handlePointerLeave, { passive: true })

    resize()
    frame()

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', handlePointerMove)
      canvas?.removeEventListener('pointerleave', handlePointerLeave)
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  })
</script>

<canvas bind:this={canvas} class="matrix-canvas" aria-hidden="true"></canvas>

<style>
  .matrix-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  }
</style>`,
  nebula: `<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    starCount?: number
    orbitRadius?: number
    rotateSpeed?: number
    starSize?: number
    starColor?: string
    coreColor?: string
    tailLength?: number
  }

  let {
    starCount = 120,
    orbitRadius = 160,
    rotateSpeed = 1.0,
    starSize = 1.8,
    starColor = '#f472b6',
    coreColor = '#38bdf8',
    tailLength = 0.08,
  }: Props = $props()

  type Star = {
    angle: number
    radius: number
    speed: number
    size: number
    phase: number
  }

  let canvas: HTMLCanvasElement
  let context: CanvasRenderingContext2D
  let animationFrame = 0
  let width = 0
  let height = 0
  let pixelRatio = 1
  let stars: Star[] = []
  
  let targetX = 0
  let targetY = 0
  let centerX = 0
  let centerY = 0
  let isMousePresent = false
  let reducedMotion = false

  function initStars() {
    if (!width || !height) return
    stars = []
    centerX = width / 2
    centerY = height / 2
    targetX = centerX
    targetY = centerY

    for (let i = 0; i < starCount; i++) {
      const distRatio = Math.sqrt(Math.random())
      stars.push({
        angle: Math.random() * Math.PI * 2,
        radius: 10 + distRatio * orbitRadius * 1.5,
        speed: (0.005 + Math.random() * 0.015) * rotateSpeed * (distRatio < 0.2 ? 1.5 : 0.75),
        size: starSize * (0.4 + Math.random() * 0.9),
        phase: Math.random() * Math.PI * 2,
      })
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
    initStars()
  }

  function handlePointerMove(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    targetX = event.clientX - rect.left
    targetY = event.clientY - rect.top
    isMousePresent = true
  }

  function handlePointerLeave() {
    isMousePresent = false
    targetX = width / 2
    targetY = height / 2
  }

  function hexToRgb(hex: string): string {
    let cleanHex = hex.replace('#', '')
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(char => char + char).join('')
    }
    const num = parseInt(cleanHex, 16)
    if (isNaN(num)) return '244, 114, 182'
    return \`\${(num >> 16) & 255}, \${(num >> 8) & 255}, \${num & 255}\`
  }

  function draw(now: number) {
    if (!context || !width || !height) return

    const htmlTheme = document.documentElement.dataset.theme
    const isDark = htmlTheme === 'dark' || (htmlTheme === undefined && window.matchMedia('(prefers-color-scheme: dark)').matches)
    
    const fadeColor = isDark ? \`rgba(0, 0, 0, \${tailLength})\` : \`rgba(245, 245, 247, \${tailLength})\`
    context.fillStyle = fadeColor
    context.fillRect(0, 0, width, height)

    centerX += (targetX - centerX) * 0.08
    centerY += (targetY - centerY) * 0.08

    const rgbStar = hexToRgb(starColor)
    const rgbCore = hexToRgb(coreColor)

    const gasRadius = orbitRadius * 0.8
    const gradient = context.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, gasRadius
    )
    gradient.addColorStop(0, \`rgba(\${rgbCore}, 0.2)\`)
    gradient.addColorStop(0.5, \`rgba(\${rgbStar}, 0.08)\`)
    gradient.addColorStop(1, \`rgba(0, 0, 0, 0)\`)
    
    context.fillStyle = gradient
    context.beginPath()
    context.arc(centerX, centerY, gasRadius, 0, Math.PI * 2)
    context.fill()

    for (const star of stars) {
      if (!reducedMotion) {
        star.angle += star.speed
      }

      const sx = centerX + Math.cos(star.angle) * star.radius
      const sy = centerY + Math.sin(star.angle) * star.radius

      const twinkle = 0.5 + Math.sin(now * 0.003 + star.phase) * 0.5
      const sizeMod = star.size * (0.8 + twinkle * 0.4)

      const coreMix = Math.max(0, 1 - star.radius / (orbitRadius * 1.2))
      context.fillStyle = coreMix > 0.4
        ? \`rgba(\${rgbCore}, \${0.35 + twinkle * 0.6})\`
        : \`rgba(\${rgbStar}, \${0.35 + twinkle * 0.6})\`

      context.beginPath()
      context.arc(sx, sy, sizeMod, 0, Math.PI * 2)
      context.fill()
    }
  }

  function frame(now: number) {
    draw(now)
    animationFrame = requestAnimationFrame(frame)
  }

  $effect(() => {
    if (starCount && width && height) {
      initStars()
    }
  })

  onMount(() => {
    context = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    canvas.addEventListener('pointerleave', handlePointerLeave, { passive: true })

    resize()
    animationFrame = requestAnimationFrame(frame)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', handlePointerMove)
      canvas?.removeEventListener('pointerleave', handlePointerLeave)
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  })
</script>

<canvas bind:this={canvas} class="nebula-canvas" aria-hidden="true"></canvas>

<style>
  .nebula-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  }
</style>`,
  hexgrid: `<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    cellSize?: number
    gapSize?: number
    rippleSpeed?: number
    color?: string
    bgColor?: string
    opacity?: number
    interactive?: boolean
  }

  let {
    cellSize = 32,
    gapSize = 3.0,
    rippleSpeed = 0.35,
    color = '#f59e0b',
    bgColor = '#27272a',
    opacity = 0.2,
    interactive = true,
  }: Props = $props()

  type Ripple = {
    x: number
    y: number
    born: number
    force: number
  }

  let canvas: HTMLCanvasElement
  let context: CanvasRenderingContext2D
  let animationFrame = 0
  let width = 0
  let height = 0
  let pixelRatio = 1
  let ripples: Ripple[] = []
  let mouseX = -9999
  let mouseY = -9999
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
  }

  function addRipple(x: number, y: number, force = 1) {
    if (reducedMotion || !canvas) return
    ripples.push({
      x,
      y,
      born: performance.now(),
      force,
    })
    if (ripples.length > 5) {
      ripples = ripples.slice(-5)
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
    mouseX = -9999
    mouseY = -9999
  }

  function handlePointerDown(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    addRipple(x, y, 1.8)
  }

  function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i
      const sx = x + Math.cos(angle) * r
      const sy = y + Math.sin(angle) * r
      if (i === 0) ctx.moveTo(sx, sy)
      else ctx.lineTo(sx, sy)
    }
    ctx.closePath()
  }

  function getRgb(hexColor: string): string {
    let hex = hexColor.replace('#', '')
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('')
    }
    const num = parseInt(hex, 16)
    if (isNaN(num)) return '245, 158, 11'
    return \`\${(num >> 16) & 255}, \dots\${(num >> 8) & 255}, \${num & 255}\`
  }

  function draw(now: number) {
    if (!context || !width || !height) return

    context.clearRect(0, 0, width, height)

    const rgbColor = getRgb(color)
    const rgbBg = getRgb(bgColor)

    const w = cellSize * 2
    const h = Math.sqrt(3) * cellSize
    const xStep = w * 0.75 + gapSize
    const yStep = h + gapSize

    const cols = Math.ceil(width / xStep) + 1
    const rows = Math.ceil(height / yStep) + 1

    for (let col = 0; col < cols; col++) {
      const xOffset = col * xStep
      const yStagger = (col % 2) * (yStep / 2)

      for (let row = 0; row < rows; row++) {
        const x = xOffset
        const y = row * yStep + yStagger

        let energy = 0
        for (const ripple of ripples) {
          const age = now - ripple.born
          const radius = age * rippleSpeed
          const dx = x - ripple.x
          const dy = y - ripple.y
          const dist = Math.hypot(dx, dy)
          
          const bandWidth = 80
          const band = Math.exp(-Math.abs(dist - radius) / bandWidth)
          const decay = Math.max(0, 1 - age / 1800)
          
          energy += band * decay * ripple.force
        }

        let hoverEnergy = 0
        if (isMousePresent && interactive) {
          const dx = x - mouseX
          const dy = y - mouseY
          const dist = Math.hypot(dx, dy)
          if (dist < 150) {
            hoverEnergy = (1 - dist / 150) ** 1.8
          }
        }

        const totalEnergy = hoverEnergy * 0.75 + energy * 1.5
        const hexSize = cellSize - gapSize / 2

        if (totalEnergy > 0.05) {
          const cellAlpha = opacity * 0.3 + Math.min(0.85, totalEnergy * 0.72)
          context.fillStyle = \`rgba(\${rgbColor}, \${cellAlpha})\`
          context.strokeStyle = \`rgba(\${rgbColor}, \${cellAlpha * 1.25})\`
          drawHexagon(context, x, y, hexSize)
          context.fill()
          context.stroke()
        } else {
          context.fillStyle = \`rgba(\${rgbBg}, \${opacity})\`
          context.strokeStyle = \`rgba(\${rgbBg}, \${opacity * 0.65})\`
          drawHexagon(context, x, y, hexSize)
          context.fill()
          context.stroke()
        }
      }
    }
  }

  function frame(now: number) {
    ripples = ripples.filter(r => now - r.born < 2000)
    draw(now)
    animationFrame = requestAnimationFrame(frame)
  }

  onMount(() => {
    context = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    canvas.addEventListener('pointerleave', handlePointerLeave, { passive: true })
    window.addEventListener('pointerdown', handlePointerDown, { passive: true })

    resize()
    animationFrame = requestAnimationFrame(frame)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', handlePointerMove)
      canvas?.removeEventListener('pointerleave', handlePointerLeave)
      window.removeEventListener('pointerdown', handlePointerDown)
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  })
</script>

<canvas bind:this={canvas} class="hex-canvas" aria-hidden="true"></canvas>

<style>
  .hex-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  }
</style>`,
  fireflies: `<script lang="ts">
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
    return \`\${(num >> 16) & 255}, \${(num >> 8) & 255}, \${num & 255}\`
  }

  function draw() {
    if (!context || !width || !height) return

    context.clearRect(0, 0, width, height)

    const rgbColor = getRgb(color)
    const historyLimit = Math.max(1, Math.floor(trailLength * 60))

    for (let p of particles) {
      p.angle += (Math.random() - 0.5) * 0.3
      
      let targetVx = Math.cos(p.angle) * 0.5 * speed * p.speedMultiplier
      let targetVy = Math.sin(p.angle) * 0.5 * speed * p.speedMultiplier

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

      p.vx += (targetVx - p.vx) * 0.08
      p.vy += (targetVy - p.vy) * 0.08

      if (!reducedMotion) {
        p.x += p.vx
        p.y += p.vy
      }

      if (p.x < -20) p.x = width + 20
      else if (p.x > width + 20) p.x = -20
      if (p.y < -20) p.y = height + 20
      else if (p.y > height + 20) p.y = -20

      p.alpha += (Math.random() - 0.5) * 0.06
      p.alpha = Math.max(0.1, Math.min(1.0, p.alpha))

      if (!reducedMotion) {
        p.history.push({ x: p.x, y: p.y })
        if (p.history.length > historyLimit) {
          p.history.shift()
        }
      } else {
        p.history = []
      }

      for (let i = 0; i < p.history.length; i++) {
        const pt = p.history[i]
        const ratio = i / p.history.length
        const trailAlpha = p.alpha * ratio * 0.25
        context.beginPath()
        context.arc(pt.x, pt.y, p.size * (0.6 + ratio * 0.4), 0, Math.PI * 2)
        context.fillStyle = \`rgba(\${rgbColor}, \${trailAlpha})\`
        context.fill()
      }

      const gradient = context.createRadialGradient(
        p.x, p.y, 0,
        p.x, p.y, p.size + glowRadius
      )
      gradient.addColorStop(0, \`rgba(\${rgbColor}, \${p.alpha})\`)
      gradient.addColorStop(0.3, \`rgba(\${rgbColor}, \${p.alpha * 0.4})\`)
      gradient.addColorStop(1, \`rgba(\${rgbColor}, 0)\`)

      context.beginPath()
      context.arc(p.x, p.y, p.size + glowRadius, 0, Math.PI * 2)
      context.fillStyle = gradient
      context.fill()

      context.beginPath()
      context.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2)
      context.fillStyle = \`rgba(255, 255, 255, \${p.alpha * 0.95})\`
      context.fill()
    }

    animationFrame = requestAnimationFrame(draw)
  }

  $effect(() => {
    initParticles()
  })

  onMount(() => {
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
</style>`,
  synthwave: `<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    gridSpeed?: number
    gridColor?: string
    sunColor?: string
    sunSize?: number
    sunY?: number
    perspective?: number
    fogDensity?: number
  }

  let {
    gridSpeed = 2.0,
    gridColor = '#ec4899',
    sunColor = '#f59e0b',
    sunSize = 120,
    sunY = 120,
    perspective = 300,
    fogDensity = 0.4,
  }: Props = $props()

  let canvas: HTMLCanvasElement
  let context: CanvasRenderingContext2D
  let animationFrame = 0
  let width = 0
  let height = 0
  let pixelRatio = 1
  let scrollOffset = 0
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
  }

  function getRgb(hexColor: string): string {
    let hex = hexColor.replace('#', '')
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('')
    }
    const num = parseInt(hex, 16)
    if (isNaN(num)) return '236, 72, 153'
    return \`\${(num >> 16) & 255}, \${(num >> 8) & 255}, \${num & 255}\`
  }

  function draw(time: number) {
    if (!context || !width || !height) return

    context.clearRect(0, 0, width, height)

    const gridRgb = getRgb(gridColor)
    const sunRgb = getRgb(sunColor)

    const horizonY = height * 0.5
    const sunCenterX = width / 2
    const sunCenterY = horizonY - (sunY - 100)
    
    context.save()
    context.beginPath()
    context.arc(sunCenterX, sunCenterY, sunSize, 0, Math.PI * 2)
    context.clip()

    const sunGrad = context.createLinearGradient(
      sunCenterX, sunCenterY - sunSize,
      sunCenterX, sunCenterY + sunSize
    )
    sunGrad.addColorStop(0, \`rgba(\${sunRgb}, 1.0)\`)
    sunGrad.addColorStop(0.5, \`rgba(236, 72, 153, 0.95)\`)
    sunGrad.addColorStop(1.0, \`rgba(\${sunRgb}, 0.2)\`)
    context.fillStyle = sunGrad
    context.fillRect(sunCenterX - sunSize, sunCenterY - sunSize, sunSize * 2, sunSize * 2)

    context.globalCompositeOperation = 'destination-out'
    const barSpacing = 16
    const barHeightMin = 2
    const barHeightMax = 12
    
    for (let sy = sunCenterY - sunSize; sy < sunCenterY + sunSize; sy += barSpacing) {
      if (sy > sunCenterY - sunSize * 0.1) {
        const progress = (sy - (sunCenterY - sunSize * 0.1)) / (sunSize * 1.1)
        const gapH = barHeightMin + progress * (barHeightMax - barHeightMin)
        context.fillRect(sunCenterX - sunSize - 10, sy, sunSize * 2 + 20, gapH)
      }
    }
    context.restore()
    context.globalCompositeOperation = 'source-over'

    if (!reducedMotion) {
      scrollOffset += (gridSpeed * 0.08)
      if (scrollOffset >= 1.0) {
        scrollOffset -= 1.0
      }
    }

    context.lineWidth = 1.5
    context.strokeStyle = \`rgba(\${gridRgb}, 0.65)\`

    const numVertLines = 36
    const vLineSpacing = (width * 2) / numVertLines
    const horizonBuffer = 2

    for (let i = 0; i <= numVertLines; i++) {
      const startX = -width + i * vLineSpacing
      const endX = width / 2 + (startX - width / 2) * 0.05
      
      context.beginPath()
      context.moveTo(startX, height)
      context.lineTo(endX, horizonY + horizonBuffer)
      
      const lineGrad = context.createLinearGradient(endX, horizonY, startX, height)
      lineGrad.addColorStop(0, \`rgba(\${gridRgb}, 0.0)\`)
      lineGrad.addColorStop(0.2, \`rgba(\${gridRgb}, 0.15)\`)
      lineGrad.addColorStop(1.0, \`rgba(\${gridRgb}, 0.7)\`)
      context.strokeStyle = lineGrad
      context.stroke()
    }

    const numHorizLines = 14
    for (let i = 0; i < numHorizLines; i++) {
      const lineProgress = (i + scrollOffset) / numHorizLines
      const scaleZ = Math.pow(lineProgress, 3.2)
      const lineY = horizonY + (height - horizonY) * scaleZ

      context.beginPath()
      context.moveTo(0, lineY)
      context.lineTo(width, lineY)

      const opacity = scaleZ * 0.8
      context.strokeStyle = \`rgba(\${gridRgb}, \${opacity})\`
      context.stroke()
    }

    const fogGrad = context.createLinearGradient(width / 2, horizonY, width / 2, height)
    fogGrad.addColorStop(0, \`rgba(\${gridRgb}, \${fogDensity})\`)
    fogGrad.addColorStop(0.15, \`rgba(\${gridRgb}, \${fogDensity * 0.4})\`)
    fogGrad.addColorStop(0.7, \`rgba(\${gridRgb}, 0.0)\`)
    
    context.fillStyle = fogGrad
    context.fillRect(0, horizonY, width, height - horizonY)

    animationFrame = requestAnimationFrame(() => draw(performance.now()))
  }

  onMount(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion = mediaQuery.matches
    const handleMotionChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches
    }
    mediaQuery.addEventListener('change', handleMotionChange)

    resize()
    window.addEventListener('resize', resize)
    animationFrame = requestAnimationFrame(() => draw(performance.now()))

    return () => {
      window.removeEventListener('resize', resize)
      mediaQuery.removeEventListener('change', handleMotionChange)
      cancelAnimationFrame(animationFrame)
    }
  })
</script>

<canvas
  bind:this={canvas}
  class="synthwave-canvas"
  aria-hidden="true"
></canvas>

<style>
  .synthwave-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: block;
    pointer-events: none;
    z-index: 1;
    background: transparent;
  }
</style>`,
  voronoi: `<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    cellCount?: number
    lineWidth?: number
    speed?: number
    lineColor?: string
    bgGradient1?: string
    bgGradient2?: string
    interactive?: boolean
  }

  let {
    cellCount = 35,
    lineWidth = 1.5,
    speed = 0.8,
    lineColor = '#3b82f6',
    bgGradient1 = '#0f172a',
    bgGradient2 = '#1e1b4b',
    interactive = true,
  }: Props = $props()

  type Point = {
    x: number
    y: number
    vx: number
    vy: number
  }

  type Vertex = { x: number; y: number }

  let canvas: HTMLCanvasElement
  let context: CanvasRenderingContext2D
  let animationFrame = 0
  let points: Point[] = []
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
    initPoints()
  }

  function initPoints() {
    if (!width || !height) return
    points = []
    for (let i = 0; i < cellCount; i++) {
      points.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * speed * 0.8,
        vy: (Math.random() - 0.5) * speed * 0.8,
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

  function clipPolygon(poly: Vertex[], p1: Point, p2: Point): Vertex[] {
    const clipped: Vertex[] = []
    if (poly.length === 0) return clipped

    const mx = (p1.x + p2.x) / 2
    const my = (p1.y + p2.y) / 2
    const nx = p2.x - p1.x
    const ny = p2.y - p1.y

    const isInside = (pt: Vertex) => {
      return (pt.x - mx) * nx + (pt.y - my) * ny < 0
    }

    const getIntersection = (s: Vertex, e: Vertex): Vertex => {
      const dx = e.x - s.x
      const dy = e.y - s.y
      const denominator = dx * nx + dy * ny
      if (Math.abs(denominator) < 0.0001) return s
      const t = -((s.x - mx) * nx + (s.y - my) * ny) / denominator
      return {
        x: s.x + t * dx,
        y: s.y + t * dy,
      }
    }

    let s = poly[poly.length - 1]
    for (let i = 0; i < poly.length; i++) {
      const e = poly[i]
      if (isInside(e)) {
        if (!isInside(s)) {
          clipped.push(getIntersection(s, e))
        }
        clipped.push(e)
      } else if (isInside(s)) {
        clipped.push(getIntersection(s, e))
      }
      s = e
    }

    return clipped
  }

  function draw() {
    if (!context || !width || !height) return

    const bgGrad = context.createLinearGradient(0, 0, width, height)
    bgGrad.addColorStop(0, bgGradient1)
    bgGrad.addColorStop(1, bgGradient2)
    context.fillStyle = bgGrad
    context.fillRect(0, 0, width, height)

    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      if (!reducedMotion) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) { p.x = 0; p.vx *= -1; }
        else if (p.x > width) { p.x = width; p.vx *= -1; }
        if (p.y < 0) { p.y = 0; p.vy *= -1; }
        else if (p.y > height) { p.y = height; p.vy *= -1; }
      }

      if (interactive && isMousePresent) {
        const dx = p.x - mouseX
        const dy = p.y - mouseY
        const dist = Math.hypot(dx, dy)
        if (dist < 180) {
          const force = (180 - dist) / 180
          p.x += (dx / dist) * force * 1.5
          p.y += (dy / dist) * force * 1.5
        }
      }
    }

    context.lineWidth = lineWidth
    context.strokeStyle = lineColor

    for (let i = 0; i < points.length; i++) {
      const p1 = points[i]
      let cellPoly: Vertex[] = [
        { x: -10, y: -10 },
        { x: width + 10, y: -10 },
        { x: width + 10, y: height + 10 },
        { x: -10, y: height + 10 },
      ]

      for (let j = 0; j < points.length; j++) {
        if (i === j) continue
        cellPoly = clipPolygon(cellPoly, p1, points[j])
        if (cellPoly.length === 0) break
      }

      if (cellPoly.length > 2) {
        context.beginPath()
        context.moveTo(cellPoly[0].x, cellPoly[0].y)
        for (let k = 1; k < cellPoly.length; k++) {
          context.lineTo(cellPoly[k].x, cellPoly[k].y)
        }
        context.closePath()

        if (interactive && isMousePresent) {
          const dist = Math.hypot(p1.x - mouseX, p1.y - mouseY)
          if (dist < 200) {
            context.fillStyle = \`rgba(255, 255, 255, \${0.08 * (1 - dist / 200)})\`
            context.fill()
          }
        }
        context.stroke()
      }
    }

    animationFrame = requestAnimationFrame(draw)
  }

  $effect(() => {
    initPoints()
  })

  onMount(() => {
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
  class="voronoi-canvas"
  aria-hidden="true"
></canvas>

<style>
  .voronoi-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: block;
    pointer-events: auto;
    z-index: 1;
  }
</style>`,
}
