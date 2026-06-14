<script lang="ts">
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
      // Stagger start coordinates
      columns.push(Math.random() * -100 - 20)
      columnSpeeds.push((0.5 + Math.random() * 0.8) * speed)
    }
  }

  function resize() {
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    width = rect.width
    height = rect.height
    // Cap pixel ratio at 1 for retro matrix text to preserve font sharpness and performance
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

    // Draw fading background
    context.fillStyle = `rgba(0, 0, 0, ${trailFade})`
    context.fillRect(0, 0, width, height)

    context.fillStyle = color
    context.font = `${fontSize}px monospace`

    const charSource = customText.trim() || '01'

    for (let i = 0; i < columns.length; i++) {
      // Check column density
      if (Math.sin(i * 0.15) > density) continue

      const x = i * fontSize
      let y = columns[i] * fontSize

      // Generate a random character from source
      const charIndex = Math.floor(Math.random() * charSource.length)
      const char = charSource.charAt(charIndex)

      // Draw character
      if (y > 0) {
        // Glowing white head for the leading drop character
        if (Math.random() > 0.96) {
          context.fillStyle = '#ffffff'
        } else {
          context.fillStyle = color
        }
        context.fillText(char, x, y)
      }

      // Physics update
      let localSpeed = columnSpeeds[i]

      // Interactive: cursor creates friction/heat, slowing or pushing drops away
      if (interactive && isMousePresent) {
        const dx = x - mouseX
        const dy = y - mouseY
        const dist = Math.hypot(dx, dy)
        if (dist < 120) {
          // Slow down falling columns inside mouse radius
          localSpeed *= (dist / 120)
        }
      }

      if (!reducedMotion) {
        columns[i] += localSpeed
      }

      // Reset when drop reaches bottom
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
    // Re-initialize columns if font size changes
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
</style>
