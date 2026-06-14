<script lang="ts">
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
      const distRatio = Math.sqrt(Math.random()) // Denser towards core
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

  // Helper to parse colors
  function hexToRgb(hex: string): string {
    let cleanHex = hex.replace('#', '')
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(char => char + char).join('')
    }
    const num = parseInt(cleanHex, 16)
    if (isNaN(num)) return '244, 114, 182'
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`
  }

  function draw(now: number) {
    if (!context || !width || !height) return

    // Cosmic trail fade
    const htmlTheme = document.documentElement.dataset.theme
    const isDark = htmlTheme === 'dark' || (htmlTheme === undefined && window.matchMedia('(prefers-color-scheme: dark)').matches)
    
    // Trail fade is inverse of tailLength
    const fadeColor = isDark ? `rgba(0, 0, 0, ${tailLength})` : `rgba(245, 245, 247, ${tailLength})`
    context.fillStyle = fadeColor
    context.fillRect(0, 0, width, height)

    // Smoothly ease gravity core center to target
    centerX += (targetX - centerX) * 0.08
    centerY += (targetY - centerY) * 0.08

    const rgbStar = hexToRgb(starColor)
    const rgbCore = hexToRgb(coreColor)

    // Draw glowing nebula gas at center
    const gasRadius = orbitRadius * 0.8
    const gradient = context.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, gasRadius
    )
    gradient.addColorStop(0, `rgba(${rgbCore}, 0.2)`)
    gradient.addColorStop(0.5, `rgba(${rgbStar}, 0.08)`)
    gradient.addColorStop(1, `rgba(0, 0, 0, 0)`)
    
    context.fillStyle = gradient
    context.beginPath()
    context.arc(centerX, centerY, gasRadius, 0, Math.PI * 2)
    context.fill()

    // Draw stars
    for (const star of stars) {
      if (!reducedMotion) {
        star.angle += star.speed
      }

      // Orbital positions
      const sx = centerX + Math.cos(star.angle) * star.radius
      const sy = centerY + Math.sin(star.angle) * star.radius

      // Twinkle brightness modulation
      const twinkle = 0.5 + Math.sin(now * 0.003 + star.phase) * 0.5
      const sizeMod = star.size * (0.8 + twinkle * 0.4)

      // Vary color from core to outer stars
      const coreMix = Math.max(0, 1 - star.radius / (orbitRadius * 1.2))
      context.fillStyle = coreMix > 0.4
        ? `rgba(${rgbCore}, ${0.35 + twinkle * 0.6})`
        : `rgba(${rgbStar}, ${0.35 + twinkle * 0.6})`

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
</style>
