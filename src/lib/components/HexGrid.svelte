<script lang="ts">
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
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`
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
      // Hex grid stagger rows
      const yStagger = (col % 2) * (yStep / 2)

      for (let row = 0; row < rows; row++) {
        const x = xOffset
        const y = row * yStep + yStagger

        let energy = 0
        let ripplePower = 0

        // Calculate ripple wave energy
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
          ripplePower += band * decay
        }

        // Mouse hover energy
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

        // Draw background stroke or fill
        context.lineWidth = 1.0
        
        if (totalEnergy > 0.05) {
          // Glow colored hexagon
          const cellAlpha = opacity * 0.3 + Math.min(0.85, totalEnergy * 0.72)
          context.fillStyle = `rgba(${rgbColor}, ${cellAlpha})`
          context.strokeStyle = `rgba(${rgbColor}, ${cellAlpha * 1.25})`
          drawHexagon(context, x, y, hexSize)
          context.fill()
          context.stroke()
        } else {
          // Idle cell
          context.fillStyle = `rgba(${rgbBg}, ${opacity})`
          context.strokeStyle = `rgba(${rgbBg}, ${opacity * 0.65})`
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
</style>
