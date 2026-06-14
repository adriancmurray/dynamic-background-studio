<script lang="ts">
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
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`
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
      // Vary opacity based on wave layer
      const waveOpacity = opacity * (0.35 + (w / waveCount) * 0.65)
      context.strokeStyle = `rgba(${rgbColor}, ${waveOpacity})`

      const offsetPhase = w * (Math.PI / waveCount) * 1.5
      const waveSpeed = speed * (0.0008 + w * 0.0002)

      let prevX = 0
      let prevY = 0

      for (let i = 0; i < pointsCount; i++) {
        const x = i * step
        
        // Base sine wave calculation
        const angle = x * frequency + now * waveSpeed + offsetPhase
        // Waves staggered vertically
        const baseY = height * 0.2 + (w * (height * 0.6 / waveCount))
        let y = baseY + Math.sin(angle) * amplitude * Math.cos(angle * 0.5)

        // Mouse displacement
        if (interactive && isMousePresent) {
          const dx = x - mouseX
          const dy = y - mouseY
          const dist = Math.hypot(dx, dy)
          const influence = 160
          if (dist < influence) {
            const force = (1 - dist / influence) ** 2
            // Push wave vertically based on mouse location
            y += (dy / dist) * force * 55
          }
        }

        if (i === 0) {
          context.moveTo(x, y)
        } else {
          // Smooth connection via quadratic curves
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
</style>
